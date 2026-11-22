import { describe, it, expect } from "vitest";
import { masteryLevel } from "../../src/lib/ships/mastery.js";
import { HULL_CLASS_ORDER, rootLocationId, sortShipPanels, type ShipCardView } from "../../src/lib/view/ships.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

// Five levels; each asks a little more of two skills.
const requirements = [
  new Map([[3300, 1], [3327, 1]]),
  new Map([[3300, 3], [3327, 2]]),
  new Map([[3300, 4], [3327, 3]]),
  new Map([[3300, 5], [3327, 4]]),
  new Map([[3300, 5], [3327, 5], [3413, 5]]),
];
const skills = (gunnery: number, command: number, grid = 0) => new Map([[3300, gunnery], [3327, command], [3413, grid]]);

describe("masteryLevel", () => {
  it("is the highest level whose every skill is trained far enough", () => {
    expect(masteryLevel(requirements, skills(0, 0))).toBe(0);
    expect(masteryLevel(requirements, skills(1, 1))).toBe(1);
    expect(masteryLevel(requirements, skills(4, 3))).toBe(3);
    expect(masteryLevel(requirements, skills(5, 4))).toBe(4);
    expect(masteryLevel(requirements, skills(5, 5, 5))).toBe(5);
  });
  it("stops at the first level with a skill short, however high the others are", () => {
    expect(masteryLevel(requirements, skills(5, 1))).toBe(1);
    expect(masteryLevel(requirements, skills(5, 5, 4))).toBe(4);
  });
  it("counts a skill the pilot has never injected as untrained", () => {
    expect(masteryLevel(requirements, new Map())).toBe(0);
  });
  it("is unknown, not zero, for a hull the SDE has no mastery for", () => {
    expect(masteryLevel(undefined, skills(5, 5, 5))).toBeNull();
  });
});

describe("sortShipPanels", () => {
  const card = (key: string, groupName: string | null, valueRaw: number): ShipCardView => ({
    key, href: `/ships/${key}`, name: null, typeId: 1, typeName: key, groupName, raceName: null, location: "",
    stats: null, cpu: null, power: null, missingSkills: 0, weapons: [], value: null, valueRaw, unpriced: null, error: null, mastery: null,
  });
  it("orders by hull type, largest first, then by value", () => {
    const sorted = sortShipPanels([
      card("rifter", "Frigate", 5), card("loki", "Strategic Cruiser", 900), card("hyperion", "Battleship", 250),
      card("merlin", "Frigate", 9), card("tengu", "Strategic Cruiser", 1200), card("shuttle", "Shuttle", 1),
    ]);
    expect(sorted.map((c) => c.key)).toEqual(["hyperion", "tengu", "loki", "merlin", "rifter", "shuttle"]);
  });
  it("puts hull types the list does not name last, kept together by name", () => {
    const sorted = sortShipPanels([
      card("venture", "Mining Frigate", 50), card("unknown", null, 999), card("noctis", "Industrial", 10),
      card("rifter", "Frigate", 1), card("epithal", "Industrial", 20),
    ]);
    expect(sorted.map((c) => c.key)).toEqual(["rifter", "unknown", "epithal", "noctis", "venture"]);
  });
  it("starts with capitals and ends with shuttles", () => {
    expect(HULL_CLASS_ORDER[0]).toBe("Titan");
    expect(HULL_CLASS_ORDER[HULL_CLASS_ORDER.length - 1]).toBe("Shuttle");
    expect(HULL_CLASS_ORDER.indexOf("Battleship")).toBeLessThan(HULL_CLASS_ORDER.indexOf("Combat Battlecruiser"));
  });
});

describe("rootLocationId", () => {
  const asset = (itemId: number, locationId: number, locationType: string): AssetRow =>
    ({ itemId, typeId: 1, quantity: 1, locationId, locationType, locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: null }) as AssetRow;
  it("is the ship's own location when it sits in a station", () => {
    expect(rootLocationId(asset(1, 60003760, "station"), new Map())).toBe(60003760);
  });
  it("climbs out of containers and other ships to the place they are in", () => {
    const carrier = asset(9, 60003760, "station");
    const container = asset(8, 9, "item");
    const ship = asset(1, 8, "item");
    expect(rootLocationId(ship, new Map([[9, carrier], [8, container]]))).toBe(60003760);
  });
  it("stops at a holder the asset list does not contain", () => {
    expect(rootLocationId(asset(1, 777, "item"), new Map())).toBe(777);
  });
});
