// Explicit owner-authorized live check; not part of npm test.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
(async () => {
  if (!process.argv.includes("--send"))
    throw new Error(
      "Use --send only with owner authorization; this sends one real synthetic report.",
    );
  const meta = JSON.parse(
    fs.readFileSync(path.join(root, "test-results/chrome-stable.json")),
  );
  const profile = fs.mkdtempSync(path.join(root, "test-results/live-report-"));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: meta.executable,
    headless: false,
    args: [
      "--headless=new",
      "--disable-extensions-except=" + root,
      "--load-extension=" + root,
    ],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.route("https://example.com/**", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: '<html lang="en"><title>Report delivery fixture</title><body><p>Delivery test</p></body></html>',
      }),
    );
    await page.goto("https://example.com/");
    const report = await context.newPage();
    await report.goto("chrome-extension://" + id + "/report.html");
    const button = report.locator("#send");
    await button.waitFor();
    await report.waitForFunction(
      () => !document.querySelector("#send").disabled,
      {},
      { timeout: 30000 },
    );
    await button.click();
    await report.waitForFunction(
      () =>
        /report sent|saved on this device/i.test(
          document.querySelector("#summary").textContent,
        ),
      {},
      { timeout: 45000 },
    );
    let status = await report.locator("#summary").innerText();
    if (!/report sent/i.test(status)) {
      await worker.evaluate(() => REPORT_DELIVERY.flush());
      status = await report.locator("#summary").innerText();
    }
    await report.screenshot({
      path: path.join(root, "test-results/report-live-receipt.png"),
      fullPage: true,
    });
    const saved = await worker.evaluate(() =>
      chrome.storage.local.get(["reportReceipts", "reportOutbox"]),
    );
    fs.writeFileSync(
      path.join(root, "test-results/extension-collector-live.json"),
      JSON.stringify(
        {
          browser: meta.version,
          status,
          receipts: saved.reportReceipts,
          queued: saved.reportOutbox?.length || 0,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ status, ...saved }, null, 2));
    assert.match(status, /report sent/i);
  } finally {
    await context.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
