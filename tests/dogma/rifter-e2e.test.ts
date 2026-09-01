import { describe, it, expect } from "vitest";
import {
  fitFromAssets, fitFromFitting, fitStats, validateFit, missingSkills, explain, ATTR,
  type FitContext, type BuiltFit,
} from "../../src/lib/dogma/index.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import type { FittingRow } from "../../src/lib/db/character-fittings.js";
import { fixtureData } from "./fixture.js";
import { allSkills } from "./build-fit.js";

const data = fixtureData("rifter");

const SHIP: AssetRow = {
  itemId: 1000, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Scout One",
};

/** Rifter + 3 × 200mm AutoCannon II + Damage Control II + Gyrostabilizer II. */
const CHILDREN: AssetRow[] = ([
  [1001, 2889, "HiSlot0"], [1002, 2889, "HiSlot1"], [1003, 2889, "HiSlot2"],
  [1004, 2048, "LoSlot0"], [1005, 519, "LoSlot1"],
] as [number, number, string][]).map(([itemId, typeId, locationFlag]): AssetRow => ({
  itemId, typeId, quantity: 1, locationId: 1000, locationType: "item",
  locationFlag, isSingleton: true, isBlueprintCopy: false, name: null,
}));

/** The same loadout, saved as a fitting rather than assembled from assets. */
const FITTING: FittingRow = {
  fittingId: 9001, name: "Rifter — three ACs, DCU, gyro", description: "", shipTypeId: 587,
  items: [
    { idx: 0, typeId: 2889, quantity: 1, flag: "HiSlot0" },
    { idx: 1, typeId: 2889, quantity: 1, flag: "HiSlot1" },
    { idx: 2, typeId: 2889, quantity: 1, flag: "HiSlot2" },
    { idx: 3, typeId: 2048, quantity: 1, flag: "LoSlot0" },
    { idx: 4, typeId: 519, quantity: 1, flag: "LoSlot1" },
  ],
};

const atLevel = (level: number): FitContext => ({ data, skills: allSkills(data, level), implants: [] });

const BUILDERS: [string, () => BuiltFit][] = [
  ["fitFromAssets", () => fitFromAssets(SHIP, CHILDREN, atLevel(5))],
  ["fitFromFitting", () => fitFromFitting(FITTING, FITTING.items, atLevel(5))],
];

describe.each(BUILDERS)("Rifter with three autocannons, a damage control and a gyrostabilizer, built via %s", (_label, build) => {
  // ⚠ Hand-derived, not verified against Pyfa or the client (research §8). The 162.5 / 51.25 output
  // figures ARE independently checked against the EVE University wiki, and every step of the 80.25 /
  // 12.80 usage arithmetic follows directly from the SDE modifiers quoted in research §6.7/§9 — but if
  // an operator later compares this fit in-game and it disagrees, this fixture is what changes, and the
  // divergence table in research §7 is where to look first.
  it("uses 80.25 tf of 162.5 and 12.80 MW of 51.25 at all skills V", () => {
    const stats = fitStats(build().fit);
    expect(stats.cpu).toEqual({ used: 80.25, output: 162.5 });
    expect(stats.power).toEqual({ used: 12.8, output: 51.25 });
  });

  it("charges each module the value the SDE modifiers derive", () => {
    const stats = fitStats(build().fit);
    expect(stats.modules.map((m) => [m.item.typeId, m.cpu, m.power])).toEqual([
      [2889, 6.75, 3.6], [2889, 6.75, 3.6], [2889, 6.75, 3.6], [2048, 30, 1], [519, 30, 1],
    ]);
    expect(stats.modules.every((m) => m.charged)).toBe(true);
  });

  it("fills the hull's slots and hardpoints exactly", () => {
    const stats = fitStats(build().fit);
    expect(stats.slots).toEqual({
      high: { used: 3, total: 3 }, mid: { used: 0, total: 3 }, low: { used: 2, total: 4 },
      rig: { used: 0, total: 3 }, subsystem: { used: 0, total: 0 },
    });
    expect(stats.hardpoints).toEqual({ turret: { used: 3, total: 3 }, launcher: { used: 0, total: 2 } });
    expect(stats.calibration).toEqual({ used: 0, output: 400 });
  });

  it("reports no problems and no missing skills at all skills V", () => {
    const built = build();
    expect(validateFit(built.fit)).toEqual([]);
    expect(missingSkills(built.fit)).toEqual([]);
  });
});

it("produces identical CPU/power totals whichever way the fit is built", () => {
  const fromAssets = fitStats(fitFromAssets(SHIP, CHILDREN, atLevel(5)).fit);
  const fromFitting = fitStats(fitFromFitting(FITTING, FITTING.items, atLevel(5)).fit);
  expect({ cpu: fromFitting.cpu, power: fromFitting.power }).toEqual({ cpu: fromAssets.cpu, power: fromAssets.power });
});

it("still fits with no skills at all, at the unmodified numbers", () => {
  const built = fitFromAssets(SHIP, CHILDREN, { data, skills: new Map(), implants: [] });
  const stats = fitStats(built.fit);
  expect(stats.cpu).toEqual({ used: 87, output: 130 });     // 3 × 9 + 30 + 30
  expect(stats.power).toEqual({ used: 14, output: 41 });    // 3 × 4 + 1 + 1
  const problems = validateFit(built.fit);
  expect(problems.length).toBeGreaterThan(0);
  expect(problems.every((p) => p.kind === "skill")).toBe(true);
  expect(missingSkills(built.fit).length).toBeGreaterThan(0);
});

it("explains where the CPU output and the turret's CPU come from", () => {
  const built = fitFromAssets(SHIP, CHILDREN, atLevel(5));
  expect(explain(built.fit, built.fit.ship, ATTR.cpuOutput).map((a) => [a.carrierTypeId, a.effectId]))
    .toEqual([[3426, 397]]);
  expect(explain(built.fit, built.fit.ship, ATTR.powerOutput).map((a) => [a.carrierTypeId, a.effectId]))
    .toEqual([[3413, 490]]);
  expect(explain(built.fit, built.fit.modules[0].item, ATTR.cpu).map((a) => [a.carrierTypeId, a.effectId]))
    .toEqual([[3318, 581]]);
  expect(explain(built.fit, built.fit.modules[0].item, ATTR.power).map((a) => [a.carrierTypeId, a.effectId]))
    .toEqual([[11207, 1638]]);
});
