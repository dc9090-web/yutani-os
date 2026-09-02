/**
 * The server side of `/combat`. Postgres only (foundation §2.1): three batched lookups build every
 * label on the page, and nothing here reaches for ESI. Never import this from a `"use client"`
 * component — it pulls in `pg`.
 */
import {
  COMBAT_PAGE_SIZE, allCombatRows, countCombatRows, listCombatRows, type CombatRow,
} from "../db/killmails.js";
import { backfillStatus } from "../db/killmail-backfill.js";
// `../names/label.js`, not `../names/index.js`: the index also wires up the ESI client, and the
// page side of phase 7 must never reach ESI. This is what `src/lib/view/wallet.ts` does too.
import { displayNames } from "../names/label.js";
import { getSolarSystems, getTypes } from "../sde/repo.js";
import { combatStats, periodStart, type CombatPeriod, type CombatStats } from "./stats.js";
import {
  backfillLine, killmailRows, monthBars, statTiles, topLists,
  type KillmailRowView, type Labels, type MonthBarView, type StatTile, type TopListView,
} from "../view/combat.js";

export interface CombatPageView {
  tiles: StatTile[]; months: MonthBarView[]; topLists: TopListView[];
  rows: KillmailRowView[]; total: number; hasMore: boolean; backfill: string | null;
}

/**
 * One name query, one type query and one system query for however many rows arrive. `stats`, when
 * given, adds the handful of ids the top lists and the favourite weapon need — never pass
 * `allCombatRows`'s (up to `STAT_ROW_CAP` = 20,000) rows here: that would fan `displayNames` /
 * `getTypes` / `getSolarSystems` out over thousands of ids to build one page. Callers only ever
 * need labels for the 50 rows actually rendered plus the statistics panels' own top-N entries.
 */
export async function loadLabels(rows: CombatRow[], stats?: CombatStats): Promise<Labels> {
  const nameIds = new Set<number>();
  const typeIds = new Set<number>();
  const systemIds = new Set<number>();
  for (const row of rows) {
    if (row.victimCharacterId !== null) nameIds.add(row.victimCharacterId);
    if (row.victimCorporationId !== null) nameIds.add(row.victimCorporationId);
    if (row.victimShipTypeId !== null) typeIds.add(row.victimShipTypeId);
    if (row.ourShipTypeId !== null) typeIds.add(row.ourShipTypeId);
    if (row.weaponTypeId !== null) typeIds.add(row.weaponTypeId);
    if (row.solarSystemId !== null) systemIds.add(row.solarSystemId);
  }
  if (stats !== undefined) {
    for (const e of stats.shipsFlown) typeIds.add(e.id);
    for (const e of stats.shipsLost) typeIds.add(e.id);
    for (const e of stats.systems) systemIds.add(e.id);
    if (stats.favouriteWeapon !== null) typeIds.add(stats.favouriteWeapon);
  }
  const [names, types, systems] = await Promise.all([
    displayNames([...nameIds]), getTypes([...typeIds]), getSolarSystems([...systemIds]),
  ]);
  return {
    names,
    types: new Map([...types].flatMap(([id, t]) => (t.name === null ? [] : [[id, t.name] as const]))),
    systems: new Map([...systems].map(([id, s]) => [id, {
      name: s.name ?? `Unknown system (${id})`, security: s.securityStatus,
    }])),
  };
}

export async function loadCombatPage(
  characterIds: number[], period: CombatPeriod, now: Date = new Date(),
): Promise<CombatPageView> {
  const since = periodStart(period, now);
  const [statRows, pageRows, total, backfill] = await Promise.all([
    allCombatRows(characterIds, since),
    listCombatRows(characterIds, { since, limit: COMBAT_PAGE_SIZE, offset: 0 }),
    countCombatRows(characterIds, since),
    backfillStatus(characterIds),
  ]);
  const stats = combatStats(statRows, now);
  // Labels for the 50 page rows plus the top lists' own ids — never the (up to STAT_ROW_CAP)
  // statistics rowset itself, which would fan the three label queries out over thousands of ids.
  const labels = await loadLabels(pageRows, stats);
  return {
    tiles: statTiles(stats),
    months: monthBars(stats),
    topLists: topLists(stats, labels),
    rows: killmailRows(pageRows, labels),
    total,
    hasMore: pageRows.length === COMBAT_PAGE_SIZE && total > COMBAT_PAGE_SIZE,
    backfill: backfillLine(backfill),
  };
}

/** The "more" route (spec §6): the same builders, so appended rows match the ones on screen. */
export async function loadKillmailRows(
  characterIds: number[], period: CombatPeriod, offset: number, now: Date = new Date(),
): Promise<{ rows: KillmailRowView[]; hasMore: boolean }> {
  const since = periodStart(period, now);
  const rows = await listCombatRows(characterIds, { since, limit: COMBAT_PAGE_SIZE, offset });
  const labels = await loadLabels(rows);
  return { rows: killmailRows(rows, labels), hasMore: rows.length === COMBAT_PAGE_SIZE };
}
