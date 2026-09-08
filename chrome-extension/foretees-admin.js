(() => {
  const EDITED_MEMBER_KEY =
    "golfops_foretees_edited_member";

  const PENDING_SYNC_KEY =
    "golfops_foretees_pending_bag_sync";

  let syncInProgress = false;
  let attemptedSyncId = "";
  let observerTimer = null;

  function readStoredJson(key) {
    try {
      const value =
        window.sessionStorage.getItem(key);

      return value
        ? JSON.parse(value)
        : null;
    } catch {
      return null;
    }
  }

  function writeStoredJson(
    key,
    value
  ) {
    try {
      window.sessionStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error(
        "GolfOps ForeTees storage error:",
        error
      );
    }
  }

  function removeStoredValue(key) {
    try {
      window.sessionStorage.removeItem(
        key
      );
    } catch {
      // Ignore unavailable session storage.
    }
  }

  function showGolfOpsStatus(
    message,
    type = "normal"
  ) {
    let statusBox =
      document.getElementById(
        "golfops-foretees-bag-status"
      );

    if (!statusBox) {
      statusBox =
        document.createElement("div");

      statusBox.id =
        "golfops-foretees-bag-status";

      Object.assign(
        statusBox.style,
        {
          position: "fixed",
          right: "20px",
          bottom: "20px",
          zIndex: "9999999",
          maxWidth: "440px",
          padding: "14px 18px",
          borderRadius: "10px",
          color: "#ffffff",
          fontFamily:
            "Arial, sans-serif",
          fontSize: "14px",
          fontWeight: "700",
          lineHeight: "1.4",
          boxShadow:
            "0 6px 24px rgba(0, 0, 0, 0.28)"
        }
      );

      document.body.appendChild(
        statusBox
      );
    }

    statusBox.textContent =
      message;

    if (type === "success") {
      statusBox.style.background =
        "#15803d";
    } else if (type === "error") {
      statusBox.style.background =
        "#b91c1c";
    } else {
      statusBox.style.background =
        "#334155";
    }
  }

  function getControlText(
    element
  ) {
    if (
      !(element instanceof HTMLElement)
    ) {
      return "";
    }

    const value =
      element instanceof HTMLInputElement
        ? element.value
        : "";

    return `${value} ${element.textContent ?? ""}`
      .replace(/\s+/g, " ")
      .trim();
  }

  function getControlCode(
    element
  ) {
    if (
      !(element instanceof HTMLElement)
    ) {
      return "";
    }

    return [
      element.getAttribute("href") ??
        "",
      element.getAttribute("onclick") ??
        "",
      element.getAttribute("value") ??
        "",
      element.textContent ?? ""
    ].join(" ");
  }

  function extractEditedUsername(
    element
  ) {
    const code =
      getControlCode(element);

    /*
      ForeTees currently uses links similar to:

      javascript:viewUser(
        '/v5/servlet/Admin_editmain',
        '04736'
      )
    */

    const viewUserMatch =
      code.match(
        /viewUser\s*\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/i
      );

    if (viewUserMatch?.[1]) {
      return viewUserMatch[1].trim();
    }

    const fallbackMatch =
      code.match(
        /Admin_editmain[^,]*,\s*['"]([^'"]+)['"]/i
      );

    return fallbackMatch?.[1]?.trim() ??
      "";
  }

  function isSaveAndClose(
    element
  ) {
    const text =
      getControlText(element)
        .toLowerCase();

    const code =
      getControlCode(element)
        .toLowerCase();

    return (
      text.includes(
        "save and close"
      ) ||
      code.includes(
        "updateandclose"
      )
    );
  }

  function isCancelControl(
    element
  ) {
    return (
      getControlText(element)
        .trim()
        .toLowerCase() ===
      "cancel"
    );
  }

  function handleForeTeesClick(
    event
  ) {
    const target =
      event.target instanceof Element
        ? event.target.closest(
            "a, button, input"
          )
        : null;

    if (
      !(target instanceof HTMLElement)
    ) {
      return;
    }

    /*
      Remember which member was selected
      when the manager clicks Edit.
    */

    const editedUsername =
      extractEditedUsername(target);

    if (editedUsername) {
      writeStoredJson(
        EDITED_MEMBER_KEY,
        {
          username:
            editedUsername,
          selectedAt:
            Date.now()
        }
      );

      removeStoredValue(
        PENDING_SYNC_KEY
      );

      return;
    }

    /*
      Cancel must never trigger a
      GolfOps update.
    */

    if (
      isCancelControl(target)
    ) {
      removeStoredValue(
        EDITED_MEMBER_KEY
      );

      removeStoredValue(
        PENDING_SYNC_KEY
      );

      return;
    }

    /*
      Save and Close starts a pending sync.
      The actual GolfOps update does not
      happen until ForeTees returns to the
      Member List and the saved row appears.
    */

    if (
      isSaveAndClose(target)
    ) {
      const editedMember =
        readStoredJson(
          EDITED_MEMBER_KEY
        );

      const username =
        typeof editedMember?.username ===
        "string"
          ? editedMember.username.trim()
          : "";

      if (!username) {
        console.warn(
          "GolfOps Live could not determine which ForeTees member is being saved."
        );

        return;
      }

      const savedAt =
        Date.now();

      writeStoredJson(
        PENDING_SYNC_KEY,
        {
          username,
          savedAt
        }
      );

      attemptedSyncId = "";

      showGolfOpsStatus(
        "ForeTees is saving the bag-slot change..."
      );
    }
  }

  function normalizeHeader(
    value
  ) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function cleanCellText(cell) {
    return String(
      cell?.textContent ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  function findColumn(
    headers,
    possibleNames
  ) {
    for (
      const possibleName
      of possibleNames
    ) {
      const index =
        headers.indexOf(
          possibleName
        );

      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  function findSavedMember(
    username
  ) {
    const allRows =
      Array.from(
        document.querySelectorAll(
          "tr"
        )
      );

    for (
      const possibleHeaderRow
      of allRows
    ) {
      const headerCells =
        Array.from(
          possibleHeaderRow.cells ??
            []
        );

      if (!headerCells.length) {
        continue;
      }

      const headers =
        headerCells.map(
          (cell) =>
            normalizeHeader(
              cell.textContent
            )
        );

      const lastNameIndex =
        findColumn(
          headers,
          ["lastname"]
        );

      const firstNameIndex =
        findColumn(
          headers,
          ["firstname"]
        );

      const usernameIndex =
        findColumn(
          headers,
          ["username"]
        );

      const memberNumberIndex =
        findColumn(
          headers,
          [
            "mem",
            "membernumber"
          ]
        );

      const posIdIndex =
        findColumn(
          headers,
          [
            "posid",
            "posmemberid"
          ]
        );

      const bagSlotIndex =
        findColumn(
          headers,
          [
            "bagslot",
            "bagstoragenumber",
            "bagnumber"
          ]
        );

      const membershipTypeIndex =
        findColumn(
          headers,
          ["membershiptype"]
        );

      const memberTypeIndex =
        findColumn(
          headers,
          ["membertype"]
        );

      const statusIndex =
        findColumn(
          headers,
          ["status"]
        );

      const lastSyncDateIndex =
        findColumn(
          headers,
          ["lastsyncdate"]
        );

      if (
        lastNameIndex < 0 ||
        firstNameIndex < 0 ||
        usernameIndex < 0 ||
        bagSlotIndex < 0
      ) {
        continue;
      }

      const memberTable =
        possibleHeaderRow.closest(
          "table"
        );

      if (!memberTable) {
        continue;
      }

      const tableRows =
        Array.from(
          memberTable.rows
        );

      const headerPosition =
        tableRows.indexOf(
          possibleHeaderRow
        );

      if (headerPosition < 0) {
        continue;
      }

      for (
        const row
        of tableRows.slice(
          headerPosition + 1
        )
      ) {
        const cells =
          Array.from(
            row.cells ?? []
          );

        if (
          cells.length <=
          usernameIndex
        ) {
          continue;
        }

        const rowUsername =
          cleanCellText(
            cells[usernameIndex]
          );

        if (
          rowUsername.toLowerCase() !==
          username.toLowerCase()
        ) {
          continue;
        }

        return {
          foreteesUsername:
            rowUsername,

          firstName:
            cleanCellText(
              cells[
                firstNameIndex
              ]
            ),

          lastName:
            cleanCellText(
              cells[
                lastNameIndex
              ]
            ),

          memberNumber:
            memberNumberIndex >= 0
              ? cleanCellText(
                  cells[
                    memberNumberIndex
                  ]
                )
              : "",

          posId:
            posIdIndex >= 0
              ? cleanCellText(
                  cells[
                    posIdIndex
                  ]
                )
              : "",

          bagNumber:
            cleanCellText(
              cells[
                bagSlotIndex
              ]
            ),

          membershipType:
            membershipTypeIndex >= 0
              ? cleanCellText(
                  cells[
                    membershipTypeIndex
                  ]
                )
              : "",

          memberType:
            memberTypeIndex >= 0
              ? cleanCellText(
                  cells[
                    memberTypeIndex
                  ]
                )
              : "",

          status:
            statusIndex >= 0
              ? cleanCellText(
                  cells[
                    statusIndex
                  ]
                )
              : "",

          lastSyncDate:
            lastSyncDateIndex >= 0
              ? cleanCellText(
                  cells[
                    lastSyncDateIndex
                  ]
                )
              : ""
        };
      }
    }

    return null;
  }

  function attemptPendingSync() {
    if (syncInProgress) {
      return;
    }

    const pendingSync =
      readStoredJson(
        PENDING_SYNC_KEY
      );

    const username =
      typeof pendingSync?.username ===
      "string"
        ? pendingSync.username.trim()
        : "";

    const savedAt =
      Number(
        pendingSync?.savedAt
      );

    if (
      !username ||
      !Number.isFinite(savedAt)
    ) {
      return;
    }

    /*
      Discard abandoned edits after
      fifteen minutes.
    */

    if (
      Date.now() - savedAt >
      15 * 60 * 1000
    ) {
      removeStoredValue(
        PENDING_SYNC_KEY
      );

      removeStoredValue(
        EDITED_MEMBER_KEY
      );

      return;
    }

    const syncId =
      `${username}:${savedAt}`;

    if (
      attemptedSyncId ===
      syncId
    ) {
      return;
    }

    const member =
      findSavedMember(
        username
      );

    /*
      The Member List has not returned
      yet, or ForeTees is still rendering.
    */

    if (!member) {
      return;
    }

    attemptedSyncId =
      syncId;

    syncInProgress =
      true;

    showGolfOpsStatus(
      `Updating GolfOps Bag Finder for ${member.firstName} ${member.lastName}...`
    );

    chrome.runtime.sendMessage(
      {
        type:
          "SEND_FORETEES_BAG_MEMBER",

        payload:
          member
      },
      (response) => {
        syncInProgress =
          false;

        if (
          chrome.runtime
            .lastError
        ) {
          const message =
            chrome.runtime
              .lastError
              .message ||
            "Unknown extension error.";

          console.error(
            "GolfOps ForeTees bag sync extension error:",
            message
          );

          showGolfOpsStatus(
            `GolfOps Bag Finder update failed: ${message}`,
            "error"
          );

          return;
        }

        if (!response?.ok) {
          console.error(
            "GolfOps ForeTees bag sync response:",
            response
          );

          showGolfOpsStatus(
            response?.error ||
              "GolfOps Bag Finder update failed.",
            "error"
          );

          return;
        }

        removeStoredValue(
          PENDING_SYNC_KEY
        );

        removeStoredValue(
          EDITED_MEMBER_KEY
        );

        const bagMessage =
          member.bagNumber
            ? `bag ${member.bagNumber}`
            : "bag assignment cleared";

        showGolfOpsStatus(
          `GolfOps updated — ${member.firstName} ${member.lastName}, ${bagMessage}.`,
          "success"
        );

        console.log(
          "GolfOps Live: ForeTees Bag Finder member synchronized.",
          response
        );
      }
    );
  }

  function schedulePendingSync() {
    if (observerTimer) {
      window.clearTimeout(
        observerTimer
      );
    }

    observerTimer =
      window.setTimeout(
        attemptPendingSync,
        300
      );
  }

  /*
    Capture ForeTees controls before its
    legacy JavaScript changes the page.
  */

  document.addEventListener(
    "click",
    handleForeTeesClick,
    true
  );

  /*
    Save and Close may replace the current
    page content without changing the
    visible URL. Observe those changes and
    synchronize after the Member List
    returns.
  */

  const observer =
    new MutationObserver(
      schedulePendingSync
    );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  window.setTimeout(
    attemptPendingSync,
    500
  );

  window.setTimeout(
    attemptPendingSync,
    1500
  );
})();