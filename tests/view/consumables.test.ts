import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { fitFromAssets } from "../../src/lib/dogma/index.js";
import { boosterLength, consumableRows } from "../../src/lib/view/consumables.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

function asset(over: Partial<AssetRow> & { itemId: number; typeId: number }): AssetRow {
  return {
    quantity: 1, locationId: 1000, locationType: "item", locationFlag: "Cargo",
    isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  };
}
const SHIP = asset({ itemId: 1000, typeId: 587, locationId: 60003760, locationType: "station", locationFlag: "Hangar", isSingleton: true });
const data = fixtureData("rifter");
const ctx = { data, skills: new Map<number, number>(), implants: [] };
const DESCRIPTIONS = new Map<number, string>([[32006, "Provides a quick injection of power into your capacitor."]]);

const rows = (children: AssetRow[]) => consumableRows(fitFromAssets(SHIP, children, ctx), DESCRIPTIONS);

describe("consumableRows", () => {
  it("reads a cap booster charge's injection and the fitted booster that loads it, with the charges per load", () => {
    const view = rows([
      asset({ itemId: 1, typeId: 3568, locationFlag: "MedSlot0", isSingleton: true }),   // Small Capacitor Booster II, 15 m³ of charges
      asset({ itemId: 2, typeId: 32006, quantity: 19 }),                                // Navy Cap Booster 400, 12 m³ each
      asset({ itemId: 3, typeId: 31982, quantity: 10 }),                                // Navy Cap Booster 100, 3 m³ each
      asset({ itemId: 4, typeId: 32006, quantity: 5 }),                                 // a second stack: still one row
    ]);
    expect(view.map((r) => [r.kind, r.name, r.effect, r.use])).toEqual([
      ["capBooster", "Navy Cap Booster 100", "+100 GJ per charge", "Small Capacitor Booster II, 5 per load"],
      ["capBooster", "Navy Cap Booster 400", "+400 GJ per charge", "Small Capacitor Booster II, 1 per load"],
    ]);
    expect(view[1]).toMatchObject({ key: "consumable:32006", typeId: 32006, desc: "Provides a quick injection of power into your capacitor." });
  });

  it("leaves the use blank for a charge nothing fitted takes", () => {
    const view = rows([asset({ itemId: 2, typeId: 32006, quantity: 19 })]);
    expect(view.map((r) => [r.effect, r.use])).toEqual([["+400 GJ per charge", null]]);
  });

  it("describes nanite paste by the ancillary repairer that burns it, else as overheat repair", () => {
    const fitted = rows([
      asset({ itemId: 1, typeId: 33076, locationFlag: "LoSlot0", isSingleton: true }),   // Small Ancillary Armor Repairer: 0.08 m³, ×3 repair
      asset({ itemId: 2, typeId: 28668, quantity: 200 }),
    ]);
    expect(fitted.map((r) => [r.kind, r.effect, r.use])).toEqual([["paste", "×3 armor repair", "Small Ancillary Armor Repairer, 8 per load"]]);
    const bare = rows([asset({ itemId: 2, typeId: 28668, quantity: 200 })]);
    expect(bare.map((r) => [r.effect, r.use])).toEqual([["Overheat repair", null]]);
  });

  it("lists a booster's bonuses, its side effects with their odds, and its slot and duration", () => {
    const view = rows([
      asset({ itemId: 1, typeId: 46002, quantity: 2 }),   // Agency 'Hardshell' TB5 Dose II
      asset({ itemId: 2, typeId: 15479, quantity: 1 }),   // Standard Exile Booster: +20% armor repair, 20% chance of each of four penalties
    ]);
    expect(view.map((r) => [r.kind, r.name, r.effect, r.use])).toEqual([
      ["booster", "Agency 'Hardshell' TB5 Dose II", "+5% shield boost, +5% armor repair", "Slot 11 · 30 min"],
      ["booster", "Standard Exile Booster", "+20% armor repair · 20% chance each: −20% armor HP, −20% turret tracking, +20% explosion radius, −20% capacitor", "Slot 1 · 30 min"],
    ]);
  });

  it("says where a filament goes and how many ships it takes", () => {
    const view = rows([
      asset({ itemId: 1, typeId: 56076, quantity: 1 }),   // Border-5 'Pochven' Filament
      asset({ itemId: 2, typeId: 53984, quantity: 3 }),   // Signal-5 'Needlejack' Filament
    ]);
    expect(view.map((r) => [r.kind, r.name, r.effect, r.use])).toEqual([
      ["filament", "Border-5 'Pochven' Filament", "Conduit into Pochven", "up to 5 ships · 30 s spool-up"],
      ["filament", "Signal-5 'Needlejack' Filament", "Jump to a random null-sec system", "up to 5 ships · 30 s spool-up"],
    ]);
  });

  it("names the burst a command charge is for and the fitted bursts that take it", () => {
    const view = rows([
      asset({ itemId: 1, typeId: 42530, locationFlag: "HiSlot0", isSingleton: true }),   // Skirmish Command Burst I
      asset({ itemId: 2, typeId: 42530, locationFlag: "HiSlot1", isSingleton: true }),
      asset({ itemId: 3, typeId: 42840, quantity: 288 }),                               // Rapid Deployment Charge
    ]);
    expect(view.map((r) => [r.kind, r.effect, r.use])).toEqual([["burstCharge", "For Skirmish Command Burst", "2 × Skirmish Command Burst I"]]);
    const one = rows([
      asset({ itemId: 1, typeId: 42530, locationFlag: "HiSlot0", isSingleton: true }),
      asset({ itemId: 3, typeId: 42840, quantity: 288 }),
    ]);
    expect(one[0].use).toBe("Skirmish Command Burst I");
  });

  it("orders cap charges, paste, boosters, burst charges and filaments, and skips ammunition, drones and the rest of the hold", () => {
    const view = rows([
      asset({ itemId: 1, typeId: 53984 }), asset({ itemId: 2, typeId: 42840 }), asset({ itemId: 3, typeId: 46002 }),
      asset({ itemId: 4, typeId: 28668 }), asset({ itemId: 5, typeId: 32006 }),
      asset({ itemId: 6, typeId: 12608, quantity: 500 }),   // Hail S: the Ammunition panel's business
      asset({ itemId: 7, typeId: 2456 }),                    // a drone in the hold
      asset({ itemId: 8, typeId: 587 }),                     // a packaged Rifter
    ]);
    expect(view.map((r) => r.kind)).toEqual(["capBooster", "paste", "booster", "burstCharge", "filament"]);
  });
});

describe("boosterLength", () => {
  it("writes minutes, whole hours, and hours with minutes", () => {
    expect(boosterLength(1_800_000)).toBe("30 min");
    expect(boosterLength(7_200_000)).toBe("2 h");
    expect(boosterLength(5_400_000)).toBe("1 h 30 min");
  });
});
