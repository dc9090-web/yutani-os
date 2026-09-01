import { describe, it, expect } from "vitest";
import {
  buildCatalogue, catalogueFrom, skillLabel, skillRate, type CatalogueRow,
} from "../../src/lib/skills/catalogue.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3318, name: "Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 2, primaryAttr: 167, secondaryAttr: 166, prereqs: [{ skillId: 3300, level: 2 }] },
  { id: 4444, name: null, groupId: null, groupName: null, rank: 3, primaryAttr: 165, secondaryAttr: 166, prereqs: [] },
];
const ALPHA = new Map([[3300, 5], [3318, 4]]);
const ATTRS: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };

describe("buildCatalogue", () => {
  it("carries the Alpha cap and names a skill the SDE left unnamed", () => {
    const skills = buildCatalogue(ROWS, ALPHA);
    expect(skills.map((s) => s.id)).toEqual([3300, 3318, 4444]);
    expect(skills[0]).toEqual({
      id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery",
      rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5,
    });
    expect(skills[1].alphaMaxLevel).toBe(4);
    expect(skills[2]).toMatchObject({ name: "Skill 4444", alphaMaxLevel: null });
  });
});

describe("catalogueFrom / skillLabel", () => {
  it("indexes by id and names an id it does not hold", () => {
    const catalogue = catalogueFrom(buildCatalogue(ROWS, ALPHA));
    expect(catalogue.get(3318)?.name).toBe("Weapon Upgrades");
    expect(skillLabel(catalogue, 3318)).toBe("Weapon Upgrades");
    expect(skillLabel(catalogue, 999999)).toBe("Unknown skill (999999)");
  });
});

describe("skillRate", () => {
  it("uses the skill's own primary/secondary pair", () => {
    const catalogue = catalogueFrom(buildCatalogue(ROWS, ALPHA));
    // Gunnery: perception 21 + willpower 22/2 = 32 SP/min.
    expect(skillRate(catalogue.get(3300)!, ATTRS)).toBe(32);
    // Weapon Upgrades: perception 21 + memory 18/2 = 30 SP/min.
    expect(skillRate(catalogue.get(3318)!, ATTRS)).toBe(30);
  });
});
