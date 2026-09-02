import { describe, it, expect } from "vitest";
import { ALL_JOBS } from "../../src/worker/jobs/index.js";
import type { CharacterSyncJob, GlobalSyncJob, SyncJob } from "../../src/worker/scheduler.js";

const isGlobal = (j: SyncJob): j is GlobalSyncJob => j.scope === "global";

describe("worker job registration", () => {
  it("registers the two global jobs plus the eight character jobs, globals first", () => {
    expect(ALL_JOBS.map((j) => j.name)).toEqual([
      "sde-update", "market-prices", "character-info", "skills", "clones", "assets", "fittings",
      "wallet", "location", "killmails",
    ]);
    expect(ALL_JOBS[0].scope).toBe("global");
    expect(ALL_JOBS[1].scope).toBe("global");
  });
  it("gives every job a unique name, a positive interval and a shorter retry", () => {
    expect(new Set(ALL_JOBS.map((j) => j.name)).size).toBe(ALL_JOBS.length);
    for (const job of ALL_JOBS) {
      expect(job.intervalMs).toBeGreaterThan(0);
      expect(job.retryMs).toBeGreaterThan(0);
      expect(job.retryMs!).toBeLessThan(job.intervalMs);
    }
  });
  it("uses the intervals from the spec's job table", () => {
    const byName = new Map(ALL_JOBS.map((j) => [j.name, j.intervalMs]));
    expect(byName.get("skills")).toBe(60 * 60 * 1000);
    expect(byName.get("assets")).toBe(60 * 60 * 1000);
    expect(byName.get("wallet")).toBe(60 * 60 * 1000);
    expect(byName.get("clones")).toBe(6 * 60 * 60 * 1000);
    expect(byName.get("fittings")).toBe(6 * 60 * 60 * 1000);
    expect(byName.get("character-info")).toBe(6 * 60 * 60 * 1000);
    expect(byName.get("location")).toBe(15 * 60 * 1000);
    expect(byName.get("market-prices")).toBe(60 * 60 * 1000);
    expect(byName.get("killmails")).toBe(60 * 60 * 1000);
  });
  it("marks exactly two jobs global; the other eight run per character", () => {
    expect(ALL_JOBS.filter(isGlobal)).toHaveLength(2);
    const characterJobs = ALL_JOBS.filter((j): j is CharacterSyncJob => !isGlobal(j));
    expect(characterJobs).toHaveLength(8);
    for (const job of characterJobs) expect(job.scope ?? "character").toBe("character");
  });
});
