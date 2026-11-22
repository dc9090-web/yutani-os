import { describe, it, expect } from "vitest";
import { keyFigures, mergeModuleRows, repairViews, skillEffectText, skillGapGroups, type ModuleRowView } from "../../src/lib/view/fit-sheet.js";
import { launchedSummary, launchedTotals, roomFor, type DroneLimits } from "../../src/lib/view/drones.js";
import type { FitPerformance, SkillGap } from "../../src/lib/dogma/index.js";

const perf = (over: Partial<FitPerformance>): FitPerformance => ({
  dps: null, volley: null, weaponDps: null, droneDps: null, ehp: null, shield: null, armor: null, hull: null,
  shieldRechargeTime: null, shieldRechargeRate: null, maxVelocity: null, propulsion: null, alignTime: null,
  capacitorCapacity: null, capRechargeTime: null, capStable: null, capUsage: null, capPeakRecharge: null, capDelta: null,
  maxTargets: null, maxTargetRange: null, scanResolution: null, signatureRadius: null, sensorStrength: null,
  mass: null, inertia: null, warpSpeed: null, droneBandwidth: null, droneBay: null, droneControlRange: null,
  shieldBoostRate: 0, armorRepairRate: 0, hullRepairRate: 0, drones: null, ...over,
});

describe("keyFigures", () => {
  it("formats the strip for a fit with a microwarpdrive and a stable capacitor", () => {
    const key = keyFigures(perf({
      ehp: 36074.2, shieldRechargeRate: 27.04, maxVelocity: 289.1, alignTime: 5.234,
      propulsion: { kind: "Microwarpdrive", velocity: 1765.3, alignTime: 7.118, signatureRadius: 900 },
      capStable: { stable: true, level: 0.423 }, capDelta: 2.21,
      maxTargetRange: 81_300, maxTargets: 6, scanResolution: 300.4,
    }));
    expect(key.ehp).toEqual({ value: "36,074", unit: null, note: "Shield recharge 27.0 hp/s", tone: null });
    expect(key.speed).toEqual({ value: "1,765", unit: "m/s", note: "With MWD · 289.1 m/s without", tone: null });
    expect(key.capacitor).toEqual({ value: "Stable 42%", unit: null, note: "+2.2 GJ/s", tone: "good" });
    expect(key.lock).toEqual({ value: "81.3", unit: "km", note: "6 targets · 300 mm scan res", tone: null });
    expect(key.align).toEqual({ value: "5.23", unit: "s", note: "7.12 s with MWD on", tone: null });
  });
  it("shows the cold speed alone without a propulsion module, and a draining capacitor in coral with a minus", () => {
    const key = keyFigures(perf({ maxVelocity: 219.4, alignTime: 5.6, capStable: { stable: false, lastsSeconds: 161 }, capDelta: -3.04, maxTargets: 1 }));
    expect(key.speed).toEqual({ value: "219", unit: "m/s", note: null, tone: null });
    expect(key.capacitor).toMatchObject({ value: "Lasts 2m 41s", tone: "bad", note: "−3.0 GJ/s" });
    expect(key.align.note).toBeNull();
    expect(key.lock.note).toBe("1 target");
  });
  it("names an afterburner as such", () => {
    const key = keyFigures(perf({ maxVelocity: 300, propulsion: { kind: "Afterburner", velocity: 700, alignTime: 4, signatureRadius: null }, alignTime: 3 }));
    expect(key.speed.note).toBe("With afterburner · 300.0 m/s without");
    expect(key.align.note).toBe("4.00 s with AB on");
  });
  it("dashes what the engine cannot say, with no stray units", () => {
    const key = keyFigures(perf({}));
    for (const figure of Object.values(key)) expect(figure).toEqual({ value: "—", unit: null, note: null, tone: null });
  });
});

describe("repairViews", () => {
  it("lists the passive shield peak and the three active rates, marking the ones the fit lacks", () => {
    expect(repairViews(perf({ shieldRechargeRate: 4.69, shieldBoostRate: 119.2, armorRepairRate: 0, hullRepairRate: 0 }))).toEqual([
      { label: "Passive shield", value: "4.7", idle: false },
      { label: "Shield boost", value: "119.2", idle: false },
      { label: "Armor repair", value: "0", idle: true },
      { label: "Hull repair", value: "0", idle: true },
    ]);
  });
  it("dashes the passive rate on a hull with no shield figures", () => {
    expect(repairViews(perf({}))[0]).toEqual({ label: "Passive shield", value: "—", idle: true });
  });
});

describe("mergeModuleRows", () => {
  const row = (key: string, typeId: number, over: Partial<ModuleRowView> = {}): ModuleRowView => ({
    quantity: 1, key, name: `Type ${typeId}`, typeId, charge: null, chargeTypeId: null, state: "Online",
    desc: null, chargeDesc: null, chargeAssumed: false, range: null, ...over,
  });
  it("merges identical modules into one row with a quantity, in first-seen order", () => {
    const merged = mergeModuleRows([row("a", 1), row("b", 2), row("c", 1), row("d", 1)]);
    expect(merged.map((r) => [r.key, r.typeId, r.quantity])).toEqual([["a", 1, 3], ["b", 2, 1]]);
  });
  it("keeps modules apart when their charge, state or reach differs", () => {
    const merged = mergeModuleRows([
      row("a", 1, { chargeTypeId: 10 }), row("b", 1, { chargeTypeId: 11 }), row("c", 1, { chargeTypeId: 10, state: "Active" }),
      row("d", 1, { chargeTypeId: 10, range: { optimal: "5 km", falloff: null } }), row("e", 1, { chargeTypeId: 10 }),
    ]);
    expect(merged.map((r) => r.quantity)).toEqual([2, 1, 1, 1]);
  });
  it("does not change the rows it is given", () => {
    const rows = [row("a", 1), row("b", 1)];
    mergeModuleRows(rows);
    expect(rows.map((r) => r.quantity)).toEqual([1, 1]);
  });
});

describe("skill gaps for the Skills panel", () => {
  it("picks the sentence of a skill's description that states its bonus", () => {
    expect(skillEffectText("Skill at the operation of missile launchers. 3% bonus to missile launcher rate of fire per skill level."))
      .toBe("3% bonus to missile launcher rate of fire per skill level.");
    expect(skillEffectText("Skill for operation of Heavy Assault Cruisers.")).toBe("Skill for operation of Heavy Assault Cruisers.");
    expect(skillEffectText("  ")).toBeNull();
    expect(skillEffectText(undefined)).toBeNull();
  });
  const gap = (over: Partial<SkillGap>): SkillGap => ({ skillTypeId: 1, name: "Skill", level: 3, group: "modules", affects: [], ...over });
  it("groups by where the skill lands, in ship, modules, drones order, dropping empty groups", () => {
    const groups = skillGapGroups([
      gap({ skillTypeId: 3, name: "Drone Interfacing", group: "drones", affects: [{ typeId: 9, name: "Infiltrator", count: 1, isShip: false }] }),
      gap({ skillTypeId: 1, name: "HAC", group: "ship", level: 2, affects: [{ typeId: 7, name: "Ishtar", count: 1, isShip: true }] }),
    ], new Map([[3, "10% bonus to drone damage per level."]]));
    expect(groups.map((g) => g.name)).toEqual(["Ship and bonuses", "Drones"]);
    expect(groups[0].skills[0]).toMatchObject({ name: "HAC", level: 2, affects: "Ishtar hull", effect: null });
    expect(groups[1].skills[0]).toMatchObject({ affects: "Infiltrator", effect: "10% bonus to drone damage per level." });
  });
  it("counts identical modules and caps a long list", () => {
    const names = ["A", "B", "C", "D", "E", "F"].map((name, i) => ({ typeId: i, name, count: i === 0 ? 5 : 1, isShip: false }));
    const [group] = skillGapGroups([gap({ affects: names })], new Map());
    expect(group.skills[0].affects).toBe("5× A, B, C, D, +2 more");
  });
  it("prefers the hull's own bonus lines for a ship skill", () => {
    const [group] = skillGapGroups(
      [gap({ skillTypeId: 12096, name: "Heavy Assault Cruisers", group: "ship", affects: [{ typeId: 7, name: "Ishtar", count: 1, isShip: true }] })],
      new Map([[12096, "Skill for operation of Heavy Assault Cruisers."]]),
      new Map([[12096, ["5% bonus to drone damage", "7.5% bonus to drone tracking"]]]),
    );
    expect(group.skills[0].effect).toBe("5% bonus to drone damage; 7.5% bonus to drone tracking, per level");
  });
});

describe("drone selector arithmetic", () => {
  const limits: DroneLimits = {
    bandwidth: 60, maxActive: 5,
    types: [
      { typeId: 1, name: "Heavy", inBay: 3, bandwidth: 25, dpsEach: 50, volleyEach: 200 },
      { typeId: 2, name: "Light", inBay: 5, bandwidth: 5, dpsEach: 20, volleyEach: 60 },
    ],
  };
  it("totals a selection", () => {
    expect(launchedTotals(limits, { 1: 2, 2: 2 })).toEqual({ dps: 140, volley: 520, active: 4, bandwidthUsed: 60 });
    expect(launchedTotals(limits, {})).toEqual({ dps: 0, volley: 0, active: 0, bandwidthUsed: 0 });
  });
  it("limits a type by the bay, the bandwidth left and the control limit, whichever is lowest", () => {
    expect(roomFor(limits, {}, limits.types[0])).toBe(2);                 // bandwidth
    expect(roomFor(limits, { 1: 2 }, limits.types[1])).toBe(2);           // bandwidth
    expect(roomFor(limits, { 2: 4 }, limits.types[1])).toBe(1);           // bay and control limit
    expect(roomFor(limits, { 2: 5 }, limits.types[0])).toBe(0);           // control limit
    expect(roomFor({ ...limits, maxActive: null, bandwidth: 1000 }, {}, limits.types[0])).toBe(3);   // bay
  });
  it("summarises what is out", () => {
    expect(launchedSummary(limits, { 1: 2, 2: 1 })).toBe("2× Heavy, 1× Light");
    expect(launchedSummary(limits, { 1: 0 })).toBe("No drones launched");
  });
});
