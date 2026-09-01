import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { SLOT_KINDS, State, fitStats, slotFromFlag } from "../../src/lib/dogma/index.js";
import {
  CARGO_FLAG, docItemsFromBuilt, fitFromDoc, flagFor, stateName, stateValue,
  type FitDoc, type FitItem,
} from "../../src/lib/fits/doc.js";
import { fitFromAssets } from "../../src/lib/dogma/index.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

const data = fixtureData("rifter");
// CPU Management V and Power Grid Management V only — the Rifter's own skill stays untrained.
const ctx = { data, skills: new Map([[3426, 5], [3413, 5]]), implants: [] };

function item(over: Partial<FitItem> & { typeId: number; flag: string }): FitItem {
  return { quantity: 1, chargeTypeId: null, state: "active", ...over };
}

const DOC: FitDoc = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v",
  items: [
    item({ typeId: 2889, flag: "HiSlot0", chargeTypeId: 12608 }),   // 200mm AutoCannon II + Hail S
    item({ typeId: 2048, flag: "LoSlot0", state: "offline" }),      // Damage Control II, offline
    item({ typeId: 2456, flag: "DroneBay", quantity: 2 }),          // Hobgoblin II ×2
    item({ typeId: 12608, flag: CARGO_FLAG, quantity: 600 }),       // spare Hail S
    item({ typeId: 999999, flag: "HiSlot1" }),                      // not in this SDE build
  ],
};

describe("flagFor", () => {
  it("is the inverse of slotFromFlag for every slot kind", () => {
    for (const slot of SLOT_KINDS) {
      expect(slotFromFlag(flagFor(slot, 3))).toEqual({ slot, index: 3 });
    }
    expect(flagFor("high", 0)).toBe("HiSlot0");
    expect(flagFor("subsystem", 2)).toBe("SubSystemSlot2");
  });
});

describe("state names", () => {
  it("round-trips every state", () => {
    expect(stateName(stateValue("offline"))).toBe("offline");
    expect(stateName(stateValue("online"))).toBe("online");
    expect(stateName(stateValue("active"))).toBe("active");
    expect(stateName(stateValue("overload"))).toBe("overload");
    expect(stateValue("overload")).toBe(State.Overload);
  });
});

describe("fitFromDoc", () => {
  it("places modules, attaches the charge and honours the stored state", () => {
    const built = fitFromDoc(DOC, ctx);
    expect(built.fit.modules.map((m) => [m.slot, m.index, m.item.typeId])).toEqual([
      ["high", 0, 2889],
      ["low", 0, 2048],
    ]);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.fit.modules[1].item.state).toBe(State.Offline);
  });

  it("fills the drone bay and the cargo hold, and lists unknown types without modelling them", () => {
    const built = fitFromDoc(DOC, ctx);
    expect(built.drones.map((d) => [d.typeId, d.quantity])).toEqual([[2456, 2]]);
    expect(built.cargo.map((c) => [c.typeId, c.quantity])).toEqual([[12608, 600]]);
    expect(built.unknown.map((u) => u.typeId)).toEqual([999999]);
    expect(built.fit.drones.map((d) => d.typeId)).toEqual([2456]);
  });

  it("charges an offline module nothing — the autocannon's 9 tf is the whole CPU bill", () => {
    const stats = fitStats(fitFromDoc(DOC, ctx).fit);
    expect(stats.cpu.used).toBe(9);          // Damage Control II's 30 tf is not charged while offline
    expect(stats.cpu.output).toBe(162.5);    // Rifter, CPU Management V
    expect(stats.slots.low.total).toBe(4);
    expect(stats.slots.high.total).toBe(3);
  });
});

describe("docItemsFromBuilt", () => {
  it("turns a phase-4 BuiltFit into doc items, charge and state included", () => {
    const ship: AssetRow = {
      itemId: 1000, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station",
      locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Scarlet Dart",
    };
    const children: AssetRow[] = [
      { ...ship, itemId: 1001, typeId: 2889, locationId: 1000, locationFlag: "HiSlot0", name: null },
      { ...ship, itemId: 1002, typeId: 12608, quantity: 400, locationId: 1000, locationFlag: "HiSlot0", isSingleton: false, name: null },
      { ...ship, itemId: 1003, typeId: 2456, quantity: 5, locationId: 1000, locationFlag: "DroneBay", isSingleton: false, name: null },
    ];
    expect(docItemsFromBuilt(fitFromAssets(ship, children, ctx))).toEqual([
      { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" },
      { typeId: 2456, quantity: 5, flag: "DroneBay", chargeTypeId: null, state: "active" },
    ]);
  });
});
