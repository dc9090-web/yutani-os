import { createHash, randomBytes } from "node:crypto";
import { getPool } from "./client.js";

export interface AppSession { id: number; sub: string; email: string; deviceName: string; createdAt: Date; lastUsedAt: Date | null }

const COLS = `id, google_sub AS sub, email, device_name AS "deviceName", created_at AS "createdAt", last_used_at AS "lastUsedAt"`;
const fix = (r: AppSession): AppSession => ({ ...r, id: Number(r.id) }); // bigserial comes back as a string

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** The token is returned once and never stored; only its hash is. */
export async function createAppSession(a: { sub: string; email: string; deviceName: string }): Promise<{ id: number; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const { rows } = await getPool().query<{ id: string }>(
    "INSERT INTO app_sessions (token_hash, google_sub, email, device_name) VALUES ($1, $2, $3, $4) RETURNING id",
    [hashToken(token), a.sub, a.email, a.deviceName]);
  return { id: Number(rows[0].id), token };
}

/** The live session behind a bearer token, or null for an unknown or revoked one. */
export async function findAppSession(token: string): Promise<AppSession | null> {
  const { rows } = await getPool().query<AppSession>(
    `SELECT ${COLS} FROM app_sessions WHERE token_hash = $1 AND revoked_at IS NULL`, [hashToken(token)]);
  return rows[0] ? fix(rows[0]) : null;
}

/** "Last used" is for the Settings list, so a minute's grain is enough — not a write per request. */
export async function touchAppSession(id: number): Promise<void> {
  await getPool().query(
    "UPDATE app_sessions SET last_used_at = now() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')", [id]);
}

export async function revokeAppSession(id: number): Promise<void> {
  await getPool().query("UPDATE app_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
}

/** Every phone still signed in, newest first. */
export async function listAppSessions(): Promise<AppSession[]> {
  const { rows } = await getPool().query<AppSession>(
    `SELECT ${COLS} FROM app_sessions WHERE revoked_at IS NULL ORDER BY created_at DESC, id DESC`);
  return rows.map(fix);
}
