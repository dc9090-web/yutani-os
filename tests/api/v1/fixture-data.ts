import type { Pool } from "pg";
import { resetDb, resetSde } from "../../db/helpers.js";
import { resetDogmaCache } from "../../../src/lib/dogma/sde-loader.js";
import { loadSync, resetSyncCache } from "../../../src/lib/api/v1/sync.js";
import {
  assetsResource, charactersResource, clonesResource, meResource, serverResource, overviewResource, shipDetailResource, shipsResource,
  skillsResource, trainingOverviewResource, trainingResource, walletRowsResource, walletSummaryResource, type ShipDetailKind,
} from "../../../src/lib/api/v1/resources.js";
import type { Resource } from "../../../src/lib/api/v1/respond.js";
import { importApiSde } from "./fixture-sde.js";

/**
 * The invented account behind api-fixtures/v1. Nothing here is anyone's: the character ids sit
 * below the range EVE gives players, the names say what they are, and the address is example.com.
 * Item, station and system ids are the game's own public data.
 */
export const FIXTURE_NOW = new Date("2026-03-14T12:00:00.000Z");
export const FIXTURE_EMAIL = "pilot@example.com";
export const MAIN = 9000001;      // everything synced, training
export const ALT = 9000002;       // paused queue, no wallet yet, token needs re-authorising
export const FRESH = 9000003;     // just added: nothing synced
/** The main's Tristan (drones aboard), its Rifter, and the two fits it saved in game. */
export const TRISTAN_ITEM = 1040000000001;
export const RIFTER_ITEM = 1040000000050;
export const TRISTAN_FIT = 7001;
export const RIFTER_FIT = 7002;

const JITA_STATION = 60003760;
const PERIMETER = 30000144;
const STRUCTURE = 1035000000001;

/** The settings the loaders read, pinned so the fixtures do not depend on the developer's shell. */
export function fixtureEnv(): void {
  Object.assign(process.env, {
    EVE_CLIENT_ID: "fixture", EVE_CLIENT_SECRET: "fixture", EVE_CALLBACK_URL: "https://eve.example.com/auth/callback",
    GOOGLE_CLIENT_ID: "fixture.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "fixture",
    ALLOWED_GOOGLE_EMAILS: FIXTURE_EMAIL, OVERVIEW_CHARACTER_IDS: "", OWNER_INITIALS: "EP",
    ESI_COMPATIBILITY_DATE: "2026-01-01", ESI_USER_AGENT: "fixture", SESSION_SECRET: "f".repeat(64),
  });
}

/** [skillId, level]: the main's sheet. Skill points are the level's worth at rank 1 — close enough to read well. */
const SKILLS: [number, number][] = [
  [3300, 5], [3301, 5], [3302, 4], [3310, 4], [3311, 4], [3312, 4], [3315, 3], [3316, 4], [3317, 3], [3318, 5], [11207, 3], [12210, 3],
  [3436, 5], [3437, 4], [3442, 4], [12305, 4], [12486, 3], [23606, 4], [23618, 3], [24241, 5],
  [3327, 5], [3328, 5], [3329, 4], [3392, 5], [3393, 4], [3394, 5], [3402, 4], [3413, 5], [3417, 4], [3418, 4], [3426, 5],
  [3427, 3], [3428, 3], [3429, 3], [3431, 3], [3435, 4], [3449, 5], [3450, 4], [3452, 3], [3453, 3],
];
const SP_AT_LEVEL = [0, 250, 1414, 8000, 45255, 256000];

async function seedMain(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $3::int[], $4::bigint[])`,
    [MAIN, SKILLS.map(([id]) => id), SKILLS.map(([, level]) => level), SKILLS.map(([, level]) => SP_AT_LEVEL[level])]);
  await pool.query("INSERT INTO character_skill_summary (character_id, total_sp, unallocated_sp) VALUES ($1, $2, 150000)",
    [MAIN, SKILLS.reduce((sum, [, level]) => sum + SP_AT_LEVEL[level], 0)]);
  // Position 0 finished before FIXTURE_NOW and ESI has not trimmed it yet; position 1 is training;
  // 2 and 3 wait. Drone Interfacing is queued twice — one entry per level.
  await pool.query(
    `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date, level_start_sp, level_end_sp, training_start_sp) VALUES
       ($1, 0, 3315, 4, '2026-03-12T08:00:00Z', '2026-03-14T06:30:00Z', 8000, 45255, 8000),
       ($1, 1, 3442, 5, '2026-03-14T06:30:00Z', '2026-03-19T18:45:00Z', 45255, 256000, 61200),
       ($1, 2, 12486, 4, '2026-03-19T18:45:00Z', '2026-03-22T03:10:00Z', 8000, 45255, 8000),
       ($1, 3, 12486, 5, '2026-03-22T03:10:00Z', '2026-04-05T21:00:00Z', 45255, 256000, 45255)`, [MAIN]);

  await pool.query("INSERT INTO character_wallet (character_id, balance) VALUES ($1, 1284503217.44)", [MAIN]);
  await pool.query(
    `INSERT INTO character_wallet_journal (character_id, id, date, ref_type, description, amount, balance, first_party_id, second_party_id) VALUES
       ($1, 5001, '2026-03-14T10:42:00Z', 'market_transaction', 'Market: Example Trader One bought stuff', 18400000.00, 1284503217.44, 9100001, $1),
       ($1, 5002, '2026-03-14T10:42:00Z', 'transaction_tax', 'Market transaction tax', -662400.00, 1266103217.44, $1, 1000132),
       ($1, 5003, '2026-03-13T21:05:00Z', 'bounty_prizes', 'Example Pilot One got bounty prizes', 4312870.25, 1266765617.44, 1000125, $1),
       ($1, 5004, '2026-03-13T19:30:00Z', 'market_escrow', 'Market escrow release', -25000000.00, 1262452747.19, $1, $1),
       ($1, 5005, '2026-03-12T16:11:00Z', 'player_donation', 'Example Pilot Two deposited cash into Example Pilot One''s account', 50000000.00, 1287452747.19, $2, $1),
       ($1, 5006, '2026-03-11T09:00:00Z', 'insurance', 'Insurance paid for a lost ship', 1250000.00, 1237452747.19, 1000132, $1),
       ($1, 5007, '2026-03-10T23:59:00Z', 'contract_price', 'Contract price paid', -120000000.00, 1236202747.19, $1, 98900001),
       ($1, 5008, '2026-03-10T08:15:00Z', 'corporate_reward_payout', 'Reward payout', NULL, NULL, 1000125, $1)`, [MAIN, ALT]);
  await pool.query(
    `INSERT INTO character_wallet_transactions (character_id, transaction_id, date, type_id, quantity, unit_price, client_id, location_id, is_buy, is_personal, journal_ref_id) VALUES
       ($1, 6001, '2026-03-14T10:42:00Z', 2456, 20, 920000.00, 9100001, $2, false, true, 5001),
       ($1, 6002, '2026-03-13T19:30:00Z', 12612, 5000, 410.50, 9100002, $2, true, true, NULL),
       ($1, 6003, '2026-03-12T12:00:00Z', 593, 1, 1150000.00, 9100002, $3, true, true, NULL),
       ($1, 6004, '2026-03-09T07:45:00Z', 34, 250000, 4.18, 9100001, $2, false, true, NULL)`, [MAIN, JITA_STATION, STRUCTURE]);

  await pool.query(
    `INSERT INTO character_location (character_id, solar_system_id, station_id, ship_item_id, ship_type_id, ship_name, online, last_login)
     VALUES ($1, 30000142, $2, $3, 593, 'Paper Kite', false, '2026-03-13T18:00:00Z')`, [MAIN, JITA_STATION, TRISTAN_ITEM]);

  await pool.query("INSERT INTO character_implants (character_id, type_id) SELECT $1, * FROM unnest($2::int[])", [MAIN, [10208, 10212, 10216, 10221, 10225, 13216]]);
  await pool.query(
    "INSERT INTO character_clones (character_id, home_location_id, home_location_type, last_clone_jump_date) VALUES ($1, $2, 'station', '2026-03-13T17:20:00Z')", [MAIN, JITA_STATION]);
  await pool.query(
    `INSERT INTO character_jump_clones (character_id, jump_clone_id, location_id, location_type, name, implants) VALUES
       ($1, 8001, $2, 'station', 'Trade clone', '{10216,10212}'),
       ($1, 8002, $3, 'structure', NULL, '{}'),
       ($1, 8003, $3, 'structure', 'Empty spare', '{13216}')`, [MAIN, JITA_STATION, STRUCTURE]);

  // The Tristan, docked in Jita: three blasters with Void loaded, a full mid and low rack, two
  // rigs, eight light drones in a 40 m3 bay, and a hold with spare ammunition and repair paste.
  const tristan: [number, number, number, string, boolean][] = [
    // [itemId offset, typeId, quantity, flag, singleton]
    [1, 3178, 1, "HiSlot0", true], [2, 12612, 120, "HiSlot0", false],
    [3, 3178, 1, "HiSlot1", true], [4, 12612, 120, "HiSlot1", false],
    [5, 438, 1, "MedSlot0", true], [6, 448, 1, "MedSlot1", true], [7, 527, 1, "MedSlot2", true],
    [8, 2048, 1, "LoSlot0", true], [9, 4405, 1, "LoSlot1", true], [10, 1183, 1, "LoSlot2", true],
    [11, 31045, 1, "RigSlot0", true], [12, 31526, 1, "RigSlot1", true],
    [13, 2456, 5, "DroneBay", false], [14, 2488, 3, "DroneBay", false],
    [15, 12612, 2000, "Cargo", false], [16, 12614, 1500, "Cargo", false], [17, 222, 1000, "Cargo", false], [18, 28668, 40, "Cargo", false],
  ];
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton, is_blueprint_copy, name) VALUES
       ($1, $2, 593, 1, $4, 'station', 'Hangar', true, false, 'Paper Kite'),
       ($1, $3, 587, 1, $5, 'other', 'Hangar', true, false, 'Scarlet Dart'),
       ($1, ${RIFTER_ITEM + 1}, 2889, 1, $3, 'item', 'HiSlot0', true, false, NULL),
       ($1, ${RIFTER_ITEM + 2}, 21898, 100, $3, 'item', 'HiSlot0', false, false, NULL),
       ($1, ${RIFTER_ITEM + 3}, 519, 1, $3, 'item', 'LoSlot0', true, false, NULL),
       ($1, ${RIFTER_ITEM + 4}, 12608, 800, $3, 'item', 'Cargo', false, false, NULL),
       ($1, 1040000000100, 3297, 1, $4, 'station', 'Hangar', true, false, 'Spare parts'),
       ($1, 1040000000101, 34, 1250000, 1040000000100, 'item', 'Unlocked', false, false, NULL),
       ($1, 1040000000102, 2456, 10, 1040000000100, 'item', 'Unlocked', false, false, NULL),
       ($1, 1040000000103, 940, 1, $4, 'station', 'Hangar', true, true, NULL),
       ($1, 1040000000104, 34, 50000, $4, 'station', 'Hangar', false, false, NULL)`,
    [MAIN, TRISTAN_ITEM, RIFTER_ITEM, JITA_STATION, STRUCTURE]);
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton)
     SELECT $1, $2::bigint + o, t, q, $2, 'item', f, s FROM unnest($3::int[], $4::int[], $5::bigint[], $6::text[], $7::bool[]) AS x(o, t, q, f, s)`,
    [MAIN, TRISTAN_ITEM, tristan.map((r) => r[0]), tristan.map((r) => r[1]), tristan.map((r) => r[2]), tristan.map((r) => r[3]), tristan.map((r) => r[4])]);

  await pool.query(
    `INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES
       ($1, ${TRISTAN_FIT}, 'Tristan - drone brawler', '', 593), ($1, ${RIFTER_FIT}, 'Rifter - autocannons', '', 587)`, [MAIN]);
  const saved: [number, number, number, string][] = [
    // [fittingId, typeId, quantity, flag]
    [TRISTAN_FIT, 3178, 1, "HiSlot0"], [TRISTAN_FIT, 3178, 1, "HiSlot1"],
    [TRISTAN_FIT, 438, 1, "MedSlot0"], [TRISTAN_FIT, 448, 1, "MedSlot1"], [TRISTAN_FIT, 527, 1, "MedSlot2"],
    [TRISTAN_FIT, 2048, 1, "LoSlot0"], [TRISTAN_FIT, 4405, 1, "LoSlot1"], [TRISTAN_FIT, 1183, 1, "LoSlot2"],
    [TRISTAN_FIT, 31045, 1, "RigSlot0"], [TRISTAN_FIT, 2456, 5, "DroneBay"], [TRISTAN_FIT, 2488, 3, "DroneBay"],
    [TRISTAN_FIT, 12612, 2000, "Cargo"], [TRISTAN_FIT, 12614, 1000, "Cargo"],
    [RIFTER_FIT, 2889, 1, "HiSlot0"], [RIFTER_FIT, 2889, 1, "HiSlot1"], [RIFTER_FIT, 2889, 1, "HiSlot2"],
    [RIFTER_FIT, 519, 1, "LoSlot0"], [RIFTER_FIT, 2048, 1, "LoSlot1"], [RIFTER_FIT, 21898, 1500, "Cargo"],
  ];
  await pool.query(
    `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
     SELECT $1, f, (row_number() OVER (PARTITION BY f))::int - 1, t, q, g FROM unnest($2::bigint[], $3::int[], $4::int[], $5::text[]) AS x(f, t, q, g)`,
    [MAIN, saved.map((r) => r[0]), saved.map((r) => r[1]), saved.map((r) => r[2]), saved.map((r) => r[3])]);
}

/** Truncates the test database and fills it with the invented account. Never point this at real data. */
export async function seedApiFixtureDb(): Promise<Pool> {
  fixtureEnv();
  const pool = await resetDb();
  await resetSde(pool);
  await importApiSde(pool);
  resetDogmaCache();
  resetSyncCache();

  await pool.query("INSERT INTO accounts (name) VALUES ('Main'), ('Alt')");
  // created_at is spelled out: it is the order the characters are listed in.
  await pool.query(
    `INSERT INTO characters (id, name, account_id, corporation_id, corporation_name, alliance_id, alliance_name, race_id, refresh_token_enc, token_status, created_at) VALUES
       ($1, 'Example Pilot One', 1, 98900001, 'Example Corporation', 99900001, 'Example Alliance', 8, 'enc', 'ok', '2026-01-01T00:00:00Z'),
       ($2, 'Example Pilot Two', 2, 98900001, 'Example Corporation', NULL, NULL, 2, 'enc', 'needs_reauth', '2026-01-02T00:00:00Z'),
       ($3, 'Example Pilot Three', NULL, NULL, NULL, NULL, NULL, NULL, 'enc', 'ok', '2026-01-03T00:00:00Z')`, [MAIN, ALT, FRESH]);
  await pool.query("INSERT INTO character_tags (name) VALUES ('Hauler'), ('Scout')");
  await pool.query("INSERT INTO character_tag_map (character_id, tag_id) VALUES ($1, 2), ($2, 1), ($2, 2)", [MAIN, ALT]);

  await pool.query(
    `INSERT INTO universe_names (id, category, name) VALUES
       ($1, 'station', 'Jita IV - Moon 4 - Caldari Navy Assembly Plant'),
       (9100001, 'character', 'Example Trader One'), (9100002, 'character', 'Example Trader Two'),
       ($2, 'character', 'Example Pilot One'), ($3, 'character', 'Example Pilot Two'),
       (98900001, 'corporation', 'Example Corporation'),
       (1000125, 'corporation', 'CONCORD'), (1000132, 'corporation', 'Secure Commerce Commission')`, [JITA_STATION, MAIN, ALT]);
  await pool.query("INSERT INTO structures (id, name, solar_system_id, type_id) VALUES ($1, 'Perimeter - Example Trade Tower', $2, 35833)", [STRUCTURE, PERIMETER]);
  await pool.query(
    `INSERT INTO market_prices (type_id, adjusted_price, average_price, jita_sell_min, jita_buy_max) VALUES
       (593, 1100000, 1150000, 1180000, 1050000), (587, 600000, 640000, 650000, 590000),
       (3178, 2900000, 3000000, 3100000, 2800000), (2889, 2600000, 2700000, 2750000, 2500000),
       (438, 1500000, 1550000, 1600000, 1450000), (448, 1900000, 1950000, 2000000, 1850000), (527, 1300000, 1350000, 1400000, 1250000),
       (2048, 1700000, 1750000, 1800000, 1650000), (4405, 1450000, 1500000, 1550000, 1400000), (1183, 900000, 950000, 980000, 870000),
       (519, 1200000, 1250000, 1290000, 1150000), (31045, 800000, 850000, 880000, 760000),
       (2456, 880000, 910000, 920000, 860000), (2488, 840000, 870000, 890000, 820000),
       (12612, 400, 410, 410.5, 395), (12614, 380, 390, 399, 371), (222, 12, 13, 13.4, 11.9), (21898, 520, 540, 555, 510), (12608, 410, 420, 431, 402),
       (28668, 21000, 22000, 22500, 20500), (34, 4, 4.1, 4.18, 4.02), (3297, 9000, 9500, 9900, 8800)`);
  // 31526 (the second rig) is left unpriced on purpose: the sheet's "1 item unpriced" line.

  await seedMain(pool);

  // The player count, read a few minutes before the fixture clock.
  await pool.query(
    "INSERT INTO server_status (id, players, server_version, start_time, fetched_at) VALUES (1, 23456, '3113402', '2026-03-14T11:02:00Z', '2026-03-14T11:57:00Z')");

  // The alt: paused queue (ESI sends no dates), in space in Perimeter, online, no wallet row yet.
  await pool.query("INSERT INTO character_skill_summary (character_id, total_sp) VALUES ($1, 1250000)", [ALT]);
  await pool.query(
    `INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints) VALUES
       ($1, 3327, 4, 4, 45255), ($1, 3329, 3, 3, 8000), ($1, 3300, 4, 3, 45255), ($1, 3302, 3, 3, 8000)`, [ALT]);
  await pool.query(
    `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, level_start_sp, level_end_sp, training_start_sp) VALUES
       ($1, 0, 3329, 4, 8000, 45255, 21000), ($1, 1, 3302, 4, 8000, 45255, 8000)`, [ALT]);
  await pool.query(
    "INSERT INTO character_location (character_id, solar_system_id, ship_item_id, ship_type_id, ship_name, online) VALUES ($1, $2, 1040000000900, 587, 'Second Wind', true)", [ALT, PERIMETER]);
  return pool;
}

export interface Envelope { data: unknown; generatedAt: string }

/** "/api/v1/characters/9000001/wallet?kind=journal&offset=0&limit=500" → "characters/9000001/wallet-journal.json". */
export function fixtureFile(path: string): string {
  const [route, query] = path.replace(/^\/api\/v1\//, "").split("?");
  const kind = new URLSearchParams(query ?? "").get("kind");
  return `${route}${kind === null ? "" : `-${kind}`}.json`;
}

function resourceFor(path: string): Resource {
  const who = { email: FIXTURE_EMAIL };
  const globals = [meResource(who), serverResource(), charactersResource(), overviewResource(), trainingOverviewResource()];
  const found = globals.find((r) => r.path === path);
  if (found !== undefined) return found;
  const match = /^\/api\/v1\/characters\/(\d+)\/(.+)$/.exec(path);
  if (match === null) throw new Error(`no resource for ${path}`);
  const id = Number(match[1]);
  const detail = /^ships\/(asset|fit)\/(\d+)$/.exec(match[2]);
  if (detail !== null) return shipDetailResource(id, detail[1] as ShipDetailKind, Number(detail[2]));
  const candidates = [skillsResource(id), trainingResource(id), clonesResource(id), assetsResource(id), shipsResource(id),
    walletSummaryResource(id), walletRowsResource(id, "journal"), walletRowsResource(id, "transactions")];
  const resource = candidates.find((r) => r.path === path);
  if (resource === undefined) throw new Error(`no resource for ${path}`);
  return resource;
}

/**
 * Every response a phone would hold for the seeded account, as `file → { data, generatedAt }`:
 * the sync list, then each resource it names, built at FIXTURE_NOW. The same code paths as the
 * routes, minus HTTP.
 */
export async function buildApiFixtures(): Promise<Map<string, Envelope>> {
  const generatedAt = FIXTURE_NOW.toISOString();
  const sync = await loadSync({ email: FIXTURE_EMAIL });
  const out = new Map<string, Envelope>([["sync.json", { data: sync, generatedAt }]]);
  for (const { path } of sync.resources) {
    out.set(fixtureFile(path), { data: await resourceFor(path).build(FIXTURE_NOW), generatedAt });
  }
  // Through JSON and back, so the map holds exactly what a client would parse (dates as strings, no undefined).
  return new Map([...out].map(([file, envelope]) => [file, JSON.parse(JSON.stringify(envelope)) as Envelope]));
}
