import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getCharacter, listCharacters, loadKillmailRows } = vi.hoisted(() => ({
  getCharacter: vi.fn(), listCharacters: vi.fn(), loadKillmailRows: vi.fn(),
}));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter, listCharacters }));
vi.mock("../../src/lib/combat/load.js", () => ({ loadKillmailRows }));

const { GET } = await import("../../src/app/api/characters/[id]/killmails/route.js");

const CID = 669539978;
const OTHER = 2112625428;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (query: string) =>
  new NextRequest(`https://eve.example.com/api/characters/${CID}/killmails${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "A" } : null));
  listCharacters.mockResolvedValue([{ id: CID }, { id: OTHER }]);
  loadKillmailRows.mockResolvedValue({ rows: [{ killmailId: 1 }], hasMore: true });
});

describe("GET /api/characters/[id]/killmails", () => {
  it("returns the next page for one character", async () => {
    const res = await GET(request("?offset=50"), ctx(String(CID)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rows: [{ killmailId: 1 }], hasMore: true });
    expect(loadKillmailRows).toHaveBeenCalledWith([CID], "90d", 50);
  });

  it("defaults the offset to zero and the period to 90d", async () => {
    await GET(request(""), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenCalledWith([CID], "90d", 0);
  });

  it("passes the period through and falls back for a bogus one", async () => {
    await GET(request("?period=1y"), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenCalledWith([CID], "1y", 0);
    await GET(request("?period=forever"), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenLastCalledWith([CID], "90d", 0);
  });

  it("uses every character when all=1", async () => {
    await GET(request("?all=1"), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenCalledWith([CID, OTHER], "90d", 0);
  });

  it("rejects a bad id and a bad offset", async () => {
    expect((await GET(request(""), ctx("nope"))).status).toBe(400);
    expect((await GET(request("?offset=-1"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?offset=abc"), ctx(String(CID)))).status).toBe(400);
    expect(loadKillmailRows).not.toHaveBeenCalled();
  });

  it("404s for a character that does not exist", async () => {
    expect((await GET(request(""), ctx("12345"))).status).toBe(404);
    expect(loadKillmailRows).not.toHaveBeenCalled();
  });
});
