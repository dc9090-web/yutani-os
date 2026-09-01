import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { browseTypes, listMarketGroups, getMetaGroups } = vi.hoisted(() => ({
  browseTypes: vi.fn(), listMarketGroups: vi.fn(), getMetaGroups: vi.fn(),
}));
vi.mock("../../src/lib/sde/repo.js", () => ({ browseTypes, listMarketGroups, getMetaGroups }));

const { GET: TYPES } = await import("../../src/app/api/sde/types/route.js");
const { GET: GROUPS } = await import("../../src/app/api/sde/market-groups/route.js");

const request = (path: string) => new NextRequest(`https://eve.plasma66.com${path}`);

beforeEach(() => {
  vi.resetAllMocks();
  browseTypes.mockResolvedValue([
    { id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroupId: 2, metaLevel: 5 },
  ]);
  getMetaGroups.mockResolvedValue(new Map([[2, "Tech II"]]));
  listMarketGroups.mockResolvedValue([{ id: 9, parentId: null, name: "Ship Equipment", hasTypes: false }]);
});

describe("GET /api/sde/types", () => {
  it("passes the query, the category list and the limit through, and names the meta group", async () => {
    const res = await TYPES(request("/api/sde/types?q=auto&category=7,8,18,32&limit=50"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      types: [{ id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7,
                marketGroupId: 574, metaGroup: "Tech II", metaLevel: 5 }],
    });
    expect(browseTypes).toHaveBeenCalledWith({ q: "auto", categoryIds: [7, 8, 18, 32], marketGroupId: undefined, limit: 50 });
  });

  it("accepts a market-group-only query and defaults the limit to 50", async () => {
    await TYPES(request("/api/sde/types?marketGroup=574"));
    expect(browseTypes).toHaveBeenCalledWith({ q: undefined, categoryIds: undefined, marketGroupId: 574, limit: 50 });
  });

  it("rejects an empty filter, a bad category, a bad market group and an oversized limit", async () => {
    expect((await TYPES(request("/api/sde/types"))).status).toBe(400);
    expect((await TYPES(request("/api/sde/types?category=abc"))).status).toBe(400);
    expect((await TYPES(request("/api/sde/types?marketGroup=-1"))).status).toBe(400);
    expect((await TYPES(request("/api/sde/types?q=auto&limit=1001"))).status).toBe(400);
    expect(browseTypes).not.toHaveBeenCalled();
  });
});

describe("GET /api/sde/market-groups", () => {
  it("serves the whole tree with a day-long cache", async () => {
    const res = await GROUPS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    await expect(res.json()).resolves.toEqual({
      groups: [{ id: 9, parentId: null, name: "Ship Equipment", hasTypes: false }],
    });
  });
});
