import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";

// Gunnery (rank 1, no prereqs) ← Weapon Upgrades (rank 2, needs Gunnery II)
//   ← Advanced Weapon Upgrades (rank 6, needs Weapon Upgrades IV)
// Spaceship Command (rank 1, no prereqs) ← Minmatar Frigate (rank 2, needs Spaceship Command I)
// Ouroboros lists itself as a prerequisite, which the SDE really does contain.
const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3318, name: "Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 2, primaryAttr: 167, secondaryAttr: 166, prereqs: [{ skillId: 3300, level: 2 }] },
  { id: 11207, name: "Advanced Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 6, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 3318, level: 4 }] },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3329, name: "Minmatar Frigate", groupId: 257, groupName: "Spaceship Command", rank: 2, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 3327, level: 1 }] },
  { id: 8888, name: "Ouroboros", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 8888, level: 3 }] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));
const pairs = (entries: { skillId: number; level: number }[]) => entries.map((e) => [e.skillId, e.level]);

describe("expandPlan", () => {
  it("emits every level of a requested skill, tagging the ones below it as prereqs", () => {
    const out = expandPlan([{ skillId: 3300, level: 3 }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([[3300, 1], [3300, 2], [3300, 3]]);
    expect(out.map((e) => e.prereq)).toEqual([true, true, false]);
  });

  it("expands nested prerequisites in trainable order", () => {
    const out = expandPlan([{ skillId: 11207, level: 1 }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([
      [3300, 1], [3300, 2],                                  // Gunnery II, for Weapon Upgrades
      [3318, 1], [3318, 2], [3318, 3], [3318, 4],            // Weapon Upgrades IV, for AWU
      [11207, 1],
    ]);
    expect(out.filter((e) => !e.prereq).map((e) => e.skillId)).toEqual([11207]);
  });

  it("skips prerequisite levels the character already has", () => {
    const known = new Map([[3300, 2], [3318, 2]]);
    expect(pairs(expandPlan([{ skillId: 11207, level: 1 }], known, CATALOGUE)))
      .toEqual([[3318, 3], [3318, 4], [11207, 1]]);
  });

  it("keeps a requested level the character already has, so the table can mark it done", () => {
    const out = expandPlan([{ skillId: 3300, level: 2 }], new Map([[3300, 5]]), CATALOGUE);
    expect(pairs(out)).toEqual([[3300, 2]]);
    expect(out[0].prereq).toBe(false);
  });

  it("never emits the same pair twice, however many entries need it", () => {
    const out = expandPlan(
      [{ skillId: 3318, level: 4 }, { skillId: 11207, level: 1 }, { skillId: 3300, level: 5 }],
      new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([
      [3300, 1], [3300, 2], [3318, 1], [3318, 2], [3318, 3], [3318, 4],
      [11207, 1],
      [3300, 3], [3300, 4], [3300, 5],
    ]);
    expect(new Set(out.map((e) => `${e.skillId}:${e.level}`)).size).toBe(out.length);
  });

  it("carries the note of the requested entry only", () => {
    const out = expandPlan([{ skillId: 3329, level: 1, note: "for the Rifter" }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([[3327, 1], [3329, 1]]);
    expect(out.map((e) => e.note)).toEqual([null, "for the Rifter"]);
  });

  it("ignores a self-referencing prerequisite and drops out-of-range levels", () => {
    expect(pairs(expandPlan([{ skillId: 8888, level: 1 }], new Map(), CATALOGUE))).toEqual([[8888, 1]]);
    expect(expandPlan([{ skillId: 3300, level: 0 }, { skillId: 3300, level: 6 }], new Map(), CATALOGUE)).toEqual([]);
  });

  it("emits an unknown skill as asked, with no expansion", () => {
    const out = expandPlan([{ skillId: 999999, level: 2 }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([[999999, 1], [999999, 2]]);
  });
});
