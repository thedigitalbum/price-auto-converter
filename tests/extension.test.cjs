const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const root = process.env.SOURCE_DIR || path.join(__dirname, '..');
test('Actual unpacked extension: worker, content scripts, settings, and latest-price restore', { timeout: 45000 }, async t => {
  const testDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(testDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(testDir, 'extension-profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, locale: 'en-US', ignoreDefaultArgs: ['--disable-extensions'],
    timeout: 15000,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--host-resolver-rules=MAP * ~NOTFOUND']
  });
  t.after(() => context.close());
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
  // Wait for install's bundled-rate seeding before choosing deterministic test rates.
  await worker.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      if ((await chrome.storage.local.get('rates')).rates) break;
      await new Promise(r => setTimeout(r, 30));
    }
    await chrome.storage.local.set({ rates: { USD: 1, PHP: 56, CAD: 1.4 }, ratesBundled: false });
    await chrome.storage.sync.set({ enabled: true, target: 'PHP', fxBuffer: 0 });
  });
  assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), '1.1.0');
  const page = await context.newPage();
  await page.route('https://shop.example/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><meta name="currency" content="USD"><p id="price">USD 100</p><div class="a-price" id="az"><span class="a-offscreen">$19.99</span><span aria-hidden="true">$19.99</span></div>' }));
  await page.goto('https://shop.example/');
  await page.waitForFunction(() => document.querySelector('#price').textContent.includes('₱5,600.00'));
  await page.waitForFunction(() => document.querySelector('#az [aria-hidden]').textContent.includes('₱1,119.44'));
  await page.evaluate(() => document.querySelector('#az .a-offscreen').textContent = '$29.99');
  await page.waitForFunction(() => document.querySelector('#az [aria-hidden]').textContent.includes('₱1,679.44'));
  await worker.evaluate(() => chrome.storage.sync.set({ enabled: false }));
  await page.waitForFunction(() => document.querySelector('#price').textContent === 'USD 100');
  assert.equal(await page.textContent('#az .a-offscreen'), '$29.99');
  assert.equal(await page.textContent('#az [aria-hidden]'), '$29.99');
});
