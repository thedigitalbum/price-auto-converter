const $ = UI.el;
let cfg = PC.settings(),
  rates = null,
  local = {},
  siteDirty = false;
const conversionKeys = [
  "enabled",
  "target",
  "dollarMode",
  "yenMode",
  "fxBuffer",
  "indicator",
  "whole",
];
function formValues() {
  return {
    enabled: $("enabled").checked,
    target: $("target").value,
    dollarMode: $("dollarMode").value,
    yenMode: $("yenMode").value,
    fxBuffer: Number($("fxBuffer").value),
    indicator: $("indicator").value,
    whole: $("whole").checked,
  };
}
function renderForm() {
  UI.currencies(
    $("target"),
    Object.keys(rates || {}).length
      ? Object.keys(rates)
      : ["USD", "EUR", "PHP", "JPY"],
    cfg.target,
  );
  for (const key of conversionKeys) {
    if (["enabled", "whole"].includes(key)) $(key).checked = cfg[key];
    else $(key).value = cfg[key];
  }
  preview();
}
function preview() {
  const from = cfg.dollarMode === "auto" ? "USD" : cfg.dollarMode;
  if (!rates?.[from] || !rates?.[cfg.target]) {
    $("preview").textContent =
      "Preview will appear when rates are available for this currency.";
    return;
  }
  if (from === cfg.target) {
    $("preview").textContent =
      `$100 already means ${cfg.target}. No conversion needed.`;
    return;
  }
  const value =
    PC.convert(100, from, cfg.target, rates) * (1 + cfg.fxBuffer / 100);
  $("preview").textContent =
    `100 ${from} ≈ ${PC.formatMoney(value, cfg.target, { whole: cfg.whole })}`;
}
function renderRates() {
  const text = UI.ratesText(local);
  $("ratesTitle").textContent = text.title;
  $("ratesTitle").style.color = text.warn ? "var(--warn)" : "var(--cyan)";
  $("ratesInfo").textContent = text.detail;
}
async function saveConversion() {
  const next = PC.settings({ ...cfg, ...formValues() });
  const result = await PC.saveSync(
    Object.fromEntries(conversionKeys.map((k) => [k, next[k]])),
  );
  if (result.ok) {
    cfg = next;
    preview();
    UI.toast("Saved");
  } else {
    renderForm();
    UI.toast(result.error, true);
  }
}
function normalizeHosts(value) {
  return [
    ...new Set(
      value
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((line) => {
          const url = new URL(
            /^https?:\/\//i.test(line) ? line : "https://" + line,
          );
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            !url.hostname
          )
            throw new Error("Enter a valid website hostname on each line.");
          return url.hostname.toLowerCase().replace(/^www\./, "");
        }),
    ),
  ].join("\n");
}
async function main() {
  UI.version();
  $("report").onclick = () => UI.openReport(null).catch(UI.startupError);
  for (let i = 0; i <= 10; i++) {
    const o = document.createElement("option");
    o.value = i / 2;
    o.textContent = i ? `+${i / 2}%` : "None (0%)";
    $("fxBuffer").append(o);
  }
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = "Auto-detect";
  $("dollarMode").append(auto);
  for (const c of PC.FAMILY.dollar) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    $("dollarMode").append(o);
  }
  const [s, l] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get([
      "rates",
      "ratesUpdated",
      "ratesSource",
      "ratesBundled",
      "ratesError",
    ]),
  ]);
  cfg = PC.settings(s);
  if (!cfg.currencyConfirmed) {
    location.replace(chrome.runtime.getURL("popup.html"));
    return;
  }
  local = l;
  rates = l.rates || null;
  renderForm();
  renderRates();
  $("excluded").value = cfg.excluded;
  $("included").value = cfg.included;
  for (const key of conversionKeys)
    $(key).addEventListener("change", () =>
      saveConversion().catch(UI.startupError),
    );
  for (const key of ["excluded", "included"])
    $(key).addEventListener("input", () => {
      siteDirty = true;
      UI.toast("Website rules have unsaved changes");
    });
  $("siteForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const next = {
        excluded: normalizeHosts($("excluded").value),
        included: normalizeHosts($("included").value),
      };
      const result = await PC.saveSync(next);
      if (!result.ok) {
        UI.toast(result.error, true);
        return;
      }
      cfg = { ...cfg, ...next };
      $("excluded").value = cfg.excluded;
      $("included").value = cfg.included;
      siteDirty = false;
      UI.toast("Website rules saved");
    } catch (error) {
      UI.toast(error.message || "Could not save website rules.", true);
    }
  };
  $("refresh").onclick = async () => {
    const b = $("refresh");
    b.disabled = true;
    try {
      const r = await chrome.runtime.sendMessage({ type: "refresh-rates" });
      local = await chrome.storage.local.get([
        "rates",
        "ratesUpdated",
        "ratesSource",
        "ratesBundled",
        "ratesError",
      ]);
      rates = local.rates || null;
      renderForm();
      renderRates();
      UI.toast(
        r?.ok === false
          ? "Refresh failed. Existing estimates remain available."
          : "Rates refreshed",
        r?.ok === false,
      );
    } catch {
      UI.toast("Could not refresh rates. Please try again.", true);
    } finally {
      b.disabled = false;
    }
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      for (const [k, v] of Object.entries(changes)) cfg[k] = v.newValue;
      cfg = PC.settings(cfg);
      renderForm();
      if (!siteDirty) {
        $("excluded").value = cfg.excluded;
        $("included").value = cfg.included;
      }
    } else if (area === "local") {
      for (const [k, v] of Object.entries(changes)) local[k] = v.newValue;
      rates = local.rates || null;
      renderRates();
      renderForm();
    }
  });
}
main().catch(UI.startupError);
