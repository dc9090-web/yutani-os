import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { knownKillmailIds, saveKillmails, unresolvedPartyIds } from "../../src/lib/db/killmails.js";
import { toKillmailWrite, type EsiKillmail } from "../../src/lib/combat/killmail.js";
import { esiFixture } from "../fixtures/esi.js";

let pool: Pool;
const CID = 669539978;
const body = (): EsiKillmail => esiFixture<EsiKillmail>("killmail");

beforeAll(async () => {
  pool = await resetDb();
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'Trill', 'enc')", [CID]);
}, 60_000);
afterAll(closePool);

describe("saveKillmails", () => {
  it("stores the killmail, its attackers, its items and the character link", async () => {
    const written = await saveKillmails(
      [toKillmailWrite(body(), "hash-1", "esi")],
      [{ characterId: CID, killmailId: 120000001, role: "loss" }]);
    // 1 killmail + 3 attackers + 5 item rows + 1 link = 10
    expect(written).toBe(10);
    const km = await pool.query("SELECT * FROM killmails WHERE killmail_id = 120000001");
    expect(km.rows[0].source).toBe("esi");
    expect(km.rows[0].attacker_count).toBe(3);
    expect(km.rows[0].final_blow_character_id).toBe("2124678472");
    expect(Number(km.rows[0].damage_taken)).toBe(4210);
    expect((await pool.query("SELECT count(*)::int AS n FROM killmail_attackers")).rows[0].n).toBe(3);
    expect((await pool.query("SELECT count(*)::int AS n FROM killmail_items")).rows[0].n).toBe(5);
    const nested = await pool.query("SELECT parent_idx FROM killmail_items WHERE idx = 2");
    expect(nested.rows[0].parent_idx).toBe(1);
    const link = await pool.query("SELECT role FROM character_killmails WHERE character_id = $1", [CID]);
    expect(link.rows[0].role).toBe("loss");
  });

  it("is idempotent: the same killmail again writes nothing new", async () => {
    const written = await saveKillmails(
      [toKillmailWrite(body(), "hash-1", "esi")],
      [{ characterId: CID, killmailId: 120000001, role: "loss" }]);
    expect(written).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS n FROM killmail_items")).rows[0].n).toBe(5);
  });

  it("fills the zkb columns from a later zKillboard sighting without touching the ESI ones", async () => {
    await saveKillmails([toKillmailWrite(body(), "hash-1", "zkb", {
      hash: "hash-1", totalValue: 60633419.79, points: 1, npc: false, solo: true, awox: false,
    })], []);
    const { rows } = await pool.query("SELECT * FROM killmails WHERE killmail_id = 120000001");
    expect(Number(rows[0].zkb_total_value)).toBe(60633419.79);
    expect(rows[0].zkb_points).toBe(1);
    expect(rows[0].zkb_solo).toBe(true);
    expect(rows[0].source).toBe("esi");              // the first source keeps the row
    expect(rows[0].attacker_count).toBe(3);
  });

  it("never nulls a zkb value that is already stored", async () => {
    await saveKillmails([toKillmailWrite(body(), "hash-1", "esi")], []);
    const { rows } = await pool.query("SELECT zkb_total_value FROM killmails WHERE killmail_id = 120000001");
    expect(Number(rows[0].zkb_total_value)).toBe(60633419.79);
  });

  it("accepts a duplicate killmail id and a duplicate character/killmail link within one batch", async () => {
    // Without de-duping, two identical conflict targets in one INSERT's VALUES would throw
    // "ON CONFLICT DO UPDATE command cannot affect row a second time".
    const dup = toKillmailWrite({ ...body(), killmail_id: 120000098 }, "hash-98", "esi");
    const written = await saveKillmails(
      [dup, dup],
      [{ characterId: CID, killmailId: 120000098, role: "kill" },
       { characterId: CID, killmailId: 120000098, role: "loss" }]);
    // Deduped to one write (1 killmail + 3 attackers + 5 items = 9) and one link ('loss' wins) = 10.
    expect(written).toBe(10);
    const km = await pool.query("SELECT count(*)::int AS n FROM killmails WHERE killmail_id = 120000098");
    expect(km.rows[0].n).toBe(1);
    const link = await pool.query(
      "SELECT role FROM character_killmails WHERE character_id = $1 AND killmail_id = 120000098", [CID]);
    expect(link.rows[0].role).toBe("loss");
  });

  it("upgrades a link from kill to loss but never downgrades it", async () => {
    // A fresh killmail, first linked as a kill: the plain insert branch.
    await saveKillmails(
      [toKillmailWrite({ ...body(), killmail_id: 120000099 }, "hash-99", "esi")],
      [{ characterId: CID, killmailId: 120000099, role: "kill" }]);
    const kill = await pool.query(
      "SELECT role FROM character_killmails WHERE character_id = $1 AND killmail_id = 120000099", [CID]);
    expect(kill.rows[0].role).toBe("kill");

    // Re-linked as a loss: the true upgrade branch.
    await saveKillmails([], [{ characterId: CID, killmailId: 120000099, role: "loss" }]);
    const upgraded = await pool.query(
      "SELECT role FROM character_killmails WHERE character_id = $1 AND killmail_id = 120000099", [CID]);
    expect(upgraded.rows[0].role).toBe("loss");

    // 120000001 (from the very first test) is already a loss and is never downgraded back to a kill.
    await saveKillmails([], [{ characterId: CID, killmailId: 120000001, role: "kill" }]);
    const { rows } = await pool.query(
      "SELECT role FROM character_killmails WHERE character_id = $1 AND killmail_id = 120000001", [CID]);
    expect(rows[0].role).toBe("loss");
  });

  it("fills points and solo from a zkb sighting that carries no totalValue at all", async () => {
    // 120000098 was saved ESI-only earlier in this file, so every zkb_* column starts NULL. The
    // old single-column gate (WHERE zkb_total_value IS NULL AND EXCLUDED.zkb_total_value IS NOT
    // NULL) would have skipped this UPDATE entirely and left points/solo unset.
    await saveKillmails([toKillmailWrite({ ...body(), killmail_id: 120000098 }, "hash-98", "zkb", {
      hash: "hash-98", points: 4, solo: true,
    })], []);
    const { rows } = await pool.query(
      "SELECT zkb_total_value, zkb_points, zkb_solo FROM killmails WHERE killmail_id = 120000098");
    expect(rows[0].zkb_total_value).toBeNull();
    expect(rows[0].zkb_points).toBe(4);
    expect(rows[0].zkb_solo).toBe(true);
  });

  it("dies with the character but leaves the killmail itself alone", async () => {
    await pool.query("DELETE FROM characters WHERE id = $1", [CID]);
    expect((await pool.query("SELECT count(*)::int AS n FROM character_killmails")).rows[0].n).toBe(0);
    // Three killmails now exist (120000001 from the first test, 120000098 and 120000099 from the
    // dedupe and upgrade tests above), five item rows each, none of them cascading from a character.
    expect((await pool.query("SELECT count(*)::int AS n FROM killmails")).rows[0].n).toBe(3);
    expect((await pool.query("SELECT count(*)::int AS n FROM killmail_items")).rows[0].n).toBe(15);
  });
});

describe("knownKillmailIds", () => {
  it("returns only the ids already stored, and nothing for an empty list", async () => {
    expect(await knownKillmailIds([])).toEqual(new Set());
    expect(await knownKillmailIds([120000001, 120000002])).toEqual(new Set([120000001]));
  });
});

describe("unresolvedPartyIds", () => {
  it("picks up a stored killmail's victim/attacker ids that universe_names has no row for", async () => {
    // The killmails saved earlier in this file carry the fixture's victim and attacker ids; none
    // of them have ever been given a universe_names row, so a later backfill run's sweep must
    // still find them even though the killmails themselves are long since immutable and stored.
    const ids = await unresolvedPartyIds(100);
    expect(ids).toEqual(expect.arrayContaining(
      [669539978, 98000001, 99000001, 2112625428, 98000002, 2124678472, 99000002]));
  });

  it("stops returning an id once universe_names has a row for it", async () => {
    await pool.query(
      "INSERT INTO universe_names (id, category, name) VALUES ($1, 'character', 'Trill')", [669539978]);
    expect(await unresolvedPartyIds(100)).not.toContain(669539978);
  });

  it("is bounded by limit, and returns nothing for a limit of zero", async () => {
    expect(await unresolvedPartyIds(0)).toEqual([]);
    expect(await unresolvedPartyIds(1)).toHaveLength(1);
  });
});
