import { getPool } from "./client.js";
import type { ZkbKind } from "../combat/zkb.js";

export interface BackfillCursor {
  characterId: number; kind: ZkbKind; nextPage: number; done: boolean; updatedAt: Date;
}
export interface BackfillStatus {
  characterId: number; imported: number; cursors: { kind: ZkbKind; nextPage: number; done: boolean }[];
}

const KINDS: readonly ZkbKind[] = ["kills", "losses"];

/**
 * One cursor per (character, kind), created on first sight and never reset — `DO NOTHING` means a
 * character who has already walked to page 18 stays there. Returns how many rows were created.
 */
export async function ensureBackfillRows(characterIds: number[]): Promise<number> {
  const ids = [...new Set(characterIds)];
  if (ids.length === 0) return 0;
  const pairs = ids.flatMap((id) => KINDS.map((kind) => ({ id, kind })));
  const { rowCount } = await getPool().query(
    `INSERT INTO killmail_backfill (character_id, kind)
     SELECT * FROM unnest($1::bigint[], $2::text[])
     ON CONFLICT (character_id, kind) DO NOTHING`,
    [pairs.map((p) => String(p.id)), pairs.map((p) => p.kind)]);
  return rowCount ?? 0;
}

/** Oldest-first, so the job that spends a fixed page budget starts on the least recently served. */
export async function listUnfinishedBackfill(): Promise<BackfillCursor[]> {
  const { rows } = await getPool().query<{
    characterId: string; kind: ZkbKind; nextPage: number; done: boolean; updatedAt: Date;
  }>(
    `SELECT character_id AS "characterId", kind, next_page AS "nextPage", done,
            updated_at AS "updatedAt"
     FROM killmail_backfill WHERE NOT done
     ORDER BY updated_at, character_id, kind`);
  return rows.map((r) => ({ ...r, characterId: Number(r.characterId) }));
}

export async function advanceBackfill(
  characterId: number, kind: ZkbKind, next: { nextPage: number; done: boolean },
): Promise<void> {
  await getPool().query(
    `UPDATE killmail_backfill SET next_page = $3, done = $4, updated_at = now()
     WHERE character_id = $1 AND kind = $2`,
    [characterId, kind, next.nextPage, next.done]);
}

/**
 * The `/combat` status line (spec §6). `imported` is a count of the character's linked killmails,
 * not a stored counter (Decision 8) — the spec's data model has no such column.
 */
export async function backfillStatus(characterIds: number[]): Promise<BackfillStatus[]> {
  const ids = [...new Set(characterIds)];
  if (ids.length === 0) return [];
  const pool = getPool();
  const [{ rows: cursors }, { rows: counts }] = await Promise.all([
    pool.query<{ characterId: string; kind: ZkbKind; nextPage: number; done: boolean }>(
      `SELECT character_id AS "characterId", kind, next_page AS "nextPage", done
       FROM killmail_backfill WHERE character_id = ANY($1::bigint[]) ORDER BY character_id, kind`,
      [ids.map(String)]),
    pool.query<{ characterId: string; n: number }>(
      `SELECT character_id AS "characterId", count(*)::int AS n
       FROM character_killmails WHERE character_id = ANY($1::bigint[]) GROUP BY character_id`,
      [ids.map(String)]),
  ]);
  const imported = new Map(counts.map((c) => [Number(c.characterId), c.n]));
  return ids.map((id) => ({
    characterId: id,
    imported: imported.get(id) ?? 0,
    cursors: cursors
      .filter((c) => Number(c.characterId) === id)
      .map((c) => ({ kind: c.kind, nextPage: c.nextPage, done: c.done })),
  }));
}
