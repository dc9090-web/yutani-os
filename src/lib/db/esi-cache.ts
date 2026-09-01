import { getPool } from "./client.js";
export interface CacheEntry { etag: string | null; expiresAt: Date | null; pages: number; body: unknown; lastModified: string | null }

export async function getCached(characterId: number, path: string): Promise<CacheEntry | null> {
  const { rows } = await getPool().query(
    `SELECT etag, expires_at AS "expiresAt", pages, body, last_modified AS "lastModified" FROM esi_cache WHERE character_id = $1 AND path = $2`, [characterId, path]);
  return rows[0] ?? null;
}
export async function putCached(characterId: number, path: string, e: CacheEntry): Promise<void> {
  await getPool().query(
    `INSERT INTO esi_cache (character_id, path, etag, expires_at, pages, body, last_modified, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (character_id, path) DO UPDATE SET etag = EXCLUDED.etag, expires_at = EXCLUDED.expires_at, pages = EXCLUDED.pages, body = EXCLUDED.body, last_modified = EXCLUDED.last_modified, updated_at = now()`,
    [characterId, path, e.etag, e.expiresAt, e.pages, JSON.stringify(e.body), e.lastModified]);
}
