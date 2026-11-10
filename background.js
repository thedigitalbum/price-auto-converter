// Copyright (c) 2026 Harry Rama. MIT License (see LICENSE).
// Fetches and caches exchange rates (base USD).
importScripts(
  "diagnostics.js",
  "report-core.js",
  "report-config.js",
  "report-delivery.js",
);

const SOURCES = [
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    parse(d) {
      if (d.result !== "success" || !d.rates) throw new Error("Bad response");
      return d.rates;
    },
  },
  {
    name: "currency-api (jsDelivr)",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    parse(d) {
      if (!d.usd) throw new Error("Bad response");
      const valid = new Set(Intl.supportedValuesOf("currency"));
      const rates = {};
      for (const [k, v] of Object.entries(d.usd)) {
        const code = k.toUpperCase();
        if (valid.has(code) && typeof v === "number") rates[code] = v;
      }
      rates.USD = 1;
      return rates;
    },
  },
];

// Accept only well-formed data from the network: 3-letter codes, finite positive numbers, USD = 1.
function cleanRates(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (
      /^[A-Z]{3}$/.test(k) &&
      typeof v === "number" &&
      Number.isFinite(v) &&
      v > 0
    )
      out[k] = v;
  }
  if (Math.abs((out.USD || 0) - 1) > 1e-9)
    throw new Error("Unexpected base currency");
  return out;
}

async function fetchRates() {
  await chrome.storage.local.set({ ratesAttempt: Date.now() }).catch(() => {});
  let lastError = null;
  for (const src of SOURCES) {
    try {
      // data only: no cookies, no referrer
      const res = await fetch(src.url, {
        signal: AbortSignal.timeout(10000),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-cache",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const rates = cleanRates(src.parse(data));
      if (Object.keys(rates).length < 20) throw new Error("Too few currencies");
      const fetched = Date.now();
      const providerTime =
        typeof data.time_last_update_unix === "number"
          ? data.time_last_update_unix * 1000
          : Date.parse(data.date || "");
      const updated =
        Number.isFinite(providerTime) &&
        providerTime > 0 &&
        providerTime <= fetched + 86400000
          ? providerTime
          : fetched;
      await chrome.storage.local.set({
        rates,
        ratesUpdated: updated,
        ratesFetched: fetched,
        ratesSource: src.name,
        ratesBundled: false,
        ratesError: null,
      });
      return {
        ok: true,
        count: Object.keys(rates).length,
        updated,
        source: src.name,
      };
    } catch (e) {
      lastError = e;
    }
  }
  await chrome.storage.local
    .set({
      ratesError:
        "Live rates could not be fetched. Existing or built-in rates are still available.",
    })
    .catch(() => {});
  await DX.append("rates_fetch_failed");
  throw lastError || new Error("No rate source worked");
}

// Built-in approximate rates, used only until the first successful online refresh (or if every
// source stays unreachable), so conversion never waits on the network.
async function seedFallbackIfEmpty() {
  try {
    const { rates } = await chrome.storage.local.get("rates");
    if (rates && Object.keys(rates).length) return;
    const res = await fetch(chrome.runtime.getURL("fallback-rates.json"));
    const doc = await res.json();
    if ((await chrome.storage.local.get("rates")).rates) return;
    await chrome.storage.local.set({
      rates: cleanRates(doc.rates),
      ratesUpdated: Date.parse(doc.date) || Date.now(),
      ratesSource: "built-in approximate rates",
      ratesBundled: true,
    });
  } catch (e) {
    /* storage unavailable: nothing more we can do */
  }
}

// One fetch at a time, even if many tabs ask at once. Pages (not you) may ask at most once a minute.
let inflight = null;
function refreshRates(force = true) {
  if (!inflight) {
    inflight = (async () => {
      if (!force) {
        const { ratesAttempt } = await chrome.storage.local.get("ratesAttempt");
        if (ratesAttempt && Date.now() - ratesAttempt < 60000)
          return { ok: false, error: "Tried a moment ago" };
      }
      try {
        return await fetchRates();
      } catch (e) {
        await seedFallbackIfEmpty();
        throw e;
      }
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function ensureAlarm() {
  chrome.alarms.create("refresh-rates", { periodInMinutes: 360 });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  ensureAlarm();
  REPORT_DELIVERY.schedule();
  REPORT_DELIVERY.flush().catch(() => {});
  // keys used by earlier versions (replaced by dollarMode / yenMode, and the removed "convert anyway" list)
  chrome.storage.sync.remove(["dollar", "yen", "forced"]).catch(() => {});
  seedFallbackIfEmpty().then(() => refreshRates().catch(() => {}));
  if (reason === "install") {
    chrome.storage.sync.get(["target"]).then((saved) => {
      if (!/^[A-Z]{3}$/.test(saved.target || ""))
        return chrome.storage.sync.set({ currencyConfirmed: false });
    }).catch(() => {});
  }
  // Older installations could use PHP without ever saving a target.
  if (reason === "update") {
    chrome.storage.sync.get(["target", "currencyConfirmed"]).then((saved) => {
      if (!saved.target && saved.currencyConfirmed === undefined)
        return chrome.storage.sync.set({ target: "PHP", currencyConfirmed: true });
    }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(async () => {
  ensureAlarm();
  REPORT_DELIVERY.schedule();
  REPORT_DELIVERY.flush().catch(() => {});
  await seedFallbackIfEmpty();
  const { ratesUpdated } = await chrome.storage.local.get("ratesUpdated");
  if (!ratesUpdated || Date.now() - ratesUpdated > 12 * 3600 * 1000) {
    refreshRates().catch(() => {});
  }
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "report-retry") REPORT_DELIVERY.flush().catch(() => {});
  if (a.name === "refresh-rates") refreshRates().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only this extension's own pages and content scripts may talk to the worker.
  if (!msg || typeof msg !== "object" || sender.id !== chrome.runtime.id)
    return;

  if (msg.type === "submit-report" || msg.type === "report-ready") {
    // Only our report page can submit; websites/content scripts cannot trigger uploads.
    let ownReportPage = false;
    try {
      const url = new URL(sender.url);
      ownReportPage =
        url.protocol === "chrome-extension:" &&
        url.hostname === chrome.runtime.id &&
        url.pathname === "/report.html";
    } catch {}
    if (!ownReportPage) return;
    if (msg.type === "report-ready") {
      sendResponse({ configured: REPORT_DELIVERY.configured() });
      return;
    }
    REPORT_DELIVERY.submit(msg.report)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, code: "storage_unavailable" }));
    return true;
  }

  if (msg.type === "diagnostic-event") {
    DX.append(msg.code);
    return;
  }

  // Content script reports its state so the toolbar icon can show it for that tab.
  if (msg.type === "badge" && sender.tab) {
    const text = typeof msg.text === "string" ? msg.text.slice(0, 3) : "";
    const title = typeof msg.title === "string" ? msg.title.slice(0, 200) : "";
    const tabId = sender.tab.id;
    const quiet = () => {};
    chrome.action.setBadgeText({ tabId, text }).catch(quiet);
    chrome.action
      .setTitle({ tabId, title: title || "Price Auto Converter" })
      .catch(quiet);
    if (text) {
      // amber = needs your attention, grey = switched off
      chrome.action
        .setBadgeBackgroundColor({
          tabId,
          color: msg.kind === "attention" ? "#b45309" : "#6b7280",
        })
        .catch(quiet);
      if (chrome.action.setBadgeTextColor)
        chrome.action
          .setBadgeTextColor({ tabId, color: "#ffffff" })
          .catch(quiet);
    }
    return;
  }

  if (msg.type === "refresh-rates") {
    const fromOwnPage = !!(
      sender.url && sender.url.startsWith(chrome.runtime.getURL(""))
    );
    refreshRates(fromOwnPage)
      .then(sendResponse)
      .catch((e) =>
        sendResponse({ ok: false, error: String((e && e.message) || e) }),
      );
    return true; // async response
  }
});
