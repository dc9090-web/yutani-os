import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { listTags, createTag, deleteTag, setCharacterTags } = vi.hoisted(() => ({
  listTags: vi.fn(), createTag: vi.fn(), deleteTag: vi.fn(), setCharacterTags: vi.fn(),
}));
vi.mock("../../src/lib/db/tags.js", () => ({ listTags, createTag, deleteTag, setCharacterTags }));

const { getCharacter } = vi.hoisted(() => ({ getCharacter: vi.fn() }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));

const { GET: LIST, POST } = await import("../../src/app/api/tags/route.js");
const { DELETE } = await import("../../src/app/api/tags/[id]/route.js");
const { PUT } = await import("../../src/app/api/characters/[id]/tags/route.js");

const TAG = { id: 1, name: "Miner" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new NextRequest("https://eve.plasma66.com/api/tags", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
const put = (body: unknown, url = "https://eve.plasma66.com/api/characters/1/tags") =>
  new NextRequest(url, {
    method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  listTags.mockResolvedValue([TAG]);
  createTag.mockResolvedValue(TAG);
  deleteTag.mockResolvedValue(undefined);
  setCharacterTags.mockResolvedValue(undefined);
  getCharacter.mockImplementation(async (id: number) => (id === 1 ? { id: 1, name: "TrilliumONE" } : null));
});

describe("the tags routes", () => {
  it("lists tags", async () => {
    const res = await LIST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([TAG]);
  });

  it("creates with a 201, trimming the name", async () => {
    const res = await POST(post({ name: "  Miner  " }));
    expect(res.status).toBe(201);
    expect(createTag).toHaveBeenCalledWith("Miner");
    expect(await res.json()).toEqual(TAG);
  });

  it("400s an invalid name", async () => {
    expect((await POST(post({ name: "" }))).status).toBe(400);
    expect((await POST(post({ name: "x".repeat(31) }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect(createTag).not.toHaveBeenCalled();
  });

  it("409s a duplicate name", async () => {
    createTag.mockRejectedValue({ code: "23505" });
    const res = await POST(post({ name: "Miner" }));
    expect(res.status).toBe(409);
  });

  it("deletes with a 204", async () => {
    const res = await DELETE(new NextRequest("https://eve.plasma66.com/api/tags/1"), ctx("1"));
    expect(res.status).toBe(204);
    expect(deleteTag).toHaveBeenCalledWith(1);
  });

  it("400s a delete with a bad id", async () => {
    expect((await DELETE(new NextRequest("https://eve.plasma66.com/api/tags/x"), ctx("x"))).status).toBe(400);
    expect(deleteTag).not.toHaveBeenCalled();
  });

  it("assigns tags to a character with a 204", async () => {
    const res = await PUT(put({ tagIds: [1, 2] }), ctx("1"));
    expect(res.status).toBe(204);
    expect(setCharacterTags).toHaveBeenCalledWith(1, [1, 2]);
  });

  it("404s an unknown character", async () => {
    const res = await PUT(put({ tagIds: [1] }, "https://eve.plasma66.com/api/characters/2/tags"), ctx("2"));
    expect(res.status).toBe(404);
    expect(setCharacterTags).not.toHaveBeenCalled();
  });

  it("400s a bad character id or a non-array tagIds body", async () => {
    expect((await PUT(put({ tagIds: [1] }), ctx("x"))).status).toBe(400);
    expect((await PUT(put({ tagIds: "nope" }), ctx("1"))).status).toBe(400);
    expect((await PUT(put({ tagIds: [1.5] }), ctx("1"))).status).toBe(400);
    expect((await PUT(put({ tagIds: [0] }), ctx("1"))).status).toBe(400);
    expect(setCharacterTags).not.toHaveBeenCalled();
  });
});
