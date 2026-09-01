import { describe, it, expect, vi } from "vitest";
import { characterInfoJob } from "../../src/worker/jobs/character-info.js";

vi.mock("../../src/lib/db/characters.js", () => ({ updateCharacterInfo: vi.fn(async () => {}) }));
import { updateCharacterInfo } from "../../src/lib/db/characters.js";

describe("character-info job", () => {
  it("fetches character, corporation and alliance names", async () => {
    const get = vi.fn(async (path: string) => {
      if (path === "/characters/1") return { data: { name: "T", corporation_id: 98, alliance_id: 99 } };
      if (path === "/corporations/98") return { data: { name: "Corp" } };
      if (path === "/alliances/99") return { data: { name: "Ally" } };
      throw new Error(path);
    });
    const rows = await characterInfoJob.run({ characterId: 1, esi: { get } as never });
    expect(rows).toBe(1);
    expect(updateCharacterInfo).toHaveBeenCalledWith(1, { name: "T", corporationId: 98, corporationName: "Corp", allianceId: 99, allianceName: "Ally" });
    expect(characterInfoJob.intervalMs).toBe(6 * 60 * 60 * 1000);
  });
  it("handles no alliance", async () => {
    const get = vi.fn(async (path: string) => path === "/characters/1" ? { data: { name: "T", corporation_id: 98 } } : { data: { name: "Corp" } });
    await characterInfoJob.run({ characterId: 1, esi: { get } as never });
    expect(updateCharacterInfo).toHaveBeenLastCalledWith(1, { name: "T", corporationId: 98, corporationName: "Corp", allianceId: null, allianceName: null });
  });
});
