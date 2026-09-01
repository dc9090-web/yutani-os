import { getPool } from "./client.js";
export interface SyncRunSummary { job: string; characterId: number | null; startedAt: Date; finishedAt: Date | null; status: "running" | "ok" | "error"; rows: number | null; error: string | null }

export async function startRun(job: string, characterId: number | null): Promise<number> {
  const { rows } = await getPool().query<{ id: string }>("INSERT INTO sync_runs (job, character_id) VALUES ($1, $2) RETURNING id", [job, characterId]);
  return Number(rows[0].id);
}
export async function finishRun(id: number, r: { status: "ok" | "error"; rows?: number; error?: string }): Promise<void> {
  await getPool().query("UPDATE sync_runs SET finished_at = now(), status = $2, rows = $3, error = $4 WHERE id = $1", [id, r.status, r.rows ?? null, r.error ?? null]);
}
export async function latestRuns(): Promise<SyncRunSummary[]> {
  const { rows } = await getPool().query<SyncRunSummary>(
    `SELECT DISTINCT ON (job, character_id) job, character_id AS "characterId", started_at AS "startedAt", finished_at AS "finishedAt", status, rows, error
     FROM sync_runs ORDER BY job, character_id, started_at DESC`);
  return rows.map((r) => ({ ...r, characterId: r.characterId === null ? null : Number(r.characterId) }));
}
