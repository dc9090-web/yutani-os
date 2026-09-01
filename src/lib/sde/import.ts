import type { Pool } from "pg";
import { readJsonlMember } from "./jsonl.js";
import { sdeDdl, SDE_TABLES } from "./ddl.js";
import { SDE_TABLE_DEFS, type SdeTable } from "./tables.js";
import { parseSdeBuild, type SdeBuild } from "./version.js";

export const SDE_STAGING_SCHEMA = "sde_import";
const BATCH_ROWS = 2000;

export interface ImportResult {
  buildNumber: number;
  releaseDate: Date;
  counts: Record<string, number>;
}

/**
 * Loads a JSON Lines SDE archive into `public.sde_*`.
 *
 * Everything is staged in the `sde_import` schema first and moved with `ALTER TABLE … SET SCHEMA`
 * inside one transaction, so readers see the previous SDE until the swap commits and no live table
 * is ever locked for long. A failure anywhere before the swap leaves the live tables untouched;
 * the leftover staging schema is dropped at the start of the next attempt.
 */
export async function importSde(zipPath: string, pool: Pool, log: (msg: string) => void = () => {}): Promise<ImportResult> {
  const build = await readBuild(zipPath);
  log(`SDE build ${build.buildNumber} released ${build.releaseDate.toISOString()} — staging`);

  await pool.query(`DROP SCHEMA IF EXISTS ${SDE_STAGING_SCHEMA} CASCADE`);
  await pool.query(`CREATE SCHEMA ${SDE_STAGING_SCHEMA}`);
  for (const stmt of sdeDdl(SDE_STAGING_SCHEMA)) await pool.query(stmt);

  const counts: Record<string, number> = {};
  for (const def of SDE_TABLE_DEFS) counts[def.table] = 0;

  for (const [member, defs] of groupByMember(SDE_TABLE_DEFS)) {
    const batches = new Map<string, unknown[][]>(defs.map((d) => [d.table, []]));
    for await (const record of readJsonlMember(zipPath, `${member}.jsonl`)) {
      for (const def of defs) {
        const batch = batches.get(def.table)!;
        for (const row of toRows(def.map(record))) batch.push(row);
        if (batch.length >= BATCH_ROWS) counts[def.table] += await flush(pool, def, batch);
      }
    }
    for (const def of defs) counts[def.table] += await flush(pool, def, batches.get(def.table)!);
    log(`${member}.jsonl → ${defs.map((d) => `${d.table}=${counts[d.table]}`).join(", ")}`);
    // Statistics for the planner: each table is fully loaded at this point (its final flush just
    // ran), so ANALYZE here means the swapped-in table already has stats instead of starting cold.
    for (const def of defs) {
      await pool.query(`ANALYZE ${SDE_STAGING_SCHEMA}.${def.table}`);
      log(`analyzed ${SDE_STAGING_SCHEMA}.${def.table}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock timeout: the swap only ever contends with readers holding brief AccessShareLocks, but
    // if a stuck client is somehow holding one, fail fast rather than blocking every future query
    // on these tables.
    await client.query("SET LOCAL lock_timeout = '30s'");
    // Contract: nothing may reference sde_* objects (no views, FKs or materialised views) — query
    // them, never depend on them. The importer drops and replaces them wholesale on every run (see
    // ddl.ts), so anything that depends on them would be silently dropped along with the old table.
    for (const table of SDE_TABLES) {
      await client.query(`DROP TABLE IF EXISTS public.${table}`);
      await client.query(`ALTER TABLE ${SDE_STAGING_SCHEMA}.${table} SET SCHEMA public`);
    }
    await client.query(
      `INSERT INTO public.sde_meta (id, build_number, release_date, imported_at)
       VALUES (1, $1, $2, now())
       ON CONFLICT (id) DO UPDATE
         SET build_number = EXCLUDED.build_number, release_date = EXCLUDED.release_date, imported_at = now()`,
      [build.buildNumber, build.releaseDate],
    );
    await client.query(`DROP SCHEMA ${SDE_STAGING_SCHEMA} CASCADE`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  log(`swapped ${SDE_TABLES.length} tables into public`);

  return { buildNumber: build.buildNumber, releaseDate: build.releaseDate, counts };
}

async function readBuild(zipPath: string): Promise<SdeBuild> {
  for await (const record of readJsonlMember(zipPath, "_sde.jsonl")) {
    return parseSdeBuild(record);
  }
  throw new Error("_sde.jsonl is empty");
}

/** Preserves first-appearance order so each member is streamed exactly once. */
function groupByMember(defs: readonly SdeTable[]): Map<string, SdeTable[]> {
  const out = new Map<string, SdeTable[]>();
  for (const def of defs) {
    const existing = out.get(def.member);
    if (existing) existing.push(def);
    else out.set(def.member, [def]);
  }
  return out;
}

function toRows(mapped: unknown[] | unknown[][]): unknown[][] {
  if (mapped.length === 0) return [];
  return Array.isArray(mapped[0]) ? (mapped as unknown[][]) : [mapped as unknown[]];
}

/** Inserts and empties the batch; returns how many rows went in. */
async function flush(pool: Pool, def: SdeTable, rows: unknown[][]): Promise<number> {
  if (rows.length === 0) return 0;
  const columns = def.columns.map((_, i) => rows.map((row) => row[i]));
  await pool.query(insertSql(def), columns);
  const n = rows.length;
  rows.length = 0;
  return n;
}

/** `INSERT INTO sde_import.t (a, b) SELECT * FROM unnest($1::int[], $2::text[])` */
function insertSql(def: SdeTable): string {
  const names = def.columns.map((c) => c.name).join(", ");
  const args = def.columns.map((c, i) => `$${i + 1}::${c.type}[]`).join(", ");
  return `INSERT INTO ${SDE_STAGING_SCHEMA}.${def.table} (${names}) SELECT * FROM unnest(${args})`;
}
