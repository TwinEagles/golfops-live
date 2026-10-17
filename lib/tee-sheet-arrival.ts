export type TeeSheetArrivalIdentity = {
  member_id: string | number | null;
  bag_number: string | null;
  player_name: string | null;
};

function normalizeBag(value: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeName(value: string | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function teeSheetArrivalIdentityKey(slot: TeeSheetArrivalIdentity) {
  if (slot.member_id !== null && slot.member_id !== undefined) {
    return `member:${String(slot.member_id)}`;
  }

  const bag = normalizeBag(slot.bag_number);
  if (bag) return `bag:${bag}`;

  const name = normalizeName(slot.player_name);
  return name ? `name:${name}` : null;
}
