import type { EsiClient } from "../../lib/esi/client.js";
import type { GlobalSyncJob } from "../scheduler.js";
import { upsertServerStatus } from "../../lib/db/server-status.js";

/** Every five minutes: often enough that the count on screen is current, far inside ESI's limits (it caches /status for 30 s). */
export const SERVER_STATUS_INTERVAL_MS = 5 * 60 * 1000;
export const SERVER_STATUS_RETRY_MS = 60 * 1000;

/** ESI `GET /status`. `start_time` and `server_version` are always sent in practice but typed optional here to be safe. */
export interface EsiStatus { players: number; server_version?: string; start_time?: string; vip?: boolean }

export interface ServerStatusDeps {
  fetchStatus: (esi: EsiClient) => Promise<EsiStatus>;
  upsert: typeof upsertServerStatus;
}

/** Public route: no character, so no token and one shared cache row. */
export const REAL_FETCH_STATUS = async (esi: EsiClient): Promise<EsiStatus> => (await esi.get<EsiStatus>("/status")).data;

/**
 * Stores how many pilots are logged in to Tranquility. During daily downtime ESI answers with an
 * error and the run fails; the stored count then ages out of the strip until the cluster is back.
 */
export function createServerStatusJob(deps: ServerStatusDeps): GlobalSyncJob {
  return {
    name: "server-status",
    scope: "global",
    intervalMs: SERVER_STATUS_INTERVAL_MS,
    retryMs: SERVER_STATUS_RETRY_MS,
    async run({ esi }): Promise<number> {
      const status = await deps.fetchStatus(esi);
      if (!Number.isInteger(status.players) || status.players < 0) throw new Error(`ESI /status sent no usable player count: ${JSON.stringify(status.players)}`);
      const start = status.start_time === undefined ? null : new Date(status.start_time);
      await deps.upsert({
        players: status.players,
        serverVersion: status.server_version ?? null,
        startTime: start !== null && !Number.isNaN(start.getTime()) ? start : null,
      });
      return 1;
    },
  };
}

export const serverStatusJob = createServerStatusJob({ fetchStatus: REAL_FETCH_STATUS, upsert: upsertServerStatus });
