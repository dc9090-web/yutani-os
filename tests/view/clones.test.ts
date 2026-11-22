import { describe, it, expect } from "vitest";
import { cloneLocations, cloneView, IMPLANT_SLOT_ATTR, type ImplantSource } from "../../src/lib/view/clones.js";

const PERCEPTION_BONUS = 178;
const implant = (name: string, slot: number | null, extra: [number, number][] = [], desc: string | null = null): ImplantSource => ({
  name, desc, attributes: new Map<number, number>([...(slot === null ? [] : [[IMPLANT_SLOT_ATTR, slot] as [number, number]]), ...extra]),
});
const types = new Map<number, ImplantSource>([
  [1, implant("Ocular Filter - Improved", 1, [[PERCEPTION_BONUS, 5]], "Improves perception.")],
  [6, implant("Squire Power Grid EG-602", 6)],
  [9, implant("Deadeye Sharpshooter ST-905", 9)],
  [50, implant("Oddity", null)],
]);

describe("cloneView", () => {
  it("sorts implants by their SDE slot and marks the slots taken", () => {
    const view = cloneView([9, 1, 6], types);
    expect(view.implants.map((i) => [i.slot, i.name])).toEqual([
      [1, "Ocular Filter - Improved"], [6, "Squire Power Grid EG-602"], [9, "Deadeye Sharpshooter ST-905"],
    ]);
    expect(view.slots).toEqual([true, false, false, false, false, true, false, false, true, false]);
    expect(view.used).toBe(3);
  });
  it("carries the attribute bonus and the description", () => {
    const [ocular, squire] = cloneView([1, 6], types).implants;
    expect(ocular).toMatchObject({ bonus: "+5 Perception", desc: "Improves perception." });
    expect(squire).toMatchObject({ bonus: null, desc: null });
  });
  it("counts an implant with no slot on record but fills no block for it, and sorts it last", () => {
    const view = cloneView([50, 1], types);
    expect(view.implants.map((i) => i.slot)).toEqual([1, null]);
    expect(view.slots.filter(Boolean)).toHaveLength(1);
    expect(view.used).toBe(2);
  });
  it("names a type the SDE does not know by its id", () => {
    expect(cloneView([777], types).implants[0]).toMatchObject({ name: "Type 777", slot: null, bonus: null });
  });
  it("is empty for a clean clone", () => {
    expect(cloneView([], types)).toEqual({ implants: [], slots: Array(10).fill(false), used: 0 });
  });
});

describe("cloneLocations", () => {
  const places = new Map([
    [60003760, { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", systemName: "Jita" }],
    [60001234, { name: "Kubinen VI - Moon 2 - Lai Dai Corporation Factory", systemName: "Kubinen" }],
    [1035000000001, { name: "Unknown structure (1035000000001)", systemName: null }],
  ]);
  const clone = (jumpCloneId: number, locationId: number | null, name: string | null = null, implants: number[] = []) => ({ jumpCloneId, locationId, name, implants });

  it("groups by station, the one with the most clones first, numbering clones in list order", () => {
    const locations = cloneLocations([clone(11, 60001234, "Scout"), clone(12, 60003760), clone(13, 60003760, "  ")], places, types);
    expect(locations.map((l) => [l.title, l.station, l.clones.map((c) => c.code)])).toEqual([
      ["Jita", "Jita IV - Moon 4 - Caldari Navy Assembly Plant", ["JC 02", "JC 03"]],
      ["Kubinen", "Kubinen VI - Moon 2 - Lai Dai Corporation Factory", ["JC 01"]],
    ]);
    expect(locations[1].clones[0].name).toBe("Scout");
    expect(locations[0].clones[1].name).toBeNull();   // a blank name is no name
  });
  it("uses the place's own label when it has no system, and groups unknown places together", () => {
    const locations = cloneLocations([clone(1, 1035000000001), clone(2, null), clone(3, 999)], places, types);
    expect(locations.map((l) => [l.title, l.station, l.clones.length])).toEqual([
      ["Unknown location", null, 2],
      ["Unknown structure (1035000000001)", null, 1],
    ]);
  });
  it("gives each clone its own implant list and slot strip", () => {
    const [location] = cloneLocations([clone(1, 60003760, null, [9, 6])], places, types);
    expect(location.clones[0].implants.map((i) => i.slot)).toEqual([6, 9]);
    expect(location.clones[0].used).toBe(2);
  });
});
