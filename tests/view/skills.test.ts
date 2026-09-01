import { describe, it, expect } from "vitest";
import { attributeViews, queueProgress, ATTRIBUTE_BONUS_ATTR, SKILL_CATEGORY_ID } from "../../src/lib/view/skills.js";

describe("attributeViews", () => {
  const base = { charisma: 20, intelligence: 24, memory: 21, perception: 20, willpower: 21 };

  it("uses dogma attributes 175..179 for the five bonuses", () => {
    expect(ATTRIBUTE_BONUS_ATTR).toEqual({ charisma: 175, intelligence: 176, memory: 177, perception: 178, willpower: 179 });
    expect(SKILL_CATEGORY_ID).toBe(16);
  });

  it("adds every implant's bonus on top of the base value", () => {
    const views = attributeViews(base, [
      new Map([[176, 4]]),              // +4 INT hardwiring
      new Map([[176, 1], [177, 3]]),    // +1 INT, +3 MEM
    ]);
    const int = views.find((v) => v.key === "intelligence")!;
    expect(int).toEqual({ key: "intelligence", label: "Intelligence", base: 24, bonus: 5, total: 29 });
    expect(views.find((v) => v.key === "memory")!.total).toBe(24);
    expect(views.find((v) => v.key === "charisma")!).toEqual({ key: "charisma", label: "Charisma", base: 20, bonus: 0, total: 20 });
  });

  it("returns all five attributes in a stable order with no implants", () => {
    expect(attributeViews(base, []).map((v) => v.key))
      .toEqual(["charisma", "intelligence", "memory", "perception", "willpower"]);
    expect(attributeViews(base, []).every((v) => v.bonus === 0)).toBe(true);
  });
});

describe("queueProgress", () => {
  const start = new Date("2026-08-30T12:00:00Z");
  const finish = new Date("2026-08-31T12:00:00Z");

  it("measures the head entry against the wall clock", () => {
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-08-30T18:00:00Z"))).toBeCloseTo(0.25, 6);
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-08-31T00:00:00Z"))).toBeCloseTo(0.5, 6);
  });

  it("clamps outside the window", () => {
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-08-29T00:00:00Z"))).toBe(0);
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-09-05T00:00:00Z"))).toBe(1);
  });

  it("reads zero for a paused entry, which ESI sends with no dates at all", () => {
    expect(queueProgress({ startDate: null, finishDate: null }, new Date())).toBe(0);
    expect(queueProgress({ startDate: start, finishDate: null }, new Date())).toBe(0);
  });

  it("reads one for a zero-length window rather than dividing by zero", () => {
    expect(queueProgress({ startDate: start, finishDate: start }, new Date())).toBe(1);
  });
});
