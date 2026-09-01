import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_ATTR, ATTRIBUTE_KEYS, ATTRIBUTE_KEY_BY_ATTR, BASE_ATTRIBUTE, FREE_POINTS,
  MAX_REMAP_POINTS, TOTAL_ATTRIBUTE_POINTS, addAttributes, effectiveAttributes, enumerateBases,
  implantBonuses, isLegalBase, spPerMinute, type AttributeSet,
} from "../../src/lib/skills/attributes.js";

const BASE: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };

describe("constants", () => {
  it("names the five attribute ids in EVE's order", () => {
    expect(ATTRIBUTE_KEYS).toEqual(["charisma", "intelligence", "memory", "perception", "willpower"]);
    expect(ATTRIBUTE_ATTR).toEqual({ charisma: 164, intelligence: 165, memory: 166, perception: 167, willpower: 168 });
    expect(ATTRIBUTE_KEY_BY_ATTR.get(167)).toBe("perception");
    expect(ATTRIBUTE_KEY_BY_ATTR.get(999)).toBeUndefined();
    expect([BASE_ATTRIBUTE, FREE_POINTS, MAX_REMAP_POINTS, TOTAL_ATTRIBUTE_POINTS]).toEqual([17, 14, 10, 99]);
    // 5 * 17 + 14 = 99 — the two ways the wiki states it are the same statement.
    expect(BASE_ATTRIBUTE * 5 + FREE_POINTS).toBe(TOTAL_ATTRIBUTE_POINTS);
  });
});

describe("implants", () => {
  it("sums attributes 175-179 across the plugged implants", () => {
    // Ocular Filter - Basic (+3 perception) and Neural Boost - Basic (+3 willpower).
    const implants = [new Map([[178, 3], [331, 1]]), new Map([[179, 3], [331, 3]])];
    expect(implantBonuses(implants)).toEqual(
      { charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 });
    expect(effectiveAttributes(BASE, implants)).toEqual(
      { charisma: 18, intelligence: 20, memory: 18, perception: 24, willpower: 25 });
  });

  it("ignores a hardwiring with no attribute bonus", () => {
    expect(implantBonuses([new Map([[202, 5], [331, 6]])]))
      .toEqual({ charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 });
  });

  it("adds two sets attribute by attribute", () => {
    expect(addAttributes(BASE, { charisma: 1, intelligence: 0, memory: 0, perception: 5, willpower: 0 }))
      .toEqual({ charisma: 19, intelligence: 20, memory: 18, perception: 26, willpower: 22 });
  });
});

describe("spPerMinute", () => {
  it("is primary + secondary / 2", () => {
    // Gunnery is perception (167) primary, willpower (168) secondary: 21 + 22/2 = 32.
    expect(spPerMinute(BASE, 167, 168)).toBe(32);
    // Power Grid Management is intelligence (165) / memory (166): 20 + 18/2 = 29.
    expect(spPerMinute(BASE, 165, 166)).toBe(29);
  });
  it("is zero when either attribute id is unknown", () => {
    expect(spPerMinute(BASE, 0, 168)).toBe(0);
    expect(spPerMinute(BASE, 167, 999)).toBe(0);
  });
});

describe("legal bases", () => {
  it("accepts 17..27 summing to 99 and rejects everything else", () => {
    expect(isLegalBase(BASE)).toBe(true);
    expect(isLegalBase({ charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 })).toBe(true);
    expect(isLegalBase({ charisma: 16, intelligence: 18, memory: 17, perception: 27, willpower: 21 })).toBe(false);
    expect(isLegalBase({ charisma: 17, intelligence: 17, memory: 17, perception: 28, willpower: 20 })).toBe(false);
    expect(isLegalBase({ charisma: 17, intelligence: 17, memory: 17, perception: 17, willpower: 17 })).toBe(false);
  });

  it("enumerates every legal distribution once, in perception-first order", () => {
    const bases = enumerateBases();
    expect(bases).toHaveLength(2885);
    for (const base of bases) expect(isLegalBase(base)).toBe(true);
    expect(new Set(bases.map((b) => JSON.stringify(b))).size).toBe(2885);
    // The walk is perception outermost, ascending, and charisma takes the remainder, so the first
    // legal tuple is per=0 wil=0 int=0 mem=4 (charisma would be 14, over the +10 cap, until then).
    expect(bases[0]).toEqual({ charisma: 27, intelligence: 17, memory: 21, perception: 17, willpower: 17 });
    expect(bases[bases.length - 1]).toEqual({ charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
  });
});
