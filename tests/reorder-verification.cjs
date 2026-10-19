const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const output = ts.transpileModule(fs.readFileSync("lib/reorder-verification.ts", "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const compiled = {exports: {}};
new Function("exports", output)(compiled.exports);
const {gateReorderCounts} = compiled.exports;
const now = Date.parse("2026-10-19T00:00:00Z");
const stamp = new Date(now - 60_000).toISOString();
const item = {item_id: "item", on_hand: 3, suggested_quantity: 7, blockers: []};
const areas = [{id: "a", name: "Main"}, {id: "b", name: "Cabinet"}];
const locations = [
  {item_id: "item", storage_area_id: "a", on_hand: 2, updated_at: stamp},
  {item_id: "item", storage_area_id: "b", on_hand: 1, updated_at: stamp},
];
const verified = locations.map(location => ({...location, actual_on_hand: location.on_hand, verified_at: stamp, verified_by: "Counter"}));
const result = (counts = verified, stock = locations, catalog = areas) => gateReorderCounts([item], stock, counts, catalog, now)[0];
assert.equal(result().suggested_quantity, 7, "All locations confirmed: expose planning quantity");
assert.equal(result([]).suggested_quantity, null, "No verification: withhold quantity");
assert.equal(result(verified.slice(0, 1)).count_verified, false, "Partial building count cannot verify item");
assert.equal(result(verified.map(v => ({...v, verified_at: new Date(now - 25 * 3600000).toISOString()}))).count_verified, false, "Expired count");
assert.equal(result(verified.map(v => ({...v, verified_at: new Date(now + 60000).toISOString()}))).count_verified, false, "Future timestamp");
assert.equal(result(verified, [{...locations[0], updated_at: new Date(now).toISOString()}, locations[1]]).count_verified, false, "Later inventory edit invalidates count");
assert.equal(result(verified, [{...locations[0], on_hand: 8}, locations[1]]).count_verified, false, "Shelf quantity differs");
assert.equal(result(verified, locations, [areas[0]]).count_verified, false, "Inactive or missing area");
assert.equal(result(verified, []).count_verified, false, "No locations");
assert.equal(result(verified, [{...locations[0], updated_at: null}, locations[1]]).count_verified, false, "Unknown change time");
const old = {...verified[0], verified_at: new Date(now - 120000).toISOString(), actual_on_hand: 90};
assert.equal(result([old, ...verified]).count_verified, true, "Latest verification wins regardless of order");
const incompleteItem = {...item, on_hand: 6};
assert.equal(gateReorderCounts([incompleteItem], locations, verified, areas, now)[0].count_verified, false, "Locations must account for the entire building total");
console.log("12 count-gate checks passed.");
