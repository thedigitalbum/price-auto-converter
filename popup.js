const $ = UI.el;
let tabId = null,
  fullHost = "",
  cfg = PC.settings(),
  poll = null;
async function write(data) {
  const r = await PC.saveSync(data);
  if (!r.ok) {
    UI.toast(r.error, true);
    return false;
  }
  cfg = PC.settings({ ...cfg, ...data });
  UI.toast("Saved");
  return true;
}
function status(r) {
  const active = r?.state === "active";
  $("stateBadge").textContent = active
    ? "Active"
    : r?.state === "excluded" || r?.state === "off"
      ? "Paused"
      : r?.state === "error"
        ? "Needs attention"
        : "Unavailable";
  $("stateBadge").classList.toggle("warn", !active);
  if (!r) {
    $("status").textContent =
      "This page is unavailable to the extension. Try a shopping page, then reload it if needed.";
    return;
  }
  $("host").textContent = r.host || "This page";
  $("siteOn").disabled = !fullHost || !cfg.enabled;
  $("siteOn").checked =
    !!fullHost && cfg.enabled && PC.siteEnabled(fullHost, cfg);
  $("status").textContent = active
    ? `${r.count} converted price${r.count === 1 ? "" : "s"} · estimates in ${r.target}`
    : r.state === "off"
      ? "Paused globally. Turn conversion on in Settings."
      : r.state === "excluded"
        ? "Conversion is paused for this hostname."
        : r.state === "norates"
          ? "Waiting for exchange rates. Try Refresh below."
          : r.state === "error"
            ? "Conversion paused after an error. Reload the page or prepare a report."
            : "Starting conversion…";
  if (active && (r.bareSkipped || r.missed))
    $("status").textContent +=
      ` ${r.bareSkipped + r.missed} price candidates need a closer look.`;
  $("bareHint").textContent = r.bare
    ? `Source: ${r.bare} · ${r.bareSource}`
    : `Source not detected. ${r.sym?.dollar ? "Unlabelled $ is assumed to be " + r.sym.dollar + "." : ""}`;
  $("converterInfo").hidden = !r.converter;
  $("converterInfo").textContent = r.converter
    ? "The shop has its own currency controls. Conversion waits while you use them."
    : "";
}
async function refreshStatus() {
  try {
    status(await chrome.tabs.sendMessage(tabId, { type: "status" }));
  } catch {
    status(null);
  }
}
async function renderRates() {
  const l = await chrome.storage.local.get([
    "rates",
    "ratesUpdated",
    "ratesSource",
    "ratesBundled",
    "ratesError",
  ]);
  const text = UI.ratesText(l);
  $("ratesTitle").textContent = text.title;
  $("ratesInfo").textContent = text.detail;
  $("ratesTitle").style.color = text.warn ? "var(--warn)" : "var(--cyan)";
  return l;
}
async function main() {
  UI.version();
  $("settings").onclick = () =>
    chrome.runtime.openOptionsPage().catch(UI.startupError);
  $("report").onclick = () => UI.openReport(tabId).catch(UI.startupError);
  cfg = PC.settings(await chrome.storage.sync.get(PC.DEFAULTS));
  const local = await renderRates();
  const codes = Object.keys(local.rates || {});
  UI.currencies(
    $("target"),
    codes.length ? codes : ["USD", "EUR", "GBP", "PHP", "JPY"],
    cfg.target,
  );
  for (let i = 0; i <= 10; i++) {
    const o = document.createElement("option");
    o.value = i / 2;
    o.textContent = i ? `+${i / 2}%` : "None";
    $("fee").append(o);
  }
  $("fee").value = cfg.fxBuffer;
  $("target").onchange = async () => {
    if (!(await write({ target: $("target").value })))
      $("target").value = cfg.target;
  };
  $("fee").onchange = async () => {
    if (!(await write({ fxBuffer: Number($("fee").value) })))
      $("fee").value = cfg.fxBuffer;
  };
  $("refreshRates").onclick = async () => {
    const b = $("refreshRates");
    b.disabled = true;
    try {
      const r = await chrome.runtime.sendMessage({ type: "refresh-rates" });
      if (r?.ok === false)
        UI.toast("Refresh failed. Existing estimates remain available.", true);
      const l = await renderRates();
      UI.currencies($("target"), Object.keys(l.rates || {}), cfg.target);
    } catch {
      UI.toast("Could not refresh rates. Try again later.", true);
    } finally {
      b.disabled = false;
    }
  };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  let st = null;
  if (tabId !== null)
    try {
      st = await chrome.tabs.sendMessage(tabId, { type: "status" });
    } catch {}
  fullHost = st?.host || "";
  if (fullHost) {
    $("siteOn").onchange = async () => {
      const current = PC.settings(await chrome.storage.sync.get(PC.DEFAULTS));
      if (!(await write(PC.toggleSite(fullHost, current, $("siteOn").checked))))
        $("siteOn").checked = PC.siteEnabled(fullHost, cfg);
    };
    for (const code of codes) {
      const o = document.createElement("option");
      o.value = code;
      o.textContent = code;
      $("bare").append(o);
    }
    const rules = cfg.siteCurrencies
      .split("\n")
      .filter(Boolean)
      .sort((a, b) => b.split("=")[0].length - a.split("=")[0].length);
    const rule = rules.find((x) =>
      PC.hostMatches(fullHost, x.split("=")[0].trim().toLowerCase()),
    );
    $("bare").value = rule?.split("=")[1]?.trim().toUpperCase() || "";
    $("bare").disabled = false;
    $("bare").onchange = async () => {
      const cur = PC.settings(await chrome.storage.sync.get(PC.DEFAULTS));
      const rules = cur.siteCurrencies
        .split("\n")
        .filter(
          (x) => x.split("=")[0].trim().toLowerCase() !== fullHost && x.trim(),
        );
      if ($("bare").value) rules.push(fullHost + "=" + $("bare").value);
      await write({ siteCurrencies: rules.join("\n") });
    };
  }
  if (!fullHost) $("host").textContent = "This page";
  status(st);
  poll = setInterval(refreshStatus, 1000);
  window.addEventListener("unload", () => clearInterval(poll));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      for (const [key, value] of Object.entries(changes))
        cfg[key] = value.newValue;
      cfg = PC.settings(cfg);
      $("target").value = cfg.target;
      $("fee").value = cfg.fxBuffer;
      refreshStatus();
    } else if (
      area === "local" &&
      Object.keys(changes).some((k) => k.startsWith("rates"))
    )
      renderRates().catch(() => {});
  });
}
main().catch(UI.startupError);
