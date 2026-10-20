const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const src = fs.readFileSync(
  path.join(process.env.SOURCE_DIR || path.join(__dirname, ".."), "lib.js"),
  "utf8",
);
const PC = vm.runInNewContext(src + "\nPC", { Intl, TextEncoder });
test("Feet in product dimensions are not Hungarian money", () => {
  const c = {
    rates: { USD: 1, PHP: 56, HUF: 350 },
    target: "PHP",
    bare: "CAD",
  };
  assert.equal(PC.find("Cable 2500 Ft", c).length, 0);
  assert.equal(PC.find("2500 Ft", { ...c, bare: "HUF" })[0].amount, 2500);
});
const ctx = {
  rates: { USD: 1, PHP: 56, MYR: 4, EUR: 0.9, ZAR: 18 },
  target: "PHP",
  sym: { dollar: "USD", rand: "ZAR" },
  bare: "USD",
};
test("Shared-label ranges are left intact instead of partially converting", () => {
  assert.equal(PC.find("$10–20", ctx).length, 0);
  assert.equal(PC.find("$10–$20", ctx).length, 2);
});
for (const value of [
  "Romeo RM-9595",
  "Model R500i",
  "29€999",
  "USD 12.34.56",
  "Laptop EUR900X",
])
  test("Reject partial/model: " + value, () =>
    assert.equal(PC.find(value, ctx).length, 0),
  );
test("A subdomain toggle preserves parent exclusions for siblings", () => {
  const cfg = { excluded: "example.com", included: "" };
  const next = PC.toggleSite("shop.example.com", cfg, true);
  assert.equal(PC.siteEnabled("shop.example.com", next), true);
  assert.equal(PC.siteEnabled("other.example.com", next), false);
  assert.equal(next.excluded, "example.com");
  assert.equal(
    PC.siteEnabled(
      "shop.example.com",
      PC.toggleSite("shop.example.com", next, false),
    ),
    false,
  );
});
test("Corrupt settings fall back predictably", () => {
  const cfg = PC.settings({
    target: "<script>",
    enabled: "false",
    fxBuffer: Infinity,
    excluded: [],
    whole: 1,
    dollarMode: "JPY",
  });
  assert.equal(cfg.target, "PHP");
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.fxBuffer, 0);
  assert.equal(cfg.excluded, "");
  assert.equal(cfg.whole, false);
  assert.equal(cfg.dollarMode, "auto");
});

test("Storage quota errors remain recoverable and writes are serialized", async () => {
  const writes = [];
  let busy = false;
  const P = vm.runInNewContext(src + "\nPC", {
    Intl,
    TextEncoder,
    chrome: {
      storage: {
        sync: {
          set: async (obj) => {
            assert.equal(busy, false);
            busy = true;
            await new Promise((r) => setTimeout(r, 2));
            busy = false;
            if (obj.fail) throw new Error("quota");
            writes.push(obj);
          },
        },
      },
    },
  });
  const results = await Promise.all([
    P.saveSync({ target: "PHP" }),
    P.saveSync({ fail: true }),
    P.saveSync({ target: "EUR" }),
  ]);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(results[2].ok, true);
  assert.equal(writes.length, 2);
  assert.equal((await P.saveSync({ included: "a".repeat(6001) })).ok, false);
});
test("Parser sweep: grouped amounts consume the entire input", () => {
  for (let n = 1; n < 100000; n += 173) {
    const input = "USD " + n.toLocaleString("en-US") + ".25";
    const h = PC.find(input, ctx);
    assert.equal(h.length, 1, input);
    assert.equal(h[0].amount, n + 0.25, input);
    assert.equal(h[0].end, input.length, input);
  }
});
test("Adversarial punctuation input finishes in a bounded time", () => {
  const start = performance.now();
  PC.find("USD " + "1,".repeat(10000) + "x", ctx);
  assert.ok(performance.now() - start < 1500);
});
