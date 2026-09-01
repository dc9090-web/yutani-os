import { describe, it, expect } from "vitest";
import { ATTR } from "../../src/lib/dogma/data.js";
import { validateFit, type Problem } from "../../src/lib/dogma/validate.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";
import type { Fit, SlotKind } from "../../src/lib/dogma/fit.js";

const data = fixtureData("rifter");

/**
 * Every problem except the skill ones. Most fits in this file are built without skills, and the skill
 * checks (added in the next task) have their own block — filtering keeps each test about one rule.
 */
const nonSkill = (fit: Fit): Problem[] => validateFit(fit).filter((p) => p.kind !== "skill");
const kinds = (fit: Fit): string[] => nonSkill(fit).map((p) => p.kind);

describe("cpu", () => {
  it("passes when the modules fit", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0], [2889, "high", 1], [2889, "high", 2]] });
    expect(nonSkill(fit)).toEqual([]);
  });

  it("fails when the sum exceeds the hull's output", () => {
    // 3 × 9 + 30 + 30 + 30 + 23 + 25 = 165 tf of 130; powergrid stays at 35 MW of 41.
    const modules: [number, SlotKind, number][] = [
      [2889, "high", 0], [2889, "high", 1], [2889, "high", 2],
      [2048, "low", 0], [519, "low", 1],
      [5443, "mid", 0], [380, "mid", 1], [440, "mid", 2],
    ];
    const problems = nonSkill(buildFit(data, 587, { modules }));
    expect(problems.map((p) => p.kind)).toEqual(["cpu"]);
    expect(problems[0].detail).toBe("CPU: 165 tf used of 130 tf");
    expect(problems[0].item).toBeUndefined();
  });

  it("passes the same fit once the fitting skills are trained", () => {
    const modules: [number, SlotKind, number][] = [
      [2889, "high", 0], [2889, "high", 1], [2889, "high", 2], [2048, "low", 0], [519, "low", 1],
    ];
    expect(validateFit(buildFit(data, 587, { modules, skills: allSkills(data, 5) }))).toEqual([]);
  });
});

describe("power", () => {
  it("passes with two microwarpdrives", () => {
    // 2 × 17 = 34 MW of 41, 2 × 25 = 50 tf of 130.
    expect(nonSkill(buildFit(data, 587, { modules: [[440, "mid", 0], [440, "mid", 1]] }))).toEqual([]);
  });

  it("fails when the powergrid is oversubscribed", () => {
    // 3 × 17 = 51 MW of 41; CPU stays at 75 tf of 130.
    const fit = buildFit(data, 587, { modules: [[440, "mid", 0], [440, "mid", 1], [440, "mid", 2]] });
    const problems = nonSkill(fit);
    expect(problems.map((p) => p.kind)).toEqual(["power"]);
    expect(problems[0].detail).toBe("Powergrid: 51 MW used of 41 MW");
  });
});

describe("calibration", () => {
  it("passes with one 300-point rig and fails with two", () => {
    expect(nonSkill(buildFit(data, 587, { modules: [[31686, "rig", 0]] }))).toEqual([]);
    const problems = nonSkill(buildFit(data, 587, { modules: [[31686, "rig", 0], [31686, "rig", 1]] }));
    expect(problems.map((p) => p.kind)).toEqual(["calibration"]);
    expect(problems[0].detail).toBe("Calibration: 600 used of 400");
  });
});

describe("slots", () => {
  it("passes at exactly the slot count and fails one over", () => {
    const three: [number, SlotKind, number][] = [[5443, "mid", 0], [5443, "mid", 1], [5443, "mid", 2]];
    expect(kinds(buildFit(data, 587, { modules: three }))).toEqual([]);
    const problems = nonSkill(buildFit(data, 587, { modules: [...three, [5443, "mid", 3]] }));
    expect(problems.map((p) => p.kind)).toEqual(["slot"]);
    expect(problems[0].detail).toBe("Mid slots: 4 used of 3");
  });

  it("reports a subsystem slot problem on a hull with none", () => {
    const problems = nonSkill(buildFit(data, 587, { modules: [[2048, "subsystem", 0]] }));
    expect(problems.map((p) => p.detail)).toContain("Subsystem slots: 1 used of 0");
  });
});

describe("hardpoints", () => {
  it("fails when a hull runs out of turret hardpoints before high slots", () => {
    // Hound: 5 high slots but only 2 turret hardpoints.
    const fit = buildFit(data, 12034, { modules: [[2889, "high", 0], [2889, "high", 1], [2889, "high", 2]] });
    const problems = nonSkill(fit);
    expect(problems.map((p) => p.kind)).toEqual(["hardpoint"]);
    expect(problems[0].detail).toBe("Turret hardpoints: 3 used of 2");
  });

  it("passes at exactly the hardpoint count", () => {
    expect(nonSkill(buildFit(data, 12034, { modules: [[2889, "high", 0], [2889, "high", 1]] }))).toEqual([]);
  });
});

describe("rig size", () => {
  it("accepts a small rig on a small hull", () => {
    expect(nonSkill(buildFit(data, 587, { modules: [[31686, "rig", 0]] }))).toEqual([]);
  });

  it("rejects a medium rig on a small hull", () => {
    const fit = buildFit(data, 587, { modules: [[31724, "rig", 0]] });
    const problems = nonSkill(fit);
    expect(problems.map((p) => p.kind)).toEqual(["rigSize"]);
    expect(problems[0].item).toBe(fit.modules[0].item);
    expect(problems[0].detail).toBe("Medium EM Shield Reinforcer II is a size-2 rig; this hull takes size 1");
  });

  it("skips the check when either side has no rigSize", () => {
    const fit = buildFit(data, 587, { modules: [[31724, "rig", 0]] });
    fit.ship.attrs.delete(ATTR.rigSize);
    expect(nonSkill(fit)).toEqual([]);
  });

  it("does not apply the check to a non-rig module", () => {
    const fit = buildFit(data, 587, { modules: [[2048, "low", 0]] });
    fit.modules[0].item.attrs.set(ATTR.rigSize, 3);
    expect(nonSkill(fit)).toEqual([]);
  });
});
