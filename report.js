const $ = UI.el;
const rawTab = new URLSearchParams(location.search).get("tabId");
const tabId = rawTab !== null && /^\d+$/.test(rawTab) ? Number(rawTab) : null;
let generation = 0;
async function build() {
  const current = ++generation;
  for (const id of ["copy", "download", "github"]) $(id).disabled = true;
  try {
    const [raw, local] = await Promise.all([
      chrome.storage.sync.get(PC.DEFAULTS),
      chrome.storage.local.get([
        "rates",
        "ratesUpdated",
        "ratesSource",
        "ratesBundled",
        "diagnosticEvents",
      ]),
    ]);
    let page = null;
    if (tabId !== null)
      try {
        page = await chrome.tabs.sendMessage(tabId, {
          type: "report-context",
          includeExamples: $("includeExamples").checked,
        });
      } catch {}
    if (current !== generation) return;
    $("includeSite").disabled = !page;
    $("includeExamples").disabled = !page;
    if (!page) {
      $("includeSite").checked = false;
      $("includeExamples").checked = false;
    }
    $("pageNote").textContent = page
      ? "Page context is available. Optional details remain off until you select them."
      : "No page context is available. This report still includes extension settings, rates and error codes. Open Report a problem from a website’s popup to include page details.";
    const ua = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent);
    const report = DX.report({
      version: chrome.runtime.getManifest().version,
      settings: PC.settings(raw),
      local,
      page,
      browser: ua ? "Chrome/" + ua[1] : "Chromium browser",
      includeSite: $("includeSite").checked,
      includeExamples: $("includeExamples").checked,
    });
    $("preview").value = JSON.stringify(report, null, 2);
    for (const id of ["copy", "download", "github"]) $(id).disabled = false;
  } catch {
    if (current !== generation) return;
    $("preview").value =
      "Report could not be prepared. Reopen this page to try again.";
    UI.toast("Could not prepare the report.", true);
    DX.record("report_build_failed");
  }
}
async function copy() {
  await navigator.clipboard.writeText($("preview").value);
  UI.toast("Report copied. You can paste it into a support conversation.");
}
UI.version();
for (const id of ["includeSite", "includeExamples"])
  $(id).onchange = () => build();
$("copy").onclick = () =>
  copy().catch(() =>
    UI.toast("Could not copy. Use Download JSON instead.", true),
  );
$("download").onclick = () => {
  const a = document.createElement("a");
  a.href =
    "data:application/json;charset=utf-8," +
    encodeURIComponent($("preview").value + "\n");
  a.download =
    "price-auto-converter-report-" +
    new Date().toISOString().slice(0, 10) +
    ".json";
  document.body.append(a);
  a.click();
  a.remove();
  UI.toast("Report download requested.");
};
$("github").onclick = async () => {
  try {
    await copy();
    await chrome.tabs.create({
      url: "https://github.com/thedigitalbum/price-auto-converter/issues/new",
    });
    UI.toast(
      "Report copied. Paste it into the GitHub issue before submitting.",
    );
  } catch {
    UI.toast(
      "Could not copy or open GitHub. Download the report instead.",
      true,
    );
  }
};
$("clearEvents").onclick = async () => {
  try {
    await chrome.storage.local.remove("diagnosticEvents");
    await build();
    UI.toast("Local error history cleared.");
  } catch {
    UI.toast("Could not clear error history.", true);
  }
};
build();
