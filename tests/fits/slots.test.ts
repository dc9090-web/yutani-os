import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { createFit, makeItem } from "../../src/lib/dogma/index.js";
import { CARGO_FLAG, type FitDoc, type FitItem } from "../../src/lib/fits/doc.js";
import {
  allowedStates, canFitShip, chargeFits, firstFreeIndex, fitTypeInto, removeSlot, setEntryQuantity,
  setSlotCharge, setSlotState, slotGrid, slotTotals,
} from "../../src/lib/fits/slots.js";

const data = fixtureData("rifter");
const RIFTER = { high: 3, mid: 3, low: 4, rig: 3, subsystem: 0 };

function item(over: Partial<FitItem> & { typeId: number; flag: string }): FitItem {
  return { quantity: 1, chargeTypeId: null, state: "active", ...over };
}
function doc(items: FitItem[]): FitDoc {
  return { id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v", items };
}

describe("slotTotals", () => {
  it("reads the hull's slot counts through the engine", () => {
    const fit = createFit(data, makeItem(data, 587));
    expect(slotTotals(fit)).toEqual(RIFTER);
  });
});

describe("slotGrid", () => {
  it("sizes each row by the hull and leaves the empty cells null", () => {
    const grid = slotGrid(doc([item({ typeId: 2889, flag: "HiSlot0" })]), RIFTER);
    expect(grid.high.map((c) => c.item?.typeId ?? null)).toEqual([2889, null, null]);
    expect(grid.low).toHaveLength(4);
    expect(grid.subsystem).toEqual([]);
    expect(grid.high.every((c) => !c.over)).toBe(true);
  });

  it("extends the row and marks the extras when a module sits past the hull's count", () => {
    const grid = slotGrid(doc([
      item({ typeId: 2889, flag: "HiSlot0" }),
      item({ typeId: 2889, flag: "HiSlot4" }),
    ]), RIFTER);
    expect(grid.high).toHaveLength(5);
    expect(grid.high.map((c) => c.over)).toEqual([false, false, false, true, true]);
    expect(grid.high[4].item?.typeId).toBe(2889);
  });
});

describe("firstFreeIndex", () => {
  it("finds the first gap, and reports a full row as null", () => {
    const one = doc([item({ typeId: 2889, flag: "HiSlot0" })]);
    expect(firstFreeIndex(one, "high", RIFTER)).toBe(1);
    const full = doc([0, 1, 2].map((i) => item({ typeId: 2889, flag: `HiSlot${i}` })));
    expect(firstFreeIndex(full, "high", RIFTER)).toBeNull();
    expect(firstFreeIndex(full, "mid", RIFTER)).toBe(0);
  });
});

describe("fitTypeInto", () => {
  it("puts a module in the first free matching slot with its default state", () => {
    const next = fitTypeInto(doc([item({ typeId: 2889, flag: "HiSlot0" })]), data, 2889, RIFTER);
    expect(next.items.map((i) => [i.flag, i.typeId, i.state])).toEqual([
      ["HiSlot0", 2889, "active"],
      ["HiSlot1", 2889, "active"],
    ]);
  });

  it("replaces the selected slot instead of adding, keeping the document order", () => {
    const before = doc([
      item({ typeId: 2889, flag: "HiSlot0", chargeTypeId: 12608 }),
      item({ typeId: 2048, flag: "LoSlot0" }),
    ]);
    const next = fitTypeInto(before, data, 4256, RIFTER, { slot: "high", index: 0 });
    expect(next.items.map((i) => [i.flag, i.typeId, i.chargeTypeId])).toEqual([
      ["HiSlot0", 4256, null],
      ["LoSlot0", 2048, null],
    ]);
  });

  it("over-fits past the hull's count rather than refusing", () => {
    const full = doc([0, 1, 2].map((i) => item({ typeId: 2889, flag: `HiSlot${i}` })));
    const next = fitTypeInto(full, data, 2889, RIFTER);
    expect(next.items[3].flag).toBe("HiSlot3");
    expect(slotGrid(next, RIFTER).high[3].over).toBe(true);
  });

  it("sends a drone to the drone bay and ammunition to the cargo hold, merging quantities", () => {
    const withDrone = fitTypeInto(doc([]), data, 2456, RIFTER);
    expect(withDrone.items).toEqual([
      { typeId: 2456, quantity: 1, flag: "DroneBay", chargeTypeId: null, state: "active" },
    ]);
    const twoDrones = fitTypeInto(withDrone, data, 2456, RIFTER);
    expect(twoDrones.items[0].quantity).toBe(2);
    const withAmmo = fitTypeInto(twoDrones, data, 12608, RIFTER);
    expect(withAmmo.items[1]).toEqual(
      { typeId: 12608, quantity: 1, flag: CARGO_FLAG, chargeTypeId: null, state: "active" });
  });

  it("ignores a type this SDE build does not know", () => {
    const before = doc([]);
    expect(fitTypeInto(before, data, 999999, RIFTER)).toBe(before);
  });
});

describe("the per-slot edits", () => {
  const before = doc([
    item({ typeId: 2889, flag: "HiSlot0", chargeTypeId: 12608 }),
    item({ typeId: 2048, flag: "LoSlot0" }),
  ]);

  it("removes, restates and recharges exactly one slot", () => {
    expect(removeSlot(before, "high", 0).items.map((i) => i.flag)).toEqual(["LoSlot0"]);
    expect(setSlotState(before, "low", 0, "offline").items[1].state).toBe("offline");
    expect(setSlotCharge(before, "high", 0, 27339).items[0].chargeTypeId).toBe(27339);
    expect(setSlotCharge(before, "high", 0, null).items[0].chargeTypeId).toBeNull();
  });

  it("does not touch the document when the slot is empty", () => {
    expect(removeSlot(before, "mid", 2)).toBe(before);
    expect(setSlotState(before, "mid", 2, "offline")).toBe(before);
  });
});

describe("setEntryQuantity", () => {
  const before = doc([item({ typeId: 2456, flag: "DroneBay", quantity: 5 })]);
  it("changes the quantity and deletes the entry at zero", () => {
    expect(setEntryQuantity(before, "DroneBay", 2456, 3).items[0].quantity).toBe(3);
    expect(setEntryQuantity(before, "DroneBay", 2456, 0).items).toEqual([]);
  });
});

describe("chargeFits", () => {
  const gun = data.types.get(2889)!;          // 200mm AutoCannon II — chargeGroup1 83, chargeGroup2 372
  const hail = data.types.get(12608)!;        // Hail S — group 372, chargeSize 1
  const torpedo = data.types.get(27339)!;     // Caldari Navy Mjolnir Torpedo — group 89
  const extender = data.types.get(380)!;      // Small Shield Extender II — takes no charge at all

  it("accepts a charge whose group the module lists", () => {
    expect(chargeFits(gun, hail)).toBe(true);
  });
  it("rejects a charge from a group the module does not list", () => {
    expect(chargeFits(gun, torpedo)).toBe(false);
  });
  it("rejects everything for a module that declares no charge group", () => {
    expect(chargeFits(extender, hail)).toBe(false);
  });
});

describe("allowedStates", () => {
  it("offers every state the type's own effects support", () => {
    expect(allowedStates(data, data.types.get(2889)!)).toEqual(["offline", "online", "active", "overload"]);
    expect(allowedStates(data, data.types.get(2048)!)).toEqual(["offline", "online"]);
    expect(allowedStates(data, data.types.get(31686)!)).toEqual(["offline", "online"]);
  });
});

describe("canFitShip", () => {
  const rifter = data.types.get(587)!;
  const gun = data.types.get(2889)!;                 // no restriction at all
  const smallRig = data.types.get(31686)!;           // Small rig, rigSize 1
  const mediumRig = data.types.get(31682)!;          // Medium rig, rigSize 2
  const bombLauncher = data.types.get(4256)!;        // canFitShipGroup01 = 834 (Stealth Bomber)

  it("accepts anything with no restriction", () => {
    expect(canFitShip(rifter, gun)).toBe(true);
  });
  it("rejects a rig whose size the hull does not take", () => {
    expect(canFitShip(rifter, smallRig)).toBe(true);        // both are rigSize 1
    expect(canFitShip(rifter, mediumRig)).toBe(false);      // rigSize 2 on a rigSize 1 hull
  });
  it("rejects a module restricted to other hull groups", () => {
    expect(canFitShip(rifter, bombLauncher)).toBe(false);   // the Rifter's group is 25, not 834
  });
});
