import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import {
  PLAN_TEXT_FORMATS, exportPlanText, isPlanTextFormat, levelFromToken, planTextNames,
  resolvePlanLines, tokenisePlanText,
} from "../../src/lib/skills/text.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 11207, name: "Advanced Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 6, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));
const BY_NAME = new Map([["gunnery", 3300], ["advanced weapon upgrades", 11207]]);

describe("levelFromToken", () => {
  it("reads Arabic and Roman levels, case-insensitively", () => {
    expect([1, 2, 3, 4, 5].map((n) => levelFromToken(String(n)))).toEqual([1, 2, 3, 4, 5]);
    expect(["I", "ii", "III", "iv", "V"].map(levelFromToken)).toEqual([1, 2, 3, 4, 5]);
  });
  it("rejects anything else", () => {
    expect(levelFromToken("6")).toBeNull();
    expect(levelFromToken("0")).toBeNull();
    expect(levelFromToken("VI")).toBeNull();
    expect(levelFromToken("Upgrades")).toBeNull();
  });
  it("names the two formats", () => {
    expect(PLAN_TEXT_FORMATS).toEqual(["evemon", "ingame"]);
    expect(isPlanTextFormat("evemon")).toBe(true);
    expect(isPlanTextFormat("eft")).toBe(false);
  });
});

describe("tokenisePlanText", () => {
  it("splits name from level in both flavours", () => {
    expect(tokenisePlanText("Gunnery V\nAdvanced Weapon Upgrades 3\n"))
      .toEqual([
        { name: "Gunnery", level: 5, raw: "Gunnery V" },
        { name: "Advanced Weapon Upgrades", level: 3, raw: "Advanced Weapon Upgrades 3" },
      ]);
  });

  it("treats a bare name as level I", () => {
    expect(tokenisePlanText("Gunnery")).toEqual([{ name: "Gunnery", level: 1, raw: "Gunnery" }]);
  });

  it("unwraps the client's localisation tag and drops the trailing star", () => {
    const text = '<localized hint="宇宙船操作">Spaceship Command*</localized> 2';
    expect(tokenisePlanText(text)).toEqual([
      { name: "Spaceship Command", level: 2, raw: text },
    ]);
  });

  it("skips blanks, remap markers and comments", () => {
    expect(tokenisePlanText("\n***Remap to perception***\n# a note\n// another\nGunnery I\n   \n"))
      .toEqual([{ name: "Gunnery", level: 1, raw: "Gunnery I" }]);
  });

  it("handles CRLF and surrounding whitespace", () => {
    expect(tokenisePlanText("  Gunnery  II  \r\nGunnery III\r\n").map((l) => [l.name, l.level]))
      .toEqual([["Gunnery", 2], ["Gunnery", 3]]);
  });

  it("lists the lower-cased names to resolve, once each", () => {
    expect(planTextNames("Gunnery I\nGUNNERY II\nAdvanced Weapon Upgrades 1\n"))
      .toEqual(["gunnery", "advanced weapon upgrades"]);
  });
});

describe("resolvePlanLines", () => {
  it("resolves case-insensitively and reports the rest verbatim", () => {
    const parsed = resolvePlanLines(tokenisePlanText("gunnery V\nDamage Controll II\n"), BY_NAME);
    expect(parsed.entries).toEqual([{ skillId: 3300, level: 5 }]);
    expect(parsed.unresolved).toEqual(["Damage Controll II"]);
  });
});

describe("exportPlanText", () => {
  const entries = [
    { skillId: 3300, level: 1 }, { skillId: 3300, level: 2 }, { skillId: 11207, level: 1 },
  ];

  it("writes Roman numerals for EVEMon and Arabic digits for the client", () => {
    expect(exportPlanText(entries, CATALOGUE, "evemon"))
      .toBe("Gunnery I\nGunnery II\nAdvanced Weapon Upgrades I\n");
    expect(exportPlanText(entries, CATALOGUE, "ingame"))
      .toBe("Gunnery 1\nGunnery 2\nAdvanced Weapon Upgrades 1\n");
  });

  it("omits a skill the catalogue does not hold", () => {
    expect(exportPlanText([...entries, { skillId: 999999, level: 3 }], CATALOGUE, "ingame"))
      .toBe("Gunnery 1\nGunnery 2\nAdvanced Weapon Upgrades 1\n");
  });

  it("is empty for an empty plan", () => {
    expect(exportPlanText([], CATALOGUE, "evemon")).toBe("");
  });

  it("round-trips through both formats", () => {
    for (const format of PLAN_TEXT_FORMATS) {
      const text = exportPlanText(entries, CATALOGUE, format);
      const parsed = resolvePlanLines(tokenisePlanText(text), BY_NAME);
      expect(parsed.unresolved).toEqual([]);
      expect(parsed.entries).toEqual(entries);
      expect(exportPlanText(parsed.entries, CATALOGUE, format)).toBe(text);
    }
  });
});
