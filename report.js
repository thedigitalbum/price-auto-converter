const $ = UI.el;
const query = new URLSearchParams(location.search).get("tabId");
const tabId = query !== null && /^\d+$/.test(query) ? Number(query) : null;
const reportId = crypto.randomUUID();
let report = null,
  sending = false,
  submitted = false;
UI.version();
async function build() {
  try {
    const [raw, local, ready] = await Promise.all([
      chrome.storage.sync.get(PC.DEFAULTS),
      chrome.storage.local.get([
        "rates",
        "ratesUpdated",
        "ratesSource",
        "ratesBundled",
        "diagnosticEvents",
      ]),
      chrome.runtime.sendMessage({ type: "report-ready" }),
    ]);
    let page = null;
    if (tabId !== null)
      try {
        page = await chrome.tabs.sendMessage(tabId, {
          type: "report-context",
          includeExamples: false,
        });
      } catch {}
    const ua = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent);
    const base = DX.report({
      version: chrome.runtime.getManifest().version,
      settings: PC.settings(raw),
      local,
      page,
      browser: ua ? "Chrome/" + ua[1] : "Chrome",
      includeSite: true,
      includeExamples: false,
    });
    base.id = reportId;
    base.page.evidence = page?.evidence || [];
    report = RC.prepare(base);
    $("summary").textContent = report.summary;
    $("context").textContent =
      `${report.page.converted} converted price fragments · ${report.settings.target}. ` +
      (report.page.missedPrices
        ? "These are possible missed elements, not confirmed pricing errors. "
        : "") +
      "The technical details have been prepared for investigation.";
    $("preview").value = JSON.stringify(report, null, 2);
    $("download").disabled = false;
    if (!submitted && !sending) $("send").disabled = !ready?.configured;
    if (!ready?.configured)
      UI.toast(
        "The developer is finishing report delivery setup. Nothing has been sent.",
        true,
      );
  } catch {
    UI.toast(
      "Could not prepare diagnostics. Reopen this page to try again.",
      true,
    );
    $("send").disabled = true;
    DX.record("report_build_failed");
  }
}
function result(r) {
  if (r?.ok && r.status === "sent") {
    submitted = true;
    $("summary").textContent = "Report received. Thank you!";
    UI.toast("Reference: " + r.receipt + ". You can close this tab.");
    $("send").textContent = "Sent";
    $("send").disabled = true;
  } else if (r?.ok && r.status === "queued") {
    submitted = true;
    $("summary").textContent = "Saved on this device.";
    UI.toast(
      "We’ll retry automatically for up to 7 days. Keep the extension installed; no further action is needed.",
    );
    $("send").textContent = "Waiting to send";
    $("send").disabled = true;
  } else {
    const messages = {
      not_configured: "The developer has not connected report delivery yet.",
      queue_full:
        "Five reports are already waiting on this device. Please try later.",
      too_soon: "A report was just sent. Please wait a moment.",
      invalid_report:
        "This report could not be accepted. Update the extension and try again.",
      storage_unavailable: "Could not save the report on this device.",
    };
    UI.toast(
      messages[r?.code] || "Could not save the report. Please try again.",
      true,
    );
    $("send").disabled = false;
  }
}
$("send").onclick = async () => {
  if (!report || sending || submitted) return;
  sending = true;
  $("send").disabled = true;
  $("send").textContent = "Sending…";
  UI.toast("Sending report…");
  try {
    result(await chrome.runtime.sendMessage({ type: "submit-report", report }));
  } catch {
    UI.toast(
      "Could not contact the extension. Reopen this page to try again.",
      true,
    );
    $("send").disabled = false;
  } finally {
    sending = false;
    if (!submitted) $("send").textContent = "Send report";
  }
};
$("download").onclick = () => {
  const a = document.createElement("a");
  a.href =
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(report, null, 2) + "\n");
  a.download = "price-auto-converter-report-" + reportId + ".json";
  document.body.append(a);
  a.click();
  a.remove();
};
$("clearEvents").onclick = async () => {
  try {
    await chrome.storage.local.remove("diagnosticEvents");
    if (!submitted) await build();
    UI.toast("Local error history cleared.");
  } catch {
    UI.toast("Could not clear error history.", true);
  }
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.reportReceipts) {
    const receipt = (changes.reportReceipts.newValue || []).find(
      (r) => r.id === reportId,
    );
    if (receipt) result({ ok: true, status: "sent", receipt: receipt.receipt });
  }
});
build();
