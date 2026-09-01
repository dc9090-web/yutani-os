import { describe, it, expect } from "vitest";
import { groupByAccount, portraitUrl, toCharacterView } from "../../src/lib/view/characters.js";

const c = (id: number, accountId: number | null) => ({ id, name: `c${id}`, accountId, corporationName: null, allianceName: null, tokenStatus: "ok" as const });

describe("groupByAccount", () => {
  it("groups in account order with Unassigned last and drops empty accounts", () => {
    const g = groupByAccount([c(1, 2), c(2, 1), c(3, null)], [{ id: 1, name: "Main" }, { id: 2, name: "Alt" }, { id: 3, name: "Empty" }]);
    expect(g.map((x) => [x.label, x.characters.map((y) => y.id)])).toEqual([["Main", [2]], ["Alt", [1]], ["Unassigned", [3]]]);
  });
  it("portrait url", () => { expect(portraitUrl(5)).toBe("https://images.evetech.net/characters/5/portrait?size=64"); });
});

describe("toCharacterView", () => {
  it("picks only the CharacterView fields, dropping sensitive/extra fields such as refreshTokenEnc", () => {
    const character = {
      id: 1,
      name: "TrilliumONE",
      accountId: 2,
      corporationId: 99,
      corporationName: "Test Corp",
      allianceId: null,
      allianceName: null,
      refreshTokenEnc: "super-secret-token",
      scopes: ["esi-skills.read_skills.v1"],
      tokenStatus: "ok" as const,
      lastLoginAt: new Date(),
    };
    const view = toCharacterView(character);
    expect(view).toEqual({
      id: 1,
      name: "TrilliumONE",
      accountId: 2,
      corporationName: "Test Corp",
      allianceName: null,
      tokenStatus: "ok",
    });
    expect(view).not.toHaveProperty("refreshTokenEnc");
    expect(view).not.toHaveProperty("scopes");
  });
});
