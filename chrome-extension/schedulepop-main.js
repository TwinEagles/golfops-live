(function () {
  const REPORT_EVENT = "golfops-schedulepop-report";
  const PTO_COMMAND_EVENT = "golfops-schedulepop-pto-command";
  const PTO_DATA_EVENT = "golfops-schedulepop-pto-data";
  const originalFetch = window.fetch;
  let locationId = null;

  function parseUrl(value) {
    try { return new URL(String(value), window.location.href); } catch { return null; }
  }

  function learnContext(value) {
    const url = parseUrl(value);
    if (!url || url.hostname !== "api.schedulepop.com") return url;
    const match = url.pathname.match(/\/locations\/(\d+)/);
    if (match) locationId = Number(match[1]);
    return url;
  }

  function announceReport(value) {
    const url = learnContext(value);
    if (url?.hostname === "api.schedulepop.com" && url.pathname.includes("/printableSchedule")) {
      window.dispatchEvent(new CustomEvent(REPORT_EVENT, { detail: url.toString() }));
    }
  }

  function sanitizeEmployee(value) {
    if (!value || typeof value !== "object") return null;
    const duties = Array.isArray(value.userDuties) ? value.userDuties.map((duty) => ({
      id: duty?.id, duty: duty?.duty, name: duty?.name,
      disabled: duty?.disabled, activeDuty: duty?.activeDuty,
    })) : [];
    const zones = Array.isArray(value.userZones) ? value.userZones.map((zone) => ({
      id: zone?.id, zone: zone?.zone, zoneName: zone?.zoneName, enabled: zone?.enabled,
    })) : [];
    return {
      id: Number(value.id), firstname: value.firstname || "", lastname: value.lastname || "",
      email: value.email || "", userStatusTypeName: value.userStatusTypeName || "",
      userDuties: duties, userZones: zones,
    };
  }

  function sanitizePto(value) {
    if (!value || typeof value !== "object") return null;
    return {
      id: Number(value.id), user: Number(value.user), firstname: value.firstname || "",
      lastname: value.lastname || "", start: value.start || "", end: value.end || "",
      allDay: value.allDay !== false, approved: value.approved === true,
      isDeleted: value.isDeleted === true, status: value.status || "PTO",
      managerNote: value.managerNote || null, createDatetime: value.createDatetime || null,
      updateDatetime: value.updateDatetime || null,
    };
  }

  function emitPto(detail) {
    window.dispatchEvent(new CustomEvent(PTO_DATA_EVENT, { detail }));
  }

  async function inspectPtoMutation(url, method, response) {
    if (!url || url.hostname !== "api.schedulepop.com") return;
    if (url.pathname.includes("/approveTimeOff") && response.ok) {
      try {
        const body = await response.clone().json();
        const request = sanitizePto(body);
        const employee = sanitizeEmployee(body?.userObj);
        if (request?.id) {
          emitPto({ sourceMode: "delta", action: "upsert", locationId,
            employees: employee ? [employee] : [], requests: [request], complete: false });
        }
      } catch { /* Manual full sync remains available if SchedulePop changes this response. */ }
      return;
    }

    const deleteMatch = url.pathname.match(/\/locations\/(\d+)\/users\/(\d+)\/availabilities\/(\d+)$/);
    if (method === "DELETE" && deleteMatch && response.ok) {
      const today = new Date().toISOString().slice(0, 10);
      emitPto({
        sourceMode: "delta", action: "delete", locationId: Number(deleteMatch[1]), employees: [],
        requests: [{ id: Number(deleteMatch[3]), user: Number(deleteMatch[2]),
          start: `${today} 00:00:00`, end: `${today} 23:59:59` }], complete: false,
      });
    }
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.results)) return value.results;
    return [];
  }

  async function fetchJson(url) {
    const response = await originalFetch.call(window, url, {
      method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`SchedulePop returned ${response.status}.`);
    return response.json();
  }

  async function mapWithConcurrency(values, limit, mapper) {
    const results = new Array(values.length);
    let next = 0;
    async function worker() {
      while (next < values.length) {
        const index = next++;
        results[index] = await mapper(values[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
    return results;
  }

  async function fullPtoSync(detail) {
    const requestId = detail?.requestId || null;
    try {
      if (!locationId) throw new Error("Open the SchedulePop Dashboard or Users page once, then try TEAM PTO again.");
      const dateStart = String(detail?.dateStart || "");
      const dateEnd = String(detail?.dateEnd || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart) || !/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
        throw new Error("The TEAM PTO date range is invalid.");
      }

      const base = `https://api.schedulepop.com/api/rest/admin/locations/${locationId}`;
      const usersResult = await fetchJson(
        `${base}/users?fields=id,firstname,lastname,email,userStatusTypeName,userDuties,userZones`
      );
      const userList = asArray(usersResult).filter((user) => Number(user?.id) > 0);
      if (!userList.length) throw new Error("SchedulePop did not return the employee directory.");

      const failures = [];
      const collected = await mapWithConcurrency(userList, 4, async (listedUser) => {
        const userId = Number(listedUser.id);
        try {
          const [employeeResult, ptoResult] = await Promise.all([
            fetchJson(`${base}/users/${userId}`),
            fetchJson(`${base}/users/${userId}/availabilities?available=0&recurs=0&start=${encodeURIComponent(dateStart)}&end=${encodeURIComponent(dateEnd)}`),
          ]);
          return { employee: sanitizeEmployee(employeeResult), requests: asArray(ptoResult).map(sanitizePto).filter(Boolean) };
        } catch (error) {
          failures.push(`${listedUser.firstname || "Employee"} ${listedUser.lastname || userId}: ${error instanceof Error ? error.message : "Unable to retrieve PTO."}`);
          return { employee: sanitizeEmployee(listedUser), requests: [] };
        }
      });

      emitPto({
        requestId, sourceMode: "full", action: "upsert", locationId, dateStart, dateEnd,
        employees: collected.map((item) => item.employee).filter(Boolean),
        requests: collected.flatMap((item) => item.requests), complete: failures.length === 0,
        sourceErrors: failures,
      });
    } catch (error) {
      emitPto({ requestId, error: error instanceof Error ? error.message : "Unable to collect SchedulePop PTO." });
    }
  }

  const originalOpen = window.open;
  window.open = function (url, ...args) {
    announceReport(url);
    return originalOpen.call(window, url, ...args);
  };

  window.fetch = function (input, init) {
    const value = typeof input === "string" ? input : input?.url;
    const url = learnContext(value);
    announceReport(value);
    const method = String(init?.method || (typeof input === "object" ? input?.method : "GET") || "GET").toUpperCase();
    const promise = originalFetch.call(this, input, init);
    promise.then((response) => inspectPtoMutation(url, method, response)).catch(() => {});
    return promise;
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    learnContext(url);
    announceReport(url);
    return originalXhrOpen.call(this, method, url, ...args);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (target) announceReport(target.href);
  }, true);

  window.addEventListener(PTO_COMMAND_EVENT, (event) => fullPtoSync(event.detail));
})();
