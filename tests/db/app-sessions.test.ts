import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createAppSession, findAppSession, hashToken, listAppSessions, revokeAppSession, touchAppSession } from "../../src/lib/db/app-sessions.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);
beforeEach(async () => { await pool.query("TRUNCATE app_sessions RESTART IDENTITY"); });

const phone = { sub: "g-1", email: "owner@example.com", deviceName: "Pixel 9" };

describe("the app sessions repo", () => {
  it("stores only the SHA-256 of the token", async () => {
    const { token } = await createAppSession(phone);
    const { rows } = await pool.query("SELECT * FROM app_sessions");
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(hashToken(token));
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows[0])).not.toContain(token);
  });

  it("finds a session by its token and nothing by another", async () => {
    const { id, token } = await createAppSession(phone);
    expect(await findAppSession(token)).toMatchObject({ id, sub: "g-1", email: "owner@example.com", deviceName: "Pixel 9", lastUsedAt: null });
    expect(await findAppSession(`${token}x`)).toBeNull();
    expect(await findAppSession("")).toBeNull();
  });

  it("gives every session its own token", async () => {
    const a = await createAppSession(phone);
    const b = await createAppSession(phone);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);     // 32 random bytes
  });

  it("a revoked session is not found and not listed", async () => {
    const kept = await createAppSession({ ...phone, deviceName: "Tablet" });
    const gone = await createAppSession(phone);
    await revokeAppSession(gone.id);
    expect(await findAppSession(gone.token)).toBeNull();
    expect((await listAppSessions()).map((s) => s.deviceName)).toEqual(["Tablet"]);
    expect(await findAppSession(kept.token)).not.toBeNull();
  });

  it("records last use, at most once a minute", async () => {
    const { id, token } = await createAppSession(phone);
    await touchAppSession(id);
    const first = (await findAppSession(token))!.lastUsedAt!;
    expect(first).toBeInstanceOf(Date);
    await touchAppSession(id);
    expect((await findAppSession(token))!.lastUsedAt!.getTime()).toBe(first.getTime());
    await pool.query("UPDATE app_sessions SET last_used_at = now() - interval '2 minutes'");
    await touchAppSession(id);
    expect((await findAppSession(token))!.lastUsedAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});
