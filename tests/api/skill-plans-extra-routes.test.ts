import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getPlan, createPlan } = vi.hoisted(() => ({ getPlan: vi.fn(), createPlan: vi.fn() }));
const { getCharacter } = vi.hoisted(() => ({ getCharacter: vi.fn() }));
const { computePlan, loadSkillCatalogue } = vi.hoisted(() => ({ computePlan: vi.fn(), loadSkillCatalogue: vi.fn() }));

vi.mock("../../src/lib/db/skill-plans.js", () => ({ getPlan, createPlan }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/skills/load.js", () => ({ computePlan, loadSkillCatalogue }));

const { POST: OPTIMISE } = await import("../../src/app/api/skill-plans/[id]/optimise/route.js");
const { POST: IMPORT } = await import("../../src/app/api/skill-plans/import/route.js");
const { GET: EXPORT } = await import("../../src/app/api/skill-plans/[id]/export/route.js");

const SKILLS = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
];
const PLAN = {
  id: 7, characterId: 669539978, name: "Gunnery", remap: null,
  createdAt: new Date("2026-09-02T10:00:00Z"), updatedAt: new Date("2026-09-02T10:00:00Z"),
  entries: [{ position: 0, skillId: 3300, level: 3, note: null }],
};
const EXPANDED = [
  { skillId: 3300, level: 1, note: null, prereq: true },
  { skillId: 3300, level: 2, note: null, prereq: true },
  { skillId: 3300, level: 3, note: null, prereq: false },
];
const CONTEXT = {
  base: { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 },
  implantBonus: { charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 },
  trained: new Map([[3300, 1]]), queued: new Map<number, number>(), partialSp: new Map<number, number>(),
};

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (url: string) => new NextRequest(`https://eve.example.com${url}`);
const post = (url: string, value: unknown) =>
  new NextRequest(`https://eve.example.com${url}`,
    { method: "POST", body: JSON.stringify(value), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  getPlan.mockImplementation(async (id: number) => (id === 7 ? PLAN : null));
  createPlan.mockImplementation(async (input: { entries: unknown[] }) => ({ ...PLAN, id: 9, entries: input.entries }));
  getCharacter.mockImplementation(async (id: number) => (id === 669539978 ? { id, name: "TrilliumONE" } : null));
  loadSkillCatalogue.mockResolvedValue(SKILLS);
  computePlan.mockResolvedValue({
    plan: PLAN, context: CONTEXT, catalogue: SKILLS, entries: EXPANDED,
    timeline: {
      entries: EXPANDED.map((e, i) => ({ ...e, status: i === 0 ? "done" : "planned" })),
      totalSp: 7750, totalMs: 14_531_250, doneAt: new Date("2026-09-01T04:02:11Z"), unknownSkillIds: [],
    },
    attributes: CONTEXT.base, startAt: new Date("2026-09-01T00:00:00Z"),
  });
});

describe("POST /api/skill-plans/[id]/optimise", () => {
  it("returns the best legal remap and what it saves", async () => {
    const res = await OPTIMISE(post("/api/skill-plans/7/optimise", {}), ctx("7"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Gunnery is perception/willpower, so the optimum is perception 27 / willpower 21.
    expect(json.remap).toEqual({ charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
    expect(json.candidates).toBe(2885);
    expect(json.savedMs).toBeGreaterThan(0);
    expect(json.totalMs).toBeLessThan(json.currentMs);
  });

  it("400s on a bad id and 404s on an unknown plan", async () => {
    expect((await OPTIMISE(post("/api/skill-plans/x/optimise", {}), ctx("x"))).status).toBe(400);
    expect((await OPTIMISE(post("/api/skill-plans/8/optimise", {}), ctx("8"))).status).toBe(404);
  });
});

describe("POST /api/skill-plans/import", () => {
  it("creates a plan from pasted text and reports what did not resolve", async () => {
    const res = await IMPORT(post("/api/skill-plans/import", {
      characterId: 669539978, name: "Pasted",
      text: "Gunnery V\nSpaceship Command 1\n200mm AutoCannon II\n",
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.plan.entries).toEqual([
      { skillId: 3300, level: 5, note: null }, { skillId: 3327, level: 1, note: null },
    ]);
    expect(json.unresolved).toEqual(["200mm AutoCannon II"]);
  });

  it("reports the overflow instead of silently dropping it", async () => {
    const text = `${Array.from({ length: 505 }, () => "Gunnery 1").join("\n")}\n`;
    const res = await IMPORT(post("/api/skill-plans/import", { characterId: 669539978, name: "Big", text }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.plan.entries).toHaveLength(500);
    expect(json.unresolved).toEqual(["… and 5 more lines (a plan holds at most 500 entries)"]);
  });

  it("400s on a malformed body and 404s on an unknown character", async () => {
    expect((await IMPORT(post("/api/skill-plans/import", { characterId: 669539978, name: "x", text: "" }))).status).toBe(400);
    expect((await IMPORT(post("/api/skill-plans/import", { characterId: 1, name: "x", text: "Gunnery V" }))).status).toBe(404);
  });
});

describe("GET /api/skill-plans/[id]/export", () => {
  it("writes EVEMon text by default, skipping levels already trained", async () => {
    const res = await EXPORT(get("/api/skill-plans/7/export"), ctx("7"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("Gunnery II\nGunnery III\n");
  });

  it("writes the in-game flavour when asked", async () => {
    const res = await EXPORT(get("/api/skill-plans/7/export?format=ingame"), ctx("7"));
    expect(await res.text()).toBe("Gunnery 2\nGunnery 3\n");
  });

  it("400s on an unknown format and 404s on an unknown plan", async () => {
    expect((await EXPORT(get("/api/skill-plans/7/export?format=eft"), ctx("7"))).status).toBe(400);
    expect((await EXPORT(get("/api/skill-plans/8/export"), ctx("8"))).status).toBe(404);
  });
});
