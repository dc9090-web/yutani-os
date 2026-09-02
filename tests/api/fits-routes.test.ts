import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { clampFitName, parseFitCreate, parseFitItems, parseFitPatch } from "../../src/lib/fits/parse.js";

const { listFits, getFit, createFit, updateFit, deleteFit } = vi.hoisted(() => ({
  listFits: vi.fn(), getFit: vi.fn(), createFit: vi.fn(), updateFit: vi.fn(), deleteFit: vi.fn(),
}));
vi.mock("../../src/lib/db/fits.js", () => ({ listFits, getFit, createFit, updateFit, deleteFit }));

const { GET: LIST, POST } = await import("../../src/app/api/fits/route.js");
const { GET: ONE, PUT, DELETE } = await import("../../src/app/api/fits/[id]/route.js");

const GUN = { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" };
const FIT = {
  id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: 669539978,
  createdAt: new Date("2026-09-02T10:00:00Z"), updatedAt: new Date("2026-09-02T10:00:00Z"), items: [GUN],
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new NextRequest("https://eve.plasma66.com/api/fits", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
const put = (body: unknown) =>
  new NextRequest("https://eve.plasma66.com/api/fits/1", {
    method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  listFits.mockResolvedValue([FIT]);
  getFit.mockImplementation(async (id: number) => (id === 1 ? FIT : null));
  createFit.mockResolvedValue(FIT);
  updateFit.mockImplementation(async (id: number) => (id === 1 ? FIT : null));
  deleteFit.mockImplementation(async (id: number) => id === 1);
});

describe("parseFitItems", () => {
  it("accepts slot, drone-bay and cargo flags", () => {
    expect(parseFitItems([
      GUN,
      { typeId: 2456, quantity: 5, flag: "DroneBay", chargeTypeId: null, state: "active" },
      { typeId: 12608, quantity: 600, flag: "Cargo", chargeTypeId: null, state: "active" },
    ])).toHaveLength(3);
  });
  it("defaults quantity, charge and state", () => {
    expect(parseFitItems([{ typeId: 2889, flag: "HiSlot0" }]))
      .toEqual([{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" }]);
  });
  it("rejects a bad flag, a bad state, a bad type id and a non-array", () => {
    expect(parseFitItems([{ typeId: 2889, flag: "Nonsense" }])).toBeNull();
    expect(parseFitItems([{ typeId: 2889, flag: "HiSlot0", state: "melted" }])).toBeNull();
    expect(parseFitItems([{ typeId: 0, flag: "HiSlot0" }])).toBeNull();
    expect(parseFitItems([{ typeId: 2889, flag: "HiSlot0", quantity: 0 }])).toBeNull();
    expect(parseFitItems("nope")).toBeNull();
    expect(parseFitItems(Array.from({ length: 201 }, () => ({ typeId: 1, flag: "Cargo" })))).toBeNull();
  });
  it("rejects two items on the same slot flag, but allows drone bay and cargo to repeat", () => {
    expect(parseFitItems([
      { typeId: 2889, flag: "HiSlot0" }, { typeId: 2889, flag: "HiSlot0" },
    ])).toBeNull();
    expect(parseFitItems([
      { typeId: 2456, quantity: 5, flag: "DroneBay" }, { typeId: 2454, quantity: 5, flag: "DroneBay" },
    ])).toHaveLength(2);
    expect(parseFitItems([
      { typeId: 12608, quantity: 200, flag: "Cargo" }, { typeId: 12609, quantity: 100, flag: "Cargo" },
    ])).toHaveLength(2);
  });
});

describe("parseFitCreate / parseFitPatch", () => {
  it("requires a name and a hull, and defaults the rest", () => {
    expect(parseFitCreate({ name: "  Cheap Rifter ", shipTypeId: 587 }))
      .toEqual({ name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: null, items: [] });
    expect(parseFitCreate({ shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "", shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "x".repeat(61), shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "ok", shipTypeId: "587" })).toBeNull();
  });

  it("rejects a name that would break an EFT header: newline, carriage return or ]", () => {
    expect(parseFitCreate({ name: "Line\nBreak", shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "Carriage\rReturn", shipTypeId: 587 })).toBeNull();
    expect(parseFitCreate({ name: "Closing]Bracket", shipTypeId: 587 })).toBeNull();
    expect(parseFitPatch({ name: "Closing]Bracket" })).toBeNull();
  });

  it("tells an absent characterId from an explicit null", () => {
    expect(parseFitPatch({ name: "New" })).toEqual({ name: "New" });
    expect(parseFitPatch({ characterId: null })).toEqual({ characterId: null });
    expect(parseFitPatch({ characterId: 669539978 })).toEqual({ characterId: 669539978 });
    expect(parseFitPatch({ characterId: 0 })).toBeNull();
  });
  it("rejects an empty patch — no recognised field means nothing to update", () => {
    expect(parseFitPatch({})).toBeNull();
  });
});

describe("clampFitName", () => {
  it("trims and passes a plain name through untouched", () => {
    expect(clampFitName("  Cheap Rifter  ")).toBe("Cheap Rifter");
  });
  it("caps a long name at MAX_FIT_NAME", () => {
    const clamped = clampFitName("x".repeat(100));
    expect(clamped).toBe("x".repeat(60));
    expect(clamped.length).toBe(60);
  });
  it("strips newlines, carriage returns and ] so the result stays EFT-header-safe", () => {
    expect(clampFitName("Line\nBreak")).toBe("LineBreak");
    expect(clampFitName("Carriage\rReturn")).toBe("CarriageReturn");
    expect(clampFitName("Closing]Bracket]")).toBe("ClosingBracket");
  });
  it("falls back to a placeholder when nothing survives", () => {
    expect(clampFitName("")).toBe("Unnamed fit");
    expect(clampFitName("   ")).toBe("Unnamed fit");
    expect(clampFitName("\n\r]")).toBe("Unnamed fit");
  });
});

describe("the fits routes", () => {
  it("lists and reads", async () => {
    const list = await LIST();
    expect(list.status).toBe(200);
    expect((await list.json()).fits).toHaveLength(1);
    const one = await ONE(new NextRequest("https://eve.plasma66.com/api/fits/1"), ctx("1"));
    expect((await one.json()).fit.name).toBe("Cheap Rifter");
  });

  it("creates with a 201 and passes the parsed body through", async () => {
    const res = await POST(post({ name: "Cheap Rifter", shipTypeId: 587, characterId: 669539978, items: [GUN] }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: 669539978, items: [GUN],
    });
  });

  it("replaces the items wholesale on PUT", async () => {
    const res = await PUT(put({ name: "Renamed", items: [] }), ctx("1"));
    expect(res.status).toBe(200);
    expect(updateFit).toHaveBeenCalledWith(1, { name: "Renamed", items: [] });
  });

  it("deletes with a 204", async () => {
    expect((await DELETE(new NextRequest("https://eve.plasma66.com/api/fits/1"), ctx("1"))).status).toBe(204);
  });

  it("400s on bad ids and bad bodies, 404s on unknown fits", async () => {
    expect((await ONE(new NextRequest("https://eve.plasma66.com/api/fits/x"), ctx("x"))).status).toBe(400);
    expect((await ONE(new NextRequest("https://eve.plasma66.com/api/fits/2"), ctx("2"))).status).toBe(404);
    expect((await POST(post({ shipTypeId: 587 }))).status).toBe(400);
    expect((await PUT(put({ items: "nope" }), ctx("1"))).status).toBe(400);
    expect((await PUT(put({ name: "x" }), ctx("2"))).status).toBe(404);
    expect((await DELETE(new NextRequest("https://eve.plasma66.com/api/fits/2"), ctx("2"))).status).toBe(404);
  });

  it("400s an empty PUT body instead of bumping updated_at for nothing", async () => {
    expect((await PUT(put({}), ctx("1"))).status).toBe(400);
    expect(updateFit).not.toHaveBeenCalled();
  });

  it("400s on a body that is not JSON at all", async () => {
    const broken = new NextRequest("https://eve.plasma66.com/api/fits", {
      method: "POST", body: "{", headers: { "content-type": "application/json" },
    });
    expect((await POST(broken)).status).toBe(400);
  });
});
