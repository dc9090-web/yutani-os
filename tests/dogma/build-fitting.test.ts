import { describe, it, expect } from "vitest";
import { UnknownTypeError } from "../../src/lib/dogma/fit.js";
import { fitFromFitting, type FitContext } from "../../src/lib/dogma/build.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import { validateFit } from "../../src/lib/dogma/validate.js";
import type { FittingItemRow, FittingRow } from "../../src/lib/db/character-fittings.js";
import { fixtureData } from "./fixture.js";

const data = fixtureData("rifter");
const ctx: FitContext = { data, skills: new Map(), implants: [] };

function fitting(shipTypeId: number, items: [number, number, string][]): FittingRow {
  return {
    fittingId: 4021, name: "Rifter — cheap tackle", description: "", shipTypeId,
    items: items.map(([typeId, quantity, flag], idx): FittingItemRow => ({ idx, typeId, quantity, flag })),
  };
}

describe("fitFromFitting", () => {
  const saved = fitting(587, [
    [484, 1, "HiSlot0"],
    [484, 1, "HiSlot1"],
    [12608, 100, "HiSlot0"],       // ammo loaded into the first gun
    [5443, 1, "MedSlot0"],
    [2048, 1, "LoSlot0"],
    [31686, 1, "RigSlot0"],
    [12608, 400, "Cargo"],
    [2456, 5, "DroneBay"],
    [27339, 1, "Invalid"],
  ]);

  it("places the modules and hangs the ammo under the gun that shares its flag", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    expect(built.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([
      [484, "high", 0], [484, "high", 1], [5443, "mid", 0], [2048, "low", 0], [31686, "rig", 0],
    ]);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.fit.modules[1].item.charge).toBeUndefined();
  });

  it("lists the Invalid entry as unfittable rather than modelling it", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    expect(built.unfittable).toEqual([{ typeId: 27339, quantity: 1, flag: "Invalid", name: null }]);
    expect(built.fit.modules.some((m) => m.item.typeId === 27339)).toBe(false);
  });

  it("splits cargo and drones out", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 400, flag: "Cargo", name: null }]);
    expect(built.drones).toEqual([{ typeId: 2456, quantity: 5, flag: "DroneBay", name: null }]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
    expect(built.unknown).toEqual([]);
  });

  it("produces a fit the rest of the engine can measure and validate", () => {
    const built = fitFromFitting(saved, saved.items, ctx);
    const stats = fitStats(built.fit);
    expect(stats.cpu).toEqual({ used: 66, output: 130 });    // 3 + 3 + 30 + 30
    // 1.1 + 1.1 + 1 + 1: the rig (Small Projectile Collision Accelerator II) adds 10% to a turret's
    // own powergrid need, so each gun draws 1.1 rather than the base 1.
    expect(stats.power).toEqual({ used: 4.2, output: 41 });
    expect(stats.calibration).toEqual({ used: 300, output: 400 });
    const problems = validateFit(built.fit);
    // Nothing but skills: the fit is inside every resource, slot and hardpoint limit.
    expect(new Set(problems.map((p) => p.kind))).toEqual(new Set(["skill"]));
    expect(problems.map((p) => p.skill!.skillTypeId)).toEqual([
      3300, 3302, 3312, 3327, 3329, 3392, 3394, 3426, 3435, 3436, 3449, 11084, 12486, 24241,
    ]);
    expect(problems.map((p) => p.skill!.required)).toEqual([
      2, 5, 3, 1, 1, 1, 4, 3, 1, 5, 2, 1, 1, 5,
    ]);
  });

  it("records a type this SDE build does not know", () => {
    const built = fitFromFitting(fitting(587, [[999999, 1, "LoSlot0"]]), [
      { idx: 0, typeId: 999999, quantity: 1, flag: "LoSlot0" },
    ], ctx);
    expect(built.unknown).toEqual([{ typeId: 999999, quantity: 1, flag: "LoSlot0", name: null }]);
    expect(built.fit.modules).toEqual([]);
  });

  it("throws when the fitting's hull is unknown", () => {
    expect(() => fitFromFitting(fitting(999999, []), [], ctx)).toThrow(UnknownTypeError);
  });

  it("handles a drone-only fitting", () => {
    const vexor = fitting(626, [[2456, 5, "DroneBay"]]);
    const built = fitFromFitting(vexor, vexor.items, ctx);
    expect(built.fit.modules).toEqual([]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
    expect(fitStats(built.fit).slots.high).toEqual({ used: 0, total: 4 });
  });

  it("sends every item in a slot flag to cargo when nothing in it carries the slot marker", () => {
    // Two units of ammo alone under HiSlot1, with no gun to hang them off — neither becomes a
    // stand-in module (review tightening #1).
    const f = fitting(587, [[12608, 50, "HiSlot1"], [12608, 25, "HiSlot1"]]);
    const built = fitFromFitting(f, f.items, ctx);
    expect(built.fit.modules).toEqual([]);
    expect(built.cargo).toEqual([
      { typeId: 12608, quantity: 50, flag: "HiSlot1", name: null },
      { typeId: 12608, quantity: 25, flag: "HiSlot1", name: null },
    ]);
  });

  it("sends a second marker-carrying type sharing a flag to unfittable instead of treating it as a charge", () => {
    // Two guns both claim HiSlot0 — the second can't be a charge of the first (review tightening #2).
    const f = fitting(587, [[484, 1, "HiSlot0"], [484, 1, "HiSlot0"]]);
    const built = fitFromFitting(f, f.items, ctx);
    expect(built.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([[484, "high", 0]]);
    expect(built.fit.modules[0].item.charge).toBeUndefined();
    expect(built.unfittable).toEqual([{ typeId: 484, quantity: 1, flag: "HiSlot0", name: null }]);
  });

  it("picks the known, slot-matching entry as the module regardless of row order", () => {
    // Unknown "ammo" and a known gun share HiSlot1 — the gun (known, carries the hi-slot marker) is
    // the module; the unknown entry always lands in `unknown`, whichever order the rows arrive in.
    const forward = fitting(587, [[999999, 50, "HiSlot1"], [484, 1, "HiSlot1"]]);
    const builtForward = fitFromFitting(forward, forward.items, ctx);
    expect(builtForward.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([[484, "high", 1]]);
    expect(builtForward.unknown).toEqual([{ typeId: 999999, quantity: 50, flag: "HiSlot1", name: null }]);
    expect(builtForward.unfittable).toEqual([]);

    const reversed = fitting(587, [[484, 1, "HiSlot1"], [999999, 50, "HiSlot1"]]);
    const builtReversed = fitFromFitting(reversed, reversed.items, ctx);
    expect(builtReversed.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([[484, "high", 1]]);
    expect(builtReversed.unknown).toEqual([{ typeId: 999999, quantity: 50, flag: "HiSlot1", name: null }]);
    expect(builtReversed.unfittable).toEqual([]);
  });

  it("sends a known entry of the wrong slot kind to unfittable instead of treating it as the module", () => {
    // Damage Control II (2048) is a low-slot module; a row of it under HiSlot0 is a real module, just
    // the wrong kind for a hi slot — it's unfittable, not promoted into the slot.
    const f = fitting(587, [[2048, 1, "HiSlot0"]]);
    const built = fitFromFitting(f, f.items, ctx);
    expect(built.fit.modules).toEqual([]);
    expect(built.unfittable).toEqual([{ typeId: 2048, quantity: 1, flag: "HiSlot0", name: null }]);
    expect(built.cargo).toEqual([]);
    expect(built.unknown).toEqual([]);
  });
});
