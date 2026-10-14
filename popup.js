// Copyright (c) 2026 Harry Rama. MIT License (see LICENSE).
const $ = (id) => document.getElementById(id);
let tabId = null;
let host = '';

const lines = (list) => (list || '').split('\n').map((s) => s.trim()).filter(Boolean);
const matches = (d, h) => h === d.toLowerCase() || h.endsWith('.' + d.toLowerCase());
const findRule = (list, h) => lines(list).find((d) => matches(d, h));
const ruleCode = (list, h) => {
  const l = lines(list).find((x) => matches(x.split('=')[0].trim(), h));
  return l ? (l.split('=')[1] || '').trim().toUpperCase() : '';
};
const setRule = (list, h, host, code) => {
  const kept = lines(list).filter((x) => !matches(x.split('=')[0].trim(), h));
  if (code) kept.push(`${host}=${code}`);
  return kept.join('\n');
};
const addHost = (list, h) => (findRule(list, h) ? lines(list) : [...lines(list), h]).join('\n');
const removeHost = (list, h) => lines(list).filter((d) => !matches(d, h)).join('\n');

const currencyName = (c) => {
  try { return new Intl.DisplayNames(['en'], { type: 'currency' }).of(c) || ''; } catch { return ''; }
};

// "Detected source": the currency this site's prices are in, and where that came from.
function renderBare(r) {
  const box = $('bareBox');
  const mine = !!$('bare').value;
  box.hidden = false;
  $('bareHint').classList.remove('attn');
  const dollar = r.sym && r.sym.dollar !== 'USD' ? ` $ is read as ${r.sym.dollar}.` : '';
  if (r.bare) {
    const nm = currencyName(r.bare);
    $('bareHint').textContent = `Site currency: ${r.bare}${nm ? ` (${nm})` : ''}, ${mine ? 'your choice' : 'from ' + r.bareSource}.${dollar}`;
    $('bareRow').hidden = !$('bareRow').dataset.open;
    $('bareChange').hidden = !!$('bareRow').dataset.open;
  } else if (r.bareSkipped > 0) {
    $('bareHint').textContent = `${r.bareSkipped} price${r.bareSkipped === 1 ? '' : 's'} on this page show no clear currency and I couldn’t work it out. Pick it below.`;
    $('bareHint').classList.add('attn');
    $('bareRow').hidden = false;
    $('bareChange').hidden = true;
  } else {
    $('bareHint').textContent = `Site currency: not detected. $ is read as ${r.sym ? r.sym.dollar : 'USD'}.`;
    $('bareRow').hidden = !$('bareRow').dataset.open;
    $('bareChange').hidden = !!$('bareRow').dataset.open;
  }
}

// How fresh are the exchange rates? Amber when they're built-in or old.
async function renderRates() {
  const { ratesUpdated, ratesSource, ratesBundled } = await chrome.storage.local.get(['ratesUpdated', 'ratesSource', 'ratesBundled']);
  const el = $('ratesInfo');
  el.classList.remove('attn');
  if (!ratesUpdated) { el.textContent = 'No exchange rates yet.'; el.classList.add('attn'); return; }
  const when = new Date(ratesUpdated);
  const day = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const days = Math.floor((Date.now() - ratesUpdated) / 86400000);
  if (ratesBundled) {
    el.textContent = `Using built-in approximate rates (${day}). Live rates load when you’re online.`;
    el.classList.add('attn');
  } else if (days >= 2) {
    el.textContent = `Rates are ${days} days old (${day}).`;
    el.classList.add('attn');
  } else {
    el.textContent = `Rates updated ${when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${ratesSource ? ' · ' + ratesSource : ''}.`;
  }
}

function renderStatus(r) {
  const el = $('status');
  el.classList.remove('attn');
  $('bareHint').classList.remove('attn');
  $('bareBox').hidden = true;
  if (!r) { el.textContent = 'Reload this page to activate Price Auto Converter.'; return; }
  switch (r.state) {
    case 'active':
      renderBare(r);
      $('converterInfo').hidden = !r.converter;
      if (r.converter) {
        $('converterInfo').textContent = r.offersTarget
          ? `This site has its own currency menu and it also offers ${r.target}. Prices are converted for you either way.`
          : `This site has its own currency menu (no ${r.target} option). Prices are converted for you automatically.`;
      }
      el.textContent = r.count
        ? `Converting to ${r.target} · ${r.count} price${r.count === 1 ? '' : 's'} on this page.`
        : `On. Converting to ${r.target} — no prices found on this page yet.`;
      if (r.missed > 0) {
        el.textContent += ` ${r.missed} price${r.missed === 1 ? '' : 's'} may not be converted. Tap “Missed a price? Copy details” below and send it to get this fixed.`;
        el.classList.add('attn');
      }
      break;
    case 'excluded':
      el.textContent = 'Off on this site.';
      break;
    case 'off':
      el.textContent = 'Price Auto Converter is turned off in settings.';
      break;
    case 'norates':
      el.classList.add('attn');
      el.textContent = 'Waiting for exchange rates… open Settings and press “Refresh now”.';
      break;
    default:
      el.textContent = 'Starting…';
  }
}

async function refreshStatus() {
  try {
    renderStatus(await chrome.tabs.sendMessage(tabId, { type: 'status' }));
  } catch {
    renderStatus(null);
  }
}

// Write to synced settings; show a message instead of failing silently (quota, rate limits).
async function write(obj) {
  const r = await PC.saveSync(obj);
  if (!r.ok) {
    $('status').textContent = r.error;
    $('status').classList.add('attn');
  }
  return r.ok;
}

async function main() {
  $('settings').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

  // The page's own copy of the extension tells us which site this is, so no extra
  // "tabs"/"activeTab" permission is needed.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let st = null;
  if (tab && tab.id != null) {
    tabId = tab.id;
    try { st = await chrome.tabs.sendMessage(tabId, { type: 'status' }); } catch {}
  }
  if (!st || !st.host) {
    $('host').textContent = 'This page';
    $('status').textContent = 'Price Auto Converter isn’t running on this page. It can’t run on browser pages or the Web Store. On other pages, reload the page and try again.';
    return;
  }
  const fullHost = st.host;
  host = fullHost.replace(/^www\./, '');
  $('host').textContent = host;

  const cfg = await chrome.storage.sync.get(PC.DEFAULTS);
  const rule = findRule(cfg.excluded, fullHost);
  $('siteOn').checked = !rule;
  $('siteOn').disabled = false;
  if (rule && rule !== host) $('host').textContent = `${host} (off via “${rule}”)`;

  const { rates } = await chrome.storage.local.get('rates');
  await renderRates();
  const saved = ruleCode(cfg.siteCurrencies, fullHost);
  const codes = [...new Set([...(rates ? Object.keys(rates).sort() : []), ...(saved ? [saved] : [])])];
  for (const c of codes) {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('bare').appendChild(o);
  }
  $('bare').value = saved;
  $('bareChange').addEventListener('click', () => { $('bareRow').dataset.open = '1'; $('bareRow').hidden = false; $('bareChange').hidden = true; });
  $('bare').addEventListener('change', async () => {
    const cur = await chrome.storage.sync.get(PC.DEFAULTS);
    if (await write({ siteCurrencies: setRule(cur.siteCurrencies, fullHost, host, $('bare').value) })) setTimeout(refreshStatus, 450);
  });

  // Convert to: [currency]
  const targets = [...new Set([...(rates ? Object.keys(rates).sort() : []), cfg.target])];
  for (const c of targets) {
    const o = document.createElement('option');
    const nm = currencyName(c);
    o.value = c; o.textContent = nm ? `${c} – ${nm}` : c;
    $('target').appendChild(o);
  }
  $('target').value = cfg.target;
  $('target').addEventListener('change', async () => {
    if (await write({ target: $('target').value })) setTimeout(refreshStatus, 450);
  });

  // Card fee buffer: 0% to +5% in 0.5% steps
  for (let i = 0; i <= 10; i++) {
    const v = i / 2;
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = v === 0 ? 'None (0%)' : `+${v}%`;
    $('fee').appendChild(o);
  }
  $('fee').value = String(Math.min(5, Math.max(0, Math.round((Number(cfg.fxBuffer) || 0) * 2) / 2)));
  $('fee').addEventListener('change', async () => {
    if (await write({ fxBuffer: Number($('fee').value) })) setTimeout(refreshStatus, 450);
  });

  $('refreshRates').addEventListener('click', async () => {
    $('refreshRates').disabled = true;
    $('ratesInfo').textContent = 'Refreshing…';
    try { await chrome.runtime.sendMessage({ type: 'refresh-rates' }); } catch {}
    await renderRates();
    $('refreshRates').disabled = false;
  });

  $('siteOn').addEventListener('change', async () => {
    const cur = await chrome.storage.sync.get(PC.DEFAULTS);
    const excluded = $('siteOn').checked ? removeHost(cur.excluded, fullHost) : addHost(cur.excluded, host);
    if (await write({ excluded })) { $('host').textContent = host; setTimeout(refreshStatus, 350); }
    else $('siteOn').checked = !$('siteOn').checked;
  });

  $('diag').hidden = false;
  $('diag').addEventListener('click', async () => {
    try {
      const r = await chrome.tabs.sendMessage(tabId, { type: 'diagnose' });
      await navigator.clipboard.writeText(r.text);
      $('diagNote').textContent = 'Copied. It lists page element names and short price text only. Paste it in the chat.';
    } catch {
      $('diagNote').textContent = 'Couldn’t copy. Reload the page and try again.';
    }
  });

  renderStatus(st);
}
main();
