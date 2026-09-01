import { describe, it, expect, vi } from "vitest";
import { Scheduler, type SyncJob } from "../../src/worker/scheduler.js";
import { NeedsReauthError } from "../../src/lib/esi/tokens.js";
import { EsiError } from "../../src/lib/esi/client.js";

function make(jobs: SyncJob[], chars = [{ id: 1, tokenStatus: "ok" }, { id: 2, tokenStatus: "ok" }], markNeedsReauth?: (id: number) => Promise<void>) {
  let t = 0;
  const runs: { job: string; cid: number | null }[] = [];
  const finished: { id: number; status: string; error?: string; rows?: number }[] = [];
  const s = new Scheduler({
    jobs, esi: {} as never, listCharacters: async () => chars,
    startRun: async (job, cid) => { runs.push({ job, cid }); return runs.length; },
    finishRun: async (id, r) => { finished.push({ id, ...r }); },
    now: () => t, staggerMs: 5000, log: () => {}, markNeedsReauth,
  });
  return { s, runs, finished, advance: (ms: number) => { t += ms; } };
}

describe("Scheduler", () => {
  it("staggers first runs and repeats on the interval", async () => {
    const run = vi.fn(async () => 1);
    const { s, runs, advance } = make([{ name: "j", intervalMs: 60_000, run }]);
    expect(await s.tick()).toBe(1);                 // t=0: character 1 due, character 2 due at 5s
    advance(5000); expect(await s.tick()).toBe(1);   // character 2
    advance(1000); expect(await s.tick()).toBe(0);
    advance(54_000); expect(await s.tick()).toBe(1); // t=60s: character 1 again
    expect(runs.map((r) => r.cid)).toEqual([1, 2, 1]);
  });
  it("records errors, keeps going, and skips needs_reauth characters", async () => {
    const run = vi.fn(async ({ characterId }: { characterId: number }) => { if (characterId === 1) throw new Error("boom"); return 3; });
    const { s, finished, advance } = make([{ name: "j", intervalMs: 60_000, run }], [{ id: 1, tokenStatus: "ok" }, { id: 2, tokenStatus: "ok" }, { id: 3, tokenStatus: "needs_reauth" }]);
    await s.tick(); advance(5000); await s.tick(); advance(5000); await s.tick();
    expect(finished).toEqual([{ id: 1, status: "error", error: "boom" }, { id: 2, status: "ok", rows: 3 }]);
  });
  it("treats NeedsReauthError as a quiet error", async () => {
    const run = vi.fn(async () => { throw new NeedsReauthError(1); });
    const { s, finished } = make([{ name: "j", intervalMs: 60_000, run }], [{ id: 1, tokenStatus: "ok" }]);
    await s.tick();
    expect(finished[0].status).toBe("error"); expect(finished[0].error).toMatch(/re-authorisation/);
  });
  it("marks needs_reauth on a 401 EsiError", async () => {
    const run = vi.fn(async () => { throw new EsiError(401, "/x", "nope"); });
    const markNeedsReauth = vi.fn(async () => {});
    const { s, finished } = make([{ name: "j", intervalMs: 60_000, run }], [{ id: 1, tokenStatus: "ok" }], markNeedsReauth);
    await s.tick();
    expect(markNeedsReauth).toHaveBeenCalledWith(1);
    expect(finished[0].status).toBe("error"); expect(finished[0].error).toMatch(/401/);
  });
  it("leaves a 403 EsiError as a plain error, no reauth flag", async () => {
    const run = vi.fn(async () => { throw new EsiError(403, "/x", "forbidden"); });
    const markNeedsReauth = vi.fn(async () => {});
    const { s, finished } = make([{ name: "j", intervalMs: 60_000, run }], [{ id: 1, tokenStatus: "ok" }], markNeedsReauth);
    await s.tick();
    expect(markNeedsReauth).not.toHaveBeenCalled();
    expect(finished[0].status).toBe("error"); expect(finished[0].error).toBe("forbidden");
  });
});
