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
    $("summary").textContent = report.summary.replace(
      " No automatic failure was confirmed.",
      "",
    );
    $("context").textContent =
      `${report.page.converted} converted · ${report.settings.target}`;
    $("preview").value = JSON.stringify(report, null, 2);
    $("download").disabled = false;
    if (!submitted && !sending) $("send").disabled = !ready?.configured;
    if (!ready?.configured) UI.toast("Report delivery is not connected.", true);
  } catch {
    UI.toast("Could not prepare report. Reopen to retry.", true);
    $("send").disabled = true;
    DX.record("report_build_failed");
  }
}
function result(r) {
  if (r?.ok && r.status === "sent") {
    submitted = true;
    $("summary").textContent = "Report received";
    UI.toast("Reference: " + r.receipt);
    $("send").textContent = "Sent";
    $("send").disabled = true;
  } else if (r?.ok && r.status === "queued") {
    submitted = true;
    $("summary").textContent = "Saved on this device.";
    UI.toast("Retrying automatically for up to 7 days.");
    $("send").textContent = "Waiting to send";
    $("send").disabled = true;
  } else {
    const messages = {
      not_configured: "The developer has not connected report delivery yet.",
      queue_full: "Report queue full. Try later.",
      too_soon: "Please wait before sending another report.",
      invalid_report: "Report rejected. Update the extension and retry.",
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
    UI.toast("Extension unavailable. Reopen to retry.", true);
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
