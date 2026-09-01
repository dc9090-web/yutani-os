import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";
import { optimalRemap } from "../../src/lib/skills/remap.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  // Gunnery: perception primary, willpower secondary, rank 1.
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  // Power Grid Management: intelligence primary, memory secondary, rank 1.
  { id: 3413, name: "Power Grid Management", groupId: 272, groupName: "Engineering", rank: 1, primaryAttr: 165, secondaryAttr: 166, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));
const CURRENT: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };

describe("optimalRemap", () => {
  it("pushes a Gunnery-only plan into perception and willpower", () => {
    const entries = expandPlan([{ skillId: 3300, level: 5 }], new Map(), CATALOGUE);
    const result = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map(),
    });
    // rate = perception + willpower/2, maximised at perception 27 (the +10 cap) with the
    // remaining 4 points in willpower: 27 + 21/2 = 37.5 SP/min. perception 26 / willpower 22
    // would give 37, so the optimum is unique.
    expect(result.remap).toEqual(
      { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
    expect(result.candidates).toBe(2885);
    // Gunnery V is 256,000 SP. Current 21 + 22/2 = 32 → 8,000 min = 480,000,000 ms.
    // Optimal 37.5 → 6,826.66… min = 409,600,000 ms. Saved 70,400,000 ms (19 h 33 m 20 s).
    expect(result.currentMs).toBe(480_000_000);
    expect(result.totalMs).toBe(409_600_000);
    expect(result.savedMs).toBe(70_400_000);
  });

  it("adds implants on top of every candidate without changing the winner", () => {
    const entries = expandPlan([{ skillId: 3300, level: 5 }], new Map(), CATALOGUE);
    const result = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map(),
      implantBonus: { charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 },
    });
    expect(result.remap).toEqual(
      { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
    // 30 + 24/2 = 42 SP/min → 256,000 / 42 min.
    expect(result.totalMs).toBeCloseTo((256_000 / 42) * 60_000, 3);
  });

  it("balances a plan that pulls on both attribute pairs", () => {
    const entries = expandPlan(
      [{ skillId: 3300, level: 5 }, { skillId: 3413, level: 5 }], new Map(), CATALOGUE);
    const result = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map(),
    });
    // Both halves are 256,000 SP, so the winner must put real points into intelligence too.
    expect(result.remap.intelligence).toBeGreaterThan(17);
    expect(result.remap.perception).toBeGreaterThan(17);
    expect(result.remap.charisma).toBe(17);
    expect(result.totalMs).toBeLessThan(result.currentMs);
  });

  it("never reports a negative saving, and skips entries that cost nothing", () => {
    const entries = expandPlan([{ skillId: 3300, level: 5 }], new Map(), CATALOGUE);
    const done = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT,
      trained: new Map([[3300, 5]]), queued: new Map(),
    });
    expect(done.currentMs).toBe(0);
    expect(done.totalMs).toBe(0);
    expect(done.savedMs).toBe(0);
  });

  it("is deterministic", () => {
    const entries = expandPlan([{ skillId: 3300, level: 3 }], new Map(), CATALOGUE);
    const args = { entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map() };
    expect(optimalRemap(args)).toEqual(optimalRemap(args));
  });
});
