import { describe, it, expect } from "vitest";
import { systemState } from "../../src/lib/view/system.js";
import type { SyncRunSummary } from "../../src/lib/db/sync-runs.js";

function run(partial: Partial<SyncRunSummary>): SyncRunSummary {
  return { job: "skills", characterId: 1, startedAt: new Date("2026-10-01T06:00:00Z"), finishedAt: null, status: "ok", rows: 1, error: null, ...partial };
}

describe("systemState", () => {
  it("is 'none' for both when nothing has run yet", () => {
    expect(systemState([])).toEqual({ sync: "none", esi: "none" });
  });

  it("is ok when every latest run succeeded", () => {
    expect(systemState([run({}), run({ job: "sde-update", characterId: null })])).toEqual({ sync: "ok", esi: "ok" });
  });

  it("reports running ahead of error ahead of ok", () => {
    expect(systemState([run({ status: "error" }), run({ job: "wallet", status: "running" })]).sync).toBe("running");
    expect(systemState([run({ status: "error" }), run({ job: "wallet" })]).sync).toBe("error");
  });

  it("derives the ESI state from character-scoped runs only", () => {
    const runs = [run({ job: "sde-update", characterId: null, status: "error" }), run({})];
    expect(systemState(runs)).toEqual({ sync: "error", esi: "ok" });
    expect(systemState([run({ job: "sde-update", characterId: null })]).esi).toBe("none");
  });

  it("treats a partial-success warning as ok", () => {
    expect(systemState([run({ error: "warn: journal page 3 of 4 timed out" })])).toEqual({ sync: "ok", esi: "ok" });
  });
});
