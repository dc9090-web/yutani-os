import { describe, it, expect } from "vitest";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import {
  buildAssetTree, toViewNodes, sumVolume, filterAssetTree, locationDisplayLabel,
  type AssetViewNode, type TypeInfo,
} from "../../src/lib/view/assets.js";

const STATION = 60003760;
const SHIP = 1_035_000_000_001;      // an item_id, and also inside classifyLocation's structure range
const CONTAINER = 1_035_000_000_002;

function row(over: Partial<AssetRow> & Pick<AssetRow, "itemId" | "typeId" | "locationId" | "locationType" | "locationFlag">): AssetRow {
  return {
    quantity: 1, isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  } as AssetRow;
}

const rows: AssetRow[] = [
  row({ itemId: SHIP, typeId: 587, locationId: STATION, locationType: "station", locationFlag: "Hangar", isSingleton: true, name: "Scarlet Dart" }),
  row({ itemId: 2001, typeId: 519, locationId: SHIP, locationType: "item", locationFlag: "LoSlot0" }),
  row({ itemId: CONTAINER, typeId: 3465, locationId: SHIP, locationType: "item", locationFlag: "Cargo", isSingleton: true, name: "Ammo can" }),
  row({ itemId: 2003, typeId: 34, locationId: CONTAINER, locationType: "item", locationFlag: "Cargo", quantity: 5000 }),
  row({ itemId: 2004, typeId: 34, locationId: STATION, locationType: "station", locationFlag: "Hangar", quantity: 120 }),
];

describe("buildAssetTree", () => {
  it("nests location_type='item' rows under their parent and groups roots by location id", () => {
    const tree = buildAssetTree(rows);
    expect(tree).toHaveLength(1);
    const station = tree[0];
    expect(station.locationId).toBe(STATION);
    expect(station.locationType).toBe("station");
    expect(station.itemCount).toBe(5);                       // the whole subtree, not just the roots
    expect(station.nodes.map((n) => n.itemId)).toEqual([SHIP, 2004]);
  });

  it("keeps a container's contents under the ROOT location, however deep the nesting", () => {
    // The regression this guards: SHIP and CONTAINER are >= 1e12, so classifyLocation() calls them
    // "structure". They must never become locations of their own — they are items in the station.
    const tree = buildAssetTree(rows);
    expect(tree.map((l) => l.locationId)).toEqual([STATION]);
    const ship = tree[0].nodes[0];
    expect(ship.children.map((n) => n.itemId)).toEqual([CONTAINER, 2001]);   // Cargo before LoSlot0
    const container = ship.children[0];
    expect(container.children.map((n) => n.itemId)).toEqual([2003]);
    expect(container.name).toBe("Ammo can");
  });

  it("sorts locations by item count then id, and siblings by flag then item id", () => {
    const other = 60008494;
    const tree = buildAssetTree([
      ...rows,
      row({ itemId: 3001, typeId: 34, locationId: other, locationType: "station", locationFlag: "Hangar" }),
    ]);
    expect(tree.map((l) => [l.locationId, l.itemCount])).toEqual([[STATION, 5], [other, 1]]);
  });

  it("keeps an orphan item-located row as its own root, flagged as an item location", () => {
    const orphan = buildAssetTree([row({ itemId: 4001, typeId: 34, locationId: 1_099_999_999_999, locationType: "item", locationFlag: "Cargo" })]);
    expect(orphan).toEqual([{
      locationId: 1_099_999_999_999, locationType: "item", itemCount: 1,
      nodes: [expect.objectContaining({ itemId: 4001 })],
    }]);
  });

  it("returns nothing for a character with no assets", () => {
    expect(buildAssetTree([])).toEqual([]);
  });
});

describe("locationDisplayLabel", () => {
  it("uses the resolved place name, whatever its kind", () => {
    expect(locationDisplayLabel(60003760, { name: "Jita IV - Moon 4 - CNAP", kind: "station" })).toBe("Jita IV - Moon 4 - CNAP");
    // A structure-docked hangar's orphan root: location_type "item", but a real, named structure.
    expect(locationDisplayLabel(1035466617946, { name: "Player Citadel", kind: "structure" })).toBe("Player Citadel");
  });

  it("falls back to Container <id> when the id could not be classified as a place", () => {
    expect(locationDisplayLabel(1099999999999, { name: "Unknown location (1099999999999)", kind: "unknown" })).toBe("Container 1099999999999");
  });

  it("falls back to Container <id> when nothing was resolved at all", () => {
    expect(locationDisplayLabel(1099999999999, undefined)).toBe("Container 1099999999999");
  });
});

const types = new Map<number, TypeInfo>([
  [587, { name: "Rifter", volume: 27289 }],
  [519, { name: "Gyrostabilizer II", volume: 5 }],
  [3465, { name: "Small Standard Container", volume: 65 }],
  [34, { name: "Tritanium", volume: 0.01 }],
]);

describe("toViewNodes", () => {
  it("names types, humanises flags and multiplies volume by quantity", () => {
    const view = toViewNodes(buildAssetTree(rows)[0].nodes, types);
    expect(view[0]).toMatchObject({ typeName: "Rifter", name: "Scarlet Dart", flag: "Hangar", volume: 27289 });
    expect(view[0].children.map((c) => c.flag)).toEqual(["Cargo hold", "Low slot 1"]);
    expect(view[1]).toMatchObject({ typeName: "Tritanium", quantity: 120, volume: 1.2 });
  });

  it("degrades for a type the SDE has not imported and marks blueprint copies", () => {
    const view = toViewNodes(buildAssetTree([
      row({ itemId: 5001, typeId: 999999, locationId: STATION, locationType: "station", locationFlag: "Hangar", isBlueprintCopy: true }),
    ])[0].nodes, types);
    expect(view[0]).toMatchObject({ typeName: "Type 999999", volume: 0, isBlueprintCopy: true });
  });
});

describe("sumVolume", () => {
  it("sums the whole subtree", () => {
    const view = toViewNodes(buildAssetTree(rows)[0].nodes, types);
    // 27289 (ship) + 5 (gyro) + 65 (can) + 50 (5000 tritanium) + 1.2 (120 tritanium)
    expect(sumVolume(view)).toBeCloseTo(27410.2, 3);
    expect(sumVolume([])).toBe(0);
  });
});

describe("filterAssetTree", () => {
  const view: AssetViewNode[] = toViewNodes(buildAssetTree(rows)[0].nodes, types);

  it("returns everything for a blank query", () => {
    expect(filterAssetTree(view, "   ")).toBe(view);
  });

  it("keeps an ancestor whose descendant matches", () => {
    const found = filterAssetTree(view, "gyro");
    expect(found.map((n) => n.typeName)).toEqual(["Rifter"]);
    expect(found[0].children.map((n) => n.typeName)).toEqual(["Gyrostabilizer II"]);
  });

  it("keeps every child of a node that matches itself", () => {
    const found = filterAssetTree(view, "rifter");
    expect(found[0].children).toHaveLength(2);
  });

  it("matches the custom name too, case-insensitively", () => {
    expect(filterAssetTree(view, "AMMO CAN")[0].children.map((n) => n.name)).toEqual(["Ammo can"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterAssetTree(view, "zzz")).toEqual([]);
  });
});
