import { describe, it, expect, vi } from "vitest";
import { createSkillsJob, skillsJob, applyQueueOverlay, SKILLS_INTERVAL_MS, SKILLS_RETRY_MS, type SkillsJobDeps } from "../../src/worker/jobs/skills.js";
import type { SkillsWrite } from "../../src/lib/db/character-skills.js";
import { esiFixture } from "../fixtures/esi.js";
import { EsiUnavailableError } from "../../src/lib/esi/client.js";

const CID = 669539978;
const NOW = Date.parse("2026-09-01T12:00:00Z");
const ALL = ["esi-skills.read_skills.v1", "esi-skills.read_skillqueue.v1"];

function harness(scopes: string[] = ALL, over: Partial<SkillsJobDeps> = {}) {
  const writes: SkillsWrite[] = [];
  const paths: string[] = [];
  const deps: SkillsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceSkills: async (_id, w) => { writes.push(w); return 99; },
    now: () => NOW,
    ...over,
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/skills")) return { data: esiFixture("skills") };
      if (path.endsWith("/skillqueue")) return { data: esiFixture("skillqueue") };
      if (path.endsWith("/attributes")) return { data: esiFixture("attributes") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createSkillsJob(deps), esi, writes, paths };
}

describe("skills job", () => {
  it("is an hourly character job that retries in 10 minutes", () => {
    expect(skillsJob.name).toBe("skills");
    expect(skillsJob.intervalMs).toBe(SKILLS_INTERVAL_MS);
    expect(SKILLS_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(skillsJob.retryMs).toBe(SKILLS_RETRY_MS);
    expect(SKILLS_RETRY_MS).toBe(10 * 60 * 1000);
    expect(skillsJob.scope ?? "character").toBe("character");
  });
  it("fetches all three endpoints and returns the repo's row count", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(99);
    expect(h.paths).toEqual([
      `/characters/${CID}/skillqueue`, `/characters/${CID}/skills`, `/characters/${CID}/attributes`,
    ]);
  });
  it("overlays completed queue entries on top of the stale /skills list", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const written = h.writes[0].skills!;
    // Fixture: /skills says 3426 is level 3 with 8000 SP; queue position 0 finished level 4 in the past.
    expect(written.find((s) => s.skillId === 3426)).toEqual({ skillId: 3426, trainedLevel: 4, activeLevel: 4, skillpoints: 45255 });
    // Queue position 1 finishes in the future, so 3327 is untouched.
    expect(written.find((s) => s.skillId === 3327)).toEqual({ skillId: 3327, trainedLevel: 4, activeLevel: 3, skillpoints: 45255 });
    expect(h.writes[0].summary).toEqual({ totalSp: 47382910, unallocatedSp: 210000 });
  });
  it("stores the paused queue entry's missing dates and SP as null", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const paused = h.writes[0].queue!.find((q) => q.queuePosition === 2)!;
    expect(paused).toEqual({ queuePosition: 2, skillId: 24311, finishedLevel: 3, startDate: null, finishDate: null, levelStartSp: null, levelEndSp: null, trainingStartSp: null });
  });
  it("maps the attributes, keeping the optional remap fields", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].attributes).toEqual({
      charisma: 20, intelligence: 24, memory: 21, perception: 20, willpower: 21,
      bonusRemaps: 2, lastRemapDate: new Date("2025-11-14T09:12:33Z"),
      accruedRemapCooldownDate: new Date("2026-11-14T09:12:33Z"),
    });
  });
  it("treats absent optional attribute fields as null", async () => {
    const h = harness();
    h.esi.get = vi.fn(async (path: string) => {
      if (path.endsWith("/skillqueue")) return { data: [] };
      if (path.endsWith("/skills")) return { data: { total_sp: 10, skills: [] } };
      return { data: { charisma: 20, intelligence: 20, memory: 20, perception: 20, willpower: 20 } };
    });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].summary).toEqual({ totalSp: 10, unallocatedSp: null });
    expect(h.writes[0].attributes).toEqual({
      charisma: 20, intelligence: 20, memory: 20, perception: 20, willpower: 20,
      bonusRemaps: null, lastRemapDate: null, accruedRemapCooldownDate: null,
    });
  });
  it("skips the queue when its scope is missing but still syncs skills and attributes", async () => {
    const h = harness(["esi-skills.read_skills.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/skills`, `/characters/${CID}/attributes`]);
    expect(h.writes[0].queue).toBeNull();
    expect(h.writes[0].skills).not.toBeNull();
  });
  it("syncs only the queue when the skills scope is missing", async () => {
    const h = harness(["esi-skills.read_skillqueue.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/skillqueue`]);
    expect(h.writes[0].skills).toBeNull();
    expect(h.writes[0].summary).toBeNull();
    expect(h.writes[0].attributes).toBeNull();
  });
  it("returns 0 without calling ESI when neither scope is granted", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
    expect(h.writes).toEqual([]);
  });
  it("lets an ESI outage propagate so the scheduler records it", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/skillqueue", NOW + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
  });
});

describe("applyQueueOverlay", () => {
  const base = [{ skillId: 3300, trainedLevel: 4, activeLevel: 4, skillpoints: 45255 }];
  const entry = (over: Partial<{ queuePosition: number; skillId: number; finishedLevel: number; finishDate: Date | null; levelEndSp: number | null }>) => ({
    queuePosition: 0, skillId: 3300, finishedLevel: 5, startDate: null, finishDate: new Date(NOW - 1000),
    levelStartSp: null, levelEndSp: 256000, trainingStartSp: null, ...over,
  });

  it("applies only entries whose finish date has passed", () => {
    expect(applyQueueOverlay(base, [entry({ finishDate: new Date(NOW + 1000) })], NOW)).toEqual(base);
    expect(applyQueueOverlay(base, [entry({})], NOW)).toEqual([{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 }]);
  });
  it("ignores a paused entry with no finish date", () => {
    expect(applyQueueOverlay(base, [entry({ finishDate: null })], NOW)).toEqual(base);
  });
  it("adds a skill /skills has never heard of", () => {
    const out = applyQueueOverlay([], [entry({ skillId: 3426, finishedLevel: 1, levelEndSp: 250 })], NOW);
    expect(out).toEqual([{ skillId: 3426, trainedLevel: 1, activeLevel: 1, skillpoints: 250 }]);
  });
  it("keeps the highest active level and applies queue entries in position order", () => {
    const out = applyQueueOverlay(
      [{ skillId: 3300, trainedLevel: 3, activeLevel: 3, skillpoints: 8000 }],
      [entry({ queuePosition: 1, finishedLevel: 5, levelEndSp: 256000 }), entry({ queuePosition: 0, finishedLevel: 4, levelEndSp: 45255 })],
      NOW);
    expect(out).toEqual([{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 }]);
  });
  it("keeps the stored skillpoints when the queue entry has no level_end_sp", () => {
    expect(applyQueueOverlay(base, [entry({ levelEndSp: null })], NOW))
      .toEqual([{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 45255 }]);
  });
  it("returns skills sorted by skill id", () => {
    const out = applyQueueOverlay(
      [{ skillId: 3327, trainedLevel: 1, activeLevel: 1, skillpoints: 250 }],
      [entry({ skillId: 3300 })], NOW);
    expect(out.map((s) => s.skillId)).toEqual([3300, 3327]);
  });
});
