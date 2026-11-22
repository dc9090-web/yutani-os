import { describe, it, expect, vi } from "vitest";
import { createServerStatusJob, REAL_FETCH_STATUS, SERVER_STATUS_INTERVAL_MS } from "../../src/worker/jobs/server-status.js";
import type { EsiClient } from "../../src/lib/esi/client.js";

const esi = {} as EsiClient;

describe("server-status job", () => {
  it("stores the player count, server version and start time from ESI /status", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const job = createServerStatusJob({
      fetchStatus: async () => ({ players: 23456, server_version: "3113402", start_time: "2026-03-14T11:02:00Z" }), upsert,
    });
    expect(await job.run({ esi })).toBe(1);
    expect(upsert).toHaveBeenCalledWith({ players: 23456, serverVersion: "3113402", startTime: new Date("2026-03-14T11:02:00Z") });
    expect(job).toMatchObject({ name: "server-status", scope: "global", intervalMs: SERVER_STATUS_INTERVAL_MS });
  });

  it("stores a count that arrives without the optional fields", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    await createServerStatusJob({ fetchStatus: async () => ({ players: 0 }), upsert }).run({ esi });
    expect(upsert).toHaveBeenCalledWith({ players: 0, serverVersion: null, startTime: null });
  });

  it("fails the run, and stores nothing, when ESI sends no usable count", async () => {
    const upsert = vi.fn();
    const job = createServerStatusJob({ fetchStatus: async () => ({ players: undefined as unknown as number }), upsert });
    await expect(job.run({ esi })).rejects.toThrow(/player count/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("lets an ESI failure (daily downtime) fail the run so the stored count ages out", async () => {
    const upsert = vi.fn();
    const job = createServerStatusJob({ fetchStatus: async () => { throw new Error("ESI 503"); }, upsert });
    await expect(job.run({ esi })).rejects.toThrow("ESI 503");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("asks the public route, with no character and so no token", async () => {
    const get = vi.fn().mockResolvedValue({ data: { players: 5 } });
    expect(await REAL_FETCH_STATUS({ get } as unknown as EsiClient)).toEqual({ players: 5 });
    expect(get).toHaveBeenCalledWith("/status");
  });
});
