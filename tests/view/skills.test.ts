import { describe, it, expect } from "vitest";
import { attributeViews, queueProgress, remapAvailability, ATTRIBUTE_BONUS_ATTR, SKILL_CATEGORY_ID } from "../../src/lib/view/skills.js";

const NOW = new Date("2026-09-01T12:00:00Z");

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

import { groupSkills, implantBonusLabel } from "../../src/lib/view/skills.js";
import type { SkillRow } from "../../src/lib/db/character-skills.js";

describe("groupSkills", () => {
  const skills: SkillRow[] = [
    { skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 },   // Gunnery, group 255
    { skillId: 3301, trainedLevel: 4, activeLevel: 3, skillpoints: 45255 },    // Small Hybrid Turret, group 255
    { skillId: 3426, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 },   // CPU Management, group 1216
    { skillId: 587, trainedLevel: 1, activeLevel: 1, skillpoints: 10 },        // Rifter — a ship, not a skill
    { skillId: 999999, trainedLevel: 1, activeLevel: 1, skillpoints: 10 },     // not in the SDE at all
  ];
  const types = new Map([
    [3300, { name: "Gunnery", groupId: 255 }],
    [3301, { name: "Small Hybrid Turret", groupId: 255 }],
    [3426, { name: "CPU Management", groupId: 1216 }],
    [587, { name: "Rifter", groupId: 25 }],
  ]);
  const groups = new Map([
    [255, { name: "Gunnery", categoryId: 16 }],
    [1216, { name: "Engineering", categoryId: 16 }],
    [25, { name: "Frigate", categoryId: 6 }],
  ]);

  it("groups by sde_groups, sums group SP and sorts by name", () => {
    const grouped = groupSkills(skills, types, groups);
    expect(grouped.map((g) => g.name)).toEqual(["Engineering", "Gunnery"]);
    expect(grouped[1].groupSp).toBe(301255);
    expect(grouped[1].skills.map((s) => s.name)).toEqual(["Gunnery", "Small Hybrid Turret"]);
    expect(grouped[1].skills[1]).toEqual({ skillId: 3301, name: "Small Hybrid Turret", trainedLevel: 4, activeLevel: 3, skillpoints: 45255 });
  });

  it("drops anything outside category 16 and anything the SDE has never heard of", () => {
    const grouped = groupSkills(skills, types, groups);
    expect(grouped.flatMap((g) => g.skills).map((s) => s.skillId)).not.toContain(587);
    expect(grouped.flatMap((g) => g.skills).map((s) => s.skillId)).not.toContain(999999);
  });

  it("returns nothing for an unsynced sheet", () => {
    expect(groupSkills([], types, groups)).toEqual([]);
  });
});

describe("implantBonusLabel", () => {
  it("names the attribute an implant boosts", () => {
    expect(implantBonusLabel(new Map([[176, 5]]))).toBe("+5 Intelligence");
    expect(implantBonusLabel(new Map([[179, 3], [9, 100]]))).toBe("+3 Willpower");
  });
  it("returns null for an implant that boosts none of the five", () => {
    expect(implantBonusLabel(new Map([[9, 100]]))).toBeNull();
    expect(implantBonusLabel(new Map())).toBeNull();
  });
});

describe("remapAvailability", () => {
  it("says available now once the cooldown has elapsed", () => {
    expect(remapAvailability({ bonusRemaps: 0, accruedRemapCooldownDate: new Date("2026-08-30T12:00:00Z") }, NOW)).toBe("available now");
    expect(remapAvailability({ bonusRemaps: 0, accruedRemapCooldownDate: NOW }, NOW)).toBe("available now");   // exactly now counts
  });
  it("gives the relative time while the cooldown is still running", () => {
    expect(remapAvailability({ bonusRemaps: 0, accruedRemapCooldownDate: new Date("2026-09-03T12:00:00Z") }, NOW)).toBe("in 2 days");
  });
  it("says available now with no cooldown on record but a bonus remap banked", () => {
    expect(remapAvailability({ bonusRemaps: 1, accruedRemapCooldownDate: null }, NOW)).toBe("available now");
  });
  it("returns null when there is neither a cooldown nor a bonus remap", () => {
    expect(remapAvailability({ bonusRemaps: 0, accruedRemapCooldownDate: null }, NOW)).toBeNull();
    expect(remapAvailability({ bonusRemaps: null, accruedRemapCooldownDate: null }, NOW)).toBeNull();
  });
});
