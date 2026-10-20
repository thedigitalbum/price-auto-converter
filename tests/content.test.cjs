const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const root = process.env.SOURCE_DIR || path.join(__dirname, '..');
const {browserOptions,verifyBrowser}=require('./browser.cjs');
const browserReady = chromium.launch({ headless: true,...browserOptions() }).then(async b=>{await verifyBrowser(b);return b;});
after(async () => (await browserReady).close());
const rates = { USD: 1, PHP: 56, CAD: 1.4, MYR: 4, TRY: 40, NGN: 1600, CLP: 1000, COP: 4000, HKD: 8, EUR: 0.9, KWD: 0.3, PLN: 4 };
async function fixture(t, body, { url = 'https://shop.example/', currency = 'USD' } = {}) {
  const page = await (await browserReady).newPage({ locale: 'en-US' });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, [], 'no page errors'));
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="en"><head><meta charset="utf-8">${currency ? `<meta name="currency" content="${currency}">` : ''}</head><body>${body}</body></html>` }));
  await page.goto(url);
  await page.evaluate(({ rates }) => {
    const storageListeners = [], messages = [];
    window.chrome = {
      runtime: { id: 'test', getManifest: () => ({ version: '1.1.0' }), sendMessage: async msg => {if(msg.type==='diagnostic-event')window.diagnosticCodes.push(msg.code);return {};}, onMessage: { addListener: fn => messages.push(fn) } },
      storage: {
        sync: { get: async defaults => ({ ...defaults, target: 'PHP' }), set: async () => {} },
        local: { get: async () => ({ rates, ratesBundled: false }) },
        onChanged: { addListener: fn => storageListeners.push(fn), removeListener: () => {} }
      }
    };
    window.setSettings = obj => storageListeners.forEach(fn => fn(Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { newValue: v }])), 'sync'));
    window.setRates = rates => storageListeners.forEach(fn => fn({ rates: { newValue: rates } }, 'local'));
    window.diagnosticCodes=[];
    window.statusOfExtension = () => { let state; for (const fn of messages) fn({ type: 'status' }, { id: 'test' }, r => state = r); return state; };
  }, { rates });
  await page.addScriptTag({ path: path.join(root, 'lib.js') });
  await page.addScriptTag({ path: path.join(root, 'diagnostics.js') });
  await page.addScriptTag({ path: path.join(root, 'content.js') });
  return page;
}
async function text(page, selector, expected) {
  try {
    await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() === expected, { selector, expected }, { timeout: 7000 });
  } catch (e) { throw new Error(`${selector}: expected ${expected}; got ${await page.textContent(selector)}`, { cause: e }); }
}

test('Editing fields, code and Amazon-style prices inside editors stay untouched',async t=>{
 const p=await fixture(t,'<div contenteditable="plaintext-only" id="edit">USD 100<div class="a-price"><span class="a-offscreen">$10</span><span aria-hidden="true">$10</span></div></div><textarea>USD 100</textarea><code id="code">USD 100</code><p id="price" class="price-private-account">USD 100</p>');
 await text(p,'#price','≈ ₱5,600.00');await text(p,'#code','USD 100');assert.equal(await p.textContent('#edit'),'USD 100$10$10');
 const report=await p.evaluate(()=>statusOfExtension());assert.deepEqual(report.shapes,['p.price']);assert.ok(!JSON.stringify(report).includes('private-account'));
});

test('An internal conversion failure pauses, restores originals and records a fixed code',async t=>{
 const p=await fixture(t,'<p id="price">USD 100</p>');await text(p,'#price','≈ ₱5,600.00');
 await p.evaluate(()=>{PC.find=()=>{throw new Error('PRIVATE failure details');};const el=document.createElement('p');el.textContent='USD 20';document.body.append(el);});
 await p.waitForFunction(()=>statusOfExtension().state==='error');await text(p,'#price','USD 100');
 assert.deepEqual(await p.evaluate(()=>diagnosticCodes),['conversion_failed']);
});

test('A country storefront wins over stray currency-looking product text',async t=>{
 const p=await fixture(t,'<p>COP 120</p><section><p id="price" class="price">100.00</p></section>',{url:'https://www.lazada.com.my/',currency:''});
 await text(p,'#price','≈ ₱1,400.00');assert.equal(await p.evaluate(()=>statusOfExtension().bare),'MYR');
});

test('A batch of dynamic product prices converts and restores without duplicating',async t=>{
 const p=await fixture(t,'<main id="products"></main>');
 await p.evaluate(()=>{const f=document.createDocumentFragment();for(let i=0;i<200;i++){const el=document.createElement('p');el.className='price';el.textContent='USD '+(i+1);f.append(el);}document.querySelector('main').append(f);});
 await p.waitForFunction(()=>[...document.querySelectorAll('.price')].every(p=>p.textContent.startsWith('≈')));
 assert.equal(await p.locator('.price').count(),200);await p.evaluate(()=>setSettings({enabled:false}));await text(p,'.price','USD 1');assert.equal(await p.locator('.price').last().textContent(),'USD 200');
});
test('Superscript and small-font cents are assembled once', async t => {
  const p = await fixture(t, '<div class="price" id="sup"><span>$19</span><sup>99</sup></div><div id="small" class="price"><span style="font-size:24px" data-testid="ugpp-reduced-price-display">20</span><span style="font-size:12px">97</span></div>');
  await text(p, '#sup', '≈ ₱1,119.44');
  await text(p, '#small', '≈ ₱1,174.32');
  await p.evaluate(() => setSettings({ enabled: false }));
  await text(p, '#sup', '$1999');
  await text(p, '#small', '2097');
});
test('Split RM/TL labels are consumed with their numbers', async t => {
  const p = await fixture(t, '<div class="price" id="rm"><span>RM</span><span>29.90</span></div><div class="price" id="tl"><span>349</span><span>,99</span><span>TL</span></div>');
  await text(p, '#rm', '≈ ₱418.60');
  await text(p, '#tl', '≈ ₱489.99');
});
test('Split dollar label and raised cents work without page metadata', async t => {
  const p = await fixture(t, '<div class="price" id="price"><span>$</span><span>19</span><sup>99</sup></div>', { currency: '' });
  await text(p, '#price', '≈ ₱1,119.44');
});
test('Ratings, split ratings and model numbers remain untouched', async t => {
  const p = await fixture(t, '<div class="product-price"><div class="rev"><span class="rv-avg" id="rating">4.5</span><span>(123)</span></div><div class="rating" id="split"><span>4</span><span>.</span><span>50</span></div><p id="model">Romeo RM-9595</p><p id="real">NGN 1600</p></div>', { currency: 'NGN' });
  await text(p, '#real', '≈ ₱56.00');
  await text(p, '#rating', '4.5');
  await text(p, '#split', '4.50');
  await text(p, '#model', 'Romeo RM-9595');
});
for (const [url, from, value] of [['https://www.falabella.com/falabella-cl/', 'CLP', 1.344], ['https://www.mercadolibre.com.co/', 'COP', 0.336], ['https://www.hktvmall.com/', 'HKD', 168]]) {
  test('Country source: ' + from, async t => {
    const p = await fixture(t, '<p id="price">$24</p>', { url, currency: '' });
    await p.waitForFunction(() => document.querySelector('#price').textContent.includes('₱'));
    assert.equal(await p.evaluate(() => statusOfExtension().bare), from);
    const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP', ...(value < 1 ? { maximumSignificantDigits: 4 } : {}) }).format(value);
    await text(p, '#price', '≈ ' + expected);
  });
}
test('Shop currency switch uses new source and pauses mutation conversion', async t => {
  const p = await fixture(t, '<select name="currency" id="switch"><option>USD</option><option>CAD</option></select><p id="price">$100.00</p><script>document.querySelector("select").onchange=()=>{document.querySelector("#price").textContent="$100.00";}</script>');
  await text(p, '#price', '≈ ₱5,600.00');
  await p.selectOption('#switch', 'CAD');
  await text(p, '#price', '≈ ₱4,000.00');
  assert.equal(await p.evaluate(() => statusOfExtension().bare), 'CAD');
});
test('Late metadata corrects an already chosen source', async t => {
  const p = await fixture(t, '<p id="price">$100.00</p>');
  await text(p, '#price', '≈ ₱5,600.00');
  await p.evaluate(() => { document.querySelector('meta[name=currency]').content = 'CAD'; });
  await text(p, '#price', '≈ ₱4,000.00');
});
test('Amazon source updates re-convert and restore latest value', async t => {
  const p = await fixture(t, '<div class="a-price" id="az"><span class="a-offscreen">$19.99</span><span aria-hidden="true"><span>$</span><span>19.</span><span>99</span></span></div>');
  await text(p, '#az .a-offscreen', '≈ ₱1,119.44');
  await p.evaluate(() => document.querySelector('#az .a-offscreen').textContent = '$29.99');
  await text(p, '#az [aria-hidden]', '≈ ₱1,679.44');
  await p.evaluate(() => setSettings({ enabled: false }));
  await text(p, '#az .a-offscreen', '$29.99');
  await text(p, '#az [aria-hidden]', '$29.99');
});
test('Ordinary dynamic updates and long paragraphs convert', async t => {
  const p = await fixture(t, '<p id="price">USD 100</p><p id="long">' + 'Ordinary text. '.repeat(400) + 'USD 100</p>');
  await text(p, '#price', '≈ ₱5,600.00');
  assert.match(await p.textContent('#long'), /₱5,600\.00/);
  await p.evaluate(() => document.querySelector('#price').firstChild.nodeValue = 'USD 200');
  await text(p, '#price', '≈ ₱11,200.00');
});
test('Existing PHP prices and zero prices remain unchanged', async t => {
  const p = await fixture(t, '<p id="php">₱199.99</p><p class="price" id="zero">0.00</p><p id="other">USD 10</p>');
  await text(p, '#other', '≈ ₱560.00');
  await text(p, '#php', '₱199.99');
  await text(p, '#zero', '0.00');
  assert.equal(await p.evaluate(() => statusOfExtension().bareSkipped), 0);
});
test('Shadow DOM prices convert and restore', async t => {
  const p = await fixture(t, '<div id="host"></div><p id="ready">USD 1</p><script>document.querySelector("#host").attachShadow({mode:"open"}).innerHTML="<span>USD 20</span>";</script>');
  await p.waitForFunction(() => document.querySelector('#host').shadowRoot.textContent.includes('₱1,120.00'));
  await p.evaluate(() => setSettings({ enabled: false }));
  await p.waitForFunction(() => document.querySelector('#host').shadowRoot.textContent === 'USD 20');
});
test('A rate refresh re-renders prices from originals', async t => {
  const p = await fixture(t, '<p id="price">USD 10</p>');
  await text(p, '#price', '≈ ₱560.00');
  await p.evaluate(rates => setRates({ ...rates, PHP: 60 }), rates);
  await text(p, '#price', '≈ ₱600.00');
});
test('Currency labels and fee buffer restore without double conversion', async t => {
  const p = await fixture(t, '<div class="price" id="price"><span>RM</span><span>100</span></div>');
  await text(p, '#price', '≈ ₱1,400.00');
  await p.evaluate(() => setSettings({ fxBuffer: 5 }));
  await text(p, '#price', '≈ ₱1,470.00');
  await p.evaluate(() => setSettings({ enabled: false }));
  await text(p, '#price', 'RM100');
});


test('Amazon price-to-pay with blank accessibility text converts the visible 494.95 and restores its spans', async t => {
  const visible='<span class="a-price-symbol">$</span><span class="a-price-whole">494<span class="a-price-decimal">.</span></span><span class="a-price-fraction">95</span>';
  const p=await fixture(t, '<span class="a-price priceToPay" id="az"><span class="a-offscreen"> </span><span aria-hidden="true">'+visible+'</span></span>',{url:'https://www.amazon.com/dp/fixture'});
  await text(p,'#az [aria-hidden]','≈ ₱27,717.20');
  await p.evaluate(()=>setSettings({enabled:false}));
  await text(p,'#az [aria-hidden]','$494.95');
  assert.equal(await p.locator('#az [aria-hidden]').innerHTML(),visible);
  assert.equal(await p.textContent('#az .a-offscreen'),' ');
  await p.evaluate(()=>setSettings({enabled:true}));
  await text(p,'#az [aria-hidden]','≈ ₱27,717.20');
  await p.evaluate(()=>document.querySelector('#az [aria-hidden]').innerHTML='<span class="a-price-symbol">$</span><span class="a-price-whole">469<span class="a-price-decimal">.</span></span><span class="a-price-fraction">00</span>');
  await text(p,'#az [aria-hidden]','≈ ₱26,264.00');
  await p.evaluate(()=>setSettings({enabled:false}));
  await text(p,'#az [aria-hidden]','$469.00');
  assert.equal(await p.textContent('#az .a-offscreen'),' ');
});
