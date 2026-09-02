import { describe, it, expect } from "vitest";
import { duration } from "../../src/lib/view/format.js";
import { attributePanel, planView, remapSuggestion } from "../../src/lib/view/plan.js";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";
import { planTimeline } from "../../src/lib/skills/timeline.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3413, name: "Power Grid Management", groupId: 272, groupName: "Engineering", rank: 1, primaryAttr: 165, secondaryAttr: 166, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map([[3300, 5]])));
const BASE: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };
const BONUS: AttributeSet = { charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 };
const EFFECTIVE: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 24, willpower: 25 };
const START = new Date("2026-09-01T00:00:00Z");

describe("duration", () => {
  it("prints days, hours and minutes, ending in minutes", () => {
    expect(duration(480_000_000)).toBe("5d 13h 20m");     // 8,000 minutes
    expect(duration(16_406_250)).toBe("4h 33m");           // 273.4375 → 273 minutes
    expect(duration(720_000)).toBe("12m");
    expect(duration(86_400_000)).toBe("1d");
  });
  it("handles the small and the empty cases", () => {
    expect(duration(1000)).toBe("< 1m");
    expect(duration(0)).toBe("0m");
    expect(duration(-5)).toBe("0m");
  });
  it("zero-pads minutes to two digits once a larger unit precedes them", () => {
    expect(duration(101_340_000)).toBe("1d 4h 09m");   // 1,689 minutes: 1 d 4 h 9 m
    expect(duration(11_100_000)).toBe("3h 05m");        // 185 minutes: 3 h 5 m
    expect(duration(300_000)).toBe("5m");                // 5 minutes alone: no larger unit, no padding
  });
});

describe("planView", () => {
  const entries = expandPlan([{ skillId: 3300, level: 3 }], new Map(), CATALOGUE);
  const timeline = planTimeline({
    entries, catalogue: CATALOGUE, attributes: BASE,
    trained: new Map([[3300, 1]]), queued: new Map([[3300, 2]]), startAt: START,
  });

  it("renders one row per level with status, badges and times", () => {
    const view = planView(timeline, CATALOGUE, [{ skillId: 3300, level: 3 }]);
    expect(view.rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(view.rows.map((r) => r.level)).toEqual(["I", "II", "III"]);
    expect(view.rows.map((r) => r.statusLabel)).toEqual(["Done", "In queue", "Planned"]);
    expect(view.rows.map((r) => r.prereq)).toEqual([true, true, false]);
    // Only the requested pair is editable; the two prerequisite rows are not.
    expect(view.rows.map((r) => r.entryIndex)).toEqual([null, null, 0]);
    expect(view.rows.map((r) => r.alpha)).toEqual([true, true, true]);
    expect(view.rows[2]).toMatchObject({ skill: "Gunnery", group: "Gunnery", rank: "×1", unknown: false });
    // Only the planned level costs anything: 6,585 SP at 32 SP/min = 205.78 min.
    expect(view.rows.map((r) => r.time)).toEqual(["—", "—", "3h 26m"]);
    expect(view.rows.map((r) => r.cumulative)).toEqual(["—", "—", "3h 26m"]);
    expect(view.rows[2].doneAt).toBe("2026-09-01 03:25");
  });

  it("totals the remaining work", () => {
    const view = planView(timeline, CATALOGUE);
    expect(view.totals).toMatchObject({ entries: 3, remaining: 1, sp: "6k SP", time: "3h 26m" });
    expect(view.unknownCount).toBe(0);
  });

  it("renders an unknown skill without breaking the totals", () => {
    const unknown = planTimeline({
      entries: [{ skillId: 999999, level: 2, note: null, prereq: false }],
      catalogue: CATALOGUE, attributes: BASE, trained: new Map(), queued: new Map(), startAt: START,
    });
    const view = planView(unknown, CATALOGUE);
    expect(view.rows[0]).toMatchObject({
      skill: "Unknown skill (999999)", rank: "—", unknown: true, time: "—", entryIndex: null,
    });
    expect(view.unknownCount).toBe(1);
  });
});

describe("attributePanel", () => {
  const entries = expandPlan([{ skillId: 3300, level: 3 }, { skillId: 3413, level: 2 }], new Map(), CATALOGUE);
  const timeline = planTimeline({
    entries, catalogue: CATALOGUE, attributes: EFFECTIVE,
    trained: new Map(), queued: new Map(), startAt: START,
  });

  it("shows the breakdown and one rate row per attribute pair the plan uses", () => {
    const panel = attributePanel({
      base: BASE, implantBonus: BONUS, effective: EFFECTIVE,
      bonusRemaps: 2, accruedRemapCooldownDate: null, attributesSane: true,
      timeline, catalogue: CATALOGUE, now: START,
    });
    expect(panel.attributes.map((a) => [a.label, a.base, a.bonus, a.total])).toEqual([
      ["Charisma", 18, 0, 18], ["Intelligence", 20, 0, 20], ["Memory", 18, 0, 18],
      ["Perception", 21, 3, 24], ["Willpower", 22, 3, 25],
    ]);
    // Gunnery: perception 24 + willpower 25/2 = 36.5 SP/min = 2,190 SP/h, over 3 entries.
    // Power Grid Management: intelligence 20 + memory 18/2 = 29 SP/min = 1,740 SP/h, over 2 entries.
    expect(panel.pairs).toEqual([
      { label: "Perception / Willpower", spPerHour: "2,190 SP/h", entries: 3 },
      { label: "Intelligence / Memory", spPerHour: "1,740 SP/h", entries: 2 },
    ]);
    expect(panel.remapAvailable).toBe("available now");
    expect(panel.bonusRemaps).toBe(2);
    expect(panel.sane).toBe(true);
  });
});

describe("remapSuggestion", () => {
  it("shows the deltas and the saving", () => {
    const view = remapSuggestion(BASE, {
      remap: { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 },
      totalMs: 409_600_000, currentMs: 480_000_000, savedMs: 70_400_000, candidates: 2885,
    });
    expect(view.deltas.map((d) => [d.label, d.from, d.to, d.delta])).toEqual([
      ["Charisma", 18, 17, "-1"], ["Intelligence", 20, 17, "-3"], ["Memory", 18, 17, "-1"],
      ["Perception", 21, 27, "+6"], ["Willpower", 22, 21, "-1"],
    ]);
    // 409,600,000 ms = 6,826.67 min → 6,827 min = 4 d (5,760) + 1,067 min = 17 h 47 m.
    expect(view.totalTime).toBe("4d 17h 47m");
    expect(view.currentTime).toBe("5d 13h 20m");
    expect(view.saved).toBe("19h 33m");
    expect(view.alreadyOptimal).toBe(false);
  });

  it("says so when there is nothing to gain", () => {
    const view = remapSuggestion(BASE, {
      remap: BASE, totalMs: 480_000_000, currentMs: 480_000_000, savedMs: 0, candidates: 2885,
    });
    expect(view.alreadyOptimal).toBe(true);
    expect(view.saved).toBe("0m");
  });
});
