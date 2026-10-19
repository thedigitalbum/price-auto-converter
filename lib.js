// Copyright (c) 2026 Harry Rama. MIT License (see LICENSE).
// Shared logic: price detection, number parsing, conversion, formatting.
// Loaded by content.js (content script) and options.html.
const PC = (() => {
  const DEFAULTS = {
    enabled: true,
    target: 'PHP',
    dollarMode: 'auto',     // what "$" means: 'auto' (read from the site, else USD) or a fixed code
    yenMode: 'auto',        // what "¥" means: 'auto' (site, else JPY) or a fixed code
    fxBuffer: 0,            // percent added on top of the rate (card / FX fees), 0 to 5
    indicator: 'standard',  // 'standard' (≈ + tint + underline) | 'minimal' (underline) | 'tilde' (≈ only)
    whole: false,           // hide cents on amounts >= 10
    excluded: '',           // sites where the extension is off (one hostname per line)
    debug: false,           // console diagnostics (off for everyone)
    siteCurrencies: ''      // lines like "afnan.com=AED": currency of symbol-less prices on that site
  };

  // Which currencies each ambiguous symbol can stand for. The page decides (see content.js).
  const FAMILY = {
    dollar: ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN', 'ARS', 'CLP', 'COP', 'TWD'],
    yen: ['JPY', 'CNY'],
    krona: ['SEK', 'NOK', 'DKK', 'ISK'],
    rupee: ['INR', 'PKR', 'LKR', 'NPR', 'MUR'],
    rand: ['ZAR']
  };

  // Symbols that appear BEFORE the number. '@name' = ambiguous, resolved per page via ctx.sym.
  const PREFIX = {
    'US$': 'USD', 'CA$': 'CAD', 'AU$': 'AUD', 'NZ$': 'NZD', 'HK$': 'HKD', 'NT$': 'TWD', 'MX$': 'MXN',
    'R$': 'BRL', 'C$': 'CAD', 'A$': 'AUD', 'S$': 'SGD', 'Rp': 'IDR', 'RM': 'MYR', 'TL': 'TRY', 'KSh': 'KES',
    '€': 'EUR', '£': 'GBP', '₱': 'PHP', '₹': 'INR', '₩': 'KRW', '₫': 'VND', '฿': 'THB',
    '₺': 'TRY', '₴': 'UAH', '₽': 'RUB', '₦': 'NGN', '₪': 'ILS', '₡': 'CRC', '₲': 'PYG',
    '₸': 'KZT', '₼': 'AZN', '₾': 'GEL', '៛': 'KHR', '₭': 'LAK', '₮': 'MNT',
    '¥': '@yen', '￥': '@yen', '$': '@dollar',
    'kr.': '@krona', 'kr': '@krona', 'Rs.': '@rupee', 'Rs': '@rupee', 'R': '@rand', 'Fr.': 'CHF'
  };
  // Symbols that appear AFTER the number ("12,50 €", "1 200 zł").
  const SUFFIX = {
    '€': 'EUR', '£': 'GBP', '₱': 'PHP', '₹': 'INR', '₩': 'KRW', '₫': 'VND', '฿': 'THB',
    '₺': 'TRY', '₴': 'UAH', '₽': 'RUB', '₦': 'NGN', '₪': 'ILS',
    'zł': 'PLN', 'Kč': 'CZK', 'Ft': 'HUF', 'TL': 'TRY', 'KSh': 'KES', '$': '@dollar',
    'kr.': '@krona', 'kr': '@krona', 'Rs.': '@rupee', 'Rs': '@rupee', 'Fr.': 'CHF',
    '円': 'JPY', '元': 'CNY', '원': 'KRW', 'บาท': 'THB',
    'ر.س': 'SAR', 'د.إ': 'AED', 'د.ك': 'KWD', 'ر.ق': 'QAR', 'د.ب': 'BHD', 'ج.م': 'EGP'
  };
  // Currency words (also what Chrome's page translation produces: 円 -> "yen"). Case-insensitive.
  const WORD_CODE = { yen: 'JPY', yuan: 'CNY', rmb: 'CNY', baht: 'THB', euro: 'EUR', euros: 'EUR', rand: 'ZAR', rands: 'ZAR' };
  const ci = (w) => [...w].map((c) => `[${c.toLowerCase()}${c.toUpperCase()}]`).join('');

  // 3-letter codes that are also common English words — never treated as currencies.
  const NOT_CODES = new Set(['ALL', 'TOP', 'TRY', 'CUP', 'MOP', 'PEN', 'MAD', 'SOS', 'GEL', 'BAM', 'LAK', 'ANG', 'BOB', 'DOP', 'AMD', 'NAD', 'NIO', 'CRC']);

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byLen = (a, b) => b.length - a.length;
  const PRE = Object.keys(PREFIX).sort(byLen).map(esc).join('|');
  const SUF = Object.keys(SUFFIX).filter((k) => k !== '$').sort(byLen).map(esc).join('|');
  const WORDS = Object.keys(WORD_CODE).sort(byLen).map(ci).join('|');

  // Consume complete numbers, including Indian grouping and high-precision prices.
  // The boundary prevents a failed match from converting only the start of an amount.
  const NUM = String.raw`(?:\d{1,3}(?:[,.\u00a0\u202f'’ ]\d{3})+(?:[.,]\d+)?|\d{1,2}(?:,\d{2})+,\d{3}(?:\.\d+)?|\d+(?:[.,]\d+)?)(?!\d|[.,]\d)`;
  // Number-then-symbol form ("1 234,56 zł") may also use a plain space as thousands separator.
  const NUM_S = NUM;
  const MAG = String.raw`(?:(?:[kKmMbB]|bn|mn)\b|\s(?:million|billion|thousand)\b|万|億)`;
  // Whitespace as found in real pages: long indented runs from the page source, and the invisible
  // direction marks Arabic/English sites sprinkle around prices (LRM, RLM, zero-width space...).
  const WS = String.raw`[\s\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\u200b\ufeff]`;
  const SP = `${WS}{0,60}`;
  const INVISIBLE = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\u200b\ufeff]/g;
  const clean = (t) => t.replace(INVISIBLE, '').trim();
  const NEXT_NUM = new RegExp(`^${WS}{0,60}\\d`);

  const RE = new RegExp(
    // prefix form: $12.50 · USD 12.50 · $12.50 USD
    `(?<![A-Za-z])(?:(?<pSym>${PRE})|(?<pCode>[A-Z]{3}))${SP}(?<pNeg>[-\u2212\u2013]\\s?)?(?<pNum>${NUM})(?<pMag>${MAG})?(?<pDash>[,.][-\u2013\u2014])?(?:${SP}(?<pTrail>[A-Z]{3})(?![A-Za-z0-9]))?` +
    // suffix form: 12,50 € · 12.50 USD · 12$
    `|(?<![\\d.,])(?<sNum>${NUM_S})(?<sMag>${MAG})?(?:${SP}(?<sSym>${SUF})(?:(?<sCents>\\d{2})(?!\\d)|(?![\\dA-Za-z]))|(?<sDollar>\\$)(?!\\d)|${SP}(?<sWord>${WORDS})(?![A-Za-z])|${SP}(?<sCode>[A-Z]{3})(?![A-Za-z0-9]))` +
    // price marked only by a trailing dash: 1 299,-  (Norway, Denmark)  ·  25.–  (Switzerland)
    `|(?<![\\d.,])(?<dNum>${NUM_S})(?<dMark>[,.][-\u2013\u2014])(?!\\d)`,
    'g'
  );

  // Does this text mention a currency? Only real currencies count (a symbol, or a known 3-letter
  // code), so words like "OFF", "NEW" or "VAT" in "16% OFF" don't look like one.
  const SYMBOL_CHARS = /[$€£¥₱₹₩₫฿₺₴₽₦₪円元원]|บาท|ر\.س|د\.إ|د\.ك|ر\.ق|د\.ب|ج\.م|(?<![A-Za-z])(?:yen|yuan|baht|euros?|rands?)(?![A-Za-z])/i;
  const CURRENCY_TOKEN = new RegExp(`(?<![A-Za-z])(?:${PRE}|${SUF})(?![A-Za-z])`);
  function hasCurrency(text, ctx) {
    if (SYMBOL_CHARS.test(text) || CURRENCY_TOKEN.test(text)) return true;
    for (const m of text.matchAll(/(?<![A-Za-z])[A-Z]{3}(?![A-Za-z])/g)) {
      if (ctx.rates[m[0]] !== undefined && !NOT_CODES.has(m[0])) return true;
    }
    return false;
  }

  // Text that could be one half of a split price: just a currency symbol/code, or just a number.
  const FRAG_SYM = new RegExp(`^${WS}*(?:${PRE}|${SUF}|${WORDS}|[A-Z]{3})${WS}*$`);
  const FRAG_NUM = new RegExp(`^${WS}*(?:${NUM}|${NUM_S})(?:${MAG})?${WS}*$`);
  const isFragment = (t) => t.length < 30 && (FRAG_SYM.test(t) || FRAG_NUM.test(t));

  // A price shown as a bare number ("150") on a page whose currency is known from elsewhere.
  const BARE = new RegExp(`^(${WS}*)(${NUM})(${WS}*)$`);
  const isBareNumber = (t) => t.length < 24 && BARE.test(t);
  function bare(text, from, ctx) {
    const m = BARE.exec(text);
    if (!m || !ctx.rates[from] || from === ctx.target) return null;
    const amount = parseNum(m[2], from);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { start: m[1].length, end: m[1].length + m[2].length, text: m[2], label: from + ' ' + m[2], from, amount, compact: false };
  }

  function parseNum(raw, code) {
    const s = raw.replace(/[\u00a0\u202f' ’]/g, '');
    const d = s.lastIndexOf('.');
    const c = s.lastIndexOf(',');
    let dec = null;
    if (d > -1 && c > -1) {
      dec = d > c ? '.' : ',';
    } else if (d > -1 || c > -1) {
      const sep = d > -1 ? '.' : ',';
      const parts = s.split(sep);
      const tail = parts[parts.length - 1];
      // one separator: decimal unless it looks like a thousands group ("1,234")
      const threeDecimals = ['KWD', 'BHD', 'OMR', 'JOD', 'TND', 'LYD', 'IQD'].includes(code);
      if (parts.length === 2 && (tail.length !== 3 || /^0+$/.test(parts[0]) || (threeDecimals && sep === '.'))) dec = sep;
    }
    let t = s;
    if (dec) {
      const i = t.lastIndexOf(dec);
      t = t.slice(0, i).replace(/[.,]/g, '') + '.' + t.slice(i + 1);
    } else {
      t = t.replace(/[.,]/g, '');
    }
    return parseFloat(t);
  }

  function multiplier(mag) {
    if (!mag) return 1;
    const m = mag.trim().toLowerCase();
    if (m === 'k' || m === 'thousand') return 1e3;
    if (m === 'm' || m === 'mn' || m === 'million') return 1e6;
    if (m === 'b' || m === 'bn' || m === 'billion') return 1e9;
    if (m === '万') return 1e4;
    if (m === '億') return 1e8;
    return 1;
  }

  // ctx: { rates, target, sym: { dollar, yen, krona, rupee, rand } }
  //   ->  [{ start, end, text, from, amount, compact, amb }]
  // `info` (optional) collects { unresolved } = prices skipped because an ambiguous symbol
  // (like "kr") could not be tied to a currency by the page.
  function find(text, ctx, info) {
    const { rates, target } = ctx;
    const sym = ctx.sym || {};
    const known = (c) => rates[c] !== undefined;
    const wordCode = (c) => known(c) && !NOT_CODES.has(c);
    const pick = (tok) => (tok[0] === '@' ? (sym[tok.slice(1)] || '') : tok);
    const out = [];
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(text)) !== null) {
      const g = m.groups;
      let code, numStr, mag, tok = '', neg = '';
      let end = m.index + m[0].length;
      let valid;
      if (g.pNum !== undefined) {
        numStr = g.pNum; mag = g.pMag; neg = g.pNeg ? g.pNeg.trim() : '';   // "AED -25.00"
        // RM-9595 is a model number; alphabetic currency labels require a space before a minus.
        if (g.pSym && /^[A-Za-z.]+$/.test(g.pSym) && neg && text.slice(m.index + g.pSym.length).startsWith(neg)) continue;
        if (g.pSym) {
          tok = PREFIX[g.pSym]; code = pick(tok); valid = known(code);
          // South African / Nordic prices use a plain space for thousands: "R 1 299.00", "kr 1 299"
          if ((tok === '@rand' || tok === '@krona') && !g.pMag && !g.pTrail && !/[.,]/.test(numStr)) {
            const ext = /^(?: \d{3})+(?:[.,]\d{1,2})?(?:[,.][-\u2013\u2014])?(?!\d)/.exec(text.slice(end));
            if (ext) { numStr += ext[0]; end += ext[0].length; RE.lastIndex = end; }
          }
          // a lone "R" is also a model/size letter ("EOS R5"): only trust it on a South African
          // page and only for amounts that look like prices
          if (valid && g.pSym === 'R' && numStr.replace(/\D/g, '').length < 3 && !/[.,]\d{2}$/.test(numStr)) valid = false;
        } else { code = g.pCode; valid = wordCode(code); }
        if (valid && g.pTrail) {
          if (g.pSym && wordCode(g.pTrail)) {
            code = g.pTrail; tok = '';             // "$5 CAD" -> CAD wins over "$"
          } else {                                 // trailing word isn't a currency: leave it out
            const kept = m[0].slice(0, m[0].length - g.pTrail.length).replace(/[ \u00a0\u202f]$/, '');
            end = m.index + kept.length;
            RE.lastIndex = end;                    // that word may start the next price ("AED 120 AED 99")
          }
        }
      } else if (g.dNum !== undefined) {
        numStr = g.dNum; mag = '';                         // site currency (set by the page script)
        code = ctx.bare || ''; valid = known(code);
      } else {
        numStr = g.sNum; mag = g.sMag;
        if (g.sCents) {
          if (/[.,]\d{1,2}$/.test(numStr)) continue;
          numStr += '.' + g.sCents;
        }
        if (g.sSym) { tok = SUFFIX[g.sSym]; code = pick(tok); valid = known(code); }
        else if (g.sDollar) { tok = '@dollar'; code = pick(tok); valid = known(code); }
        else if (g.sWord) { code = WORD_CODE[g.sWord.toLowerCase()]; valid = known(code); }
        else {
          code = g.sCode; valid = wordCode(code);
          // "Qty 2 AED 99.00": that AED belongs to the 99.00 (code before number) unless this site
          // is known to write codes after the number ("50 USD")
          if (valid && !ctx.suffixCodes && NEXT_NUM.test(text.slice(end))) valid = false;
        }
      }
      if (!valid) {
        if (info && !code && ((tok[0] === '@' && tok !== '@rand') || g.dNum !== undefined)) info.unresolved = (info.unresolved || 0) + 1;
        if (info && !code && tok[0] === '@') { info.fams = info.fams || {}; info.fams[tok.slice(1)] = (info.fams[tok.slice(1)] || 0) + 1; }
        RE.lastIndex = m.index + 1;
        continue;
      }
      if (code === target) continue;               // already in the target currency
      const amount = parseNum(numStr, code) * multiplier(mag);
      if (!Number.isFinite(amount) || amount <= 0) continue;   // skip 0.00 prices
      if (/^[ \u00a0]?%/.test(text.slice(end))) continue;      // "20%" is a percentage, not money
      out.push({ start: m.index, end, text: text.slice(m.index, end), from: code, amount, neg, compact: !!mag && mag !== '万' && mag !== '億', amb: tok[0] === '@', fam: tok[0] === '@' ? tok.slice(1) : '' });
    }
    return out;
  }

  const locale = () => {
    try { return navigator.language || 'en-US'; } catch { return 'en-US'; }
  };

  function formatMoney(value, code, opts = {}) {
    const base = { style: 'currency', currency: code };
    let o = base;
    if (opts.compact) o = { ...base, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 };
    else if (opts.whole && Math.abs(value) >= 10) o = { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 };
    else if (value !== 0 && Math.abs(value) < 1) o = { ...base, maximumSignificantDigits: 4 };
    try {
      return new Intl.NumberFormat(opts.locale || locale(), o).format(value);
    } catch {
      return value.toFixed(2) + ' ' + code;
    }
  }

  const rate = (from, ctx) => (ctx.rates[ctx.target] / ctx.rates[from]) * feeFactor(ctx);
  const convert = (amount, from, to, rates) => (amount / rates[from]) * rates[to];

  // Fee buffer: Final = raw x rate x (1 + buffer). `mark` = false leaves off the leading "≈"
  // (second half of a price range).
  const feeFactor = (ctx) => 1 + Math.min(5, Math.max(0, Number(ctx.fee) || 0)) / 100;

  function render(hit, ctx, mark = true) {
    const value = convert(hit.amount, hit.from, ctx.target, ctx.rates) * feeFactor(ctx);
    const s = formatMoney(value, ctx.target, { whole: ctx.whole, compact: hit.compact, locale: ctx.locale });
    return (ctx.tilde && mark ? '≈\u202F' : '') + (hit.neg || '') + s;   // narrow no-break space keeps it compact and on one line
  }

  function formatRate(r, loc) {
    try { return new Intl.NumberFormat(loc || locale(), { maximumSignificantDigits: 4 }).format(r); }
    catch { return String(r); }
  }

  // chrome.storage.sync allows 8 KB per item: keep the user's lists well under that and
  // report failures instead of throwing.
  const LIST_KEYS = ['excluded', 'siteCurrencies'];
  const MAX_LIST_BYTES = 6000;
  function tooBig(obj) {
    for (const k of LIST_KEYS) {
      if (typeof obj[k] === 'string' && new TextEncoder().encode(obj[k]).length > MAX_LIST_BYTES) return k;
    }
    return '';
  }
  async function saveSync(obj) {
    if (tooBig(obj)) return { ok: false, error: 'That list is too long to sync. Remove a few sites and try again.' };
    try {
      await chrome.storage.sync.set(obj);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  return { DEFAULTS, FAMILY, clean, hasCurrency, saveSync, tooBig, find, bare, isBareNumber, isFragment, render, rate, convert, formatMoney, formatRate, locale };
})();
