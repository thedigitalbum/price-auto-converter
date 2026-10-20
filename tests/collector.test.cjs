const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const root = process.env.SOURCE_DIR || path.join(__dirname, "..");
const repo = path.join(__dirname, "..");
function payload() {
  return {
    schema: "price-auto-converter-report/2",
    id: randomUUID(),
    version: "1.1.1",
    created: new Date().toISOString(),
    browser: "Chrome/155",
    settings: { target: "PHP" },
    rates: { source: "open.er-api.com", updated: Date.now(), count: 166 },
    page: {
      hostname: "www.amazon.com",
      state: "active",
      converted: 158,
      missedPrices: 3,
    },
    events: [],
  };
}
function collector() {
  const props = {
      SHEET_ID: "private-sheet",
      DIGEST_AFTER: String(Date.now() - 86400000),
    },
    rows = [["headers"]],
    mails = [],
    triggers = [];
  let flushFail = false,
    locked = false;
  function range(row, col, height = 1, width = 1) {
    return {
      setNumberFormat() {
        return this;
      },
      setValues(values) {
        values.forEach((r, i) => {
          rows[row - 1 + i] ??= [];
          r.forEach((v, j) => (rows[row - 1 + i][col - 1 + j] = v));
        });
        return this;
      },
      getValue: () => rows[row - 1]?.[col - 1],
      getValues: () =>
        rows
          .slice(row - 1, row - 1 + height)
          .map((r) => r.slice(col - 1, col - 1 + width)),
      setBackground() {
        return this;
      },
      setFontColor() {
        return this;
      },
      setFontWeight() {
        return this;
      },
      createTextFinder(value) {
        return {
          matchEntireCell() {
            return this;
          },
          findNext() {
            const i = rows.findIndex(
              (r, i) =>
                i >= row - 1 && i < row - 1 + height && r[col - 1] === value,
            );
            return i < 0 ? null : { getRow: () => i + 1 };
          },
        };
      },
    };
  }
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 20000,
    getRange: range,
    getSheetName: () => "Reports",
    setName() {},
    setFrozenRows() {},
    setColumnWidth() {},
    deleteRows: (r, n) => rows.splice(r - 1, n),
  };
  const book = {
    getSheetByName: () => sheet,
    getUrl: () => "https://docs.google.com/spreadsheets/d/private-sheet/edit",
    getId: () => "private-sheet",
    getSheets: () => [sheet],
  };
  const context = vm.createContext({
    Date,
    console: { log: () => {} },
    Utilities: {
      newBlob: (text, type, name) => ({
        text,
        type,
        name,
        getBytes: () => Array.from(Buffer.from(text, "utf8")),
      }),
      getUuid: randomUUID,
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({
        text: s,
        setMimeType() {
          return this;
        },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props[k] || null,
        setProperty: (k, v) => (props[k] = v),
        setProperties: (o) => Object.assign(props, o),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }),
    },
    SpreadsheetApp: {
      openById: (id) => {
        assert.equal(id, "private-sheet");
        return book;
      },
      create: () => book,
      flush: () => {
        if (flushFail) throw Error("write failed");
      },
    },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: (m) => mails.push(m),
    },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger: (name) => ({
        timeBased() {
          return this;
        },
        everyDays() {
          return this;
        },
        atHour() {
          return this;
        },
        inTimezone() {
          return this;
        },
        create() {
          triggers.push({ getHandlerFunction: () => name });
        },
      }),
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(root, "report-core.js"), "utf8") +
      "\n" +
      fs.readFileSync(path.join(repo, "collector/Code.gs"), "utf8"),
    context,
  );
  return {
    rows,
    props,
    mails,
    triggers,
    context,
    post: (r) =>
      JSON.parse(
        context.doPost({ postData: { contents: JSON.stringify(r) } }).text,
      ),
    run: (s) => vm.runInContext(s, context),
    failFlush: (v) => (flushFail = v),
    busy: (v) => (locked = v),
  };
}
test("Collector saves private sanitized JSON before acknowledgment and de-duplicates IDs", () => {
  const c = collector(),
    r = payload();
  r.page.url = "https://secret.example/account";
  r.page.priceExamples = ["$671.65"];
  const a = c.post(r),
    b = c.post(r);
  assert.equal(a.ok, true);
  assert.equal(a.receipt, b.receipt);
  assert.equal(c.rows.length, 2);
  assert.ok(!c.rows[1][7].includes("secret.example"));
  assert.ok(!c.rows[1][7].includes("671.65"));
  assert.equal(c.mails.length, 0);
});
test("Invalid, oversized and wrong-schema input cannot create a row", () => {
  const c = collector();
  for (const r of [
    {},
    { ...payload(), schema: "bad" },
    { ...payload(), extra: "x".repeat(25000) },
  ])
    assert.equal(c.post(r).code, "invalid_report");
  assert.equal(c.rows.length, 1);
});
test("Storage failures, missing setup, locks and daily caps never return a receipt", () => {
  const c = collector();
  c.failFlush(true);
  assert.equal(c.post(payload()).code, "unavailable");
  c.failFlush(false);
  c.busy(true);
  assert.equal(c.post(payload()).code, "busy");
  c.busy(false);
  delete c.props.SHEET_ID;
  assert.equal(c.post(payload()).code, "not_ready");
  c.props.SHEET_ID = "private-sheet";
  c.props.BUDGET_DAY = new Date().toISOString().slice(0, 10);
  c.props.BUDGET_USED = "200";
  assert.equal(c.post(payload()).code, "daily_limit");
});
test("Health response exposes neither the spreadsheet URL nor owner credentials", () => {
  const c = collector(),
    s = c.run("doGet().text");
  assert.ok(s.includes("price-auto-converter-reports"));
  assert.ok(!s.includes("private-sheet"));
  assert.ok(!s.includes("gmail.com"));
});
test("Daily digest sends only to the fixed owner with parseable JSON, not per incoming report", () => {
  const c = collector();
  const r = payload();
  r.to = "attacker@example.com";
  c.post(r);
  assert.equal(c.mails.length, 0);
  c.run("sendDailyDigest()");
  assert.equal(c.mails.length, 1);
  assert.equal(c.mails[0].to, "thedigitalbum@gmail.com");
  const reports = JSON.parse(c.mails[0].attachments[0].text);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].page.hostname, "www.amazon.com");
  c.run("sendDailyDigest()");
  assert.equal(c.mails.length, 1);
});
test("Ninety-day retention cleanup removes old rows while preserving the header", () => {
  const c = collector();
  const old = payload();
  c.post(old);
  c.rows[1][0] = new Date(Date.now() - 100 * 86400000).toISOString();
  c.post(payload());
  c.run("sendDailyDigest()");
  assert.equal(c.rows.length, 2);
  assert.equal(c.rows[0][0], "headers");
});
test("Formula-like cells are escaped and receiver code requests no Gmail-read or Drive-wide scope", () => {
  const c = collector();
  assert.equal(c.run("safeCell_('=IMPORTXML(1)')"), "'=IMPORTXML(1)");
  const scopes = JSON.parse(
    fs.readFileSync(path.join(repo, "collector/appsscript.json"), "utf8"),
  ).oauthScopes;
  assert.ok(
    scopes.includes("https://www.googleapis.com/auth/script.send_mail"),
  );
  assert.ok(!scopes.some((s) => /gmail|auth\/drive/.test(s)));
});
test("Shared sanitizer is byte-identical in the extension and deployed-source bundle", () => {
  assert.equal(
    fs.readFileSync(path.join(repo, "collector/ReportCore.gs"), "utf8"),
    fs.readFileSync(path.join(repo, "report-core.js"), "utf8"),
  );
});
