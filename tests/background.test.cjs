const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = process.env.SOURCE_DIR || path.join(__dirname, "..");
const validRates = {
  USD: 1,
  ...Object.fromEntries(
    Array.from({ length: 25 }, (_, i) => [
      "X" +
        String.fromCharCode(65 + Math.floor(i / 26)) +
        String.fromCharCode(65 + (i % 26)),
      i + 1,
    ]),
  ),
};
function worker(fetcher) {
  const data = {},
    listeners = {},
    events = [];
  const chrome = {
    storage: {
      local: {
        get: async (keys) =>
          Object.fromEntries(
            (typeof keys === "string" ? [keys] : keys).map((k) => [k, data[k]]),
          ),
        set: async (values) => Object.assign(data, values),
      },
      sync: { remove: async () => {} },
    },
    runtime: {
      id: "test",
      getURL: (p) => "chrome-extension://test/" + p,
      openOptionsPage: async () => {},
      onInstalled: { addListener: (fn) => (listeners.install = fn) },
      onStartup: { addListener: (fn) => (listeners.startup = fn) },
      onMessage: { addListener: (fn) => (listeners.message = fn) },
    },
    alarms: {
      create: () => {},
      onAlarm: { addListener: (fn) => (listeners.alarm = fn) },
    },
    action: {},
  };
  const context = vm.createContext({
    chrome,
    Intl,
    AbortSignal,
    Date,
    fetch: fetcher,
    importScripts: () => {},
    DX: { append: async (code) => events.push(code) },
  });
  vm.runInContext(
    fs.readFileSync(path.join(root, "background.js"), "utf8"),
    context,
  );
  return {
    data,
    listeners,
    events,
    run: (code) => vm.runInContext(code, context),
  };
}
test("Network rates reject invalid entries and wrong bases", () => {
  const w = worker();
  assert.equal(
    w.run("cleanRates({USD:1,EUR:0.9,BAD:NaN,NEG:-1,ZER:0}).EUR"),
    0.9,
  );
  assert.equal(
    w.run("Object.keys(cleanRates({USD:1,BAD:Infinity,NEG:-1})).length"),
    1,
  );
  assert.throws(() => w.run("cleanRates({USD:2})"));
});
test("Provider timestamp is preserved separately from fetch time", async () => {
  const updated = Math.floor(Date.now() / 1000) - 3 * 86400;
  const w = worker(async () => ({
    ok: true,
    json: async () => ({
      result: "success",
      rates: validRates,
      time_last_update_unix: updated,
    }),
  }));
  await w.run("fetchRates()");
  assert.equal(w.data.ratesUpdated, updated * 1000);
  assert.ok(w.data.ratesFetched > w.data.ratesUpdated);
  assert.equal(w.data.ratesBundled, false);
});
test("Failures retain the cache and record only a fixed event", async () => {
  const w = worker(async () => {
    throw new Error("https://private.example/path?token=secret");
  });
  w.data.rates = { USD: 1, PHP: 56 };
  await assert.rejects(w.run("fetchRates()"));
  assert.equal(w.data.rates.PHP, 56);
  assert.deepEqual(w.events, ["rates_fetch_failed"]);
  assert.ok(!JSON.stringify(w.data).includes("secret"));
});
test("Offline first install seeds bundled rates", async () => {
  const bundled = JSON.parse(
    fs.readFileSync(path.join(root, "fallback-rates.json"), "utf8"),
  );
  const w = worker(async (url) => {
    if (url.startsWith("chrome-extension:"))
      return { json: async () => bundled };
    throw new Error("offline");
  });
  await w.run("seedFallbackIfEmpty()");
  assert.equal(w.data.ratesBundled, true);
  assert.ok(w.data.rates.PHP > 0);
});
test("Concurrent refreshes share one request", async () => {
  let calls = 0,
    release;
  const gate = new Promise((r) => (release = r));
  const w = worker(async () => {
    calls++;
    await gate;
    return {
      ok: true,
      json: async () => ({ result: "success", rates: validRates }),
    };
  });
  const a = w.run("refreshRates()"),
    b = w.run("refreshRates()");
  release();
  await Promise.all([a, b]);
  assert.equal(calls, 1);
});
test("Page refreshes are throttled", async () => {
  const w = worker(() => {
    throw new Error("must not fetch");
  });
  w.data.ratesAttempt = Date.now();
  assert.equal((await w.run("refreshRates(false)")).ok, false);
});
test("Foreign extension senders cannot append events or refresh", () => {
  const w = worker();
  w.listeners.message(
    { type: "diagnostic-event", code: "conversion_failed" },
    { id: "other" },
    () => {},
  );
  assert.deepEqual(w.events, []);
});
