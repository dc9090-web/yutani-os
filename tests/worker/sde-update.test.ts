import { describe, it, expect, vi } from "vitest";
import { createSdeUpdateJob, sdeUpdateJob, SDE_UPDATE_INTERVAL_MS, SDE_UPDATE_RETRY_MS, type SdeUpdateDeps } from "../../src/worker/jobs/sde-update.js";
import type { ImportResult } from "../../src/lib/sde/import.js";

const LATEST = { buildNumber: 3484357, releaseDate: new Date("2026-08-28T11:07:12Z") };

function result(buildNumber: number, types: number): ImportResult {
  return { buildNumber, releaseDate: LATEST.releaseDate, counts: { sde_types: types, sde_groups: 1610 } };
}

function deps(over: Partial<SdeUpdateDeps> = {}): { d: SdeUpdateDeps; removed: string[] } {
  const removed: string[] = [];
  const d: SdeUpdateDeps = {
    fetchLatestBuild: vi.fn(async () => LATEST),
    getSdeMeta: vi.fn(async () => null),
    downloadSde: vi.fn(async () => {}),
    importSde: vi.fn(async () => result(3484357, 52863)),
    tmpFile: (buildNumber) => `/tmp/eve-sde-${buildNumber}.zip`,
    removeFile: async (filePath) => { removed.push(filePath); },
    log: () => {},
    ...over,
  };
  return { d, removed };
}

describe("sde-update job", () => {
  it("is a 6-hourly global job", () => {
    expect(sdeUpdateJob.name).toBe("sde-update");
    expect(sdeUpdateJob.scope).toBe("global");
    expect(sdeUpdateJob.intervalMs).toBe(SDE_UPDATE_INTERVAL_MS);
    expect(SDE_UPDATE_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(sdeUpdateJob.retryMs).toBe(SDE_UPDATE_RETRY_MS);
  });

  it("imports on an empty database and returns the sde_types row count", async () => {
    const { d, removed } = deps();
    const rows = await createSdeUpdateJob(d).run({ esi: {} as never });
    expect(rows).toBe(52863);
    expect(d.downloadSde).toHaveBeenCalledWith("/tmp/eve-sde-3484357.zip");
    expect(d.importSde).toHaveBeenCalledWith("/tmp/eve-sde-3484357.zip");
    expect(removed).toEqual(["/tmp/eve-sde-3484357.zip"]);
  });

  it("imports when the stored build differs", async () => {
    const { d } = deps({ getSdeMeta: vi.fn(async () => ({ buildNumber: 3482594 })) });
    expect(await createSdeUpdateJob(d).run({ esi: {} as never })).toBe(52863);
    expect(d.downloadSde).toHaveBeenCalledTimes(1);
  });

  it("skips the download entirely when the stored build already matches", async () => {
    const { d, removed } = deps({ getSdeMeta: vi.fn(async () => ({ buildNumber: 3484357 })) });
    expect(await createSdeUpdateJob(d).run({ esi: {} as never })).toBe(0);
    expect(d.downloadSde).not.toHaveBeenCalled();
    expect(d.importSde).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("propagates a version-poll failure without downloading", async () => {
    const { d } = deps({ fetchLatestBuild: vi.fn(async () => { throw new Error("503 Service Unavailable"); }) });
    await expect(createSdeUpdateJob(d).run({ esi: {} as never })).rejects.toThrow(/503/);
    expect(d.downloadSde).not.toHaveBeenCalled();
  });

  it("deletes the temp file even when the download or import fails", async () => {
    const { d: dl, removed: r1 } = deps({ downloadSde: vi.fn(async () => { throw new Error("connection reset"); }) });
    await expect(createSdeUpdateJob(dl).run({ esi: {} as never })).rejects.toThrow(/connection reset/);
    expect(r1).toEqual(["/tmp/eve-sde-3484357.zip"]);

    const { d: imp, removed: r2 } = deps({ importSde: vi.fn(async () => { throw new Error("zip member not found: types.jsonl"); }) });
    await expect(createSdeUpdateJob(imp).run({ esi: {} as never })).rejects.toThrow(/types\.jsonl/);
    expect(r2).toEqual(["/tmp/eve-sde-3484357.zip"]);
  });

  it("returns 0 rather than undefined when the import reports no sde_types count", async () => {
    const { d } = deps({ importSde: vi.fn(async () => ({ buildNumber: 3484357, releaseDate: LATEST.releaseDate, counts: {} })) });
    expect(await createSdeUpdateJob(d).run({ esi: {} as never })).toBe(0);
  });
});
