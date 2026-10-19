import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { setMultiview } = vi.hoisted(() => ({ setMultiview: vi.fn() }));
vi.mock("../../src/lib/db/multiview.js", () => ({ setMultiview }));
const { listCharacters } = vi.hoisted(() => ({ listCharacters: vi.fn() }));
vi.mock("../../src/lib/db/characters.js", () => ({ listCharacters }));

const { PUT } = await import("../../src/app/api/multiview/route.js");

const put = (body: unknown) =>
  new NextRequest("https://eve.example.com/api/multiview", {
    method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  setMultiview.mockResolvedValue(undefined);
  listCharacters.mockResolvedValue([{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }]);
});

describe("PUT /api/multiview", () => {
  it("saves the ids in the order given", async () => {
    const res = await PUT(put({ characterIds: [3, 1] }));
    expect(res.status).toBe(204);
    expect(setMultiview).toHaveBeenCalledWith([3, 1]);
  });

  it("400s an empty, malformed or repeated list", async () => {
    for (const body of [{ characterIds: [] }, {}, { characterIds: ["1"] }, { characterIds: [1, 1] }, { characterIds: [0] }]) {
      expect((await PUT(put(body))).status).toBe(400);
    }
    expect(setMultiview).not.toHaveBeenCalled();
  });

  it("400s an unknown character", async () => {
    expect((await PUT(put({ characterIds: [1, 99] }))).status).toBe(400);
    expect(setMultiview).not.toHaveBeenCalled();
  });
});
