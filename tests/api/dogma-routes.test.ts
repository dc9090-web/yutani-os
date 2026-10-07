import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fixtureData } from "../dogma/fixture.js";

const { loadDogmaData, getSdeMeta } = vi.hoisted(() => ({ loadDogmaData: vi.fn(), getSdeMeta: vi.fn() }));
vi.mock("../../src/lib/dogma/sde-loader.js", () => ({ loadDogmaData }));
vi.mock("../../src/lib/sde/repo.js", () => ({ getSdeMeta }));

const { GET: META } = await import("../../src/app/api/dogma/meta/route.js");
const { GET: TYPES } = await import("../../src/app/api/dogma/types/route.js");

const data = fixtureData("rifter");
const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://eve.example.com${path}`, { headers });

beforeEach(() => {
  vi.resetAllMocks();
  getSdeMeta.mockResolvedValue({
    buildNumber: 3484357, releaseDate: new Date(), importedAt: new Date(),
    counts: { types: 1, dogmaAttributes: 1, dogmaEffects: 1, solarSystems: 1 },
  });
  loadDogmaData.mockResolvedValue(data);
});

describe("GET /api/dogma/meta", () => {
  it("serves the attribute, effect and group maps with a day-long cache and a build ETag", async () => {
    const res = await META(request("/api/dogma/meta"));
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"sde-3484357"');
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const body = await res.json();
    expect(body.build).toBe(3484357);
    expect(body.attributes).toHaveLength(data.attributes.size);
    expect(body.effects).toHaveLength(data.effects.size);
    expect(body.groups).toHaveLength(data.groups.size);
    expect(body.types).toBeUndefined();
    expect(loadDogmaData).toHaveBeenCalledWith([]);
  });

  it("answers 304 when the client already has this build", async () => {
    const res = await META(request("/api/dogma/meta", { "if-none-match": '"sde-3484357"' }));
    expect(res.status).toBe(304);
    expect(loadDogmaData).not.toHaveBeenCalled();
  });

  it("503s when no SDE has been imported", async () => {
    getSdeMeta.mockResolvedValue(null);
    expect((await META(request("/api/dogma/meta"))).status).toBe(503);
  });
});

describe("GET /api/dogma/types", () => {
  it("returns the requested types and the build number", async () => {
    const res = await TYPES(request("/api/dogma/types?ids=587,2889"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.build).toBe(3484357);
    expect(body.types.map((t: { id: number }) => t.id)).toContain(587);
    expect(loadDogmaData).toHaveBeenCalledWith([587, 2889]);
    // Attribute maps travel as entry arrays.
    const rifter = body.types.find((t: { id: number }) => t.id === 587);
    expect(Array.isArray(rifter.attrs)).toBe(true);
  });

  it("rejects a missing, malformed, empty or oversized id list", async () => {
    expect((await TYPES(request("/api/dogma/types"))).status).toBe(400);
    expect((await TYPES(request("/api/dogma/types?ids="))).status).toBe(400);
    expect((await TYPES(request("/api/dogma/types?ids=587,abc"))).status).toBe(400);
    expect((await TYPES(request("/api/dogma/types?ids=0"))).status).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => i + 1).join(",");
    expect((await TYPES(request(`/api/dogma/types?ids=${many}`))).status).toBe(400);
    expect(loadDogmaData).not.toHaveBeenCalled();
  });
});
