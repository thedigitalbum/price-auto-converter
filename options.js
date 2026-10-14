// Copyright (c) 2026 Harry Rama. MIT License (see LICENSE).
const $ = (id) => document.getElementById(id);
const COMMON = ['USD', 'EUR', 'GBP', 'JPY', 'PHP', 'CAD', 'AUD', 'SGD', 'HKD', 'CNY', 'KRW', 'INR', 'THB', 'MYR', 'IDR', 'VND', 'AED', 'CHF'];
let rates = null;
let saveTimer = null;
let names = null;
try { names = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch {}

const label = (c) => { let n = c; try { n = (names && names.of(c)) || c; } catch {} return n === c ? c : `${c} — ${n}`; };

function fillCurrencies(selected) {
  const codes = rates ? Object.keys(rates).sort() : COMMON;
  const list = codes.includes(selected) ? codes : [selected, ...codes];
  $('target').replaceChildren(...list.map((c) => {
    const o = document.createElement('option');
    o.value = c; o.textContent = label(c);
    return o;
  }));
  $('target').value = selected;
}

const normSites = (v) => v.split('\n')
  .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''))
  .filter(Boolean).join('\n');

function readForm() {
  return {
    enabled: $('enabled').checked,
    target: $('target').value,
    dollarMode: $('dollarMode').value,
    yenMode: $('yenMode').value,
    fxBuffer: Number($('fxBuffer').value) || 0,
    indicator: $('indicator').value,
    whole: $('whole').checked,
    excluded: normSites($('excluded').value)
  };
}

function updatePreview() {
  const el = $('preview');
  if (!rates) { el.textContent = 'Waiting for exchange rates…'; return; }
  const f = readForm();
  const dollar = f.dollarMode === 'auto' ? 'USD' : f.dollarMode;
  if (dollar === f.target) { el.textContent = `$ already means ${f.target} — nothing to convert for $ prices.`; return; }
  const v = PC.convert(100, dollar, f.target, rates) * (1 + f.fxBuffer / 100);
  const shown = PC.formatMoney(v, f.target, { whole: f.whole });
  el.textContent = `$100 (${dollar}${f.dollarMode === 'auto' ? ', or the site’s own dollar' : ''}) → ${f.indicator === 'minimal' ? '' : '≈\u202F'}${shown}`;
}

function updateRatesInfo(updated, source, error) {
  if (error) { $('ratesInfo').textContent = 'Could not fetch rates: ' + error; return; }
  $('ratesInfo').textContent = updated
    ? `${Object.keys(rates).length} currencies · updated ${new Date(updated).toLocaleString()} · ${source || ''}`
    : 'No rates yet — fetching…';
}

function flash(text, bad) {
  const el = $('saved');
  el.textContent = text;
  el.classList.toggle('bad', !!bad);
  el.classList.add('on');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => el.classList.remove('on'), bad ? 5000 : 1500);
}

async function save() {
  const r = await PC.saveSync(readForm());
  flash(r.ok ? 'Saved ✓' : r.error, !r.ok);
  updatePreview();
}

async function refresh() {
  $('refresh').disabled = true;
  $('ratesInfo').textContent = 'Fetching…';
  try {
    const r = await chrome.runtime.sendMessage({ type: 'refresh-rates' });
    if (r && r.ok === false) updateRatesInfo(0, '', r.error);
  } catch (e) {
    updateRatesInfo(0, '', String(e.message || e));
  }
  $('refresh').disabled = false;
}

async function main() {
  const [s, l] = await Promise.all([
    chrome.storage.sync.get(PC.DEFAULTS),
    chrome.storage.local.get(['rates', 'ratesUpdated', 'ratesSource'])
  ]);
  const cfg = { ...PC.DEFAULTS, ...s };
  rates = l.rates || null;
  fillCurrencies(cfg.target);
  $('enabled').checked = cfg.enabled;
  for (let i = 0; i <= 10; i++) {
    const o = document.createElement('option');
    o.value = String(i / 2);
    o.textContent = i === 0 ? 'None (0%)' : `+${i / 2}%`;
    $('fxBuffer').appendChild(o);
  }
  $('fxBuffer').value = String(Math.min(5, Math.max(0, Math.round((Number(cfg.fxBuffer) || 0) * 2) / 2)));
  $('dollarMode').value = cfg.dollarMode;
  $('yenMode').value = cfg.yenMode;
  $('indicator').value = cfg.indicator === 'underline' ? 'standard' : cfg.indicator;
  $('whole').checked = cfg.whole;
  $('excluded').value = cfg.excluded;
  updateRatesInfo(l.ratesUpdated, l.ratesSource);
  updatePreview();
  if (!rates) refresh();

  document.querySelectorAll('select, input[type=checkbox]').forEach((el) => el.addEventListener('change', save));
  let t;
  ['excluded'].forEach((id) => $(id).addEventListener('input', () => { clearTimeout(t); t = setTimeout(save, 500); }));
  $('refresh').addEventListener('click', refresh);

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.rates) return;
    rates = ch.rates.newValue;
    fillCurrencies($('target').value || cfg.target);
    chrome.storage.local.get(['ratesUpdated', 'ratesSource']).then((x) => updateRatesInfo(x.ratesUpdated, x.ratesSource));
    updatePreview();
  });
}
main();
