import { describe, it, expect } from "vitest";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import {
  buildAssetTree, toViewNodes, sumVolume, filterAssetTree, locationDisplayLabel, locationContents, filterContents, contentsEmpty,
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
  [691, { name: "Rifter Blueprint", volume: 0.01, isBlueprint: true }],
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

  it("points each row at its type image, using the bp/bpc variation for blueprints", () => {
    const view = toViewNodes(buildAssetTree([
      row({ itemId: 6001, typeId: 34, locationId: STATION, locationType: "station", locationFlag: "Hangar", quantity: 5 }),
      row({ itemId: 6002, typeId: 691, locationId: STATION, locationType: "station", locationFlag: "Hangar", isSingleton: true }),
      row({ itemId: 6003, typeId: 691, locationId: STATION, locationType: "station", locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: true }),
    ])[0].nodes, types);
    expect(view.map((n) => n.iconUrl).sort()).toEqual([
      "https://images.evetech.net/types/34/icon?size=32",
      "https://images.evetech.net/types/691/bp?size=32",
      "https://images.evetech.net/types/691/bpc?size=32",
    ]);
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

describe("locationContents", () => {
  const FLAG: Record<string, string> = { Hangar: "Hangar", Cargo: "Cargo hold", DroneBay: "Drone bay", SpecializedOreHold: "Ore hold" };
  const n = (itemId: number, typeId: number, typeName: string, rawFlag: string, extra: Partial<AssetViewNode> = {}): AssetViewNode => ({
    itemId, typeId, typeName, name: null, quantity: 1, flag: FLAG[rawFlag] ?? rawFlag, rawFlag, isCharge: false,
    isBlueprintCopy: false, volume: 0, iconUrl: `https://images.evetech.net/types/${typeId}/icon?size=32`, children: [], ...extra,
  });
  const hurricane = n(1, 100, "Hurricane Fleet Issue", "Hangar", {
    name: "Wraith",
    children: [
      ...[0, 1, 2, 3, 4, 5].map((i) => n(10 + i, 200, "220mm Vulcan AutoCannon II", `HiSlot${i}`)),
      n(16, 201, "Heavy Assault Missile Launcher II", "HiSlot6"),
      n(17, 201, "Heavy Assault Missile Launcher II", "HiSlot7"),
      n(20, 300, "Sensor Booster II", "MedSlot0"), n(21, 301, "Scan Resolution Script", "MedSlot0", { isCharge: true }),
      n(22, 300, "Sensor Booster II", "MedSlot2"), n(23, 301, "Scan Resolution Script", "MedSlot2", { isCharge: true }),
      n(24, 300, "Sensor Booster II", "MedSlot3"),
      n(30, 400, "Medium Trimark Armor Pump II", "RigSlot0"),
      n(40, 500, "Hobgoblin II", "DroneBay", { quantity: 5 }), n(41, 500, "Hobgoblin II", "DroneBay", { quantity: 5 }),
      n(50, 600, "Hail M", "Cargo", { quantity: 3000 }), n(51, 600, "Hail M", "Cargo", { quantity: 848 }),
      n(52, 700, "Small Secure Container", "Cargo", { name: "Loot", children: [n(60, 34, "Tritanium", "Unlocked", { quantity: 9 })] }),
      n(53, 800, "Veldspar", "SpecializedOreHold", { quantity: 10 }),
    ],
  });

  it("turns an item that holds things into a holder with a summary and its flag in capitals", () => {
    const { holders, loose } = locationContents([hurricane]);
    expect(loose).toEqual([]);
    expect(holders).toHaveLength(1);
    expect(holders[0]).toMatchObject({
      title: "Hurricane Fleet Issue", label: "Wraith", flag: "HANGAR",
      summary: "21 items inside: 12 fitted, 10 drones, 3 cargo stacks",
      iconUrl: "https://images.evetech.net/types/100/icon?size=64",
    });
  });
  it("orders the columns Fitted, Drone bay, Cargo hold, then the rest, then nested containers", () => {
    expect(locationContents([hurricane]).holders[0].groups.map((g) => [g.name, g.count])).toEqual([
      ["Fitted", "12 items"], ["Drone bay", "10 drones"], ["Cargo hold", "2 stacks"], ["Ore hold", "1 stack"],
      ["Small Secure Container “Loot” · Unlocked", "1 stack"],
    ]);
  });
  it("merges identical modules by slot family and charge, with a slot range", () => {
    const fitted = locationContents([hurricane]).holders[0].groups[0];
    expect(fitted.items.map((i) => [i.quantity, i.typeName, i.note, i.where])).toEqual([
      [6, "220mm Vulcan AutoCannon II", null, "High 1–6"],
      [2, "Heavy Assault Missile Launcher II", null, "High 7–8"],
      [2, "Sensor Booster II", "Scan Resolution Script loaded in each", "Mid 1, 3"],
      [1, "Sensor Booster II", null, "Mid 4"],
      [1, "Medium Trimark Armor Pump II", null, "Rig 1"],
    ]);
  });
  it("sums identical stacks into one row", () => {
    const [, drones, cargo] = locationContents([hurricane]).holders[0].groups;
    expect(drones.items.map((i) => [i.quantity, i.typeName])).toEqual([[10, "Hobgoblin II"]]);
    expect(cargo.items.map((i) => [i.quantity, i.typeName, i.name])).toEqual([[3848, "Hail M", null], [1, "Small Secure Container", "Loot"]]);
  });
  it("keeps loose items in columns by where they sit, originals apart from copies", () => {
    const { holders, loose } = locationContents([
      n(1, 34, "Tritanium", "Hangar", { quantity: 100 }), n(2, 34, "Tritanium", "Hangar", { quantity: 50 }),
      n(3, 691, "Rifter Blueprint", "Hangar"), n(4, 691, "Rifter Blueprint", "Hangar", { isBlueprintCopy: true }),
      n(5, 587, "Rifter", "Hangar"), n(6, 35, "Pyerite", "Deliveries"),
    ]);
    expect(holders).toEqual([]);
    expect(loose.map((g) => [g.name, g.count])).toEqual([["Hangar", "4 stacks"], ["Deliveries", "1 stack"]]);
    expect(loose[0].items.map((i) => [i.quantity, i.typeName, i.isBlueprintCopy])).toEqual([
      [150, "Tritanium", false], [1, "Rifter Blueprint", false], [1, "Rifter Blueprint", true], [1, "Rifter", false],
    ]);
  });
  it("still shows a slot that holds only a charge", () => {
    const ship = n(1, 100, "Rifter", "Hangar", { children: [n(2, 301, "Hail S", "HiSlot0", { isCharge: true, quantity: 40 })] });
    expect(locationContents([ship]).holders[0].groups[0].items.map((i) => [i.typeName, i.where])).toEqual([["Hail S", "High 1"]]);
  });

  describe("filterContents", () => {
    const contents = locationContents([hurricane, n(90, 34, "Tritanium", "Hangar", { quantity: 5 })]);
    it("keeps only matching rows, dropping empty columns and holders", () => {
      const out = filterContents(contents, "hail");
      expect(out.holders[0].groups.map((g) => g.name)).toEqual(["Cargo hold"]);
      expect(out.loose).toEqual([]);
      expect(contentsEmpty(filterContents(contents, "zzz"))).toBe(true);
    });
    it("matches the charge note and nested containers", () => {
      expect(filterContents(contents, "scan resolution").holders[0].groups[0].items.map((i) => i.typeName)).toEqual(["Sensor Booster II"]);
      const trit = filterContents(contents, "tritanium");
      expect(trit.holders[0].groups.map((g) => g.name)).toEqual(["Small Secure Container “Loot” · Unlocked"]);
      expect(trit.loose[0].items).toHaveLength(1);
    });
    it("keeps a holder whole when its own name or the pilot's name for it matches", () => {
      expect(filterContents(contents, "wraith").holders[0].groups).toHaveLength(5);
      expect(filterContents(contents, "hurricane").holders[0].groups).toHaveLength(5);
    });
    it("returns the input for a blank query", () => {
      expect(filterContents(contents, "  ")).toBe(contents);
    });
  });
});
