const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(
    process.env.SOURCE_DIR || path.join(__dirname, ".."),
    "diagnostics.js",
  ),
  "utf8",
);
function load() {
  const data = {};
  const context = vm.createContext({
    Date,
    chrome: {
      storage: {
        local: {
          get: async () => data,
          set: async (obj) => Object.assign(data, obj),
        },
      },
    },
  });
  return { DX: vm.runInContext(source + "\nDX", context), data };
}
const input = {
  version: "1.1.0",
  settings: {
    target: "PHP",
    enabled: true,
    fxBuffer: 0,
    excluded: "private.example",
    siteCurrencies: "secret.example=USD",
  },
  local: {
    rates: { USD: 1, PHP: 56 },
    ratesSource: "open.er-api.com",
    ratesUpdated: 123,
    ratesBundled: false,
  },
  page: {
    host: "private.example",
    url: "https://private.example/account?token=secret",
    text: "private account name",
    state: "active",
    count: 3,
    bare: "USD",
    shapes: ["span.price"],
    examples: ["USD 10"],
  },
  browser: "Chrome/151",
};
test("Default reports exclude hostnames, page text, URLs, examples and site lists", () => {
  const { DX } = load();
  const data = JSON.stringify(DX.report(input));
  for (const secret of [
    "private.example",
    "secret.example",
    "token=secret",
    "private account name",
    "USD 10",
  ])
    assert.ok(!data.includes(secret), secret);
  assert.ok(data.includes("price-auto-converter-report/1"));
});
test("Optional details require explicit switches", () => {
  const { DX } = load();
  const report = DX.report({
    ...input,
    includeSite: true,
    includeExamples: true,
  });
  assert.equal(report.page.hostname, "private.example");
  assert.equal(report.page.priceExamples[0], "USD 10");
  assert.equal(report.page.url, undefined);
});
test("Event history is bounded and rejects arbitrary messages", async () => {
  const { DX, data } = load();
  await DX.append("https://private.example?token=secret");
  for (let i = 0; i < 50; i++) await DX.append("conversion_failed");
  assert.equal(data.diagnosticEvents.length, 40);
  assert.ok(
    data.diagnosticEvents.every(
      (e) => e.code === "conversion_failed" && e.time,
    ),
  );
});
test("Malformed saved event data cannot crash export", () => {
  const { DX } = load();
  assert.doesNotThrow(() =>
    DX.report({ ...input, local: { diagnosticEvents: "broken" } }),
  );
});

test("Malformed event objects and private extra fields are discarded", async () => {
  const { DX, data } = load();
  data.diagnosticEvents = [
    null,
    {},
    { code: "conversion_failed", time: "secret" },
    {
      code: "conversion_failed",
      time: "2026-10-19T00:00:00Z",
      url: "private.example",
    },
  ];
  await DX.append("conversion_failed");
  assert.equal(data.diagnosticEvents.length, 2);
  assert.ok(
    !JSON.stringify(DX.report({ ...input, local: data })).includes(
      "private.example",
    ),
  );
});
