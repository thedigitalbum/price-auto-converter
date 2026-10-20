const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { browserOptions, verifyBrowser } = require("./browser.cjs");
const sourceRoot = process.env.SOURCE_DIR || path.join(__dirname, "..");

test(
  "Extension UI: persistence, rules, reports, privacy, offline and responsive layout",
  { timeout: 60000 },
  async (t) => {
    const dir = path.join(__dirname, "../test-results");
    fs.mkdirSync(dir, { recursive: true });
    // Keep Chromium download artifacts inside the writable test workspace on Windows.
    if (process.platform === "win32") {
      process.env.TEMP = dir;
      process.env.TMP = dir;
    }
    // Same packaged runtime, with only the receiver URL replaced by an isolated HTTP fixture.
    const root = fs.mkdtempSync(path.join(dir, "report-runtime-"));
    const packageFiles = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../scripts/package-files.json"),
        "utf8",
      ),
    );
    for (const file of packageFiles) {
      const dest = path.join(root, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, file), dest);
    }
    fs.writeFileSync(
      path.join(root, "report-config.js"),
      "const REPORT_CONFIG=Object.freeze({endpoint:'https://script.google.com/macros/s/AKfycb_test_collector_123456789/exec'});",
    );
    const context = await chromium.launchPersistentContext(
      fs.mkdtempSync(path.join(dir, "ui-profile-")),
      {
        ...browserOptions(),
        channel: "chromium",
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
        acceptDownloads: true,
        downloadsPath: dir,
        args: [
          ...(browserOptions().args || []),
          `--disable-extensions-except=${root}`,
          `--load-extension=${root}`,
          "--host-resolver-rules=MAP * ~NOTFOUND",
        ],
      },
    );
    t.after(() => context.close());
    await verifyBrowser(context);
    const errors = [];
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    t.after(() => assert.deepEqual(errors, []));
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const base = "chrome-extension://" + new URL(worker.url()).host + "/";
    await worker.evaluate(async () => {
      for (let i = 0; i < 100; i++) {
        if ((await chrome.storage.local.get("rates")).rates) break;
        await new Promise((r) => setTimeout(r, 30));
      }
      await chrome.storage.local.set({
        rates: { USD: 1, PHP: 56, EUR: 0.9, JPY: 150 },
        ratesUpdated: Date.now(),
        ratesSource: "test fixture",
        ratesBundled: false,
      });
      await chrome.storage.sync.set({
        target: "PHP",
        enabled: true,
        excluded: "",
        included: "",
        siteCurrencies: "",
        fxBuffer: 0,
      });
    });
    const shop = await context.newPage();
    await shop.route("https://shop.example/**", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: '<!doctype html><meta name="currency" content="USD"><p class="price" id="p">USD 100</p><p>PRIVATE ACCOUNT TEXT</p>',
      }),
    );
    await shop.goto("https://shop.example/account?private=secret");
    await shop.waitForFunction(() =>
      document.querySelector("#p").textContent.includes("₱"),
    );
    const shopId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((t) => t.active).id;
    });
    const settings = await context.newPage();
    await settings.goto(base + "options.html");
    await settings.waitForFunction(
      () => document.querySelector("#target").value === "PHP",
    );
    await settings.selectOption("#fxBuffer", "2");
    await settings.waitForFunction(() =>
      document.querySelector("#preview").textContent.includes("5,712"),
    );
    assert.equal(
      await worker.evaluate(
        async () => (await chrome.storage.sync.get("fxBuffer")).fxBuffer,
      ),
      2,
    );
    await settings.fill("#excluded", "https://example.com/path");
    await settings.locator("#siteForm button").click();
    await settings.waitForFunction(
      () => document.querySelector("#excluded").value === "example.com",
    );
    // Unsaved site rules survive unrelated automatic saves.
    await settings.fill("#excluded", "draft.example");
    await settings.selectOption("#indicator", "minimal");
    assert.equal(await settings.inputValue("#excluded"), "draft.example");
    await settings.fill("#excluded", "user:password@example.com");
    await settings.locator("#siteForm button").click();
    assert.match(await settings.textContent("#message"), /valid website/);
    assert.equal(
      await worker.evaluate(
        async () => (await chrome.storage.sync.get("excluded")).excluded,
      ),
      "example.com",
    );
    await worker.evaluate(() =>
      chrome.storage.sync.set({
        excluded: "",
        fxBuffer: 0,
        indicator: "standard",
      }),
    );
    const popup = await context.newPage();
    await popup.addInitScript((id) => {
      chrome.tabs.query = async () => [{ id }];
    }, shopId);
    await popup.setViewportSize({ width: 384, height: 760 });
    await popup.goto(base + "popup.html");
    await popup.waitForFunction(
      () => document.querySelector("#stateBadge").textContent === "Active",
    );
    assert.equal(await popup.isEnabled("#siteOn"), true);
    await popup.uncheck("#siteOn");
    await shop.waitForFunction(
      () => document.querySelector("#p").textContent === "USD 100",
    );
    await popup.check("#siteOn");
    await shop.waitForFunction(() =>
      document.querySelector("#p").textContent.includes("₱"),
    );
    await popup.selectOption("#target", "EUR");
    await shop.waitForFunction(() =>
      document.querySelector("#p").textContent.includes("90.00"),
    );
    await popup.selectOption("#target", "PHP");
    // Native keyboard controls and visible focus work without custom key handlers.
    await popup.locator("#target").focus();
    assert.equal(
      await popup.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle,
      ),
      "solid",
    );
    await worker.evaluate(() => {
      const original = fetch;
      self.testReports = [];
      self.fetch = async (url, options) => {
        if (String(url).startsWith("https://script.google.com/macros/s/")) {
          const report = JSON.parse(options.body);
          self.testReports.push(report);
          return new Response(
            JSON.stringify({
              ok: true,
              reportId: report.id,
              receipt: "PAC-20261020-test123456",
            }),
            { status: 200 },
          );
        }
        return original(url, options);
      };
    });
    const report = await context.newPage();
    await report.addInitScript((id) => {
      chrome.tabs.query = async () => [{ id }];
    }, shopId);
    await report.setViewportSize({ width: 384, height: 600 });
    await report.goto(base + "popup.html");
    await report.waitForFunction(
      () => document.querySelector("#stateBadge").textContent === "Active",
    );
    const pageCount = context.pages().length;
    await report.click("#report");
    await report.waitForURL(/report\.html.*view=popup/);
    assert.equal(
      context.pages().length,
      pageCount,
      "report stays in the same popup",
    );
    await report.waitForFunction(
      () => !document.querySelector("#send").disabled,
    );
    const sendBounds = await report.locator("#send").boundingBox();
    assert.ok(
      sendBounds.y + sendBounds.height <= 600,
      "Send is visible inside the popup",
    );
    const data = JSON.parse(await report.inputValue("#preview"));
    assert.equal(data.page.hostname, "shop.example");
    assert.equal(data.page.priceExamples, undefined);
    for (const secret of ["PRIVATE ACCOUNT TEXT", "private=secret", "USD 100"])
      assert.ok(!JSON.stringify(data).includes(secret));
    assert.equal(
      await report.locator("#github,#includeSite,#includeExamples").count(),
      0,
    );
    assert.equal(await report.locator("details").getAttribute("open"), null);
    await report.click("#send");
    await report.waitForFunction(
      () => document.querySelector("#send").textContent === "Sent",
    );
    assert.equal(await report.isDisabled("#send"), true);
    assert.equal(await worker.evaluate(() => self.testReports.length), 1);
    assert.match(await report.textContent("#message"), /Reference: PAC-/);
    await report.locator("summary").click();
    const downloaded = report.waitForEvent("download");
    await report.click("#download");
    const file = await downloaded;
    assert.deepEqual(
      JSON.parse(fs.readFileSync(await file.path(), "utf8")),
      data,
    );
    const beforeDialog = context.pages().length;
    await settings.click("#report");
    await settings.locator(".report-dialog").waitFor({ state: "visible" });
    await settings
      .frameLocator(".report-dialog iframe")
      .locator("#send")
      .waitFor();
    assert.equal(
      context.pages().length,
      beforeDialog,
      "Settings report opens inline",
    );
    await settings.getByRole("button", { name: "Close", exact: true }).click();
    await settings.locator(".report-dialog").waitFor({state:"detached"});
    const unsupported = await context.newPage();
    await unsupported.addInitScript(() => {
      chrome.tabs.query = async () => [{ id: -999 }];
    });
    await unsupported.goto(base + "popup.html");
    await unsupported.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("unavailable"),
    );
    assert.equal(await unsupported.isEnabled("#target"), true);
    assert.equal(await unsupported.isEnabled("#settings"), true);
    assert.equal(await unsupported.isEnabled("#report"), true);
    await worker.evaluate(() =>
      chrome.storage.local.set({
        ratesBundled: true,
        ratesUpdated: Date.now() - 7 * 86400000,
        ratesError: "Refresh failed",
      }),
    );
    await popup.waitForFunction(
      () =>
        document.querySelector("#ratesTitle").textContent ===
        "Built-in estimates",
    );
    assert.match(await popup.textContent("#ratesInfo"), /Last refresh failed/);
    await worker.evaluate(() =>
      chrome.storage.local.set({
        ratesBundled: false,
        ratesUpdated: Date.now(),
        ratesError: null,
      }),
    );
    for (const [page, width] of [
      [settings, 1100],
      [settings, 375],
      [report, 375],
      [popup, 384],
    ]) {
      await page.setViewportSize({ width, height: 850 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "no horizontal overflow at " + width,
      );
    }
    const out = process.env.UI_SCREENSHOTS;
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      await settings.setViewportSize({ width: 1100, height: 900 });
      await settings.fill("#excluded", "");
      await settings.screenshot({
        path: path.join(out, "settings-v1.1.1.png"),
        fullPage: true,
      });
      await popup.setViewportSize({ width: 384, height: 760 });
      await popup.screenshot({
        path: path.join(out, "popup-v1.1.1.png"),
        fullPage: true,
      });
      await report.setViewportSize({ width: 900, height: 900 });
      await report.screenshot({
        path: path.join(out, "report-v1.1.1.png"),
        fullPage: true,
      });
    }
    // Every form control has an explicit accessible label.
    for (const page of [settings, popup, report])
      assert.deepEqual(
        await page
          .locator("input,select,textarea")
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => !n.labels?.length && !n.getAttribute("aria-label"))
              .map((n) => n.id),
          ),
        [],
      );
    const privacy = await context.newPage();
    await privacy.goto(base + "privacy.html");
    for (const page of [settings, popup, report, privacy]) {
      await page.evaluate(
        fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"),
      );
      const results = await page.evaluate(() =>
        axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        }),
      );
      assert.deepEqual(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        page.url(),
      );
    }
    assert.match(
      await privacy.textContent("body"),
      /Nothing is uploaded automatically|No automatic telemetry|automatically/i,
    );
  },
);
