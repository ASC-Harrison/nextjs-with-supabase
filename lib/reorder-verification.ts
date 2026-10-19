import type {ReorderRow} from "@/lib/reorder-plan";

export type CountLocation = {item_id: string; storage_area_id: string; on_hand: number | null; updated_at: string | null};
export type CountVerification = {item_id: string; storage_area_id: string; actual_on_hand: number; verified_at: string; verified_by: string};
export function gateReorderCounts(rows: ReorderRow[], locations: CountLocation[], verifications: CountVerification[], areas: {id: string; name: string}[], now = Date.now()) {
  const names = new Map(areas.map(area => [area.id, area.name]));
  const latest = new Map<string, CountVerification>();
  for (const verification of verifications) {
    const key = `${verification.item_id}:${verification.storage_area_id}`;
    const old = latest.get(key);
    if (!old || Date.parse(verification.verified_at) > Date.parse(old.verified_at)) latest.set(key, verification);
  }
  return rows.map(row => {
    const counts = locations.filter(location => location.item_id === row.item_id).map(location => {
      const verification = latest.get(`${row.item_id}:${location.storage_area_id}`);
      const time = verification ? Date.parse(verification.verified_at) : NaN;
      const changed = location.updated_at ? Date.parse(location.updated_at) : NaN;
      const fresh = Number.isFinite(time) && now >= time && now - time <= 24 * 60 * 60 * 1000;
      const confirmed = Boolean(verification && fresh && Number.isFinite(changed) && changed <= time && location.on_hand !== null && Number(verification.actual_on_hand) === Number(location.on_hand) && names.has(location.storage_area_id));
      return {area_id: location.storage_area_id, area_name: names.get(location.storage_area_id) || "Inactive or unknown area", on_hand: location.on_hand, confirmed, verified_at: verification?.verified_at ?? null, verified_by: verification?.verified_by ?? null, can_count: names.has(location.storage_area_id)};
    });
    // Fail closed if location totals cannot account for the building total.
    const totalMatches = row.on_hand !== null && counts.every(count => count.on_hand !== null) && counts.reduce((sum, count) => sum + Number(count.on_hand), 0) === Number(row.on_hand);
    const verified = counts.length > 0 && counts.every(count => count.confirmed) && totalMatches;
    return {...row, suggested_quantity: verified ? row.suggested_quantity : null, count_verified: verified, count_locations: counts, verification_status: verified ? "Count verified — review orders" : "Needs shelf check", blockers: verified ? row.blockers : ["Verify shelf counts in every location before ordering", ...(!totalMatches ? ["Storage location totals must match the building count"] : []), ...row.blockers]};
  });
}
export type VerifiedReorderRow = ReturnType<typeof gateReorderCounts>[number];
