// Local, bounded operational events. No URLs, page text, stack traces, or automatic uploads.
const DX = (() => {
  const CODES = new Set([
    "rates_fetch_failed",
    "storage_unavailable",
    "conversion_failed",
    "report_build_failed",
  ]);
  let queue = Promise.resolve();
  function safeEvents(value) {
    return (Array.isArray(value) ? value : [])
      .filter(
        (e) =>
          e &&
          CODES.has(e.code) &&
          typeof e.time === "string" &&
          Number.isFinite(Date.parse(e.time)),
      )
      .map((e) => ({ code: e.code, time: new Date(e.time).toISOString() }));
  }
  function append(code) {
    if (!CODES.has(code)) return Promise.resolve();
    const task = queue.then(async () => {
      const saved = await chrome.storage.local.get("diagnosticEvents");
      const events = safeEvents(saved.diagnosticEvents).slice(-39);
      events.push({ code, time: new Date().toISOString() });
      await chrome.storage.local.set({ diagnosticEvents: events });
    });
    queue = task.catch(() => {});
    return queue;
  }
  function record(code) {
    if (!CODES.has(code)) return;
    try {
      chrome.runtime
        .sendMessage({ type: "diagnostic-event", code })
        .catch(() => {});
    } catch {}
  }
  function report({
    version,
    settings,
    local,
    page,
    browser,
    includeSite = false,
    includeExamples = false,
  }) {
    const data = {
      schema: "price-auto-converter-report/1",
      version,
      created: new Date().toISOString(),
      browser: /^Chrome\/\d+$/.test(browser || "")
        ? browser
        : "Chromium browser",
      settings: {
        target: settings.target,
        enabled: settings.enabled,
        feePercent: settings.fxBuffer,
        dollarMode: settings.dollarMode,
        yenMode: settings.yenMode,
        indicator: settings.indicator,
        whole: settings.whole,
      },
      rates: {
        source: String(local.ratesSource || "unavailable").slice(0, 80),
        updated: Number(local.ratesUpdated) || null,
        bundled: !!local.ratesBundled,
        count: Object.keys(local.rates || {}).length,
      },
      page: page
        ? {
            state: page.state,
            converted: Number(page.count) || 0,
            sourceCurrency: page.bare || null,
            sourceEvidence: page.bareSource || null,
            unknownPrices: Number(page.bareSkipped) || 0,
            missedPrices: Number(page.missed) || 0,
            hasShopConverter: !!page.converter,
            effectiveRate: Number.isFinite(page.effectiveRate)
              ? page.effectiveRate
              : null,
            ratesUsed: (Array.isArray(page.ratesUsed) ? page.ratesUsed : [])
              .filter(
                (r) =>
                  r &&
                  /^[A-Z]{3}$/.test(r.from) &&
                  /^[A-Z]{3}$/.test(r.to) &&
                  Number.isFinite(r.rate) &&
                  r.rate > 0,
              )
              .slice(0, 12)
              .map((r) => ({ from: r.from, to: r.to, rate: r.rate })),
            shapes: Array.isArray(page.shapes) ? page.shapes.slice(0, 8) : [],
          }
        : { state: "unavailable" },
      events: safeEvents(local.diagnosticEvents).slice(-20),
    };
    if (includeSite && page?.host && /^[a-z0-9.\-:\[\]]+$/i.test(page.host))
      data.page.hostname = page.host.slice(0, 253);
    if (includeExamples && Array.isArray(page?.examples))
      data.page.priceExamples = page.examples
        .slice(0, 5)
        .map((x) => String(x).slice(0, 50));
    return data;
  }
  return { append, record, report };
})();
