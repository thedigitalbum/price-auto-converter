// Explicit user submissions only. Queued consented reports survive offline/restart.
const REPORT_DELIVERY = (() => {
  const KEY = "reportOutbox",
    RECEIPTS = "reportReceipts",
    TTL = 7 * 86400000;
  let chain = Promise.resolve();
  function serial(fn) {
    const task = chain.then(fn);
    chain = task.catch(() => {});
    return task;
  }
  function configured() {
    return RC.endpointValid(REPORT_CONFIG.endpoint);
  }
  function schedule() {
    return chrome.alarms.create("report-retry", { periodInMinutes: 5 });
  }
  async function load() {
    const s = await chrome.storage.local.get([KEY, RECEIPTS]);
    return {
      queue: (Array.isArray(s[KEY]) ? s[KEY] : [])
        .filter(
          (e) =>
            e &&
            e.report &&
            RC.UUID.test(e.report.id || "") &&
            Number.isFinite(e.saved) &&
            Date.now() - e.saved < TTL,
        )
        .slice(-5),
      receipts: (Array.isArray(s[RECEIPTS]) ? s[RECEIPTS] : [])
        .filter(
          (e) => e && RC.UUID.test(e.id || "") && typeof e.receipt === "string",
        )
        .slice(-20),
    };
  }
  async function save(state) {
    await chrome.storage.local.set({
      [KEY]: state.queue,
      [RECEIPTS]: state.receipts,
    });
  }
  async function attempt(entry, state) {
    try {
      const response = await fetch(REPORT_CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(entry.report),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("temporary");
      if (
        response.url &&
        !/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com)\//.test(
          response.url,
        )
      )
        throw new Error("temporary");
      const text = await response.text();
      if (text.length > 2048) throw new Error("temporary");
      const data = JSON.parse(text);
      if (
        data.ok === true &&
        data.reportId === entry.report.id &&
        /^PAC-[A-Za-z0-9-]{8,64}$/.test(data.receipt || "")
      ) {
        state.queue = state.queue.filter(
          (e) => e.report.id !== entry.report.id,
        );
        state.receipts.push({
          id: entry.report.id,
          receipt: data.receipt,
          time: Date.now(),
        });
        state.receipts = state.receipts.slice(-20);
        try {
          await save(state);
        } catch {}
        return { ok: true, status: "sent", receipt: data.receipt };
      }
      if (data.code === "invalid_report") {
        state.queue = state.queue.filter((e) => e !== entry);
        await save(state);
        return { ok: false, code: "invalid_report" };
      }
      throw new Error(
        data.code === "daily_limit" ? "daily_limit" : "temporary",
      );
    } catch (e) {
      entry.attempts = Math.min(30, (entry.attempts || 0) + 1);
      entry.next =
        Date.now() +
        (e.message === "daily_limit"
          ? 86400000
          : Math.min(21600000, 60000 * 2 ** Math.min(entry.attempts, 8)));
      await save(state);
      await schedule();
      return { ok: true, status: "queued" };
    }
  }
  function submit(raw) {
    return serial(async () => {
      let report;
      try {
        report = RC.prepare(raw);
      } catch {
        return { ok: false, code: "invalid_report" };
      }
      if (!configured()) return { ok: false, code: "not_configured" };
      const state = await load(),
        receipt = state.receipts.find((r) => r.id === report.id);
      if (receipt)
        return { ok: true, status: "sent", receipt: receipt.receipt };
      const existing = state.queue.find((e) => e.report.id === report.id);
      if (existing) return { ok: true, status: "queued" };
      if (state.queue.length >= 5) return { ok: false, code: "queue_full" };
      const latest = state.receipts.reduce(
        (t, r) => Math.max(t, Number(r.time) || 0),
        0,
      );
      if (Date.now() - latest < 30000) return { ok: false, code: "too_soon" };
      const entry = { report, saved: Date.now(), attempts: 0, next: 0 };
      state.queue.push(entry);
      await save(state);
      return attempt(entry, state);
    });
  }
  function flush() {
    return serial(async () => {
      if (!configured()) return;
      const state = await load();
      for (const entry of [...state.queue]) {
        if ((entry.next || 0) > Date.now()) continue;
        await attempt(entry, state);
      }
      await save(state);
    });
  }
  return { submit, flush, schedule, configured };
})();
