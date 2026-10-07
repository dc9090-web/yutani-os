import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getCharacter, listSkills, listImplants } = vi.hoisted(() => ({
  getCharacter: vi.fn(), listSkills: vi.fn(), listImplants: vi.fn(),
}));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/db/character-skills.js", () => ({ listSkills }));
vi.mock("../../src/lib/db/character-clones.js", () => ({ listImplants }));

const { GET } = await import("../../src/app/api/characters/[id]/skills/route.js");

const CID = 669539978;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => new NextRequest(`https://eve.example.com/api/characters/${CID}/skills`);

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "TrilliumONE" } : null));
  listSkills.mockResolvedValue([
    { skillId: 3426, trainedLevel: 5, activeLevel: 4, skillpoints: 256000 },
    { skillId: 3413, trainedLevel: 4, activeLevel: 4, skillpoints: 45255 },
  ]);
  listImplants.mockResolvedValue([27143]);
});

describe("GET /api/characters/[id]/skills", () => {
  it("returns trained levels and the active clone's implants", async () => {
    const res = await GET(request(), ctx(String(CID)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      skills: [{ skillId: 3426, level: 5 }, { skillId: 3413, level: 4 }],
      implants: [27143],
    });
  });

  it("answers empty lists for a character with nothing synced", async () => {
    listSkills.mockResolvedValue([]);
    listImplants.mockResolvedValue([]);
    await expect((await GET(request(), ctx(String(CID)))).json())
      .resolves.toEqual({ skills: [], implants: [] });
  });

  it("400s on a bad id and 404s on an unknown character", async () => {
    expect((await GET(request(), ctx("nope"))).status).toBe(400);
    expect((await GET(request(), ctx("12345"))).status).toBe(404);
    expect(listSkills).not.toHaveBeenCalled();
  });
});
