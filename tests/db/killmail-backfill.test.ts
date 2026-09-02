import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import {
  advanceBackfill, backfillStatus, ensureBackfillRows, listUnfinishedBackfill,
} from "../../src/lib/db/killmail-backfill.js";

let pool: Pool;
const A = 669539978;
const B = 2112625428;

beforeAll(async () => {
  pool = await resetDb();
  await pool.query(
    "INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'A', 'e'), ($2, 'B', 'e')", [A, B]);
}, 60_000);
afterAll(closePool);

describe("killmail backfill cursors", () => {
  it("creates one kills row and one losses row per character, at page 1", async () => {
    expect(await ensureBackfillRows([A, B])).toBe(4);
    const cursors = await listUnfinishedBackfill();
    expect(cursors).toHaveLength(4);
    expect(cursors.every((c) => c.nextPage === 1 && !c.done)).toBe(true);
    expect(cursors.map((c) => c.kind).sort()).toEqual(["kills", "kills", "losses", "losses"]);
  });

  it("is idempotent and never resets a cursor that has moved", async () => {
    await advanceBackfill(A, "kills", { nextPage: 18, done: false });
    expect(await ensureBackfillRows([A, B])).toBe(0);
    const cursor = (await listUnfinishedBackfill()).find((c) => c.characterId === A && c.kind === "kills");
    expect(cursor?.nextPage).toBe(18);
  });

  it("drops a finished cursor out of the unfinished list", async () => {
    await advanceBackfill(A, "losses", { nextPage: 4, done: true });
    const cursors = await listUnfinishedBackfill();
    expect(cursors).toHaveLength(3);
    expect(cursors.some((c) => c.characterId === A && c.kind === "losses")).toBe(false);
  });

  it("orders the unfinished cursors oldest-first so a run starts where the last one left off", async () => {
    const cursors = await listUnfinishedBackfill();
    expect(cursors[0].characterId).toBe(B);      // B has never been advanced
  });

  it("reports the status line's numbers: imported count and per-kind page", async () => {
    await pool.query(
      `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, source)
       VALUES (1, 'h', now(), 'zkb'), (2, 'h', now(), 'zkb')`);
    await pool.query(
      "INSERT INTO character_killmails (character_id, killmail_id, role) VALUES ($1, 1, 'kill'), ($1, 2, 'loss')", [A]);
    const [status] = await backfillStatus([A]);
    expect(status).toEqual({
      characterId: A,
      imported: 2,
      cursors: [
        { kind: "kills", nextPage: 18, done: false },
        { kind: "losses", nextPage: 4, done: true },
      ],
    });
  });

  it("dies with the character", async () => {
    await pool.query("DELETE FROM characters WHERE id = $1", [A]);
    expect((await listUnfinishedBackfill()).some((c) => c.characterId === A)).toBe(false);
  });
});
