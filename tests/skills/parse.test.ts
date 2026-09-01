import { describe, it, expect } from "vitest";
import {
  MAX_IMPORT_CHARS, MAX_PLAN_ENTRIES, MAX_PLAN_NAME, clampPlanName, parsePlanCreate,
  parsePlanEntries, parsePlanImport, parsePlanPatch, parseRemap,
} from "../../src/lib/skills/parse.js";

const REMAP = { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 };

describe("parsePlanEntries", () => {
  it("accepts skill ids with levels 1..5 and defaults the note", () => {
    expect(parsePlanEntries([{ skillId: 3300, level: 5 }, { skillId: 3318, level: 1, note: "why" }]))
      .toEqual([{ skillId: 3300, level: 5, note: null }, { skillId: 3318, level: 1, note: "why" }]);
    expect(parsePlanEntries([])).toEqual([]);
  });
  it("rejects bad ids, bad levels, long notes, non-arrays and over-long lists", () => {
    expect(parsePlanEntries([{ skillId: 0, level: 1 }])).toBeNull();
    expect(parsePlanEntries([{ skillId: 3300, level: 0 }])).toBeNull();
    expect(parsePlanEntries([{ skillId: 3300, level: 6 }])).toBeNull();
    expect(parsePlanEntries([{ skillId: 3300, level: 1, note: "x".repeat(201) }])).toBeNull();
    expect(parsePlanEntries("nope")).toBeNull();
    expect(parsePlanEntries(Array.from({ length: MAX_PLAN_ENTRIES + 1 }, () => ({ skillId: 3300, level: 1 })))).toBeNull();
  });
});

describe("parseRemap", () => {
  it("accepts a legal base and an explicit null", () => {
    expect(parseRemap(REMAP)).toEqual(REMAP);
    expect(parseRemap(null)).toBeNull();
  });
  it("rejects an illegal or incomplete distribution", () => {
    expect(parseRemap({ ...REMAP, perception: 28, willpower: 20 })).toBeUndefined();
    expect(parseRemap({ ...REMAP, charisma: 18 })).toBeUndefined();     // sums to 100
    expect(parseRemap({ charisma: 17, intelligence: 17 })).toBeUndefined();
    expect(parseRemap("nope")).toBeUndefined();
  });
});

describe("parsePlanCreate", () => {
  it("requires a character and a name, and defaults the rest", () => {
    expect(parsePlanCreate({ characterId: 669539978, name: " Gunnery " }))
      .toEqual({ characterId: 669539978, name: "Gunnery", entries: [], templateId: null });
  });
  it("takes entries or a template, never both", () => {
    expect(parsePlanCreate({ characterId: 1, name: "x", entries: [{ skillId: 3300, level: 1 }] }))
      .toMatchObject({ entries: [{ skillId: 3300, level: 1, note: null }], templateId: null });
    expect(parsePlanCreate({ characterId: 1, name: "x", templateId: 4 })).toMatchObject({ templateId: 4 });
    expect(parsePlanCreate({ characterId: 1, name: "x", templateId: 4, entries: [] })).toBeNull();
  });
  it("rejects a missing character, an empty or over-long name and a bad template id", () => {
    expect(parsePlanCreate({ name: "x" })).toBeNull();
    expect(parsePlanCreate({ characterId: 1, name: "   " })).toBeNull();
    expect(parsePlanCreate({ characterId: 1, name: "x".repeat(MAX_PLAN_NAME + 1) })).toBeNull();
    expect(parsePlanCreate({ characterId: 1, name: "x", templateId: 0 })).toBeNull();
    expect(parsePlanCreate(null)).toBeNull();
  });
});

describe("parsePlanPatch", () => {
  it("takes any subset and distinguishes an absent key from an explicit null", () => {
    expect(parsePlanPatch({ name: "Renamed" })).toEqual({ name: "Renamed" });
    expect(parsePlanPatch({ remap: null })).toEqual({ remap: null });
    expect(parsePlanPatch({ remap: REMAP })).toEqual({ remap: REMAP });
    expect(parsePlanPatch({ entries: [] })).toEqual({ entries: [] });
    expect(parsePlanPatch({})).toEqual({});
  });
  it("rejects a character id and any malformed field", () => {
    expect(parsePlanPatch({ characterId: 1 })).toBeNull();
    expect(parsePlanPatch({ name: "" })).toBeNull();
    expect(parsePlanPatch({ remap: { charisma: 1 } })).toBeNull();
    expect(parsePlanPatch({ entries: [{ skillId: 3300, level: 9 }] })).toBeNull();
    expect(parsePlanPatch([])).toBeNull();
  });
});

describe("parsePlanImport / clampPlanName", () => {
  it("requires a character, a name and some text", () => {
    expect(parsePlanImport({ characterId: 1, name: "Pasted", text: "Gunnery V\n" }))
      .toEqual({ characterId: 1, name: "Pasted", text: "Gunnery V\n" });
    expect(parsePlanImport({ characterId: 1, name: "Pasted", text: "" })).toBeNull();
    expect(parsePlanImport({ characterId: 1, name: "Pasted", text: "x".repeat(MAX_IMPORT_CHARS + 1) })).toBeNull();
  });
  it("cleans a generated name instead of rejecting it", () => {
    expect(clampPlanName("  Minmatar Militia Fighter\n ")).toBe("Minmatar Militia Fighter");
    expect(clampPlanName("x".repeat(MAX_PLAN_NAME + 20))).toHaveLength(MAX_PLAN_NAME);
    expect(clampPlanName("   ")).toBe("Unnamed plan");
  });
});
