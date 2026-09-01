import { describe, it, expect } from "vitest";
import { ATTR, EFFECT, State } from "../../src/lib/dogma/data.js";
import { clearMemo } from "../../src/lib/dogma/calc.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");

describe("a bare Rifter", () => {
  it("reports zero usage against the hull's outputs", () => {
    const stats = fitStats(buildFit(data, 587));
    expect(stats.cpu).toEqual({ used: 0, output: 130 });
    expect(stats.power).toEqual({ used: 0, output: 41 });
    expect(stats.calibration).toEqual({ used: 0, output: 400 });
    expect(stats.slots).toEqual({
      high: { used: 0, total: 3 }, mid: { used: 0, total: 3 }, low: { used: 0, total: 4 },
      rig: { used: 0, total: 3 }, subsystem: { used: 0, total: 0 },
    });
    expect(stats.hardpoints).toEqual({ turret: { used: 0, total: 3 }, launcher: { used: 0, total: 2 } });
    expect(stats.modules).toEqual([]);
  });
});

describe("resource usage", () => {
  const loadout: [number, "high" | "low", number][] = [
    [2889, "high", 0], [2889, "high", 1], [2889, "high", 2], [2048, "low", 0], [519, "low", 1],
  ];

  it("sums the modified cpu and power of every charged module", () => {
    const stats = fitStats(buildFit(data, 587, { modules: loadout }));
    expect(stats.cpu.used).toBe(87);      // 3 × 9 + 30 + 30
    expect(stats.power.used).toBe(14);    // 3 × 4 + 1 + 1
    expect(stats.slots.high).toEqual({ used: 3, total: 3 });
    expect(stats.slots.low).toEqual({ used: 2, total: 4 });
    expect(stats.hardpoints.turret).toEqual({ used: 3, total: 3 });
  });

  it("uses the skill-modified values and the skill-modified outputs", () => {
    const stats = fitStats(buildFit(data, 587, { modules: loadout, skills: allSkills(data, 5) }));
    expect(stats.cpu).toEqual({ used: 80.25, output: 162.5 });    // 3 × 6.75 + 30 + 30
    expect(stats.power).toEqual({ used: 12.8, output: 51.25 });   // 3 × 3.6 + 1 + 1
  });

  it("charges nothing for an offline module but still lists it", () => {
    const fit = buildFit(data, 587, { modules: loadout });
    fit.modules[3].item.state = State.Offline;     // Damage Control II
    clearMemo(fit);
    const stats = fitStats(fit);
    expect(stats.cpu.used).toBe(57);
    expect(stats.power.used).toBe(13);
    const dcu = stats.modules.find((m) => m.item.typeId === 2048)!;
    expect(dcu).toMatchObject({ cpu: 0, power: 0, state: State.Offline, charged: false });
  });

  it("charges nothing for a module whose type has no online effect", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.effects.delete(EFFECT.online);
    clearMemo(fit);
    const stats = fitStats(fit);
    expect(stats.cpu.used).toBe(0);
    expect(stats.modules[0].charged).toBe(false);
    // The unmodified attribute is still there — the gate is about charging, not about the value.
    expect(fit.modules[0].item.attrs.get(ATTR.cpu)).toBe(30);
  });

  it("counts a turret's hardpoint even when it is offline", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]] });
    fit.modules[0].item.state = State.Offline;
    clearMemo(fit);
    expect(fitStats(fit).hardpoints.turret).toEqual({ used: 1, total: 3 });
  });
});

describe("calibration", () => {
  it("sums upgradeCost over rigs in any state and charges them no cpu or powergrid", () => {
    const fit = buildFit(data, 587, { modules: [[31686, "rig", 0], [31724, "rig", 1]] });
    expect(fitStats(fit).calibration).toEqual({ used: 375, output: 400 });   // 300 + 75
    fit.modules[0].item.state = State.Offline;
    clearMemo(fit);
    const stats = fitStats(fit);
    expect(stats.calibration.used).toBe(375);
    expect(stats.cpu.used).toBe(0);
    expect(stats.modules[0]).toMatchObject({ slot: "rig", index: 0, calibration: 300, cpu: 0, power: 0, charged: false });
  });

  it("reports no calibration for a non-rig module", () => {
    const stats = fitStats(buildFit(data, 587, { modules: [[2048, "low", 0]] }));
    expect(stats.modules[0].calibration).toBe(0);
  });
});

describe("T3 subsystems", () => {
  it("shows a maxSubSystems of 5 as 4 and takes the subsystem's slot and output adds", () => {
    const stats = fitStats(buildFit(tengu, 29984, { modules: [[45601, "subsystem", 0]] }));
    expect(stats.slots.subsystem).toEqual({ used: 1, total: 4 });
    expect(stats.slots.high).toEqual({ used: 0, total: 7 });
    expect(stats.hardpoints.launcher).toEqual({ used: 0, total: 6 });
    expect(stats.cpu.output).toBe(470);
    expect(stats.power.output).toBe(610);
  });
});

describe("module rows", () => {
  it("carries the slot, index, state and modified costs of each module in fit order", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 2], [31686, "rig", 0]], skills: allSkills(data, 5) });
    const stats = fitStats(fit);
    expect(stats.modules.map((m) => [m.item.typeId, m.slot, m.index, m.cpu, m.power, m.calibration, m.charged]))
      .toEqual([
        [2889, "high", 2, 6.75, 3.96, 0, true],   // the rig's drawback adds 10 % to the turret's powergrid
        [31686, "rig", 0, 0, 0, 300, false],
      ]);
    expect(stats.power.used).toBe(3.96);
  });
});
