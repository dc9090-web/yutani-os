import { describe, it, expect } from "vitest";
import { ATTR } from "../../src/lib/dogma/data.js";
import { UnknownTypeError } from "../../src/lib/dogma/fit.js";
import { fitFromAssets, slotFromFlag, type FitContext } from "../../src/lib/dogma/build.js";
import { fitStats } from "../../src/lib/dogma/stats.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import { fixtureData } from "./fixture.js";

const data = fixtureData("rifter");

const ctx: FitContext = { data, skills: new Map([[3426, 5], [3413, 5], [3318, 5], [11207, 5]]), implants: [27143] };

function asset(over: Partial<AssetRow> & Pick<AssetRow, "itemId" | "typeId">): AssetRow {
  return {
    quantity: 1, locationId: 1000, locationType: "item", locationFlag: "Cargo",
    isSingleton: true, isBlueprintCopy: false, name: null, ...over,
  };
}

const SHIP = asset({ itemId: 1000, typeId: 587, locationId: 60003760, locationType: "station", locationFlag: "Hangar", name: "Scout One" });

describe("slotFromFlag", () => {
  it("maps every slot flag family with its index", () => {
    expect(slotFromFlag("HiSlot0")).toEqual({ slot: "high", index: 0 });
    expect(slotFromFlag("HiSlot7")).toEqual({ slot: "high", index: 7 });
    expect(slotFromFlag("MedSlot2")).toEqual({ slot: "mid", index: 2 });
    expect(slotFromFlag("LoSlot3")).toEqual({ slot: "low", index: 3 });
    expect(slotFromFlag("RigSlot1")).toEqual({ slot: "rig", index: 1 });
    expect(slotFromFlag("SubSystemSlot4")).toEqual({ slot: "subsystem", index: 4 });
  });

  it("rejects anything else", () => {
    for (const flag of ["Cargo", "DroneBay", "Hangar", "HiSlot", "HiSlotX", "AutoFit", "Invalid", ""]) {
      expect(slotFromFlag(flag)).toBeNull();
    }
  });
});

describe("fitFromAssets", () => {
  const children: AssetRow[] = [
    asset({ itemId: 1006, typeId: 12608, locationFlag: "Cargo", quantity: 1000, isSingleton: false }),
    asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0" }),
    asset({ itemId: 1002, typeId: 12608, locationFlag: "HiSlot0", quantity: 200, isSingleton: false }),
    asset({ itemId: 1008, typeId: 2889, locationFlag: "HiSlot1" }),
    asset({ itemId: 1003, typeId: 2048, locationFlag: "LoSlot0" }),
    asset({ itemId: 1004, typeId: 31686, locationFlag: "RigSlot0" }),
    asset({ itemId: 1005, typeId: 2456, locationFlag: "DroneBay", quantity: 5, isSingleton: false }),
    asset({ itemId: 1007, typeId: 999999, locationFlag: "MedSlot0" }),
    asset({ itemId: 2001, typeId: 2048, locationId: 9999, locationFlag: "LoSlot1" }),
  ];

  it("puts the modules in their slots in a stable order", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.fit.modules.map((m) => [m.item.typeId, m.slot, m.index])).toEqual([
      [2889, "high", 0], [2889, "high", 1], [2048, "low", 0], [31686, "rig", 0],
    ]);
  });

  it("hangs a non-singleton item sharing a module's flag under that module", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.fit.modules[0].item.charge?.container).toBe(built.fit.modules[0].item);
    expect(built.fit.modules[1].item.charge).toBeUndefined();
  });

  it("splits drones, cargo and unknown types out of the fit", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.drones).toEqual([{ typeId: 2456, quantity: 5, flag: "DroneBay", name: null }]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 1000, flag: "Cargo", name: null }]);
    expect(built.unknown).toEqual([{ typeId: 999999, quantity: 1, flag: "MedSlot0", name: null }]);
    expect(built.unfittable).toEqual([]);
  });

  it("ignores assets that live in another container", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect(built.fit.modules.some((m) => m.index === 1 && m.slot === "low")).toBe(false);
  });

  it("carries the context's skills and implants into the fit", () => {
    const built = fitFromAssets(SHIP, children, ctx);
    expect([...built.fit.skills.keys()].sort((a, b) => a - b)).toEqual([3318, 3413, 3426, 11207]);
    expect(built.fit.skills.get(3426)!.attrs.get(ATTR.skillLevel)).toBe(5);
    expect(built.fit.implants.map((i) => i.typeId)).toEqual([27143]);
  });

  it("produces a fit the rest of the engine can measure", () => {
    const stats = fitStats(fitFromAssets(SHIP, children, ctx).fit);
    expect(stats.cpu.output).toBe(164.13);       // 130 × 1.25 (CPU Management V) × 1.01 (EE-601)
    expect(stats.cpu.used).toBe(43.5);           // 2 × 6.75 + 30
    expect(stats.calibration.used).toBe(300);
    expect(stats.hardpoints.turret).toEqual({ used: 2, total: 3 });
  });

  it("skips skills and implants this SDE build does not know", () => {
    const built = fitFromAssets(SHIP, [], { data, skills: new Map([[3426, 5], [999999, 5]]), implants: [999999] });
    expect([...built.fit.skills.keys()]).toEqual([3426]);
    expect(built.fit.implants).toEqual([]);
  });

  it("throws when the hull's own type is unknown", () => {
    expect(() => fitFromAssets(asset({ itemId: 1, typeId: 999999 }), [], ctx)).toThrow(UnknownTypeError);
  });

  it("drops the charges of a module it could not build into cargo", () => {
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 3001, typeId: 999999, locationFlag: "HiSlot0" }),
      asset({ itemId: 3002, typeId: 12608, locationFlag: "HiSlot0", quantity: 50, isSingleton: false }),
    ], ctx);
    expect(built.fit.modules).toEqual([]);
    expect(built.unknown.map((e) => e.typeId)).toEqual([999999]);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 50, flag: "HiSlot0", name: null }]);
  });

  it("keeps a renamed item's name on its entry", () => {
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 4001, typeId: 12608, locationFlag: "Cargo", quantity: 3, isSingleton: false, name: "spare ammo" }),
    ], ctx);
    expect(built.cargo).toEqual([{ typeId: 12608, quantity: 3, flag: "Cargo", name: "spare ammo" }]);
  });

  it("sends every item in a slot flag to cargo when nothing in it is a singleton", () => {
    // Two non-singleton stacks share MedSlot1 with no module to hang them off — neither is promoted
    // into the slot as a stand-in module (review tightening #1).
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 5001, typeId: 12608, locationFlag: "MedSlot1", quantity: 50, isSingleton: false }),
      asset({ itemId: 5002, typeId: 12608, locationFlag: "MedSlot1", quantity: 25, isSingleton: false }),
    ], ctx);
    expect(built.fit.modules.some((m) => m.slot === "mid" && m.index === 1)).toBe(false);
    expect(built.cargo).toEqual([
      { typeId: 12608, quantity: 50, flag: "MedSlot1", name: null },
      { typeId: 12608, quantity: 25, flag: "MedSlot1", name: null },
    ]);
  });

  it("sends a second singleton sharing a flag to unfittable instead of treating it as a charge", () => {
    // Two singleton guns both claim HiSlot2 — the second can't be a charge of the first (review
    // tightening #2).
    const built = fitFromAssets(SHIP, [
      asset({ itemId: 5003, typeId: 2889, locationFlag: "HiSlot2" }),
      asset({ itemId: 5004, typeId: 2889, locationFlag: "HiSlot2" }),
    ], ctx);
    expect(built.fit.modules.filter((m) => m.slot === "high" && m.index === 2)).toHaveLength(1);
    expect(built.fit.modules.find((m) => m.slot === "high" && m.index === 2)?.item.charge).toBeUndefined();
    expect(built.unfittable).toEqual([{ typeId: 2889, quantity: 1, flag: "HiSlot2", name: null }]);
  });
});
