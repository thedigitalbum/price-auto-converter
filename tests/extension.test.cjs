const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const {browserOptions,verifyBrowser}=require('./browser.cjs');
const root = process.env.SOURCE_DIR || path.join(__dirname, '..');

test('First use suggests, searches, confirms and preserves currency without opening a tab', {timeout:60000}, async t => {
  const dir=path.join(__dirname,'../test-results');
  fs.mkdirSync(dir,{recursive:true});
  const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(dir,'onboarding-')),{
    ...browserOptions(),channel:'chromium',headless:true,locale:'en-PH',ignoreDefaultArgs:['--disable-extensions'],
    args:[...(browserOptions().args||[]),`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--host-resolver-rules=MAP * ~NOTFOUND']
  });
  t.after(()=>context.close());await verifyBrowser(context);
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{for(let i=0;i<150;i++){if(globalThis.chrome?.storage?.local&&(await chrome.storage.local.get('rates')).rates)break;await new Promise(r=>setTimeout(r,30));}});
  assert.equal(context.pages().some(p=>p.url().includes('options.html')),false);
  const shop=await context.newPage();
  await shop.route('https://shop.example/**',r=>r.fulfill({contentType:'text/html',body:'<meta name="currency" content="USD"><p id="price">USD 100</p>'}));
  await shop.goto('https://shop.example/');
  await shop.waitForTimeout(600);
  assert.equal(await shop.textContent('#price'),'USD 100');
  const popup=await context.newPage();await popup.setViewportSize({width:384,height:600});
  const url='chrome-extension://'+new URL(worker.url()).host+'/popup.html';
  await popup.goto(url);await popup.waitForFunction(()=>document.querySelector('#setupCurrency').value==='PHP');
  assert.equal(await popup.locator('#conversionPanel').isVisible(),false);
  await popup.screenshot({path:path.join(dir,'currency-onboarding.png')});
  assert.equal(await popup.evaluate(()=>document.documentElement.scrollHeight<=600&&document.documentElement.scrollWidth<=384),true);
  await popup.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));
  const axe=await popup.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
  assert.deepEqual(axe.map(v=>v.id),[]);
  await popup.fill('#currencySearch','no-such-currency');
  assert.equal(await popup.locator('#startConverting').isDisabled(),true);
  await popup.fill('#currencySearch','canadian');await popup.selectOption('#setupCurrency','CAD');
  await popup.evaluate(()=>{window.originalSave=PC.saveSync;PC.saveSync=async()=>({ok:false});});
  await popup.click('#startConverting');await popup.waitForFunction(()=>!document.querySelector('#setupError').hidden);
  assert.equal((await worker.evaluate(()=>chrome.storage.sync.get('target'))).target,undefined);
  await popup.evaluate(()=>{PC.saveSync=window.originalSave;});
  await popup.click('#startConverting');await popup.waitForFunction(()=>!document.querySelector('#conversionPanel').hidden);
  await shop.waitForFunction(()=>document.querySelector('#price').textContent!=='USD 100');
  assert.equal((await worker.evaluate(()=>chrome.storage.sync.get('target'))).target,'CAD');
  await popup.reload();await popup.waitForFunction(()=>!document.querySelector('#conversionPanel').hidden);
  // Legacy saved preferences bypass setup even without the new flag.
  await worker.evaluate(async()=>{await chrome.storage.sync.remove('currencyConfirmed');await chrome.storage.sync.set({target:'JPY',enabled:false});});
  await popup.reload();await popup.waitForFunction(()=>document.querySelector('#target').value==='JPY');
  assert.equal(await popup.locator('#currencySetup').isVisible(),false);
  assert.equal((await worker.evaluate(()=>chrome.storage.sync.get('enabled'))).enabled,false);
  await worker.evaluate(()=>chrome.storage.sync.clear());
  await popup.addInitScript(()=>Object.defineProperty(navigator,'languages',{get:()=>['en']}));
  await popup.reload();await popup.waitForFunction(()=>!document.querySelector('#currencySetup').hidden&&document.querySelector('#setupCurrency').options.length>0);
  assert.equal(await popup.inputValue('#setupCurrency'),'');
  assert.equal(await popup.locator('#startConverting').isDisabled(),true);
});
test('Actual unpacked extension: worker, content scripts, settings, and latest-price restore', { timeout: 45000 }, async t => {
  const testDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(testDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(testDir, 'extension-profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    ...browserOptions(),
    channel: 'chromium', headless: true, locale: 'en-US', ignoreDefaultArgs: ['--disable-extensions'],
    timeout: 15000,
    args: [...(browserOptions().args||[]),`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--host-resolver-rules=MAP * ~NOTFOUND']
  });
  t.after(() => context.close());
  await verifyBrowser(context);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
  // Wait for install's bundled-rate seeding before choosing deterministic test rates.
  await worker.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      if (globalThis.chrome?.storage?.local && (await chrome.storage.local.get('rates')).rates) break;
      await new Promise(r => setTimeout(r, 30));
    }
    await chrome.storage.local.set({ rates: { USD: 1, PHP: 56, CAD: 1.4 }, ratesBundled: false });
    await chrome.storage.sync.set({ enabled: true, target: 'PHP', fxBuffer: 0, currencyConfirmed: true });
  });
  assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version);
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
