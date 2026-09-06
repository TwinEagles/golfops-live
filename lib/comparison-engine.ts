export type ExistingSlotForComparison = {
  id: string;
  tee_time: string;
  course: string;
  starting_hole: number;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  member_id?: string | null;
  bag_number: string | null;
};

export type IncomingSlotForComparison = {
  tee_time: string;
  course: string;
  starting_hole: number;
  starting_position: string | null;
  slot_position: number;
  player_name: string | null;
  member_id?: string | null;
  bag_number: string | null;
};

export type TeeSheetChange = {
  change_type:
    | "ADDED"
    | "REMOVED"
    | "TIME_CHANGED"
    | "HOLE_CHANGED"
    | "REPLACED";

  player_name: string | null;
  member_id: string | null;
  bag_number: string | null;
  tee_time: string | null;
  starting_hole: number | null;
  detail: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type ComparisonSlot =
  | ExistingSlotForComparison
  | IncomingSlotForComparison;

function normalizeName(
  value: string | null
) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeBag(
  value: string | null
) {
  return (value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeCourse(
  value: string
) {
  return value
    .trim()
    .toLowerCase();
}

function normalizedPosition(
  slot: ComparisonSlot
) {
  return (
    slot.starting_position ??
    String(slot.starting_hole)
  )
    .trim()
    .toUpperCase();
}

function isUnassignedShotgunPosition(
  value: string
) {
  return (
    /^S\d*$/i.test(value) ||
    /^SHOTGUN$/i.test(value) ||
    /^UNASSIGNED$/i.test(value)
  );
}

/*
  Determine whether two records represent
  the same golfer.

  IMPORTANT:

  member_id alone must NOT cause a golfer
  to become a different person merely
  because the Member Database matched them
  on a later ForeTees import.

  Any strong matching identifier can
  establish that this is the same golfer:

  1. Same member ID
  2. Same bag number
  3. Same normalized player name
*/
function samePlayer(
  oldSlot: ComparisonSlot,
  newSlot: ComparisonSlot
) {
  const oldMember =
    oldSlot.member_id
      ? String(oldSlot.member_id)
      : "";

  const newMember =
    newSlot.member_id
      ? String(newSlot.member_id)
      : "";

  if (
    oldMember &&
    newMember &&
    oldMember === newMember
  ) {
    return true;
  }

  const oldBag =
    normalizeBag(
      oldSlot.bag_number
    );

  const newBag =
    normalizeBag(
      newSlot.bag_number
    );

  if (
    oldBag &&
    newBag &&
    oldBag === newBag
  ) {
    return true;
  }

  const oldName =
    normalizeName(
      oldSlot.player_name
    );

  const newName =
    normalizeName(
      newSlot.player_name
    );

  if (
    oldName &&
    newName &&
    oldName === newName
  ) {
    return true;
  }

  return false;
}

/*
  Score possible golfer matches.

  This helps us pick the best match if
  multiple records happen to share a name
  or other identifier.

  Higher score = stronger match.
*/
function playerMatchScore(
  oldSlot: ComparisonSlot,
  newSlot: ComparisonSlot
) {
  let score = 0;

  const oldMember =
    oldSlot.member_id
      ? String(oldSlot.member_id)
      : "";

  const newMember =
    newSlot.member_id
      ? String(newSlot.member_id)
      : "";

  if (
    oldMember &&
    newMember &&
    oldMember === newMember
  ) {
    score += 100;
  }

  const oldBag =
    normalizeBag(
      oldSlot.bag_number
    );

  const newBag =
    normalizeBag(
      newSlot.bag_number
    );

  if (
    oldBag &&
    newBag &&
    oldBag === newBag
  ) {
    score += 80;
  }

  const oldName =
    normalizeName(
      oldSlot.player_name
    );

  const newName =
    normalizeName(
      newSlot.player_name
    );

  if (
    oldName &&
    newName &&
    oldName === newName
  ) {
    score += 60;
  }

  /*
    Give a small preference to the same
    physical tee-sheet position.

    This helps resolve duplicate names.
  */
  if (
    positionKey(oldSlot) ===
    positionKey(newSlot)
  ) {
    score += 20;
  }

  return score;
}

function positionKey(
  slot: ComparisonSlot
) {
  return [
    slot.tee_time,
    normalizeCourse(
      slot.course
    ),
    normalizedPosition(slot),
    slot.slot_position,
  ].join("|");
}

function locationDescription(
  slot: ComparisonSlot
) {
  return `${slot.tee_time} ${
    slot.course
  } ${normalizedPosition(slot)}`;
}

function valuesFor(
  slot: ComparisonSlot
) {
  return {
    tee_time:
      slot.tee_time,

    course:
      slot.course,

    starting_hole:
      slot.starting_hole,

    starting_position:
      slot.starting_position,

    slot_position:
      slot.slot_position,

    player_name:
      slot.player_name,

    bag_number:
      slot.bag_number,
  };
}

export function compareTeeSheets(
  existingSlots: ExistingSlotForComparison[],
  incomingSlots: IncomingSlotForComparison[]
): TeeSheetChange[] {
  const changes:
    TeeSheetChange[] = [];

  const existingPlayers =
    existingSlots.filter(
      (slot) =>
        !!slot.player_name
    );

  const incomingPlayers =
    incomingSlots.filter(
      (slot) =>
        !!slot.player_name
    );

  /*
    Track which old/new records have
    already been matched to each other.
  */

  const matchedExisting =
    new Set<number>();

  const matchedIncoming =
    new Set<number>();

  /*
    Store actual golfer matches so that
    movement detection can happen before
    replacements/additions/removals.
  */

  const playerMatches: Array<{
    oldIndex: number;
    newIndex: number;
    oldSlot: ExistingSlotForComparison;
    newSlot: IncomingSlotForComparison;
  }> = [];

  /*
    STEP 1:
    Match golfers between the old and
    incoming tee sheets.

    This intentionally allows:

      old member_id = null
      new member_id = 123

    as long as the bag or player name
    confirms it is the same golfer.
  */

  for (
    let oldIndex = 0;
    oldIndex <
    existingPlayers.length;
    oldIndex++
  ) {
    const oldSlot =
      existingPlayers[
        oldIndex
      ];

    let bestNewIndex =
      -1;

    let bestScore =
      0;

    for (
      let newIndex = 0;
      newIndex <
      incomingPlayers.length;
      newIndex++
    ) {
      if (
        matchedIncoming.has(
          newIndex
        )
      ) {
        continue;
      }

      const newSlot =
        incomingPlayers[
          newIndex
        ];

      if (
        !samePlayer(
          oldSlot,
          newSlot
        )
      ) {
        continue;
      }

      const score =
        playerMatchScore(
          oldSlot,
          newSlot
        );

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        bestNewIndex =
          newIndex;
      }
    }

    if (
      bestNewIndex === -1
    ) {
      continue;
    }

    const newSlot =
      incomingPlayers[
        bestNewIndex
      ];

    matchedExisting.add(
      oldIndex
    );

    matchedIncoming.add(
      bestNewIndex
    );

    playerMatches.push({
      oldIndex,
      newIndex:
        bestNewIndex,
      oldSlot,
      newSlot,
    });
  }

  /*
    STEP 2:
    Detect movement for golfers who
    exist on both versions of the sheet.
  */

  for (
    const match of
    playerMatches
  ) {
    const oldSlot =
      match.oldSlot;

    const newSlot =
      match.newSlot;

    const oldPosition =
      normalizedPosition(
        oldSlot
      );

    const newPosition =
      normalizedPosition(
        newSlot
      );

    /*
      Tee time changed.
    */

    if (
      oldSlot.tee_time !==
      newSlot.tee_time
    ) {
      changes.push({
        change_type:
          "TIME_CHANGED",

        player_name:
          newSlot.player_name,

        member_id:
          newSlot.member_id ??
          oldSlot.member_id ??
          null,

        bag_number:
          newSlot.bag_number ??
          oldSlot.bag_number,

        tee_time:
          newSlot.tee_time,

        starting_hole:
          newSlot.starting_hole,

        detail:
          `${newSlot.player_name} moved from ${locationDescription(
            oldSlot
          )} to ${locationDescription(
            newSlot
          )}.`,

        old_value:
          valuesFor(
            oldSlot
          ),

        new_value:
          valuesFor(
            newSlot
          ),
      });

      continue;
    }

    /*
      Starting position or course changed.

      Special case:
      ForeTees initially uses S / S1 / S2...
      for unassigned shotgun groups.

      When ForeTees later assigns those golfers
      to actual holes, that is initialization of
      the shotgun rather than an operational
      tee-sheet change.

      Do not flood Changes with one HOLE_CHANGED
      record for every golfer in the shotgun.
    */

    const oldCourse =
      normalizeCourse(
        oldSlot.course
      );

    const newCourse =
      normalizeCourse(
        newSlot.course
      );

    const isInitialShotgunAssignment =
      oldSlot.tee_time ===
        newSlot.tee_time &&
      oldCourse ===
        newCourse &&
      isUnassignedShotgunPosition(
        oldPosition
      ) &&
      !isUnassignedShotgunPosition(
        newPosition
      );

    if (
      !isInitialShotgunAssignment &&
      (
        oldPosition !==
          newPosition ||
        oldCourse !==
          newCourse
      )
    ) {
      changes.push({
        change_type:
          "HOLE_CHANGED",

        player_name:
          newSlot.player_name,

        member_id:
          newSlot.member_id ??
          oldSlot.member_id ??
          null,

        bag_number:
          newSlot.bag_number ??
          oldSlot.bag_number,

        tee_time:
          newSlot.tee_time,

        starting_hole:
          newSlot.starting_hole,

        detail:
          `${newSlot.player_name} moved from ${locationDescription(
            oldSlot
          )} to ${locationDescription(
            newSlot
          )}.`,

        old_value:
          valuesFor(
            oldSlot
          ),

        new_value:
          valuesFor(
            newSlot
          ),
      });
    }
  }

  /*
    STEP 3:
    Detect true replacements.

    At this stage we look ONLY at players
    that were not already matched above.

    If an unmatched old golfer and unmatched
    new golfer occupy the same exact physical
    position, the golfer was replaced.
  */

  const unmatchedExistingByPosition =
    new Map<
      string,
      {
        index: number;
        slot: ExistingSlotForComparison;
      }
    >();

  const unmatchedIncomingByPosition =
    new Map<
      string,
      {
        index: number;
        slot: IncomingSlotForComparison;
      }
    >();

  for (
    let index = 0;
    index <
    existingPlayers.length;
    index++
  ) {
    if (
      matchedExisting.has(
        index
      )
    ) {
      continue;
    }

    const slot =
      existingPlayers[
        index
      ];

    unmatchedExistingByPosition.set(
      positionKey(slot),
      {
        index,
        slot,
      }
    );
  }

  for (
    let index = 0;
    index <
    incomingPlayers.length;
    index++
  ) {
    if (
      matchedIncoming.has(
        index
      )
    ) {
      continue;
    }

    const slot =
      incomingPlayers[
        index
      ];

    unmatchedIncomingByPosition.set(
      positionKey(slot),
      {
        index,
        slot,
      }
    );
  }

  for (
    const [
      position,
      oldRecord,
    ] of
      unmatchedExistingByPosition.entries()
  ) {
    const newRecord =
      unmatchedIncomingByPosition.get(
        position
      );

    if (!newRecord) {
      continue;
    }

    /*
      Safety check.

      If these somehow still represent
      the same golfer, do NOT create a
      replacement.
    */

    if (
      samePlayer(
        oldRecord.slot,
        newRecord.slot
      )
    ) {
      matchedExisting.add(
        oldRecord.index
      );

      matchedIncoming.add(
        newRecord.index
      );

      continue;
    }

    changes.push({
      change_type:
        "REPLACED",

      player_name:
        newRecord.slot
          .player_name,

      member_id:
        newRecord.slot
          .member_id ??
        null,

      bag_number:
        newRecord.slot
          .bag_number,

      tee_time:
        newRecord.slot
          .tee_time,

      starting_hole:
        newRecord.slot
          .starting_hole,

      detail:
        `${oldRecord.slot.player_name} was replaced by ${newRecord.slot.player_name} at ${locationDescription(
          newRecord.slot
        )}.`,

      old_value:
        valuesFor(
          oldRecord.slot
        ),

      new_value:
        valuesFor(
          newRecord.slot
        ),
    });

    matchedExisting.add(
      oldRecord.index
    );

    matchedIncoming.add(
      newRecord.index
    );
  }

  /*
    STEP 4:
    Remaining unmatched old players
    were removed.
  */

  for (
    let index = 0;
    index <
    existingPlayers.length;
    index++
  ) {
    if (
      matchedExisting.has(
        index
      )
    ) {
      continue;
    }

    const oldSlot =
      existingPlayers[
        index
      ];

    changes.push({
      change_type:
        "REMOVED",

      player_name:
        oldSlot.player_name,

      member_id:
        oldSlot.member_id ??
        null,

      bag_number:
        oldSlot.bag_number,

      tee_time:
        oldSlot.tee_time,

      starting_hole:
        oldSlot.starting_hole,

      detail:
        `${oldSlot.player_name} was removed from ${locationDescription(
          oldSlot
        )}.`,

      old_value:
        valuesFor(
          oldSlot
        ),

      new_value:
        null,
    });
  }

  /*
    STEP 5:
    Remaining unmatched incoming players
    are genuinely new additions.
  */

  for (
    let index = 0;
    index <
    incomingPlayers.length;
    index++
  ) {
    if (
      matchedIncoming.has(
        index
      )
    ) {
      continue;
    }

    const newSlot =
      incomingPlayers[
        index
      ];

    changes.push({
      change_type:
        "ADDED",

      player_name:
        newSlot.player_name,

      member_id:
        newSlot.member_id ??
        null,

      bag_number:
        newSlot.bag_number,

      tee_time:
        newSlot.tee_time,

      starting_hole:
        newSlot.starting_hole,

      detail:
        `${newSlot.player_name} was added at ${locationDescription(
          newSlot
        )}.`,

      old_value:
        null,

      new_value:
        valuesFor(
          newSlot
        ),
    });
  }

  return changes;
}