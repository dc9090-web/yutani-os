import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getCharacter, fitFromKillmail } = vi.hoisted(() => ({
  getCharacter: vi.fn(), fitFromKillmail: vi.fn(),
}));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/combat/fit.js", () => ({ fitFromKillmail }));

const { POST } = await import("../../src/app/api/fits/from-killmail/route.js");

const CID = 669539978;
const post = (body: unknown) => new NextRequest("https://eve.plasma66.com/api/fits/from-killmail", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID } : null));
  fitFromKillmail.mockResolvedValue({ kind: "ok", fit: { id: 42, name: "Caracal" }, unresolved: [] });
});

describe("POST /api/fits/from-killmail", () => {
  it("creates the fit and answers 201", async () => {
    const res = await POST(post({ killmailId: 120000001, characterId: CID }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ fit: { id: 42, name: "Caracal" }, unresolved: [] });
    expect(fitFromKillmail).toHaveBeenCalledWith(120000001, CID);
  });

  it("accepts a body with no character and builds an All skills V fit", async () => {
    await POST(post({ killmailId: 120000001 }));
    expect(fitFromKillmail).toHaveBeenCalledWith(120000001, null);
  });

  it("400s on a malformed body", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ killmailId: "x" }))).status).toBe(400);
    expect((await POST(post({ killmailId: 0 }))).status).toBe(400);
    expect(fitFromKillmail).not.toHaveBeenCalled();
  });

  it("404s for a character we do not have and for a killmail we do not have", async () => {
    expect((await POST(post({ killmailId: 1, characterId: 999 }))).status).toBe(404);
    fitFromKillmail.mockResolvedValue({ kind: "notFound" });
    expect((await POST(post({ killmailId: 1 }))).status).toBe(404);
  });

  it("400s when the fit could not be built", async () => {
    fitFromKillmail.mockResolvedValue({ kind: "failed" });
    expect((await POST(post({ killmailId: 1 }))).status).toBe(400);
  });
});
