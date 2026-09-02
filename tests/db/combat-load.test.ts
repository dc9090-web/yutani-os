import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { saveKillmails } from "../../src/lib/db/killmails.js";
import { ensureBackfillRows } from "../../src/lib/db/killmail-backfill.js";
import { toKillmailWrite, type EsiKillmail } from "../../src/lib/combat/killmail.js";
import { loadCombatPage, loadKillmailRows } from "../../src/lib/combat/load.js";
import { esiFixture } from "../fixtures/esi.js";

let pool: Pool;
const A = 669539978;
const NOW = new Date("2026-09-02T00:00:00Z");

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'A', 'e')", [A]);
  await pool.query(
    `INSERT INTO sde_types (id, name, published) VALUES (621, 'Caracal', true), (587, 'Rifter', true)`);
  await pool.query(
    `INSERT INTO sde_solar_systems (id, name, security_status) VALUES (30000142, 'Jita', 0.946)`);
  await pool.query(
    `INSERT INTO universe_names (id, category, name)
     VALUES ($1, 'character', 'TrilliumONE'), (98000001, 'corporation', 'Trill Industries')`, [A]);
  await ensureBackfillRows([A]);

  const base = esiFixture<EsiKillmail>("killmail");
  const writes = Array.from({ length: 3 }, (_, i) => toKillmailWrite(
    { ...base, killmail_id: 200 + i, killmail_time: `2026-09-0${i + 1}T12:00:00Z` },
    `h${i}`, "esi"));
  await saveKillmails(writes, writes.map((w) => ({
    characterId: A, killmailId: w.killmail.killmailId, role: "loss" as const,
  })));
  await pool.query("UPDATE killmails SET computed_value = 8125000");
}, 60_000);
afterAll(closePool);

describe("loadCombatPage", () => {
  it("builds every panel from Postgres alone", async () => {
    const view = await loadCombatPage([A], "90d", NOW);
    expect(view.hasMore).toBe(false);
    expect(view.rows.map((r) => r.killmailId)).toEqual([202, 201, 200]);
    expect(view.rows[0]).toMatchObject({
      victim: "TrilliumONE", victimCorp: "Trill Industries", victimShip: "Caracal",
      system: "Jita", secClass: "sec-high", value: "8.1M ISK", roleLabel: "Loss",
    });
    expect(view.tiles.find((t) => t.key === "losses")?.value).toBe("3");
    // Three losses, nothing destroyed: 0 / (0 + 24,375,000) = 0 -> "0.0%".
    expect(view.tiles.find((t) => t.key === "efficiency")?.value).toBe("0.0%");
    expect(view.months).toHaveLength(12);
    expect(view.months[11]).toMatchObject({ month: "2026-09", losses: 3, lossPct: 100 });
    expect(view.topLists.map((l) => l.key)).toEqual(["flown", "lost", "systems"]);
    expect(view.topLists[1].rows).toEqual([{ label: "Caracal", count: "3" }]);
    expect(view.backfill).toBe("Backfill from zKillboard: 3 killmails imported (kills page 1, losses page 1)");
  });

  it("honours the period", async () => {
    const view = await loadCombatPage([A], "30d", new Date("2026-12-01T00:00:00Z"));
    expect(view.rows).toEqual([]);
  });
});

describe("loadKillmailRows", () => {
  it("returns the next page and says whether another one exists", async () => {
    const page = await loadKillmailRows([A], "90d", 1, NOW);
    expect(page.rows.map((r) => r.killmailId)).toEqual([201, 200]);
    expect(page.hasMore).toBe(false);
  });
});
