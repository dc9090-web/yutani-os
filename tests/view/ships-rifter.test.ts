import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { fitFromAssets, fitStats, missingSkills, validateFit } from "../../src/lib/dogma/index.js";
import { fitValueEntries, toShipCard } from "../../src/lib/view/ships.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import type { Price } from "../../src/lib/view/price.js";

function asset(over: Partial<AssetRow> & { itemId: number; typeId: number }): AssetRow {
  return {
    quantity: 1, locationId: 1000, locationType: "item", locationFlag: "Cargo",
    isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  };
}

const SHIP = asset({
  itemId: 1000, typeId: 587, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, name: "Scarlet Dart",
});
const CHILDREN: AssetRow[] = [
  asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0", isSingleton: true }),  // 200mm AutoCannon II
  asset({ itemId: 1002, typeId: 12608, locationFlag: "HiSlot0", quantity: 400 }),     // Hail S, loaded
  asset({ itemId: 1003, typeId: 519, locationFlag: "LoSlot0", isSingleton: true }),   // Gyrostabilizer II
  asset({ itemId: 1004, typeId: 2456, locationFlag: "DroneBay", quantity: 5 }),       // Hobgoblin II
  asset({ itemId: 1005, typeId: 12608, locationFlag: "Cargo", quantity: 1000 }),      // spare Hail S
];

// CPU Management V and Power Grid Management V, nothing else — so the hull's own skill is missing.
const ctx = { data: fixtureData("rifter"), skills: new Map([[3426, 5], [3413, 5]]), implants: [] };

const PRICES = new Map<number, Price>([
  [587, { sell: 8_000_000, buy: null, adjusted: null }],
  [2889, { sell: 1_500_000, buy: null, adjusted: null }],
  [519, { sell: null, buy: null, adjusted: 1_000_000 }],
  [12608, { sell: 100, buy: null, adjusted: null }],
  [2456, { sell: 500_000, buy: null, adjusted: null }],
]);

describe("a Rifter built from asset rows", () => {
  it("puts the charge under its module, the drones in the bay and the rest in cargo", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    expect(built.fit.modules.map((m) => [m.slot, m.index, m.item.typeId])).toEqual([
      ["high", 0, 2889],
      ["low", 0, 519],
    ]);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.drones).toEqual([{ typeId: 2456, quantity: 5, flag: "DroneBay", name: null }]);
    expect(built.cargo.map((c) => [c.typeId, c.quantity])).toEqual([[12608, 1000]]);
    expect(built.unknown).toEqual([]);
  });

  it("computes the fitting numbers the fixture pins down", () => {
    const stats = fitStats(fitFromAssets(SHIP, CHILDREN, ctx).fit);
    // Phase 4a's asserted Rifter numbers: 130/41 at skills 0, 162.5/51.25 at CPU Management V and
    // Power Grid Management V.
    expect(stats.cpu.output).toBe(162.5);
    expect(stats.power.output).toBe(51.25);
    expect(stats.cpu.used).toBeGreaterThan(0);
    expect(stats.power.used).toBeGreaterThan(0);
    expect(stats.slots.high.used).toBe(1);
    expect(stats.slots.low.used).toBe(1);
    expect(stats.hardpoints.turret.used).toBe(1);
  });

  it("reports the hull's own skill as missing", () => {
    const fit = fitFromAssets(SHIP, CHILDREN, ctx).fit;
    // 3329 is Minmatar Frigate: the Rifter requires it and this character has not trained it.
    expect(missingSkills(fit).map((s) => s.skillTypeId)).toContain(3329);
    expect(validateFit(fit).filter((p) => p.kind === "skill").length).toBeGreaterThan(0);
  });

  it("turns all of that into the card the /ships grid renders", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    const stats = fitStats(built.fit);
    const card = toShipCard({
      key: "asset:1000", href: "/ships/asset/1000", name: SHIP.name, typeId: 587, typeName: "Rifter",
      location: "Jita 4-4", stats, problems: validateFit(built.fit),
      entries: fitValueEntries(built), prices: PRICES,
    });
    expect(card.cpu!.text).toBe(`${stats.cpu.used.toFixed(2)} / 162.50 tf`);
    expect(card.cpu!.over).toBe(false);
    expect(card.power!.text).toBe(`${stats.power.used.toFixed(2)} / 51.25 MW`);
    expect(card.missingSkills).toBeGreaterThan(0);
    // 8,000,000 hull + 1,500,000 gun + 100 loaded round + 1,000,000 gyro + 100,000 spare ammo
    //   + 2,500,000 drones = 13,100,100
    expect(card.valueRaw).toBe(13_100_100);
    expect(card.value).toBe("13.1M ISK");
    expect(card.unpriced).toBeNull();
  });

  it("counts entries with no price at all", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    const prices = new Map(PRICES);
    prices.delete(519);
    const card = toShipCard({
      key: "asset:1000", href: "/ships/asset/1000", name: SHIP.name, typeId: 587, typeName: "Rifter",
      location: "Jita 4-4", stats: fitStats(built.fit), problems: [],
      entries: fitValueEntries(built), prices,
    });
    expect(card.unpriced).toBe("1 item unpriced");
    expect(card.valueRaw).toBe(12_100_100);
  });
});
