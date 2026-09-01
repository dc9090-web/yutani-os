import { getPool } from "./client.js";

export type TokenStatus = "ok" | "needs_reauth";
export interface Character {
  id: number; name: string; accountId: number | null;
  corporationId: number | null; corporationName: string | null;
  allianceId: number | null; allianceName: string | null;
  refreshTokenEnc: string; scopes: string[]; tokenStatus: TokenStatus; lastLoginAt: Date | null;
}

const COLS = `id, name, account_id AS "accountId", corporation_id AS "corporationId", corporation_name AS "corporationName",
  alliance_id AS "allianceId", alliance_name AS "allianceName", refresh_token_enc AS "refreshTokenEnc",
  scopes, token_status AS "tokenStatus", last_login_at AS "lastLoginAt"`;

function fix(r: Character): Character { return { ...r, id: Number(r.id) }; } // bigint comes back as string

export async function upsertCharacter(input: { id: number; name: string; refreshTokenEnc: string; scopes: string[] }): Promise<Character> {
  const { rows } = await getPool().query<Character>(
    `INSERT INTO characters (id, name, refresh_token_enc, scopes, last_login_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, refresh_token_enc = EXCLUDED.refresh_token_enc,
       scopes = EXCLUDED.scopes, token_status = 'ok', last_login_at = now(), updated_at = now()
     RETURNING ${COLS}`, [input.id, input.name, input.refreshTokenEnc, input.scopes]);
  return fix(rows[0]);
}
export async function listCharacters(): Promise<Character[]> {
  const { rows } = await getPool().query<Character>(`SELECT ${COLS} FROM characters ORDER BY account_id NULLS LAST, name`);
  return rows.map(fix);
}
export async function getCharacter(id: number): Promise<Character | null> {
  const { rows } = await getPool().query<Character>(`SELECT ${COLS} FROM characters WHERE id = $1`, [id]);
  return rows[0] ? fix(rows[0]) : null;
}
export async function setCharacterAccount(id: number, accountId: number | null): Promise<void> {
  await getPool().query("UPDATE characters SET account_id = $2, updated_at = now() WHERE id = $1", [id, accountId]);
}
export async function updateCharacterInfo(id: number, info: { name: string; corporationId: number; corporationName: string; allianceId: number | null; allianceName: string | null }): Promise<void> {
  await getPool().query(
    `UPDATE characters SET name = $2, corporation_id = $3, corporation_name = $4, alliance_id = $5, alliance_name = $6, updated_at = now() WHERE id = $1`,
    [id, info.name, info.corporationId, info.corporationName, info.allianceId, info.allianceName]);
}
export async function setTokenStatus(id: number, status: TokenStatus): Promise<void> {
  await getPool().query("UPDATE characters SET token_status = $2, updated_at = now() WHERE id = $1", [id, status]);
}
export async function deleteCharacter(id: number): Promise<void> {
  await getPool().query("DELETE FROM characters WHERE id = $1", [id]);
}
