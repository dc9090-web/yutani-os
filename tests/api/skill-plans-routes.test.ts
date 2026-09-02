import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { MAX_PLAN_ENTRIES } from "../../src/lib/skills/parse.js";

const { listPlans, getPlan, createPlan, updatePlan, deletePlan } = vi.hoisted(() => ({
  listPlans: vi.fn(), getPlan: vi.fn(), createPlan: vi.fn(), updatePlan: vi.fn(), deletePlan: vi.fn(),
}));
const { getCharacter } = vi.hoisted(() => ({ getCharacter: vi.fn() }));
const { getCareerPlan } = vi.hoisted(() => ({ getCareerPlan: vi.fn() }));
const { computePlan, summarisePlans } = vi.hoisted(() => ({ computePlan: vi.fn(), summarisePlans: vi.fn() }));

vi.mock("../../src/lib/db/skill-plans.js", () => ({ listPlans, getPlan, createPlan, updatePlan, deletePlan }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/sde/repo.js", () => ({ getCareerPlan }));
vi.mock("../../src/lib/skills/load.js", () => ({ computePlan, summarisePlans }));

const { GET: LIST, POST } = await import("../../src/app/api/skill-plans/route.js");
const { GET: ONE, PUT, DELETE } = await import("../../src/app/api/skill-plans/[id]/route.js");

const PLAN = {
  id: 7, characterId: 669539978, name: "Gunnery", remap: null,
  createdAt: new Date("2026-09-02T10:00:00Z"), updatedAt: new Date("2026-09-02T10:00:00Z"),
  entries: [{ position: 0, skillId: 3300, level: 3, note: null }],
};
const TIMELINE = { entries: [], totalSp: 8000, totalMs: 15_000_000, doneAt: new Date("2026-09-01T04:10:00Z"), unknownSkillIds: [] };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (url: string) => new NextRequest(`https://eve.plasma66.com${url}`);
const body = (url: string, method: string, value: unknown) =>
  new NextRequest(`https://eve.plasma66.com${url}`,
    { method, body: JSON.stringify(value), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  listPlans.mockResolvedValue([PLAN]);
  summarisePlans.mockResolvedValue([{ ...PLAN, entryCount: 3, totalSp: 8000, totalMs: 15_000_000, doneAt: TIMELINE.doneAt }]);
  getPlan.mockImplementation(async (id: number) => (id === 7 ? PLAN : null));
  createPlan.mockResolvedValue(PLAN);
  updatePlan.mockImplementation(async (id: number) => (id === 7 ? PLAN : null));
  deletePlan.mockImplementation(async (id: number) => id === 7);
  getCharacter.mockImplementation(async (id: number) => (id === 669539978 ? { id, name: "TrilliumONE" } : null));
  getCareerPlan.mockImplementation(async (id: number) => {
    if (id === 4) return { id: 4, name: "Minmatar Militia Fighter", description: "", skills: [{ skillId: 3327, level: 1 }], milestones: [] };
    if (id === 5) {
      return {
        id: 5, name: "Oversized", description: "",
        skills: Array.from({ length: MAX_PLAN_ENTRIES + 20 }, (_, i) => ({ skillId: 3300 + i, level: 1 })),
        milestones: [],
      };
    }
    return null;
  });
  computePlan.mockResolvedValue({ plan: PLAN, timeline: TIMELINE, startAt: new Date("2026-09-01T00:00:00Z") });
});

describe("GET /api/skill-plans", () => {
  it("lists a character's plans with their totals", async () => {
    const res = await LIST(get("/api/skill-plans?characterId=669539978"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plans: [{ id: 7, entryCount: 3, totalMs: 15_000_000 }] });
    expect(listPlans).toHaveBeenCalledWith(669539978);
  });

  it("400s without a usable characterId", async () => {
    expect((await LIST(get("/api/skill-plans"))).status).toBe(400);
    expect((await LIST(get("/api/skill-plans?characterId=abc"))).status).toBe(400);
    expect((await LIST(get("/api/skill-plans?characterId=0"))).status).toBe(400);
  });
});

describe("POST /api/skill-plans", () => {
  it("creates a plan from entries", async () => {
    const res = await POST(body("/api/skill-plans", "POST",
      { characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 3 }] }));
    expect(res.status).toBe(201);
    expect(createPlan).toHaveBeenCalledWith({
      characterId: 669539978, name: "Gunnery", entries: [{ skillId: 3300, level: 3, note: null }],
    });
  });

  it("creates a plan from a CCP template", async () => {
    const res = await POST(body("/api/skill-plans", "POST",
      { characterId: 669539978, name: "Militia", templateId: 4 }));
    expect(res.status).toBe(201);
    expect(createPlan).toHaveBeenCalledWith({
      characterId: 669539978, name: "Militia", entries: [{ skillId: 3327, level: 1, note: null }],
    });
  });

  it("clamps an oversized template's skill list to MAX_PLAN_ENTRIES instead of 400ing", async () => {
    const res = await POST(body("/api/skill-plans", "POST",
      { characterId: 669539978, name: "Oversized", templateId: 5 }));
    expect(res.status).toBe(201);
    const call = createPlan.mock.calls[0][0] as { entries: unknown[] };
    expect(call.entries).toHaveLength(MAX_PLAN_ENTRIES);
    expect(call.entries[0]).toEqual({ skillId: 3300, level: 1, note: null });
  });

  it("404s on an unknown character and on an unknown template", async () => {
    expect((await POST(body("/api/skill-plans", "POST", { characterId: 1, name: "x" }))).status).toBe(404);
    expect((await POST(body("/api/skill-plans", "POST", { characterId: 669539978, name: "x", templateId: 99 }))).status).toBe(404);
  });

  it("400s on a malformed body", async () => {
    expect((await POST(body("/api/skill-plans", "POST", { name: "x" }))).status).toBe(400);
    expect((await POST(body("/api/skill-plans", "POST", { characterId: 669539978, name: "x", templateId: 4, entries: [] }))).status).toBe(400);
  });
});

describe("GET /api/skill-plans/[id]", () => {
  it("returns the plan with its computed timeline", async () => {
    const res = await ONE(get("/api/skill-plans/7"), ctx("7"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plan: { id: 7 }, timeline: { totalMs: 15_000_000 } });
    expect(computePlan).toHaveBeenCalledWith(PLAN, { afterQueue: false });
  });

  it("passes afterQueue through", async () => {
    await ONE(get("/api/skill-plans/7?afterQueue=1"), ctx("7"));
    expect(computePlan).toHaveBeenCalledWith(PLAN, { afterQueue: true });
  });

  it("400s on a bad id and 404s on an unknown one", async () => {
    expect((await ONE(get("/api/skill-plans/x"), ctx("x"))).status).toBe(400);
    expect((await ONE(get("/api/skill-plans/8"), ctx("8"))).status).toBe(404);
  });
});

describe("PUT /api/skill-plans/[id]", () => {
  it("replaces the entries and answers with the re-expanded timeline", async () => {
    const res = await PUT(body("/api/skill-plans/7", "PUT", { entries: [{ skillId: 3300, level: 5 }] }), ctx("7"));
    expect(res.status).toBe(200);
    expect(updatePlan).toHaveBeenCalledWith(7, { entries: [{ skillId: 3300, level: 5, note: null }] });
    expect(await res.json()).toMatchObject({ timeline: { totalMs: 15_000_000 } });
  });

  it("400s on a body carrying characterId, 404s on an unknown plan", async () => {
    expect((await PUT(body("/api/skill-plans/7", "PUT", { characterId: 1 }), ctx("7"))).status).toBe(400);
    expect((await PUT(body("/api/skill-plans/8", "PUT", { name: "x" }), ctx("8"))).status).toBe(404);
  });

  it("400s an empty PUT body instead of bumping updated_at for nothing", async () => {
    expect((await PUT(body("/api/skill-plans/7", "PUT", {}), ctx("7"))).status).toBe(400);
    expect(updatePlan).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/skill-plans/[id]", () => {
  it("answers 204, and 404 for an unknown plan", async () => {
    expect((await DELETE(get("/api/skill-plans/7"), ctx("7"))).status).toBe(204);
    expect((await DELETE(get("/api/skill-plans/8"), ctx("8"))).status).toBe(404);
  });
});
