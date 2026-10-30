type ChangeForReconciliation = {
  id: string;
  import_id: string | null;
  change_type: string;
  member_id: string | number | null;
  player_name: string | null;
  bag_number: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

function normalizeIdentity(value: unknown) {
  return typeof value === "string"
    ? value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "";
}

function samePlayer(
  left: ChangeForReconciliation,
  right: ChangeForReconciliation
) {
  const leftMember = left.member_id == null ? "" : String(left.member_id);
  const rightMember = right.member_id == null ? "" : String(right.member_id);
  if (leftMember && rightMember && leftMember === rightMember) return true;

  const leftBag = normalizeIdentity(left.bag_number);
  const rightBag = normalizeIdentity(right.bag_number);
  if (leftBag && rightBag && leftBag === rightBag) return true;

  const leftName = normalizeIdentity(left.player_name);
  const rightName = normalizeIdentity(right.player_name);
  return Boolean(leftName && rightName && leftName === rightName);
}

function locationKey(value: Record<string, unknown> | null) {
  if (!value) return "";

  const teeTime = typeof value.tee_time === "string" ? value.tee_time.trim() : "";
  const course = typeof value.course === "string" ? value.course.trim().toLowerCase() : "";
  const position = typeof value.starting_position === "string"
    ? value.starting_position.trim().toUpperCase()
    : typeof value.starting_hole === "number"
      ? String(value.starting_hole)
      : "";

  // Slot position is deliberately ignored: players can shift within a group
  // when ForeTees reorders names without changing the group's tee time/hole.
  return teeTime && position ? `${teeTime}|${course}|${position}` : "";
}

/**
 * Remove open ADDED/REMOVED pairs that cancel out at the same tee time and
 * starting position. This handles both an import that restores a prior player
 * and duplicate opposite rows created by a malformed comparison.
 */
export function removeNetZeroImportChanges<T extends ChangeForReconciliation>(
  changes: T[]
) {
  const canceledIds = new Set<string>();

  for (let firstIndex = 0; firstIndex < changes.length; firstIndex++) {
    const first = changes[firstIndex];
    if (
      canceledIds.has(first.id) ||
      (first.change_type !== "ADDED" && first.change_type !== "REMOVED")
    ) continue;

    const firstLocation = locationKey(
      first.change_type === "ADDED" ? first.new_value : first.old_value
    );
    if (!firstLocation) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < changes.length; secondIndex++) {
      const second = changes[secondIndex];
      if (
        canceledIds.has(second.id) ||
        (second.change_type !== "ADDED" && second.change_type !== "REMOVED") ||
        first.change_type === second.change_type
      ) continue;

      const secondLocation = locationKey(
        second.change_type === "ADDED" ? second.new_value : second.old_value
      );
      if (firstLocation !== secondLocation || !samePlayer(first, second)) continue;

      canceledIds.add(first.id);
      canceledIds.add(second.id);
      break;
    }
  }

  return changes.filter((change) => !canceledIds.has(change.id));
}
