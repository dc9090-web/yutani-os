import { getPool } from "./client.js";

/** ESI's `GET /status`, as stored: the cluster's player count and when the worker last read it. */
export interface ServerStatus { players: number; serverVersion: string | null; startTime: Date | null; fetchedAt: Date }

export async function upsertServerStatus(s: { players: number; serverVersion: string | null; startTime: Date | null }): Promise<void> {
  await getPool().query(
    `INSERT INTO server_status (id, players, server_version, start_time, fetched_at) VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET players = $1, server_version = $2, start_time = $3, fetched_at = now()`,
    [s.players, s.serverVersion, s.startTime]);
}

/** Null until the first successful run of the server-status job. */
export async function getServerStatus(): Promise<ServerStatus | null> {
  const { rows } = await getPool().query<{ players: number; server_version: string | null; start_time: Date | null; fetched_at: Date }>(
    "SELECT players, server_version, start_time, fetched_at FROM server_status WHERE id = 1");
  const r = rows[0];
  return r === undefined ? null : { players: r.players, serverVersion: r.server_version, startTime: r.start_time, fetchedAt: r.fetched_at };
}
