import { createHash } from "node:crypto";
import { getPool } from "../../db/client.js";

/**
 * "Has anything behind this resource changed?" answered without building it.
 *
 * A stamp is a digest of the stored rows a resource is built from, taken by Postgres: every column
 * of every row except `updated_at`, which the worker moves on each run whether or not anything
 * changed. So a stamp moves exactly when a stored value does — a sync run that fetched the same
 * data again leaves it alone, and an edit made on the site (a tag, an account name) moves it like
 * a worker write. The sync list keeps a resource's ETag for as long as its stamp stands still.
 *
 * Correctness rests on the table lists below covering everything the loaders read. A table left
 * out would let a real change hide behind a kept tag, so when a loader starts reading a new table
 * it must be added here; listing one too many only costs a rebuild.
 */

/** Per-character tables, grouped by what they feed. `order` is the primary key after character_id. */
const CHARACTER_TABLES = {
  skills: [["character_skill_summary", "1"], ["character_skills", "skill_id"], ["character_skill_queue", "queue_position"]],
  clones: [["character_implants", "type_id"], ["character_clones", "1"], ["character_jump_clones", "jump_clone_id"]],
  assets: [["character_assets", "item_id"]],
  fittings: [["character_fittings", "fitting_id"], ["character_fitting_items", "fitting_id, idx"]],
  wallet: [["character_wallet", "1"]],
  location: [["character_location", "1"]],
} as const;

export type CharacterStampKey = keyof typeof CHARACTER_TABLES | "prices";

/**
 * Tables every resource may read: the character list and what decorates it, the names and
 * structures that label places and wallet parties, and the SDE build (a new import renames things).
 * `characters` leaves out the columns no view shows — a rotated refresh token is not a change.
 */
const GLOBAL_TABLES: readonly [table: string, order: string, row: string][] = [
  ["characters", "id", "to_jsonb(t) - 'updated_at' - 'refresh_token_enc' - 'last_login_at' - 'scopes'"],
  ["accounts", "id", "to_jsonb(t)"],
  ["character_tags", "id", "to_jsonb(t)"],
  ["character_tag_map", "character_id, tag_id", "to_jsonb(t)"],
  ["multiview_characters", "character_id", "to_jsonb(t)"],
  ["universe_names", "id", "to_jsonb(t) - 'updated_at'"],
  ["structures", "id", "to_jsonb(t) - 'updated_at'"],
  ["sde_meta", "1", "to_jsonb(t)"],
];

const digest = (row: string, order: string): string => `md5(coalesce(string_agg((${row})::text, '|' ORDER BY ${order}), ''))`;

/** The 500 newest rows are what the phone holds; older rows are fetched on demand and never listed. */
const walletTail = (table: string, idColumn: string): string =>
  `SELECT c.id::text AS id, (SELECT ${digest("to_jsonb(w)", `w.date DESC, w.${idColumn} DESC`)}
     FROM (SELECT * FROM ${table} x WHERE x.character_id = c.id ORDER BY x.date DESC, x.${idColumn} DESC LIMIT 500) w) AS d
   FROM characters c`;

/** The prices a character's ships are valued with: every type they own or have in a saved fit. */
const PRICES_SQL = `
  SELECT o.character_id::text AS id, ${digest("to_jsonb(p) - 'updated_at'", "p.type_id")} AS d
  FROM (SELECT character_id, type_id FROM character_assets
        UNION SELECT character_id, type_id FROM character_fitting_items
        UNION SELECT character_id, ship_type_id FROM character_fittings) o
  JOIN market_prices p ON p.type_id = o.type_id
  GROUP BY o.character_id`;

const hash = (parts: readonly string[]): string => createHash("sha256").update(parts.join("\n")).digest("base64url").slice(0, 22);

export interface InputStamps {
  /** One stamp over the global tables and the caller's `version`. */
  global: string;
  /** The stamp of one group of one character's tables. A character with no rows has a stable empty stamp. */
  of(characterId: number, ...keys: CharacterStampKey[]): string;
  /** The same groups across every character, for the resources that show them all. */
  ofAll(...keys: CharacterStampKey[]): string;
}

/** `version` goes into every stamp: the same rows can render differently under other settings. */
export async function inputStamps(version: string): Promise<InputStamps> {
  const pool = getPool();
  const perCharacter = async (sql: string): Promise<Map<string, string>> => {
    const { rows } = await pool.query<{ id: string; d: string }>(sql);
    return new Map(rows.map((r) => [r.id, r.d]));
  };

  const groups = Object.entries(CHARACTER_TABLES) as [keyof typeof CHARACTER_TABLES, readonly (readonly [string, string])[]][];
  const [globalRows, prices, journal, transactions, ...tables] = await Promise.all([
    Promise.all(GLOBAL_TABLES.map(async ([table, order, row]) =>
      (await pool.query<{ d: string }>(`SELECT ${digest(row, order)} AS d FROM ${table} t`)).rows[0].d)),
    perCharacter(PRICES_SQL),
    perCharacter(walletTail("character_wallet_journal", "id")),
    perCharacter(walletTail("character_wallet_transactions", "transaction_id")),
    ...groups.flatMap(([, list]) => list.map(([table, order]) =>
      perCharacter(`SELECT character_id::text AS id, ${digest("to_jsonb(t) - 'updated_at'", order)} AS d FROM ${table} t GROUP BY character_id`))),
  ]);

  const byKey = new Map<CharacterStampKey, Map<string, string>[]>([["prices", [prices]]]);
  let next = 0;
  for (const [key, list] of groups) {
    byKey.set(key, tables.slice(next, next + list.length));
    next += list.length;
  }
  byKey.get("wallet")!.push(journal, transactions);

  const one = (id: string, keys: readonly CharacterStampKey[]): string =>
    keys.flatMap((key) => byKey.get(key)!.map((table) => table.get(id) ?? "")).join(",");
  const global = hash([version, ...globalRows]);
  return {
    global,
    of: (characterId, ...keys) => hash([global, one(String(characterId), keys)]),
    ofAll: (...keys) => {
      const ids = new Set(keys.flatMap((key) => byKey.get(key)!.flatMap((table) => [...table.keys()])));
      return hash([global, ...[...ids].sort().map((id) => `${id}=${one(id, keys)}`)]);
    },
  };
}
