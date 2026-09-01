import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";
import { planDurationMs, planTimeline } from "../../src/lib/skills/timeline.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3329, name: "Minmatar Frigate", groupId: 257, groupName: "Spaceship Command", rank: 2, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 3327, level: 1 }] },
  { id: 7777, name: "Attributeless", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 0, secondaryAttr: 0, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));

// perception 21, willpower 22 → every skill here trains at 21 + 22/2 = 32 SP/min.
const ATTRS: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };
const START = new Date("2026-09-01T00:00:00Z");
const ENTRIES = expandPlan([{ skillId: 3300, level: 3 }, { skillId: 3329, level: 1 }], new Map(), CATALOGUE);

describe("planTimeline", () => {
  it("prices every level and accumulates the clock", () => {
    const t = planTimeline({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map(), queued: new Map(), startAt: START,
    });
    expect(t.entries.map((e) => [e.skillId, e.level])).toEqual([[3300, 1], [3300, 2], [3300, 3], [3327, 1], [3329, 1]]);
    // Rank-1 cumulative SP is 250 / 1415 / 8000, so the increments are 250 / 1165 / 6585.
    // Minmatar Frigate is rank 2, so level I is 500 SP. Spaceship Command is rank 1: 250 SP.
    expect(t.entries.map((e) => e.sp)).toEqual([250, 1165, 6585, 250, 500]);
    expect(t.entries.map((e) => e.spPerMinute)).toEqual([32, 32, 32, 32, 32]);
    // sp / 32 SP-per-minute * 60,000 ms.
    expect(t.entries.map((e) => e.ms)).toEqual([468_750, 2_184_375, 12_346_875, 468_750, 937_500]);
    expect(t.entries.map((e) => e.cumulativeMs)).toEqual([468_750, 2_653_125, 15_000_000, 15_468_750, 16_406_250]);
    expect(t.totalSp).toBe(8750);
    expect(t.totalMs).toBe(16_406_250);
    // 16,406,250 ms = 273.4375 min = 4 h 33 m 26.25 s after midnight.
    expect(t.doneAt.toISOString()).toBe("2026-09-01T04:33:26.250Z");
    expect(t.entries[0].doneAt.toISOString()).toBe("2026-09-01T00:07:48.750Z");
    expect(t.entries.map((e) => e.status)).toEqual(["planned", "planned", "planned", "planned", "planned"]);
    expect(t.unknownSkillIds).toEqual([]);
  });

  it("marks trained and queued levels and charges them nothing", () => {
    const t = planTimeline({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map([[3300, 2]]), queued: new Map([[3300, 3]]), startAt: START,
    });
    expect(t.entries.map((e) => e.status)).toEqual(["done", "done", "queued", "planned", "planned"]);
    expect(t.entries.map((e) => e.sp)).toEqual([0, 0, 0, 250, 500]);
    // levelSp still reports what the level costs, for the table's SP column.
    expect(t.entries.map((e) => e.levelSp)).toEqual([250, 1165, 6585, 250, 500]);
    expect(t.entries.map((e) => e.cumulativeMs)).toEqual([0, 0, 0, 468_750, 1_406_250]);
    expect(t.totalMs).toBe(1_406_250);
    expect(t.totalSp).toBe(750);
    expect(t.doneAt.toISOString()).toBe("2026-09-01T00:23:26.250Z");
  });

  it("discounts SP already held inside a part-trained level, once", () => {
    const gunneryToIv = expandPlan([{ skillId: 3300, level: 4 }], new Map(), CATALOGUE);
    const t = planTimeline({
      entries: gunneryToIv, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map([[3300, 2]]), queued: new Map(),
      partialSp: new Map([[3300, 3000]]), startAt: START,
    });
    expect(t.entries.map((e) => e.status)).toEqual(["done", "done", "planned", "planned"]);
    // Gunnery III wants 8,000 SP in total and 3,000 are already in: 5,000 SP at 32 SP/min.
    expect(t.entries[2]).toMatchObject({ sp: 5000, ms: 9_375_000 });
    // Gunnery IV starts from level III's own 8,000 floor, not from the 3,000 again:
    // 45,255 - 8,000 = 37,255 SP → 1164.21875 min → 69,853,125 ms.
    expect(t.entries[3]).toMatchObject({ sp: 37_255, ms: 69_853_125 });
  });

  it("starts from the queue's end when asked to", () => {
    const after = new Date("2026-09-10T00:00:00Z");
    const t = planTimeline({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map(), queued: new Map(), startAt: after,
    });
    expect(t.entries[0].doneAt.toISOString()).toBe("2026-09-10T00:07:48.750Z");
    expect(t.doneAt.toISOString()).toBe("2026-09-10T04:33:26.250Z");
  });

  it("gives an unknown skill zero time and reports its id", () => {
    const t = planTimeline({
      entries: [{ skillId: 999999, level: 1, note: null, prereq: false }],
      catalogue: CATALOGUE, attributes: ATTRS, trained: new Map(), queued: new Map(), startAt: START,
    });
    expect(t.entries[0]).toMatchObject({ status: "planned", rank: null, levelSp: 0, sp: 0, ms: 0 });
    expect(t.totalMs).toBe(0);
    expect(t.unknownSkillIds).toEqual([999999]);
  });

  it("gives a skill with no attribute pair zero time rather than infinity", () => {
    const t = planTimeline({
      entries: [{ skillId: 7777, level: 1, note: null, prereq: false }],
      catalogue: CATALOGUE, attributes: ATTRS, trained: new Map(), queued: new Map(), startAt: START,
    });
    expect(t.entries[0]).toMatchObject({ sp: 250, spPerMinute: 0, ms: 0 });
    expect(Number.isFinite(t.totalMs)).toBe(true);
  });
});

describe("planDurationMs", () => {
  it("agrees with planTimeline's total", () => {
    expect(planDurationMs({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS, trained: new Map(), queued: new Map(),
    })).toBe(16_406_250);
    expect(planDurationMs({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map([[3300, 2]]), queued: new Map([[3300, 3]]),
    })).toBe(1_406_250);
  });
});
