import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY, fitFromAssets, fitStats, validateFit } from "../../src/lib/dogma/index.js";
import { buildFitSheet, operatorLabel, problemText, stateLabel, typeDescription } from "../../src/lib/view/fit-sheet.js";
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
    title: "Scarlet Dart", subtitle: "Jita 4-4", typeId: 587, typeName: "Rifter",
    built, stats: fitStats(built.fit), problems: validateFit(built.fit),
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

describe("buildFitSheet", () => {
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
    expect(view.subtitle).toBe("Jita 4-4");
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
    expect(high.rows[0].cpu).toMatch(/^\d+\.\d{2}$/);      // two decimals, spec §4
    expect(high.rows[0].power).toMatch(/^\d+\.\d{2}$/);
    expect(high.rows[0].state).toBe("Active");
    expect(view.slots[2].rows[0].name).toBe("Gyrostabilizer II");
    expect(view.slots[1].rows).toEqual([]);
  });

  it("explains the turret's CPU with the skill that modifies it", () => {
    const row = sheet().slots[0].rows[0];
    expect(row.cpuExplain.map((r) => r.carrier)).toContain("Weapon Upgrades");
    const applied = row.cpuExplain.find((r) => r.carrier === "Weapon Upgrades")!;
    expect(applied.operator).toBe("%");
    expect(applied.value).toBe("-25");
    expect(typeof applied.penalised).toBe("boolean");
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
    expect(view.cargo).toEqual([{ key: "Cargo:12608:0", typeId: 12608, name: "Hail S", quantity: 1500, value: "150,000.00 ISK", desc: DESCRIPTIONS.get(12608) }]);
    expect(view.drones).toEqual([{ key: "DroneBay:2456:0", typeId: 2456, name: "Hobgoblin II", quantity: 6, value: null, desc: "Light Scout Drone" }]);
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

  it("passes the unsynced-skills flag through", () => {
    expect(sheet({ skillsSynced: false }).skillsSynced).toBe(false);
  });
});
