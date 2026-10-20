const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.SOURCE_DIR || path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "report-core.js"), "utf8");
const RC = vm.runInNewContext(core + "\nRC", { Date });
const endpoint =
  "https://script.google.com/macros/s/AKfycb_test_collector_123456789/exec";
function input() {
  return {
    schema: "price-auto-converter-report/1",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    version: "1.1.1",
    created: new Date().toISOString(),
    browser: "Chrome/155",
    settings: { target: "PHP", enabled: true, feePercent: 0 },
    rates: {
      source: "open.er-api.com",
      updated: Date.now(),
      count: 166,
      bundled: false,
    },
    page: {
      hostname: "www.amazon.com",
      state: "active",
      converted: 158,
      sourceCurrency: "USD",
      sourceEvidence: "the page’s data",
      missedPrices: 3,
      evidence: [
        {
          kind: "currency_without_amount",
          tag: "span",
          parent: "div",
          currency: "USD",
          numericPattern: "nnn.nn",
          hasPriceContext: true,
          adjacentNumbers: 1,
        },
      ],
    },
    events: [],
  };
}
function plain(x) {
  return JSON.parse(JSON.stringify(x));
}
test("Automatic report identifies review candidates without claiming a confirmed bug", () => {
  const r = RC.prepare(input());
  assert.equal(r.schema, "price-auto-converter-report/2");
  assert.match(r.summary, /3 price elements need review/);
  assert.ok(
    r.issues.some(
      (i) => i.code === "price_layout_needs_review" && i.severity === "review",
    ),
  );
});
test("Submitted payload removes prices, page prose, URL paths, user details and arbitrary fields", () => {
  const raw = input();
  raw.email = "private@example.com";
  raw.page.url = "https://www.amazon.com/account?token=SECRET";
  raw.page.text = "PRIVATE ACCOUNT";
  raw.page.priceExamples = ["$671.65"];
  raw.page.evidence.push({
    kind: "currency_without_amount",
    tag: "script",
    parent: "script",
    currency: "<x>",
    numericPattern: "671.65",
    html: "PRIVATE",
  });
  const s = JSON.stringify(RC.prepare(raw));
  for (const secret of [
    "SECRET",
    "PRIVATE",
    "671.65",
    "private@example.com",
    "priceExamples",
  ])
    assert.ok(!s.includes(secret), secret);
});
test("Actual digits are masked while format punctuation remains useful", () => {
  assert.equal(RC.numericShape("1,234.56"), "n,nnn.nn");
  assert.equal(RC.numericShape("account 123"), null);
  assert.equal(RC.numericShape("https://secret/123"), null);
});
test("A historical rate failure is not presented as a current conversion error", () => {
  const raw = input();
  raw.page.missedPrices = 0;
  raw.events = [
    {
      code: "rates_fetch_failed",
      time: new Date(Date.now() - 60000).toISOString(),
    },
  ];
  const r = RC.prepare(raw);
  assert.match(r.summary, /No automatic failure was confirmed/);
  assert.ok(r.issues.some((i) => i.severity === "history"));
  assert.ok(!r.issues.some((i) => i.code === "rates_unavailable"));
});
test("Private/local hosts, corrupt events, malicious shapes and malformed reports are rejected", () => {
  const raw = input();
  raw.page.hostname = "127.0.0.1";
  raw.page.shapes = ["div.price", "user-secret", "<script>"];
  raw.events = [null, { code: "conversion_failed", time: "SECRET" }];
  const r = RC.prepare(raw);
  assert.equal(r.page.hostname, null);
  assert.deepEqual(plain(r.page.shapes), ["div.price"]);
  assert.equal(r.events.length, 0);
  assert.throws(() => RC.prepare({ ...raw, id: "bad" }));
  assert.throws(() => RC.prepare({ ...raw, created: "2020-01-01" }));
});
test("Collector URLs must be HTTPS Apps Script production endpoints", () => {
  assert.equal(RC.endpointValid(endpoint), true);
  for (const url of [
    endpoint.replace("/exec", "/dev"),
    "https://evil.example/exec",
    endpoint + "?token=x",
    endpoint.replace("https:", "http:"),
  ])
    assert.equal(RC.endpointValid(url), false);
});

function delivery(fetcher, { configured = true } = {}) {
  const data = {},
    requests = [],
    alarms = [];
  let failSave = false;
  const chrome = {
    storage: {
      local: {
        get: async (keys) => Object.fromEntries(keys.map((k) => [k, data[k]])),
        set: async (obj) => {
          if (failSave) throw new Error("storage");
          Object.assign(data, plain(obj));
        },
      },
    },
    alarms: { create: async (...args) => alarms.push(args) },
  };
  const context = vm.createContext({
    Date,
    AbortSignal,
    chrome,
    REPORT_CONFIG: { endpoint: configured ? endpoint : "" },
    fetch: async (...args) => {
      requests.push(args);
      return fetcher(...args);
    },
  });
  const api = vm.runInContext(
    core +
      "\n" +
      fs.readFileSync(path.join(root, "report-delivery.js"), "utf8") +
      "\nREPORT_DELIVERY",
    context,
  );
  return { api, data, requests, alarms, setFail: (v) => (failSave = v) };
}
function ack(body) {
  const r = JSON.parse(body);
  return {
    ok: true,
    url: "https://script.googleusercontent.com/macros/echo?user_content_key=test",
    text: async () =>
      JSON.stringify({
        ok: true,
        reportId: r.id,
        receipt: "PAC-20261020-abcdef123456",
      }),
  };
}
test("Delivery acknowledges only saved reports, omits cookies/referrer and de-duplicates clicks", async () => {
  const w = delivery(async (url, o) => ack(o.body));
  const report = RC.prepare(input());
  const [a, b] = await Promise.all([
    w.api.submit(report),
    w.api.submit(report),
  ]);
  assert.equal(a.status, "sent");
  assert.equal(b.status, "sent");
  assert.equal(w.requests.length, 1);
  assert.equal(w.requests[0][1].credentials, "omit");
  assert.equal(w.requests[0][1].referrerPolicy, "no-referrer");
  assert.equal(
    w.requests[0][1].headers["Content-Type"],
    "text/plain;charset=UTF-8",
  );
  assert.equal(w.data.reportOutbox.length, 0);
});
test("Offline reports persist and resend the same ID after a retry", async () => {
  let online = false;
  const w = delivery(async (url, o) => {
    if (!online) throw new Error("offline");
    return ack(o.body);
  });
  const r = await w.api.submit(RC.prepare(input()));
  assert.equal(r.status, "queued");
  assert.equal(w.data.reportOutbox.length, 1);
  assert.ok(w.alarms.length);
  w.data.reportOutbox[0].next = 0;
  online = true;
  await w.api.flush();
  assert.equal(w.data.reportOutbox.length, 0);
  assert.equal(w.data.reportReceipts.length, 1);
  assert.equal(
    JSON.parse(w.requests[0][1].body).id,
    JSON.parse(w.requests[1][1].body).id,
  );
});
test("HTML, login redirects, wrong IDs and HTTP success without acknowledgment never say sent", async () => {
  for (const response of [
    {
      ok: true,
      url: "https://accounts.google.com/login",
      text: async () => "<html>login</html>",
    },
    { ok: true, text: async () => "<html>login</html>" },
    {
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          reportId: "wrong",
          receipt: "PAC-20261020-abcdef",
        }),
    },
  ]) {
    const w = delivery(async () => response);
    assert.equal((await w.api.submit(RC.prepare(input()))).status, "queued");
  }
});
test("Missing configuration or invalid reports are not falsely queued/sent", async () => {
  const w = delivery(
    async () => {
      throw Error("must not fetch");
    },
    { configured: false },
  );
  assert.equal(
    (await w.api.submit(RC.prepare(input()))).code,
    "not_configured",
  );
  assert.equal((await w.api.submit({})).code, "invalid_report");
  assert.equal(w.requests.length, 0);
});
test("An explicit invalid-payload rejection stops retrying", async () => {
  const w = delivery(async () => ({
    ok: true,
    text: async () => JSON.stringify({ ok: false, code: "invalid_report" }),
  }));
  assert.equal((await w.api.submit(RC.prepare(input()))).ok, false);
  assert.equal(w.data.reportOutbox.length, 0);
});
test("Outbox is bounded and expired reports do not transmit", async () => {
  const w = delivery(async () => {
    throw Error("offline");
  });
  for (let i = 0; i < 5; i++) {
    const r = input();
    r.id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa" + i;
    assert.equal((await w.api.submit(RC.prepare(r))).status, "queued");
  }
  const r = input();
  r.id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal((await w.api.submit(RC.prepare(r))).code, "queue_full");
  w.data.reportOutbox.forEach((e) => (e.saved = Date.now() - 8 * 86400000));
  await w.api.flush();
  assert.equal(w.data.reportOutbox.length, 0);
});
test("A durable server receipt still counts as received if local receipt caching fails", async () => {
  let w;
  w = delivery(async (url, o) => {
    w.setFail(true);
    return ack(o.body);
  });
  assert.equal((await w.api.submit(RC.prepare(input()))).status, "sent");
});
module.exports = { input };
