// Shared with the Google Apps Script receiver. No browser APIs or remote code.
const RC = (() => {
  const SCHEMA = "price-auto-converter-report/2";
  const EVENTS = new Set([
    "rates_fetch_failed",
    "storage_unavailable",
    "conversion_failed",
    "report_build_failed",
  ]);
  const STATES = new Set([
    "active",
    "off",
    "excluded",
    "norates",
    "error",
    "starting",
    "unavailable",
  ]);
  const TAGS = new Set([
    "span",
    "div",
    "p",
    "s",
    "del",
    "strong",
    "b",
    "em",
    "sup",
    "small",
    "li",
    "td",
    "dd",
    "dt",
    "section",
    "article",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ]);
  const EVIDENCE = new Set([
    "your choice",
    "the site’s currency menu",
    "the page’s product data",
    "the store’s settings",
    "the page’s data",
    "the store’s country",
    "currency written on the page",
    "the site address",
    "the page language",
  ]);
  const UUID =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const count = (n) =>
    Number.isFinite(n) ? Math.max(0, Math.min(1000000, Math.floor(n))) : 0;
  const code = (s) =>
    typeof s === "string" && /^[A-Z]{3}$/.test(s) ? s : null;
  const rate = (n) => (Number.isFinite(n) && n > 0 && n <= 1e18 ? n : null);
  function hostname(s) {
    if (typeof s !== "string" || s.length > 253) return null;
    s = s.toLowerCase();
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) ||
      /\.(?:local|internal|localhost)$/.test(s)
    )
      return null;
    return s;
  }
  function shape(s) {
    return typeof s === "string" &&
      /^(?:span|div|p|s|del|strong|b|em|sup|small|li|td|dd|dt|section|article|h[1-6])(?:\.(?:price|money|amount|currency|cost|sale|total|cents|fraction|whole|value)){0,2}$/.test(
        s,
      )
      ? s
      : null;
  }
  function numericShape(s) {
    return typeof s === "string" &&
      s.length <= 50 &&
      /\d/.test(s) &&
      /^[\d\s.,'’()%+\-–—−]+$/.test(s)
      ? s.replace(/\d/g, "n").replace(/\s+/g, " ").trim()
      : null;
  }
  function safePattern(s) {
    return typeof s === "string" &&
      s.length <= 50 &&
      /n/.test(s) &&
      /^[n\s.,'’()%+\-–—−]+$/.test(s)
      ? s.trim()
      : null;
  }
  function prepare(raw, now = Date.now()) {
    if (
      !raw ||
      !UUID.test(raw.id || "") ||
      typeof raw.version !== "string" ||
      raw.version.length > 32 ||
      !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(raw.version)
    )
      throw new Error("invalid_report");
    const settings = raw.settings || {},
      page = raw.page || {},
      rates = raw.rates || {};
    const timestamp = Date.parse(raw.created || "");
    if (
      !Number.isFinite(timestamp) ||
      timestamp < now - 8 * 86400000 ||
      timestamp > now + 86400000
    )
      throw new Error("invalid_report");
    const events = (Array.isArray(raw.events) ? raw.events : [])
      .filter(
        (e) => e && EVENTS.has(e.code) && Number.isFinite(Date.parse(e.time)),
      )
      .slice(-20)
      .map((e) => ({ code: e.code, time: new Date(e.time).toISOString() }));
    const source = [
      "open.er-api.com",
      "currency-api (jsDelivr)",
      "built-in approximate rates",
    ].includes(rates.source)
      ? rates.source
      : "unavailable";
    const evidence = (Array.isArray(page.evidence) ? page.evidence : [])
      .slice(0, 8)
      .filter(
        (e) =>
          e && ["currency_without_amount", "unknown_source"].includes(e.kind),
      )
      .map((e) => ({
        kind: e.kind,
        tag: TAGS.has(e.tag) ? e.tag : "span",
        parent: TAGS.has(e.parent) ? e.parent : "div",
        currency: code(e.currency),
        numericPattern: safePattern(e.numericPattern),
        hasPriceContext: e.hasPriceContext === true,
        adjacentNumbers: Math.min(8, count(e.adjacentNumbers)),
      }));
    const report = {
      schema: SCHEMA,
      id: raw.id.toLowerCase(),
      version: raw.version,
      created: new Date(timestamp).toISOString(),
      browser: /^Chrome\/\d{2,3}$/.test(raw.browser || "")
        ? raw.browser
        : "Chrome",
      settings: {
        target: code(settings.target) || "PHP",
        enabled: settings.enabled !== false,
        feePercent: Math.min(5, Math.max(0, Number(settings.feePercent) || 0)),
        dollarMode: code(settings.dollarMode) || "auto",
        yenMode: ["JPY", "CNY"].includes(settings.yenMode)
          ? settings.yenMode
          : "auto",
        indicator: ["standard", "minimal", "tilde"].includes(settings.indicator)
          ? settings.indicator
          : "standard",
        whole: settings.whole === true,
      },
      rates: {
        source,
        updated:
          Number.isFinite(rates.updated) &&
          rates.updated > 0 &&
          rates.updated <= now + 86400000
            ? rates.updated
            : null,
        bundled: rates.bundled === true,
        count: Math.min(500, count(rates.count)),
      },
      page: {
        hostname: hostname(page.hostname),
        state: STATES.has(page.state) ? page.state : "unavailable",
        converted: count(page.converted),
        sourceCurrency: code(page.sourceCurrency),
        sourceEvidence: EVIDENCE.has(page.sourceEvidence)
          ? page.sourceEvidence
          : null,
        unknownPrices: count(page.unknownPrices),
        missedPrices: count(page.missedPrices),
        hasShopConverter: page.hasShopConverter === true,
        effectiveRate: rate(page.effectiveRate),
        ratesUsed: (Array.isArray(page.ratesUsed) ? page.ratesUsed : [])
          .filter((r) => r && code(r.from) && code(r.to) && rate(r.rate))
          .slice(0, 12)
          .map((r) => ({ from: r.from, to: r.to, rate: r.rate })),
        shapes: (Array.isArray(page.shapes) ? page.shapes : [])
          .map(shape)
          .filter(Boolean)
          .slice(0, 8),
        evidence,
      },
      events,
    };
    report.issues = issues(report, now);
    report.summary = summary(report);
    return report;
  }
  function issues(r, now = Date.now()) {
    const out = [],
      p = r.page;
    if (p.state === "error")
      out.push({ code: "conversion_error", severity: "error" });
    if (p.state === "norates" || !r.rates.count)
      out.push({ code: "rates_unavailable", severity: "error" });
    if (p.unknownPrices)
      out.push({
        code: "source_currency_unknown",
        severity: "warning",
        count: p.unknownPrices,
      });
    if (p.missedPrices)
      out.push({
        code: "price_layout_needs_review",
        severity: "review",
        count: p.missedPrices,
      });
    if (p.state === "off" || p.state === "excluded")
      out.push({ code: "conversion_paused", severity: "info" });
    if (p.state === "unavailable")
      out.push({ code: "page_unavailable", severity: "info" });
    if (r.rates.bundled)
      out.push({ code: "bundled_estimates", severity: "info" });
    else if (r.rates.updated && now - r.rates.updated > 2 * 86400000)
      out.push({ code: "rates_outdated", severity: "warning" });
    if (r.events.some((e) => e.code === "rates_fetch_failed"))
      out.push({ code: "earlier_rate_refresh_failed", severity: "history" });
    if (!out.some((i) => ["error", "warning", "review"].includes(i.severity)))
      out.push({ code: "user_reported_problem", severity: "review" });
    return out;
  }
  function summary(r) {
    const p = r.page,
      site = p.hostname ? " on " + p.hostname : "";
    if (p.state === "error")
      return "Conversion stopped after an internal error" + site + ".";
    if (p.state === "norates" || !r.rates.count)
      return "Exchange rates are unavailable" + site + ".";
    if (p.unknownPrices)
      return (
        p.unknownPrices +
        " price candidates have an unknown source currency" +
        site +
        "."
      );
    if (p.missedPrices)
      return p.missedPrices + " price elements need review" + site + ".";
    return (
      "User-reported conversion problem" +
      site +
      ". No automatic failure was confirmed."
    );
  }
  function endpointValid(url) {
    return (
      typeof url === "string" &&
      /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/.test(
        url,
      )
    );
  }
  return {
    SCHEMA,
    UUID,
    prepare,
    summary,
    issues,
    numericShape,
    endpointValid,
  };
})();
