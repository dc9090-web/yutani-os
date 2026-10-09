import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY, assumeCargoAmmo, fitFromAssets, fitPerformance, fitStats, validateFit } from "../../src/lib/dogma/index.js";
import { buildFitSheet, hintText, operatorLabel, problemText, rangeText, stateLabel, typeDescription } from "../../src/lib/view/fit-sheet.js";
import { fitValueEntries } from "../../src/lib/view/ships.js";
import { rollUpValue } from "../../src/lib/view/price.js";
import { isk } from "../../src/lib/view/format.js";
import { Operator, State } from "../../src/lib/dogma/index.js";
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
  asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0", isSingleton: true }),
  asset({ itemId: 1002, typeId: 12608, locationFlag: "HiSlot0", quantity: 400 }),
  asset({ itemId: 1003, typeId: 519, locationFlag: "LoSlot0", isSingleton: true }),
  asset({ itemId: 1004, typeId: 2456, locationFlag: "DroneBay", quantity: 5 }),
  asset({ itemId: 1005, typeId: 12608, locationFlag: "Cargo", quantity: 1000 }),
  // A second, unmerged stack of the same ammo and a launched-and-recovered (singleton) drone: ESI
  // reports both as separate rows; the sheet shows one line each.
  asset({ itemId: 1006, typeId: 12608, locationFlag: "Cargo", quantity: 500 }),
  asset({ itemId: 1007, typeId: 2456, locationFlag: "DroneBay", quantity: 1, isSingleton: true }),
];

const data = fixtureData("rifter");
// CPU Management V, Power Grid Management V, Weapon Upgrades V — the last one is what puts a
// modifier on the turret's CPU, which is what the "affected by" popover exists to show.
const skillLevels = new Map([[3426, 5], [3413, 5], [3318, 5]]);
const ctx = { data, skills: skillLevels, implants: [] };
const skillNames = new Map(
  [...data.types.values()].filter((t) => t.categoryId === CATEGORY.skill).map((t) => [t.id, t.name ?? `Skill ${t.id}`]),
);
const PRICES = new Map<number, Price>([
  [587, { sell: 8_000_000, buy: null, adjusted: null }],
  [2889, { sell: 1_500_000, buy: null, adjusted: null }],
  [519, { sell: null, buy: null, adjusted: 1_000_000 }],
  [12608, { sell: 100, buy: null, adjusted: null }],
]);
// Exactly what getTypeBonuses(587) returns against the SDE.
const BONUSES = [
  { skillTypeId: 3329, bonus: 7.5, unitId: 105, bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire" },
  { skillTypeId: 3329, bonus: 10, unitId: 105, bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff" },
];

const DESCRIPTIONS = new Map<number, string>([
  [2889, "The 200mm is a powerful autocannon."],
  [12608, "Hail is an attempt to combine penetration with versatility.\n\n25% reduced falloff."],
  [2456, "Light Scout Drone"],
]);

function sheet(over: Partial<Parameters<typeof buildFitSheet>[0]> = {}) {
  const built = fitFromAssets(SHIP, CHILDREN, ctx);
  return buildFitSheet({
    title: "Scarlet Dart", typeId: 587, typeName: "Rifter",
    ship: { typeName: "Rifter", groupName: "Frigate", raceName: "Minmatar" },
    location: { system: { name: "Jita", sec: "0.9", secClass: "sec-high" }, place: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", note: null },
    built, stats: fitStats(built.fit), problems: validateFit(built.fit), perf: fitPerformance(built.fit),
    bonuses: BONUSES, skillLevels, skillNames, prices: PRICES, descriptions: DESCRIPTIONS, skillsSynced: true, ...over,
  });
}

describe("typeDescription", () => {
  it("strips client markup, keeps paragraph breaks and drops empty text", () => {
    expect(typeDescription("Rig.\r\n\r\n\r\nTrain <a href=showinfo:26254>Astronautics Rigging</a>.  \n"))
      .toBe("Rig.\n\nTrain Astronautics Rigging.");
    expect(typeDescription("<b></b>  ")).toBeNull();
    expect(typeDescription(null)).toBeNull();
  });
  it("cuts a multi-screen essay at a word boundary", () => {
    const essay = Array.from({ length: 200 }, () => "word").join(" ");
    const cut = typeDescription(essay)!;
    expect(cut.length).toBeLessThanOrEqual(601);
    expect(cut.endsWith("word…")).toBe(true);
  });
});

describe("label helpers", () => {
  it("names states and operators", () => {
    expect(stateLabel(State.Offline)).toBe("Offline");
    expect(stateLabel(State.Overload)).toBe("Overload");
    expect(operatorLabel(Operator.PostPercent)).toBe("%");
    expect(operatorLabel(Operator.ModAdd)).toBe("+");
    expect(operatorLabel(Operator.PostMul)).toBe("×");
  });
  it("prefixes a problem with the item it is about", () => {
    expect(problemText({ kind: "cpu", detail: "12.00 tf over" })).toBe("12.00 tf over");
    expect(problemText({
      kind: "maxGroupFitted", detail: "only 1 may be fitted",
      item: { name: "Damage Control II", typeId: 2048 } as never,
    })).toBe("Damage Control II — only 1 may be fitted");
  });
});

describe("rangeText", () => {
  it("formats a turret as optimal + falloff and a missile as one range, in m under a kilometre", () => {
    expect(rangeText({ kind: "turret", optimal: 600, falloff: 4257 })).toBe("optimal 600 m · falloff 4.3 km");
    expect(rangeText({ kind: "turret", optimal: 24_000, falloff: 12_500 })).toBe("optimal 24.0 km · falloff 12.5 km");
    expect(rangeText({ kind: "missile", range: 12_960 })).toBe("range 13.0 km");
    expect(rangeText({ kind: "turret", optimal: 12_000, falloff: 1 })).toBe("optimal 12.0 km");   // a mining laser: no falloff
    expect(rangeText(null)).toBeNull();
  });
  it("describes unloadable ammo by its own flight range or its range multipliers", () => {
    expect(hintText({ kind: "missile", range: 12_960 })).toBe("range 13.0 km");
    expect(hintText({ kind: "modifiers", optimal: 0.5, falloff: 0.75 })).toBe("optimal −50% · falloff −25%");
    expect(hintText({ kind: "modifiers", optimal: 1.6, falloff: 1 })).toBe("optimal +60%");
    expect(hintText(null)).toBeNull();
  });
});

describe("buildFitSheet", () => {
  it("shows a loaded weapon's reach beside its charge, and what ammo in the hold would give it", () => {
    const view = sheet();
    const high = view.slots.find((c) => c.slot === "high")!;
    // 1,200 m x Hail's 0.5 range multiplier; 5,160 m falloff x the Rifter's +10 % x Hail's 0.75.
    expect(high.rows[0].range).toEqual({ optimal: "600 m", falloff: "4.3 km" });
    expect(view.cargo.find((e) => e.typeId === 12608)!.range).toEqual({ optimal: "600 m", falloff: "4.3 km" });
    expect(view.drones[0].range).toBeNull();
  });

  it("labels a nicknamed item with its type name and keeps the nickname beside it", () => {
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 1021, typeId: 2456, locationFlag: "Cargo", quantity: 1, isSingleton: true, name: "Lucky" }),
    ], ctx);
    const view = sheet({ built, stats: fitStats(built.fit), problems: validateFit(built.fit), perf: fitPerformance(built.fit) });
    expect(view.cargo.map((e) => [e.name, e.nickname])).toEqual([["Hobgoblin II", "Lucky"]]);
  });

  it("leaves the range off an unloaded gun, and describes cargo ammo no fitted weapon takes by itself", () => {
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0", isSingleton: true }),
      // A torpedo in the hold: nothing fitted launches it, so its own flight range (1,800 m/s x 7.2 s).
      asset({ itemId: 1008, typeId: 27339, locationFlag: "Cargo", quantity: 10 }),
    ], ctx);
    const view = sheet({ built, stats: fitStats(built.fit), problems: validateFit(built.fit), perf: fitPerformance(built.fit) });
    const gun = view.slots.find((c) => c.slot === "high")!.rows[0];
    expect(gun.charge).toBeNull();
    expect(gun.range).toBeNull();
    expect(view.cargo.find((e) => e.typeId === 27339)!.range).toEqual({ optimal: "13.0 km", falloff: null });
    // Trying the torpedo did not leave anything loaded in the gun.
    expect(built.fit.modules[0].item.charge).toBeUndefined();
  });

  it("describes turret ammo on an unarmed hull by what it does to a gun's range", () => {
    const built = fitFromAssets(SHIP, [asset({ itemId: 1005, typeId: 12608, locationFlag: "Cargo", quantity: 1000 })], ctx);
    const view = sheet({ built, stats: fitStats(built.fit), problems: validateFit(built.fit), perf: fitPerformance(built.fit) });
    expect(view.cargo[0].range).toEqual({ optimal: "−50%", falloff: "−25%" });   // Hail: x0.5 range, x0.75 falloff
  });

  it("carries each item's description for the hover text", () => {
    const view = sheet();
    const turret = view.slots.find((c) => c.slot === "high")!.rows[0];
    expect(turret.desc).toBe("The 200mm is a powerful autocannon.");
    expect(turret.chargeDesc).toContain("25% reduced falloff.");
    expect(view.slots.find((c) => c.slot === "low")!.rows[0].desc).toBeNull();   // 519 not described
    expect(view.drones[0].desc).toBe("Light Scout Drone");
  });

  it("builds the header, the render URL and the hull bonuses at the character's level", () => {
    const view = sheet();
    expect(view.title).toBe("Scarlet Dart");
    expect(view.ship).toEqual({ typeName: "Rifter", groupName: "Frigate", raceName: "Minmatar" });
    expect(view.location.system?.secClass).toBe("sec-high");
    expect(view.typeName).toBe("Rifter");
    expect(view.renderUrl).toBe("https://images.evetech.net/types/587/render?size=128");
    expect(view.bonuses).toEqual([
      { skill: "Minmatar Frigate", level: 0, text: "7.5% bonus to Small Projectile Turret rate of fire" },
      { skill: "Minmatar Frigate", level: 0, text: "10% bonus to Small Projectile Turret falloff" },
    ]);
  });

  it("has three gauges, with the fixture's Rifter outputs", () => {
    const view = sheet();
    expect(view.gauges.map((g) => g.label)).toEqual(["CPU", "Powergrid", "Calibration"]);
    expect(view.gauges[0].text.endsWith("/ 162.50 tf")).toBe(true);
    expect(view.gauges[1].text.endsWith("/ 51.25 MW")).toBe(true);
    expect(view.gauges[0].over).toBe(false);
  });

  it("lays out five slot columns and puts each module in its own", () => {
    const view = sheet();
    expect(view.slots.map((s) => s.slot)).toEqual(["high", "mid", "low", "rig", "subsystem"]);
    expect(view.slots.map((s) => s.title)).toEqual(["High", "Mid", "Low", "Rigs", "Subsystems"]);
    const high = view.slots[0];
    expect(high.used).toBe(1);
    expect(high.rows).toHaveLength(1);
    expect(high.rows[0].name).toBe("200mm AutoCannon II");
    expect(high.rows[0].charge).toBe("Hail S");
    expect(high.rows[0].state).toBe("Active");
    expect(view.slots[2].rows[0].name).toBe("Gyrostabilizer II");
    expect(view.slots[1].rows).toEqual([]);
  });

  it("counts slots and hardpoints", () => {
    const view = sheet();
    expect(view.counters.find((c) => c.label === "High")).toMatchObject({ used: 1, over: false });
    expect(view.counters.find((c) => c.label === "Turrets")).toMatchObject({ used: 1, over: false });
    expect(view.counters.find((c) => c.label === "Launchers")).toMatchObject({ used: 0 });
  });

  it("lists problems and the missing skills with have → need", () => {
    const view = sheet();
    expect(view.problems.every((p) => p.text.length > 0 && p.label.length > 0)).toBe(true);
    const frigate = view.missing.find((m) => m.skillTypeId === 3329)!;
    expect(frigate).toMatchObject({ name: "Minmatar Frigate", have: 0 });
    expect(frigate.need).toBeGreaterThanOrEqual(1);
  });

  it("lists cargo and drones one line per type, split stacks and singleton drones merged", () => {
    const view = sheet();
    expect(view.cargo).toEqual([{ key: "Cargo:12608:0", typeId: 12608, name: "Hail S", nickname: null, quantity: 1500, value: "150,000.00 ISK", desc: DESCRIPTIONS.get(12608), range: { optimal: "600 m", falloff: "4.3 km" } }]);
    expect(view.drones).toEqual([{ key: "DroneBay:2456:0", typeId: 2456, name: "Hobgoblin II", nickname: null, quantity: 6, value: null, desc: "Light Scout Drone", range: null }]);
    expect(view.unfittable).toEqual([]);
    expect(view.unknown).toEqual([]);
  });

  it("rolls the value up per group and totals exactly what fitValueEntries prices", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    const view = sheet();
    const expected = rollUpValue(fitValueEntries(built), PRICES);
    expect(view.value.total).toBe(isk(expected.total));
    expect(view.value.lines.map((l) => l.label)).toEqual(["Hull", "Modules & rigs", "Charges", "Drones", "Cargo"]);
    expect(view.value.lines[0].value).toBe(isk(8_000_000));
    expect(view.value.unpriced).toBe("2 items unpriced");   // both Hobgoblin rows — the roll-up counts asset rows, not merged lines; the Hobgoblin has no price
  });

  it("formats the fitting-window stats panel from the engine's numbers", () => {
    const view = sheet();
    const perf = fitPerformance(fitFromAssets(SHIP, CHILDREN, ctx).fit);
    // Rifter hull: 450 shield / 450 armour / 350 structure, ladar 8, warp 5 AU/s (1 x 5), mass 1,067 t.
    expect(view.stats.defense.layers.map((l) => [l.layer, l.hp])).toEqual([["Shield", "450 hp"], ["Armor", "450 hp"], ["Hull", "350 hp"]]);
    expect(view.stats.defense.layers[0].note).toBe("625 s");
    expect(view.stats.defense.layers[2].resists).toEqual([33, 33, 33, 33]);   // the innate 0.67 structure resonance
    expect(view.stats.defense.headline).toBe(`${Math.round(perf.ehp!).toLocaleString("en-US")} ehp`);
    expect(view.stats.targeting.rows.find((r) => r.label === "Sensor strength")?.value).toBe("8.0 points (Ladar)");
    expect(view.stats.navigation.rows.map((r) => r.value)).toEqual(["1,067.0 t", "3.2000×", "5.00 AU/s", expect.stringMatching(/ s$/)]);
    expect(view.stats.capacitor.headline).toMatch(/^Stable \d+%$/);
    expect(view.stats.capacitor.rows[0].value).toMatch(/^[\d,]+ GJ \/ \d+m( \d+s)?$/);   // "250 GJ / 4m 10s"
    expect(view.stats.capacitor.ok).toBe(true);
    expect(view.stats.offense.headline).toMatch(/ dps$/);
    expect(view.stats.offense.rows.find((r) => r.label === "Weapons")?.value).toMatch(/ dps$/);
    // The bays: 1500 Hail S at 0.0025 m³ = 3.75 m³ of a 140 m³ hold; 6 Hobgoblin II at 5 m³ = 30 m³, and the Rifter has no drone bay (0 m³).
    expect(view.stats.bays).toEqual([{ label: "Cargo hold", value: "3.8 / 140 m³" }, { label: "Drone bay", value: "30 m³" }]);
    expect(view.stats.drones.rows.find((r) => r.label === "In bay")?.value).toBe("6 drones");
  });

  it("marks a charge the app loaded from cargo, and notes it in Offense", () => {
    // An unloaded gun (no HiSlot1 charge row) with Hail S in the hold.
    const built = fitFromAssets(SHIP, [
      ...CHILDREN, asset({ itemId: 1010, typeId: 2889, locationFlag: "HiSlot1", isSingleton: true }),
    ], ctx);
    const loads = assumeCargoAmmo(built);
    expect(loads).toEqual([{ slot: "high", index: 1, moduleTypeId: 2889, chargeTypeId: 12608 }]);
    const view = buildFitSheet({
      title: "Scarlet Dart", typeId: 587, typeName: "Rifter",
      ship: { typeName: "Rifter", groupName: "Frigate", raceName: "Minmatar" },
      location: { system: null, place: null, note: null },
      built, stats: fitStats(built.fit), problems: validateFit(built.fit), perf: fitPerformance(built.fit),
      bonuses: BONUSES, skillLevels, skillNames, prices: PRICES, descriptions: DESCRIPTIONS, skillsSynced: true,
    });
    const high = view.slots.find((c) => c.slot === "high")!;
    expect(high.rows.map((r) => [r.charge, r.chargeAssumed])).toEqual([["Hail S", false], ["Hail S", true]]);
    expect(view.stats.offense.note).toBe("1 weapon loaded with the best ammo in cargo");
    expect(sheet().stats.offense.note).toBeNull();
  });

  it("passes the unsynced-skills flag through", () => {
    expect(sheet({ skillsSynced: false }).skillsSynced).toBe(false);
  });
});
