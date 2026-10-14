// Copyright (c) 2026 Harry Rama. MIT License (see LICENSE).
// Finds prices in page text, converts them in place, and shows the original on hover.
(() => {
  'use strict';

  const SKIP = 'script,style,noscript,textarea,input,select,option,code,pre,kbd,samp,svg,canvas,' +
    '[contenteditable=""],[contenteditable="true"],[data-pc],#pc-tooltip-host';
  const canHighlight = typeof Highlight !== 'undefined' && !!(window.CSS && CSS.highlights);

  let settings = { ...PC.DEFAULTS };
  let rates = null;
  let ratesApprox = false;   // true while only the built-in approximate rates are available
  let ctx = null;
  let observer = null;
  let flushTimer = null;
  let restartTimer = null;
  const BRAND = 'Price Auto Converter';

  // Text of `el` if it is at most `max` characters long, otherwise null. Stops reading as soon as
  // the limit is passed, so it stays cheap even when `el` is a huge container.
  function textUpTo(el, max, ignoreOurs = false) {
    let out = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (ignoreOurs && (conv.has(n) || grouped.has(n))) continue;
      out += n.nodeValue;
      if (out.length > max) return null;
    }
    return out;
  }

  // ---------- shadow DOM ----------
  // Many shops draw their product cards inside web components (shadow DOM). Page text there is
  // invisible to document-level walkers, so every shadow root is scanned and watched on its own.
  const shadows = new Set();          // shadow roots we scan
  const shadowObs = new Map();        // shadow root -> its MutationObserver
  let hlSheet = null;
  const HL_CSS = '::highlight(pc-converted){text-decoration-line:underline;text-decoration-style:dotted;' +
    'text-decoration-color:#64748b;text-decoration-thickness:1px}::highlight(pc-tint){background-color:rgba(59,130,246,.14)}';

  function shadowOf(el) {
    try {
      if (chrome.dom && chrome.dom.openOrClosedShadowRoot) return chrome.dom.openOrClosedShadowRoot(el) || null;
    } catch (e) { /* fall through */ }
    return el.shadowRoot || null;
  }

  // Root to walk for a node: its shadow root if it lives in one, otherwise the page body.
  const rootOf = (node) => {
    const r = node && node.getRootNode ? node.getRootNode() : null;
    return r && r.nodeType === 11 ? r : document.body;
  };

  // Every root that holds page text: the body plus all known shadow roots still on the page.
  function textRoots() {
    const out = [document.body];
    for (const r of shadows) {
      if (r.host && r.host.isConnected) out.push(r); else dropShadow(r);
    }
    return out;
  }

  function dropShadow(r) {
    shadows.delete(r);
    const o = shadowObs.get(r);
    if (o) { o.disconnect(); shadowObs.delete(r); }
  }

  function drain() {
    if (observer) observer.takeRecords();
    for (const o of shadowObs.values()) o.takeRecords();
  }

  function watchShadow(sr) {
    if (shadows.has(sr)) return false;
    shadows.add(sr);
    // the faint tint / dotted underline is styled per tree, so give each shadow tree the same rules
    try {
      if (canHighlight && typeof CSSStyleSheet !== 'undefined') {
        if (!hlSheet) { hlSheet = new CSSStyleSheet(); hlSheet.replaceSync(HL_CSS); }
        sr.adoptedStyleSheets = [...sr.adoptedStyleSheets, hlSheet];
      }
    } catch (e) { /* the price still converts, just without the cue */ }
    if (ctx) {
      const o = new MutationObserver(onMutations);
      o.observe(sr, { childList: true, subtree: true, characterData: true });
      shadowObs.set(sr, o);
    }
    return true;
  }

  // Find shadow hosts inside `root` (and inside the shadow roots found) and scan their content.
  function scanShadows(root) {
    const list = root.querySelectorAll ? [...root.querySelectorAll('*')] : [];
    if (root.nodeType === 1) list.push(root);
    let n = 0;
    for (const el of list) {
      if (++n > 30000) break;
      const sr = shadowOf(el);
      if (!sr) continue;
      watchShadow(sr);
      scan(sr);
    }
  }

  const log = (...a) => { if (settings.debug) console.info('[Price Auto Converter]', ...a); };
  let state = 'starting';   // starting | active | off | excluded | norates
  let stateReason = '';
  let runId = 0;
  let siteConverter = '';   // why we think the site has its own currency converter ('' = it doesn't)
  let initTimer = null;
  let reapplyTimer = null;
  let lastBare = 0;
  let bareTries = 0;

  const pending = new Set();
  const conv = new Map();     // Text node -> { orig, text, parts[], ranges[] }
  const azSaved = new Map();  // Amazon-style price element -> saved DOM, so it can be restored
  const grouped = new Map();  // blanked text node of a split price -> the node that now holds the price

  const hlUnder = canHighlight ? new Highlight() : null;   // dotted underline
  const hlTint = canHighlight ? new Highlight() : null;    // faint tint
  if (canHighlight) {
    CSS.highlights.set('pc-converted', hlUnder);
    CSS.highlights.set('pc-tint', hlTint);
  }
  const markRanges = (rs) => {
    if (!ctx || !canHighlight) return;
    rs.forEach((r) => { if (ctx.underline) hlUnder.add(r); if (ctx.tint) hlTint.add(r); });
  };
  const unmarkRanges = (rs) => {
    if (!canHighlight) return;
    rs.forEach((r) => { hlUnder.delete(r); hlTint.delete(r); });
  };

  // ---------- helpers ----------

  function hostIn(list) {
    const host = location.hostname.toLowerCase();
    return (list || '').split('\n').map((x) => x.trim().toLowerCase()).filter(Boolean)
      .some((d) => host === d || host.endsWith('.' + d));
  }
  const siteExcluded = () => hostIn(settings.excluded);

  // ---------- the site's own currency converter ----------
  // Many shops (Shopify "currencies.js", Doubly, WooCommerce switchers, ...) convert prices
  // themselves. Converting on top of that gives wrong numbers, because their scripts re-read
  // the text we changed. So when one is found we stay out of the way.

  const CONVERTER_DOM = [
    '[data-currency]', '[data-currency-code]', '[data-currency-switcher]', '[data-currency-selector]',
    'select[name*="currency" i]', 'select[id*="currency" i]',
    '[class*="currency-switch" i]', '[class*="currency_switch" i]', '[class*="currency-select" i]',
    '[class*="currency_select" i]', '[class*="currency-picker" i]', '[class*="currency-dropdown" i]',
    '[class*="currency-converter" i]', '[class*="currencyconverter" i]',
    '[id*="currency-switch" i]', '[id*="currency-select" i]', '[id*="currency-picker" i]',
    '[id*="currency-converter" i]', '#currencies',
    '[class*="woocs" i]', '[class*="wmc-" i]', '[class*="wcml" i]', '[class*="doubly" i]', '[id*="doubly" i]'
  ].join(',');
  const CONVERTER_SRC = /currenc(y|ies)[-_.a-z0-9]*\.js|doubly|woocs|wmc-|curcy|currency-?(switch|convert|select)/i;
  const CONVERTER_TEXT = /Currency\.(convertAll|rates|cookie)|doublyCurrency|currencyConverter|woocs_/;

  function detectConverter() {
    try {
      const el = document.querySelector(CONVERTER_DOM);
      if (el) {
        return el.matches('[data-currency],[data-currency-code]')
          ? 'prices are tagged with the site’s own currency data'
          : 'it has a currency switcher';
      }
      for (const sc of document.scripts) {
        if (sc.src) {
          if (CONVERTER_SRC.test(sc.src)) return 'it loads a currency converter script';
        } else if (sc.textContent && sc.textContent.length < 300000 && CONVERTER_TEXT.test(sc.textContent)) {
          return 'it runs a currency converter script';
        }
      }
    } catch (e) { /* ignore */ }
    return '';
  }


  // ---------- prices shown without any symbol ("150") ----------
  // Some shops print just the number and leave the currency implied. We work the currency out
  // from the page itself, strongest evidence first:
  //   1. your own choice for the site (popup, optional)
  //   2. product/store data in the page (meta tags, JSON-LD, Shopify/WooCommerce settings)
  //   3. currencies written elsewhere on the page ("Free delivery over AED 100")
  //   4. the page language region (en-AE) or the site address (.ae, uae.example.com)
  // A bare number is only converted when it sits in something that looks like a price.

  const PRICE_HINT = /price|money|amount|cost/i;
  const NOT_PRICE = /(^|[-_\s])(qty|quantity|count|rating|reviews?|stock|percent|phone|tel|zip)([-_\s]|$)/i;
  const LABEL_PRICE = /^\s*(?:[A-Za-z][A-Za-z ]{0,24})?(?:price|total|subtotal)\s*:?\s*[\d.,\u00a0\u202f'’ ]+\s*$/i;

  const REGION_CUR = {
    ae: 'AED', uae: 'AED', sa: 'SAR', ksa: 'SAR', saudi: 'SAR', qa: 'QAR', qatar: 'QAR', kw: 'KWD', bh: 'BHD',
    om: 'OMR', jo: 'JOD', lb: 'LBP', eg: 'EGP', ma: 'MAD', ng: 'NGN', ke: 'KES', za: 'ZAR', pk: 'PKR',
    in: 'INR', india: 'INR', bd: 'BDT', lk: 'LKR', ph: 'PHP', my: 'MYR', sg: 'SGD', id: 'IDR', th: 'THB',
    vn: 'VND', kr: 'KRW', jp: 'JPY', cn: 'CNY', hk: 'HKD', tw: 'TWD', au: 'AUD', nz: 'NZD', ca: 'CAD',
    us: 'USD', mx: 'MXN', br: 'BRL', ar: 'ARS', cl: 'CLP', pe: 'PEN', uk: 'GBP', gb: 'GBP',
    ie: 'EUR', de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR', be: 'EUR', at: 'EUR', pt: 'EUR',
    fi: 'EUR', gr: 'EUR', se: 'SEK', no: 'NOK', dk: 'DKK', ch: 'CHF', pl: 'PLN', cz: 'CZK', hu: 'HUF',
    ro: 'RON', tr: 'TRY', ru: 'RUB', ua: 'UAH', il: 'ILS'
  };

  // Languages used by (almost) one currency only. Weak evidence, last resort.
  const LANG_CUR = {
    ja: 'JPY', ko: 'KRW', th: 'THB', vi: 'VND', sv: 'SEK', nb: 'NOK', nn: 'NOK', no: 'NOK', da: 'DKK',
    pl: 'PLN', cs: 'CZK', hu: 'HUF', tr: 'TRY', ru: 'RUB', uk: 'UAH', he: 'ILS', id: 'IDR', ms: 'MYR',
    hi: 'INR', fil: 'PHP', tl: 'PHP'
  };

  // What an ambiguous symbol means on this page: the site's currency if it belongs to the
  // symbol's family ($ -> CAD on a Canadian shop), your fixed choice if you made one, otherwise
  // the usual default ($ -> USD, ¥ -> JPY, Rs -> INR). "kr" and "R" have no default: they are
  // only converted when the page says which krona / rand it means.
  function resolveSymbols(code) {
    const fam = (name, mode, dflt) => {
      if (mode && mode !== 'auto' && rates && rates[mode]) return mode;
      return code && PC.FAMILY[name].includes(code) && rates && rates[code] ? code : dflt;
    };
    return {
      dollar: fam('dollar', settings.dollarMode, 'USD'),
      yen: fam('yen', settings.yenMode, 'JPY'),
      krona: fam('krona', '', ''),
      rupee: fam('rupee', '', 'INR'),
      rand: fam('rand', '', '')
    };
  }

  function siteCurrencyOverride() {
    const host = location.hostname.toLowerCase();
    for (const line of (settings.siteCurrencies || '').split('\n')) {
      const [d, c] = line.split('=').map((x) => (x || '').trim());
      if (d && c && (host === d.toLowerCase() || host.endsWith('.' + d.toLowerCase())) && rates && rates[c.toUpperCase()]) {
        return c.toUpperCase();
      }
    }
    return '';
  }

  // Walk JSON (JSON-LD etc.) looking for a priceCurrency value.
  function jsonCurrency(v, depth = 0) {
    if (!v || typeof v !== 'object' || depth > 8) return '';
    if (typeof v.priceCurrency === 'string') return v.priceCurrency.toUpperCase();
    for (const k of Object.keys(v)) {
      const c = jsonCurrency(v[k], depth + 1);
      if (c) return c;
    }
    return '';
  }

  // Currencies written on the page itself; the clear winner is almost always the shop's currency.
  function voteCurrency() {
    const votes = { ...ctx.mentions };   // mentions already converted still count
    const vctx = { ...ctx, target: '' };
    let seen = 0;
    for (const root of textRoots()) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n && seen < 800; n = w.nextNode()) {
        const t = n.nodeValue;
        if (t.length > 300 || !/\d/.test(t) || conv.has(n) || grouped.has(n)) continue;
        const p = n.parentElement;
        if (!p || p.closest(SKIP)) continue;
        seen++;
        for (const h of PC.find(t, vctx)) if (!h.amb) votes[h.from] = (votes[h.from] || 0) + 1;
      }
    }
    const top = Object.entries(votes).sort((x, y) => y[1] - x[1]);
    if (!top.length || (top[1] && top[1][1] === top[0][1])) return '';
    return top[0][0];
  }

  // -> { code, source } ; code is '' when nothing could be worked out
  function detectPageCurrency() {
    const ok = (c) => (c && rates && rates[c] ? c : '');
    const out = (code, source) => ({ code, source });
    const o = siteCurrencyOverride();
    if (o) return out(o, 'your choice');
    try {
      for (const sel of ['meta[property="product:price:currency"]', 'meta[property="og:price:currency"]',
        'meta[property="og:currency"]', 'meta[name="currency"]',
        'meta[itemprop="priceCurrency"]', '[itemprop="priceCurrency"]']) {
        const e = document.querySelector(sel);
        const c = ok(e && (e.getAttribute('content') || e.textContent || '').trim().toUpperCase());
        if (c) return out(c, 'the page’s product data');
      }
      for (const sc of document.scripts) {
        if (sc.src || !sc.textContent || sc.textContent.length > 400000) continue;
        const t = sc.textContent;
        let c = '';
        if (sc.type === 'application/ld+json') {
          try { c = ok(jsonCurrency(JSON.parse(t))); } catch (e) { /* ignore */ }
          if (!c) { const m = /"priceCurrency"\s*:\s*"([A-Z]{3})"/.exec(t); c = ok(m && m[1]); }
        } else if (t.includes('Shopify')) {
          const m = /Shopify\.currency\s*=\s*\{[^}]*?"active"\s*:\s*"([A-Z]{3})"/.exec(t) ||
            /ShopifyAnalytics[\s\S]{0,4000}?"currency"\s*:\s*"([A-Z]{3})"/.exec(t);
          c = ok(m && m[1]);
        } else if (/woocommerce|wc_/i.test(t)) {
          const m = /"currency(?:_code)?"\s*:\s*"([A-Z]{3})"/.exec(t);
          c = ok(m && m[1]);
        }
        if (c) return out(c, 'the store’s settings');
      }
      const el = document.querySelector('input[name="currency"],input[name="currency_code"],[data-currency-code]');
      const dc = ok(el && (el.value || el.getAttribute('data-currency-code') || '').trim().toUpperCase());
      if (dc) return out(dc, 'the page’s data');

      if (ctx) {
        const v = ok(voteCurrency());
        if (v) return out(v, 'currency written on the page');
      }
      const labels = location.hostname.toLowerCase().split('.');
      const guess = (labels.length > 2 && REGION_CUR[labels[0]]) || REGION_CUR[labels[labels.length - 1]];
      if (guess && rates[guess]) return out(guess, 'the site address');
      const lang = (document.documentElement.lang || '').toLowerCase().split(/[-_]/);
      const byRegion = REGION_CUR[lang[1]];
      if (byRegion && rates[byRegion]) return out(byRegion, 'the page language');
      const byLang = LANG_CUR[lang[0]];
      if (byLang && rates[byLang]) return out(byLang, 'the page language');
    } catch (e) { /* ignore */ }
    return out('', '');
  }

  // Nearest ancestor (up to 3 levels) that looks like a price element, or null.
  function priceElement(el) {
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const cls = typeof el.className === 'string' ? el.className : '';
      let attrs = '';
      for (const a of el.attributes) if (/price|amount/i.test(a.name)) attrs += ' ' + a.name;
      const s = `${cls} ${el.id || ''} ${el.getAttribute('itemprop') || ''}${attrs}`;
      if (NOT_PRICE.test(s)) return null;
      if (PRICE_HINT.test(s)) return el;
    }
    return null;
  }

  // "Sale price" + "150" even when no class says "price".
  function labelledPrice(node) {
    let el = node.parentElement;
    for (let i = 0; el && i < 3; i++, el = el.parentElement) {
      const t = textUpTo(el, 60);
      if (t === null) return null;
      if (LABEL_PRICE.test(t)) return el;
    }
    return null;
  }

  // An old price crossed out with <s>/<del>: a lone number with decimals in there is a price.
  const STRUCK_NUM = /^\s*\d[\d.,\u00a0\u202f' ]*[.,]\d{2}\s*$/;
  function struckPrice(node) {
    const el = node.parentElement && node.parentElement.closest('s,del,strike');
    return el && !blocked(node) && STRUCK_NUM.test(node.nodeValue) ? el : null;
  }

  const priceLike = (node) => priceElement(node.parentElement) || labelledPrice(node) || struckPrice(node);

  function bareHits(text, node) {
    const el = priceLike(node);
    const et = el && textUpTo(el, 200, true);
    if (!el || et === null || PC.hasCurrency(et, ctx)) return [];
    // a currency sitting next to the number ("120.00" + "AED") is handled as a split price instead
    const par = el.parentElement;
    const pt = par && PC.isBareNumber(et) ? textUpTo(par, 120, true) : null;
    if (pt !== null && PC.hasCurrency(pt, ctx)) return [];
    const h = PC.bare(text, ctx.bare, ctx);
    return h ? [h] : [];
  }

  // Price metadata can arrive late (SPA, lazy scripts): keep trying a few times.
  function retryBare() {
    lastBare = Date.now();
    bareTries++;
    if (!ctx || ctx.bare) return;
    const d = detectPageCurrency();
    if (!d.code) return;
    ctx.bare = d.code;
    ctx.bareSource = d.source;
    ctx.sym = resolveSymbols(d.code);
    ctx.skipped.clear();
    scan(document.body);
    drain();
    syncBadge();
  }

  // What the toolbar icon should show for this tab:
  //   amber "!" or a count = needs you (paused by a site converter / currency unknown / no rates)
  //   grey OFF            = switched off here
  //   nothing             = all good
  let lastBadge = '';
  function badgeInfo() {
    if (state === 'off' || state === 'excluded') {
      return { text: 'OFF', kind: 'off', title: 'Price Auto Converter: off on this site.' };
    }
    if (state === 'norates') {
      return { text: '!', kind: 'attention', title: 'Price Auto Converter: waiting for exchange rates. Click to open settings.' };
    }
    if (state === 'active' && ctx) {
      const unknown = ctx.bare ? 0 : ctx.skipped.size;
      const n = unknown + ctx.missed.size;
      if (n > 0) {
        const plural = n === 1 ? '' : 's';
        return { text: n > 99 ? '99+' : String(n), kind: 'attention',
          title: ctx.missed.size
            ? `Price Auto Converter: ${n} price${plural} on this page may not be converted. Click the icon, then “Missed a price? Copy details”.`
            : `Price Auto Converter: ${n} price${plural} shown without a currency couldn’t be converted. Click to choose the currency.` };
      }
    }
    return { text: '', kind: '', title: 'Price Auto Converter' };
  }

  function syncBadge() {
    const b = badgeInfo();
    const key = `${b.text}|${b.kind}|${b.title}`;
    if (key === lastBadge) return;
    lastBadge = key;
    try { chrome.runtime.sendMessage({ type: 'badge', ...b }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  // Does the site's own currency menu already offer the user's currency? (information only: we
  // convert either way, and skip prices that are already in that currency)
  function offersTarget() {
    const c = settings.target;
    if (!/^[A-Z]{3}$/.test(c || '')) return false;
    try {
      return !!document.querySelector(`[data-currency="${c}" i],[data-currency-code="${c}" i],option[value="${c}" i],[data-value="${c}" i]`);
    } catch (e) { return false; }
  }

  function setState(s, why = '') {
    state = s;
    stateReason = why;
    log(s + (why ? ': ' + why : ''));
    syncBadge();
  }

  function convertedCount() {
    let n = azSaved.size;
    for (const e of conv.values()) n += e.parts.length;
    return n;
  }

  // ---------- start / stop ----------

  function start() {
    stop();
    const run = ++runId;
    if (!settings.enabled) return setState('off', 'turned off in settings');
    if (!rates) return setState('norates', 'no exchange rates yet (open settings and press Refresh now)');
    if (!rates[settings.target]) return setState('norates', 'unknown target currency ' + settings.target);
    if (siteExcluded()) return setState('excluded', 'disabled for this site');
    if (!document.body) return setState('off', 'no page body');
    const ind = settings.indicator === 'underline' ? 'standard' : settings.indicator;   // 'underline' was the old default
    ctx = {
      rates,
      target: settings.target,
      sym: resolveSymbols(''),           // what $, ¥, kr, Rs, R mean on this page (refined below)
      fee: Math.min(5, Math.max(0, Number(settings.fxBuffer) || 0)),   // card / FX fee buffer, percent
      whole: !!settings.whole,
      tilde: ind === 'standard' || ind === 'tilde' || !canHighlight,   // "≈" before the price
      underline: ind === 'standard' || ind === 'minimal',
      tint: ind === 'standard',
      locale: PC.locale(),
      bare: '',
      bareSource: '',
      skipped: new Set(),   // price-like numbers whose currency is unknown
      mentions: {},
      missed: new Set(),    // lone currency labels beside a number that we could not turn into a price
      suffixCodes: false,   // does this site write codes after the number ("50 USD")? learned below
      forms: { prefix: 0, suffix: 0 }
    };
    const det = detectPageCurrency();
    ctx.bare = det.code;
    ctx.bareSource = det.source;
    ctx.sym = resolveSymbols(det.code);
    lastBare = Date.now();
    bareTries = 0;
    setState('active');

    // A site with its own currency converter may still be applying its saved currency right
    // after load. Give it a moment first, so it works from its own numbers and not from ours.
    siteConverter = detectConverter();
    const begin = () => {
      if (run !== runId || !ctx) return;
      scan(document.body);
      drain();
      log(`target ${ctx.target}; converted ${convertedCount()} price(s) so far`);
      syncBadge();
      observer = new MutationObserver(onMutations);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (siteConverter) initTimer = setTimeout(begin, 1000); else begin();
    // web components often attach and fill their shadow trees a little after load: look again
    for (const ms of [800, 2500, 6000]) {
      setTimeout(() => {
        if (run !== runId || !ctx || state !== 'active' || !observer) return;
        scan(document.body);
        drain();
        syncBadge();
      }, ms);
    }
    for (const ms of [1500, 4000]) {
      setTimeout(() => {
        if (run !== runId) return;
        siteConverter = siteConverter || detectConverter();
        retryBare();
      }, ms);
    }
  }

  // Put every page text we changed back to the site's original.
  function revertAll() {
    for (const [el, s] of azSaved) {
      s.off.textContent = s.offText;
      s.vis.replaceChildren(...s.visNodes);
      el.removeAttribute('data-pc-az');
    }
    azSaved.clear();
    for (const [node, e] of conv) {
      if (node.nodeValue === e.text) node.nodeValue = e.orig;
      for (const x of e.extras || []) if (x.node.nodeValue === x.text) x.node.nodeValue = x.orig;
    }
    conv.clear();
    grouped.clear();
    if (canHighlight) { hlUnder.clear(); hlTint.clear(); }
    hideTip();
  }

  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
    for (const o of shadowObs.values()) o.disconnect();
    shadowObs.clear(); shadows.clear();
    clearTimeout(flushTimer); flushTimer = null;
    clearTimeout(initTimer); clearTimeout(reapplyTimer);
    pending.clear();
    revertAll();
    ctx = null;
  }

  // The visitor is using the site's own currency switcher. Put the site's original text back
  // right now (this capture-phase listener runs before the site's own handlers), so the site
  // converts from its own numbers, then convert again once it has finished.
  const onSwitch = (e) => {
    if (!ctx) return;
    if (!alive()) return shutdown();
    const t = e.target;
    const el = t && t.closest ? t.closest(CONVERTER_DOM) : null;
    if (!el || /price|money|amount/i.test(typeof el.className === 'string' ? el.className : '')) return;
    revertAll();
    drain();
    clearTimeout(reapplyTimer);
    reapplyTimer = setTimeout(() => {
      if (!ctx || state !== 'active') return;
      scan(document.body);
      drain();
      syncBadge();
    }, 1200);
  };
  document.addEventListener('click', onSwitch, true);
  document.addEventListener('change', onSwitch, true);

  // ---------- scanning ----------

  function scan(root) {
    const frags = [];
    if (root.nodeType === 3) {
      handleText(root, frags);
    } else {
      const isShadowRoot = root.nodeType === 11;
      if (!isShadowRoot && (root.nodeType !== 1 || root.closest(SKIP))) return;
      const prices = !isShadowRoot && root.matches('.a-price') ? [root] : [];
      root.querySelectorAll('.a-price').forEach((el) => prices.push(el));
      prices.forEach(convertAmazon);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
      nodes.forEach((n) => handleText(n, frags));
      scanShadows(root);
    }
    frags.forEach(convertSplit);
  }

  function handleText(node, frags) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP) || p.closest('.a-price')) return;
    const carrier = grouped.get(node);
    if (carrier) {
      if (node.nodeValue === '') return;   // our own blanked node
      forget(carrier);                      // the page changed part of a split price
    }
    if (!convertNode(node) && frags && PC.isFragment(node.nodeValue) && (/\d/.test(node.nodeValue) || PC.hasCurrency(node.nodeValue, ctx))) frags.push(node);
  }

  // Edits the text node's value in place (keeps the page's own DOM nodes intact, so
  // frameworks like React keep working) and remembers where each converted price sits.
  // Returns true if the node holds a converted price afterwards.
  function convertNode(node) {
    const text = node.nodeValue;
    const prev = conv.get(node);
    if (prev && prev.text === text) return true;     // our own output
    if (prev) forget(node);                           // the page changed this text
    if (!text || text.length > 3000 || !/\d/.test(text)) return false;
    const info = {};
    let hits = PC.find(text, ctx, info);
    if (!hits.length) {
      if (ctx.bare) hits = bareHits(text, node);
      else if (PC.isBareNumber(text) && priceLike(node)) ctx.skipped.add(node);   // price with unknown currency
      if (!hits.length && info.unresolved) ctx.skipped.add(node);                // "kr" with no currency hint
    }
    if (!hits.length) return false;
    for (const h of hits) {
      if (h.label || h.amb) continue;
      ctx.mentions[h.from] = (ctx.mentions[h.from] || 0) + 1;
      // learn whether this site puts currency codes before ("AED 50") or after ("50 AED") the number
      if (/^[A-Z]{3}/.test(h.text)) ctx.forms.prefix++; else if (/[A-Z]{3}$/.test(h.text)) ctx.forms.suffix++;
      ctx.suffixCodes = ctx.forms.suffix >= 2 && ctx.forms.suffix > ctx.forms.prefix;
    }

    let out = '';
    let pos = 0;
    let prevHit = null;
    const parts = [];
    for (const h of hits) {
      let gap = text.slice(pos, h.start);
      // "$10 - $25" -> "≈ ₱560 – ₱1,400": one ≈ for the whole range
      const range = !!prevHit && prevHit.from === h.from && /^\s*(?:[-–—~〜～]|to)\s*$/i.test(gap);
      if (range) gap = gap.replace(/[-—]/, '–');
      out += gap;
      const shown = PC.render(h, ctx, !range);
      parts.push({ start: out.length, end: out.length + shown.length, orig: h.label || h.text, from: h.from });
      out += shown;
      pos = h.end;
      prevHit = h;
    }
    out += text.slice(pos);

    node.nodeValue = out;
    const ranges = parts.map((p) => {
      const r = new Range();
      r.setStart(node, p.start);
      r.setEnd(node, p.end);
      return r;
    });
    conv.set(node, { orig: text, text: out, parts, ranges });
    markRanges(ranges);
    return true;
  }

  function forget(node) {
    const e = conv.get(node);
    if (!e) return;
    unmarkRanges(e.ranges);
    for (const x of e.extras || []) {
      grouped.delete(x.node);
      if (x.node.nodeValue === x.text) x.node.nodeValue = x.orig;
    }
    conv.delete(node);
  }

  // ---- prices split across elements: <span>AED</span><span>465</span>, "$" "19" "." "99" ----

  // Prices are often built from several elements ("AED" + "94.50", a "-" before it, a label
  // next to it, a struck-through old price beside the new one). Read the text of a small block
  // as one string, find the prices in it, and convert each price whose pieces are whole nodes.
  const LIST_LIKE = /^(TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|DL|SELECT)$/;
  const needsSpace = (a, b) => (/[A-Za-z]/.test(a) && /[A-Za-z0-9]/.test(b)) || (/\d/.test(a) && /[A-Za-z0-9]/.test(b));   // keeps "Qty 2" and "99.00" apart

  function convertSplit(node) {
    if (!ctx || !node.isConnected || conv.has(node) || grouped.has(node)) return;
    if (convertInBlock(node)) return;          // 1. read the surrounding block as one string
    if (pairNeighbours(node)) return;          // 2. a lone "AED" right next to a lone "94.50", however deep
    if (absorbLabel(node)) return;             // 3. a lone "AED" left beside a price that is already converted
    noteMissed(node);                          // 4. looks like a price, but we couldn't finish it
  }

  // A foreign currency label sitting right next to a bare number, and still not converted: tell the
  // visitor (amber count on the icon) so they can report it with "Copy details".
  function noteMissed(node) {
    const t = PC.clean(node.nodeValue);
    if (!isCurrencyOnly(t) || !PC.find(t + ' 1', ctx).length) return;
    for (const dir of [1, -1]) {
      const other = neighbourText(node, dir);
      if (!other || !isNumberOnly(PC.clean(other.nodeValue))) continue;
      const tb = node.parentElement && node.parentElement.closest('table');
      if (tb && tb.contains(other)) continue;                 // table header + cell: not one price
      ctx.missed.add(node);
      return;
    }
  }

  // A price with no currency shown, drawn in pieces: whole part, separator and cents in their own
  // elements ("13" "," "55"). Only this exact shape counts, so ratings, times and counts are safe.
  const BARE_SPLIT = /(?:^|¦)(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?=¦|$)/g;
  function bareSplit(spans, joined) {
    let done = false;
    BARE_SPLIT.lastIndex = 0;
    for (let m = BARE_SPLIT.exec(joined); m; m = BARE_SPLIT.exec(joined)) {
      const start = m.index + m[0].length - m[1].length;
      const end = start + m[1].length;
      const inside = spans.filter((sp) => sp.start < end && sp.end > start);
      if (inside.length < 2) continue;                                  // inside one node: handled by convertNode
      if (inside.some((sp) => sp.start < start || sp.end > end)) continue;
      if (inside.some((sp) => conv.has(sp.node) || grouped.has(sp.node) || blocked(sp.node))) continue;
      const h = PC.bare(m[1], ctx.bare, ctx);
      if (!h) continue;
      applySplit(inside.map((sp) => sp.node), h);
      done = true;
    }
    return done;
  }

  function convertInBlock(node) {
    let el = node.parentElement;
    for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
      if (el.closest(SKIP) || LIST_LIKE.test(el.tagName) || textUpTo(el, 160) === null) return false;   // never join across table cells / list items
      const nodes = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n);
      if (nodes.length < 2 || nodes.length > 24) continue;
      // Some sites draw a price one character per element ("A" "E" "D" " " "1" "5" "7" "." "5" "0"),
      // for a ticker effect. Then the text must be joined exactly as is, with no spaces added.
      const tiny = nodes.filter((n) => PC.clean(n.nodeValue).length <= 1).length;
      const charSplit = nodes.length >= 5 && tiny / nodes.length >= 0.8;
      let joined = '';
      const spans = [];                                   // where each node's text sits inside `joined`
      for (const n of nodes) {
        // already-converted prices are barriers, so "₱1,830" + "AED" next to it can't fuse into one price
        if (conv.has(n) || grouped.has(n)) { if (joined && !joined.endsWith('¦')) joined += '¦'; continue; }
        const t = PC.clean(n.nodeValue) || (charSplit && n.nodeValue ? ' ' : '');
        if (!t) continue;
        if (!charSplit && joined && needsSpace(joined.slice(-1), t[0])) joined += ' ';
        spans.push({ node: n, start: joined.length, end: joined.length + t.length });
        joined += t;
      }
      if (!/\d/.test(joined)) continue;
      let done = false;
      for (const h of PC.find(joined, ctx)) {
        const inside = spans.filter((s) => s.start < h.end && s.end > h.start);
        if (inside.length < 2) continue;                  // inside one node: handled by convertNode
        if (inside.some((s) => s.start < h.start || s.end > h.end)) continue;   // would cut a node's text
        if (inside.some((s) => conv.has(s.node) || grouped.has(s.node) || blocked(s.node))) continue;
        applySplit(inside.map((s) => s.node), h);
        done = true;
      }
      if (!done && ctx.bare) done = bareSplit(spans, joined);
      if (done) return true;
    }
    return false;
  }

  // Closest non-blank text node before (dir < 0) or after (dir > 0) `node`, in page order.
  function neighbourText(node, dir) {
    const w = document.createTreeWalker(rootOf(node), NodeFilter.SHOW_TEXT);
    w.currentNode = node;
    for (let i = 0, n = dir > 0 ? w.nextNode() : w.previousNode(); n && i < 8; i++, n = dir > 0 ? w.nextNode() : w.previousNode()) {
      if (PC.clean(n.nodeValue)) return n;
    }
    return null;
  }

  // Do two nodes sit in the same small block (so they belong to the same line of the page)?
  function sameBlock(a, b) {
    let el = a.parentElement;
    for (let i = 0; el && i < 7; i++, el = el.parentElement) {
      if (el.contains(b)) return !LIST_LIKE.test(el.tagName) && textUpTo(el, 300) !== null;
    }
    return false;
  }

  // Pieces that are never part of a price: the site's currency switcher, quantities, counts, ratings.
  function blocked(node) {
    let el = node.parentElement;
    if (el && el.closest(CONVERTER_DOM)) return true;
    for (let i = 0; el && i < 3; i++, el = el.parentElement) {
      const cls = typeof el.className === 'string' ? el.className : '';
      if (NOT_PRICE.test(`${cls} ${el.id || ''}`)) return true;
    }
    return false;
  }

  const isCurrencyOnly = (t) => PC.isFragment(t) && !/\d/.test(t) && !!ctx && PC.hasCurrency(t, ctx);
  const isNumberOnly = (t) => PC.isFragment(t) && /\d/.test(t);

  // "AED" and "150.00" as neighbours in page order, however the elements are nested.
  function pairNeighbours(node) {
    const t = PC.clean(node.nodeValue);
    if (!isCurrencyOnly(t) && !isNumberOnly(t)) return false;
    for (const dir of [1, -1]) {
      const other = neighbourText(node, dir);
      if (!other || conv.has(other) || grouped.has(other) || blocked(node) || blocked(other) || !sameBlock(node, other)) continue;
      const o = PC.clean(other.nodeValue);
      if (!(isCurrencyOnly(t) ? isNumberOnly(o) : isCurrencyOnly(o))) continue;
      const [first, second] = dir > 0 ? [t, o] : [o, t];
      const joined = first + (needsSpace(first.slice(-1), second[0]) ? ' ' : '') + second;
      const hits = PC.find(joined, ctx);
      if (hits.length === 1 && hits[0].start === 0 && hits[0].end === joined.length) {
        applySplit(dir > 0 ? [node, other] : [other, node], hits[0]);
        return true;
      }
    }
    return false;
  }

  // A lone "AED" left next to a price we already converted (for example a number converted on its
  // own): hide the stray label so it doesn't sit beside the new currency.
  function absorbLabel(node) {
    const t = PC.clean(node.nodeValue);
    if (!isCurrencyOnly(t)) return false;
    const probe = PC.find(t + ' 1', ctx)[0];                // which currency does this label name?
    if (!probe) return false;
    for (const dir of [1, -1]) {
      const other = neighbourText(node, dir);
      const e = other && conv.get(other);
      if (!e || !sameBlock(node, other) || !e.parts.some((p) => p.from === probe.from)) continue;
      e.extras = (e.extras || []).concat({ node, orig: node.nodeValue, text: '' });
      node.nodeValue = '';
      grouped.set(node, other);
      return true;
    }
    return false;
  }

  // Put the converted price into the node holding the digits and blank the other pieces
  // (they stay in the page, so the site's own updates keep working).
  function applySplit(nodes, hit) {
    const live = nodes.filter((n) => n.nodeValue.trim());
    const carrier = live.find((n) => /\d/.test(n.nodeValue)) || live[0];
    const shown = PC.render(hit, ctx);
    const orig = carrier.nodeValue;
    const extras = live.filter((n) => n !== carrier).map((n) => ({ node: n, orig: n.nodeValue, text: '' }));
    carrier.nodeValue = shown;
    extras.forEach((x) => { x.node.nodeValue = ''; grouped.set(x.node, carrier); });
    const r = new Range();
    r.setStart(carrier, 0);
    r.setEnd(carrier, shown.length);
    conv.set(carrier, { orig, text: shown, parts: [{ start: 0, end: shown.length, orig: hit.text, from: hit.from }], ranges: [r], extras });
    markRanges([r]);
  }

  // Amazon splits prices into separate <span>s ("$" "19" "99"); rebuild the visible part.
  function convertAmazon(el) {
    if (el.hasAttribute('data-pc-az') || !ctx) return;
    const off = el.querySelector('.a-offscreen');
    const vis = el.querySelector(':scope > [aria-hidden="true"]');
    if (!off || !vis) return;
    const t = off.textContent.trim();
    const hits = PC.find(t, ctx);
    if (hits.length !== 1 || hits[0].start !== 0 || hits[0].end !== t.length) return;
    const shown = PC.render(hits[0], ctx);
    azSaved.set(el, { off, offText: off.textContent, vis, visNodes: Array.from(vis.childNodes) });
    el.setAttribute('data-pc-az', '');
    off.textContent = shown;
    const sp = document.createElement('span');
    sp.setAttribute('data-pc', [ctx.underline && 'u', ctx.tint && 't'].filter(Boolean).join(' '));
    sp.dataset.orig = hits[0].text;
    sp.dataset.from = hits[0].from;
    sp.textContent = shown;
    vis.replaceChildren(sp);
  }

  // ---------- live updates ----------

  function onMutations(list) {
    if (!alive()) return shutdown();
    for (const m of list) {
      if (m.type === 'characterData') pending.add(m.target);
      else for (const n of m.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) pending.add(n);
    }
    if (!flushTimer) flushTimer = setTimeout(flush, 120);
  }

  function flush() {
    flushTimer = null;
    if (ctx && !ctx.bare && ctx.skipped.size > 0 && bareTries < 8 && Date.now() - lastBare > 2000) retryBare();
    if (!ctx || !observer) return;
    const nodes = [...pending];
    pending.clear();
    for (const n of nodes) if (n.isConnected) scan(n);
    drain();                                          // ignore the changes we just made
    for (const [n] of conv) if (!n.isConnected) forget(n);
    for (const n of ctx.skipped) if (!n.isConnected) ctx.skipped.delete(n);
    for (const n of ctx.missed) {
      if (!n.isConnected || conv.has(n) || grouped.has(n) || !isCurrencyOnly(PC.clean(n.nodeValue))) ctx.missed.delete(n);
    }
    syncBadge();
  }

  // ---------- hover tooltip ----------

  let tipEl = null;
  let tipEls = null;
  let tipKey = '';

  function ensureTip() {
    if (tipEl) return;
    const host = document.createElement('div');
    host.id = 'pc-tooltip-host';
    host.style.cssText = 'all:initial';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent =
      '.tip{display:none;position:fixed;z-index:2147483647;max-width:230px;padding:5px 9px;' +
      'border-radius:8px;background:#1f2937;color:#f9fafb;pointer-events:none;' +
      'font:12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.28)}' +
      '.tip.show{display:block}.orig{font-size:14px;font-weight:700}' +
      '.rate{font-size:11px;opacity:.85}.by{font-size:10px;opacity:.85}';
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'tooltip');
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; tip.appendChild(d); return d; };
    const elOrig = mk('orig'); const elRate = mk('rate'); const elBy = mk('by');
    root.append(style, tip);
    document.documentElement.appendChild(host);
    tipEl = tip;
    tipEls = { orig: elOrig, rate: elRate, by: elBy };
    tipEls.by.textContent = `Converted by ${BRAND}`;
  }

  function showTip({ orig, from, rect }) {
    if (!ctx) return;
    ensureTip();
    const key = `${orig}|${from}|${Math.round(rect.left)}|${Math.round(rect.top)}`;
    if (key === tipKey) return;
    tipKey = key;
    tipEls.orig.textContent = `Original: ${orig}`;
    const feeNote = ctx.fee > 0 ? ` (incl. ${ctx.fee}% fee)` : '';
    tipEls.rate.textContent = `1 ${from} = ${PC.formatRate(PC.rate(from, ctx), ctx.locale)} ${ctx.target}${feeNote}`;
    tipEl.classList.add('show');
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    let top = rect.top - h - 8;
    if (top < 8) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    tipEl.style.top = top + 'px';
    tipEl.style.left = left + 'px';
  }

  function hideTip() {
    tipKey = '';
    if (tipEl) tipEl.classList.remove('show');
  }

  // Which converted price (if any) is under the pointer?
  function partAt(x, y) {
    let node;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      node = p && p.offsetNode;
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      node = r && r.startContainer;
    }
    const e = node && conv.get(node);
    if (!e) return null;
    for (let i = 0; i < e.parts.length; i++) {
      for (const r of e.ranges[i].getClientRects()) {
        if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) {
          return { orig: e.parts[i].orig, from: e.parts[i].from, rect: r };
        }
      }
    }
    return null;
  }

  let raf = 0;
  let lastEvt = null;
  function hoverCheck() {
    raf = 0;
    if (!ctx || !lastEvt || (!conv.size && !azSaved.size)) return;
    const t = lastEvt.target;
    const el = t && t.closest ? t.closest('[data-pc]') : null;
    let info = null;
    if (el && ctx.rates[el.dataset.from]) info = { orig: String(el.dataset.orig || '').slice(0, 40), from: el.dataset.from, rect: el.getBoundingClientRect() };
    else if (!el && conv.size) info = partAt(lastEvt.clientX, lastEvt.clientY);
    if (info) showTip(info); else hideTip();
  }

  const onMove = (e) => {
    if (!alive()) return shutdown();
    lastEvt = e;
    if (!raf) raf = requestAnimationFrame(hoverCheck);
  };
  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('scroll', hideTip, { passive: true, capture: true });
  document.documentElement.addEventListener('mouseleave', hideTip);

  // If the extension is updated/removed while a page stays open, this old copy of the script is
  // orphaned: undo our changes and detach everything instead of throwing errors.
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  function shutdown() {
    stop();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('click', onSwitch, true);
    document.removeEventListener('change', onSwitch, true);
    document.removeEventListener('scroll', hideTip, true);
    document.documentElement.removeEventListener('mouseleave', hideTip);
    try { chrome.storage.onChanged.removeListener(onStorage); } catch (e) { /* ignore */ }
  }

  // ---------- settings + rates ----------

  function onStorage(changes, area) {
    if (area === 'sync') {
      for (const k of Object.keys(changes)) {
        settings[k] = changes[k].newValue !== undefined ? changes[k].newValue : PC.DEFAULTS[k];
      }
    } else if (area === 'local') {
      if (!changes.rates) return;
      const had = !!rates;
      const wasApprox = ratesApprox;
      rates = changes.rates.newValue || null;
      if (changes.ratesBundled) ratesApprox = !!changes.ratesBundled.newValue;
      // routine 6-hourly refresh: just use the new numbers from now on, don't redo the page.
      // (Going from built-in approximate rates to live ones does redo it.)
      if (had && !wasApprox && rates && rates[settings.target]) { if (ctx) ctx.rates = rates; return; }
    } else {
      return;
    }
    clearTimeout(restartTimer);
    restartTimer = setTimeout(start, 200);
  }

  async function init() {
    try {
      const [s, l] = await Promise.all([
        chrome.storage.sync.get(PC.DEFAULTS),
        chrome.storage.local.get(['rates', 'ratesBundled'])
      ]);
      settings = { ...PC.DEFAULTS, ...s };
      rates = l.rates || null;
      ratesApprox = !!l.ratesBundled;
      chrome.storage.onChanged.addListener(onStorage);
      if (!rates) chrome.runtime.sendMessage({ type: 'refresh-rates' }).catch(() => {});
      start();
    } catch (e) {
      /* extension was reloaded while this page was open — refresh the page */
    }
  }

  // ---------- "Missed a price?" helper ----------
  // Describes prices that were NOT converted (tag names, class names and short price text only)
  // so the visitor can copy it and send it for a fix. Nothing leaves the browser by itself.
  function skeleton(n, depth = 0) {
    if (n.nodeType === 3) { const t = n.nodeValue.trim(); return t ? t.slice(0, 40) : ''; }
    if (n.nodeType !== 1 || depth > 5) return '';
    const cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    return `<${n.tagName.toLowerCase()}${cls ? '.' + cls : ''}>${Array.from(n.childNodes).map((c) => skeleton(c, depth + 1)).join('')}</>`;
  }

  function diagnose() {
    const rows = [];
    if (ctx) {
      // group look-alikes ("4.3", "4.4"... star ratings; "5.4K", "468"... review counts) into one row
      const strong = new Map();
      const weak = new Map();
      let seen = 0;
      const allNodes = [];
      for (const root of textRoots()) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n && allNodes.length < 6000; n = w.nextNode()) allNodes.push(n);
      }
      for (const n of allNodes) {
        seen++;
        const t = n.nodeValue.trim();
        if (!t || t.length > 60 || conv.has(n) || grouped.has(n)) continue;
        if (!/\d/.test(t) && !PC.isFragment(t)) continue;
        const p = n.parentElement;
        if (!p || p.closest(SKIP) || t.includes(ctx.target) || t.includes('%')) continue;
        const likely = (PC.hasCurrency(t, ctx) && /\d/.test(t)) || isCurrencyOnly(t) || (PC.isBareNumber(t) && !!priceLike(n));
        if (!likely && !PC.isBareNumber(t)) continue;   // plain numbers are listed last
        let box = p;
        for (let i = 0; i < 3 && box.parentElement && box.parentElement !== document.body && textUpTo(box.parentElement, 160) !== null; i++) box = box.parentElement;
        const sk = skeleton(box);
        const key = sk.replace(/\d+/g, '#');
        const bucket = likely ? strong : weak;
        if (bucket.has(key)) bucket.get(key).n++; else bucket.set(key, { sk, n: 1 });
      }
      const fmt = ({ sk, n }) => (n > 1 ? `${sk}   (x${n} similar)` : sk);
      rows.push(...[...strong.values()].slice(0, 12).map(fmt));
      const rest = Math.max(0, 12 - rows.length);
      if (rest) rows.push(...[...weak.values()].slice(0, Math.min(rest, 6)).map((x) => 'plain number (probably not a price): ' + fmt(x)));
    }
    let mf = {};
    try { mf = chrome.runtime.getManifest(); } catch (e) { /* ignore */ }
    return [
      `${BRAND} ${mf.version || ''}`.trim(),
      `site: ${location.hostname}`,
      `state: ${state}${stateReason ? ' (' + stateReason + ')' : ''}; target ${settings.target}; fee ${Number(settings.fxBuffer) || 0}%`,
      `site currency: ${ctx && ctx.bare ? ctx.bare + ' (' + ctx.bareSource + ')' : 'not detected'}; converted ${convertedCount()}; skipped-unknown ${ctx ? ctx.skipped.size : 0}`,
      `site converter: ${siteConverter || 'none'}`,
      `not converted (${rows.length}):`,
      ...rows.map((r, i) => `${i + 1}. ${r}`)
    ].join('\n');
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id && msg && msg.type === 'diagnose') {
      sendResponse({ text: diagnose() });
      return;
    }
    if (sender.id === chrome.runtime.id && msg && msg.type === 'status') {
      sendResponse({ host: location.hostname.toLowerCase(), state, reason: stateReason, count: convertedCount(), target: settings.target, bare: ctx ? ctx.bare : '', bareSource: ctx ? ctx.bareSource : '', bareSkipped: ctx ? ctx.skipped.size : 0, missed: ctx ? ctx.missed.size : 0,
        sym: ctx ? ctx.sym : null, fee: ctx ? ctx.fee : 0,
        converter: siteConverter, offersTarget: siteConverter ? offersTarget() : false });
    }
  });

  init();
})();
