const SCHEDULEPOP_SCHEDULE_COMMAND_EVENT = "golfops-schedulepop-schedule-command";
const SCHEDULEPOP_SCHEDULE_DATA_EVENT = "golfops-schedulepop-schedule-data";
const SCHEDULEPOP_PTO_COMMAND_EVENT = "golfops-schedulepop-pto-command";
const SCHEDULEPOP_PTO_DATA_EVENT = "golfops-schedulepop-pto-data";

const pendingScheduleSyncs = new Map();
const pendingPtoSyncs = new Map();
let runSchedulePopSync = null;

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function showSchedulePopStatus(message, type = "normal") {
  let box = document.getElementById("golfops-schedulepop-status");
  if (!box) {
    box = document.createElement("div");
    box.id = "golfops-schedulepop-status";
    Object.assign(box.style, {
      position: "fixed", right: "20px", bottom: "20px", zIndex: "2147483647",
      padding: "14px 18px", borderRadius: "10px", fontFamily: "Arial, sans-serif",
      fontSize: "14px", fontWeight: "600", color: "white",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)", maxWidth: "440px"
    });
    document.documentElement.appendChild(box);
  }
  box.textContent = message;
  box.style.background = type === "success" ? "#15803d" : type === "error" ? "#b91c1c" : "#334155";
}

function localDateString(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

function parseLocalDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayedScheduleWeek() {
  const url = new URL(window.location.href);
  const selected = parseLocalDate(url.searchParams.get("date")) ||
    parseLocalDate(url.searchParams.get("start")) || new Date();
  const start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 12);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { dateStart: localDateString(start), dateEnd: localDateString(end) };
}

function ptoDateRange() {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - 1);
  const end = new Date();
  end.setMonth(end.getMonth() + 18);
  return { dateStart: localDateString(start), dateEnd: localDateString(end) };
}

function createPendingSync(pendingMap, timeout, timeoutMessage) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const promise = new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pendingMap.delete(requestId);
      resolve({ ok: false, error: timeoutMessage });
    }, timeout);
    pendingMap.set(requestId, { resolve, timer });
  });
  return { requestId, promise };
}

function runDirectScheduleSync() {
  const pending = createPendingSync(
    pendingScheduleSyncs, 60000,
    "SchedulePop schedule collection timed out. Refresh the Schedule page and try again."
  );
  window.dispatchEvent(new CustomEvent(SCHEDULEPOP_SCHEDULE_COMMAND_EVENT, {
    detail: { requestId: pending.requestId, ...displayedScheduleWeek() }
  }));
  return pending.promise;
}

function runPtoSync() {
  const pending = createPendingSync(
    pendingPtoSyncs, 120000,
    "SchedulePop PTO collection timed out. Keep SchedulePop open and try again."
  );
  window.dispatchEvent(new CustomEvent(SCHEDULEPOP_PTO_COMMAND_EVENT, {
    detail: { requestId: pending.requestId, ...ptoDateRange() }
  }));
  return pending.promise;
}

function resolvePending(pendingMap, requestId, result) {
  const pending = requestId ? pendingMap.get(requestId) : null;
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pendingMap.delete(requestId);
  pending.resolve(result);
}

window.addEventListener(SCHEDULEPOP_SCHEDULE_DATA_EVENT, async (event) => {
  const detail = event.detail || {};
  let result;
  try {
    if (detail.error) {
      result = { ok: false, error: detail.error };
    } else if (detail.collectInExtension) {
      const collected = await sendMessage({
        type: "COLLECT_SCHEDULEPOP_SCHEDULE",
        payload: {
          requestId: detail.requestId, authorization: detail.authorization,
          locationId: detail.locationId, dateStart: detail.dateStart, dateEnd: detail.dateEnd
        }
      });
      result = collected?.ok
        ? await sendMessage({ type: "SEND_SCHEDULEPOP", payload: collected.payload })
        : { ok: false, error: collected?.error || "Unable to collect the SchedulePop schedule." };
    } else {
      result = { ok: false, error: "SchedulePop did not return schedule data." };
    }
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "Unable to contact GolfOps Live." };
  }
  resolvePending(pendingScheduleSyncs, detail.requestId, result);
});

window.addEventListener(SCHEDULEPOP_PTO_DATA_EVENT, async (event) => {
  const detail = event.detail || {};
  let result;
  try {
    if (detail.error) {
      result = { ok: false, error: detail.error };
    } else if (detail.collectInExtension) {
      const collected = await sendMessage({
        type: "COLLECT_SCHEDULEPOP_PTO",
        payload: {
          requestId: detail.requestId, authorization: detail.authorization,
          locationId: detail.locationId, dateStart: detail.dateStart, dateEnd: detail.dateEnd
        }
      });
      result = collected?.ok
        ? await sendMessage({ type: "SEND_SCHEDULEPOP_PTO", payload: collected.payload })
        : { ok: false, error: collected?.error || "Unable to collect TEAM PTO from SchedulePop." };
    } else {
      result = await sendMessage({ type: "SEND_SCHEDULEPOP_PTO", payload: detail });
    }
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "Unable to contact GolfOps Live." };
  }
  resolvePending(pendingPtoSyncs, detail.requestId, result);
});

function addSyncButton() {
  if (document.getElementById("golfops-schedulepop-sync")) return;
  const button = document.createElement("button");
  button.id = "golfops-schedulepop-sync";
  button.type = "button";
  button.textContent = "Send to GolfOps";
  Object.assign(button.style, {
    position: "fixed", left: "20px", bottom: "20px", zIndex: "2147483646",
    padding: "11px 16px", border: "0", borderRadius: "8px", background: "#2563eb",
    color: "white", fontFamily: "Arial, sans-serif", fontSize: "14px", fontWeight: "700",
    cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.22)"
  });

  runSchedulePopSync = async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.style.opacity = "0.7";
    showSchedulePopStatus("Sending the displayed SchedulePop week and approved PTO to GolfOps Live...");
    const [scheduleResult, ptoResult] = await Promise.all([runDirectScheduleSync(), runPtoSync()]);
    button.disabled = false;
    button.style.opacity = "1";

    if (!scheduleResult?.ok) {
      showSchedulePopStatus(scheduleResult?.error || "The SchedulePop schedule could not be sent.", "error");
      return;
    }
    if (!ptoResult?.ok) {
      showSchedulePopStatus(
        `The schedule was updated, but PTO failed: ${ptoResult?.error || "Unknown error."}`, "error"
      );
      return;
    }
    showSchedulePopStatus(
      `GolfOps updated — ${scheduleResult.rowsImported || 0} staffing records imported and approved PTO synchronized.`,
      "success"
    );
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    runSchedulePopSync();
  });
  document.documentElement.appendChild(button);
}

window.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest("#golfops-schedulepop-sync") : null;
  if (!target || !runSchedulePopSync) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  runSchedulePopSync();
}, true);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addSyncButton, { once: true });
} else {
  addSyncButton();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "START_SCHEDULEPOP_PTO_SYNC") return false;
  runPtoSync().then(sendResponse).catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to synchronize TEAM PTO."
    });
  });
  return true;
});
