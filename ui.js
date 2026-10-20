const UI = (() => {
  const el = (id) => document.getElementById(id);
  const currencyName = (code) => {
    try {
      return (
        new Intl.DisplayNames(["en"], { type: "currency" }).of(code) || code
      );
    } catch {
      return code;
    }
  };
  function currencies(select, codes, value) {
    select.replaceChildren(
      ...[...new Set([...codes, value])].sort().map((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = `${c} — ${currencyName(c)}`;
        return o;
      }),
    );
    select.value = value;
  }
  function toast(text, bad = false) {
    const box = el("message");
    if (box) {
      box.textContent = text;
      box.classList.toggle("bad", bad);
    }
  }
  function version() {
    const box = el("ver");
    if (box) box.textContent = "v" + chrome.runtime.getManifest().version;
  }
  function ratesText(l) {
    if (!l.ratesUpdated)
      return {
        title: "No rates available",
        detail: "Refresh to fetch rates, or check your connection.",
        warn: true,
      };
    const stale = Date.now() - l.ratesUpdated > 2 * 86400000;
    return {
      title: l.ratesBundled
        ? "Built-in estimates"
        : stale
          ? "Rates may be outdated"
          : "Exchange rates ready",
      detail: `${new Date(l.ratesUpdated).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${Object.keys(l.rates || {}).length} currencies${l.ratesError ? " · Last refresh failed" : ""}`,
      warn: !!l.ratesBundled || stale || !!l.ratesError,
    };
  }
  async function openReport(tabId) {
    await chrome.tabs.create({
      url:
        chrome.runtime.getURL("report.html") +
        (Number.isInteger(tabId) ? "?tabId=" + tabId : ""),
    });
  }
  function startupError() {
    toast(
      "Could not load extension data. Reopen this page and try again.",
      true,
    );
    if (typeof DX !== "undefined") DX.record("storage_unavailable");
  }
  return {
    el,
    currencyName,
    currencies,
    toast,
    version,
    ratesText,
    openReport,
    startupError,
  };
})();
