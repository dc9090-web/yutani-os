# EVE Phase 7 — Combat (killmails & PvP stats)

**Date:** 2026-09-01
**Status:** Approved by delegation (project overview §2; rulings recorded inline)
**Depends on:** Phase 3 (`resolveNames`, sync jobs), Phase 4 (`market_prices`, fit builders), Phase 5 (local fits)
**Research:** `.superpowers/research/esi-endpoints.md` §6 (ESI killmails, zKillboard API)

## 1. Goal

Every kill and loss of every authorised character is stored (ESI for the live 90-day window, zKillboard for the
backfill), valued, and shown on `/combat` with PvP statistics; each killmail has a detail page with the
victim's fit, which can be opened in the fitting designer.

## 2. Sources

- **ESI** `GET /characters/{id}/killmails/recent` (scope already granted; 300 s cache; **30 tokens / 15 min**
  → at most ~15 requests per character per window; paginated, 90 days) gives `(killmail_id, killmail_hash)`;
  `GET /killmails/{id}/{hash}` (public, 30-day cache, 3600 tokens / 15 min) gives the body.
- **zKillboard** `GET https://zkillboard.com/api/{kills|losses}/characterID/{id}/page/{n}/` (trailing slash
  required, 200 per page, pages 1–100, 1 h cache, `Accept-Encoding: gzip`, descriptive `User-Agent`
  `EVE-plasma66/1.0 (dac9dc@gmail.com; +https://eve.plasma66.com)`) returns full ESI-shaped killmails plus a
  `zkb` block (`hash`, `totalValue`, `points`, `npc`, `solo`, `awox`). Ruling: one request per **2 s**, at most
  20 pages per run, no parallelism — etiquette is the only published limit. Cost if wrong: a slower backfill.

## 3. Data model

```
killmails            killmail_id bigint PK, killmail_hash text NOT NULL, killmail_time timestamptz, solar_system_id int,
                     moon_id bigint, war_id bigint,
                     victim_character_id bigint, victim_corporation_id bigint, victim_alliance_id bigint, victim_faction_id int,
                     victim_ship_type_id int, damage_taken bigint, position_x float8, position_y float8, position_z float8,
                     attacker_count int, final_blow_character_id bigint, final_blow_ship_type_id int, final_blow_weapon_type_id int,
                     zkb_total_value numeric, zkb_points int, zkb_npc bool, zkb_solo bool, zkb_awox bool,
                     computed_value numeric, source text CHECK (source IN ('esi','zkb')), fetched_at timestamptz
killmail_attackers   (killmail_id, idx int) PK, character_id bigint, corporation_id bigint, alliance_id bigint, faction_id int,
                     ship_type_id int, weapon_type_id int, damage_done bigint, final_blow bool, security_status float8
killmail_items       (killmail_id, idx int) PK, parent_idx int, item_type_id int, flag int, singleton int,
                     quantity_destroyed bigint, quantity_dropped bigint
character_killmails  (character_id bigint REFERENCES characters ON DELETE CASCADE, killmail_id bigint) PK,
                     role text CHECK (role IN ('kill','loss'))
killmail_backfill    (character_id bigint REFERENCES characters ON DELETE CASCADE, kind text CHECK (kind IN ('kills','losses'))) PK,
                     next_page int NOT NULL DEFAULT 1, done bool NOT NULL DEFAULT false, updated_at
```
Indexes: `killmails (killmail_time DESC)`, `character_killmails (character_id, killmail_id)`,
`killmail_attackers (character_id)`.

Killmails are immutable: inserts are `ON CONFLICT DO NOTHING` except `zkb_*` and `computed_value`, which are
updated when a later source supplies them. `role` = `loss` when `victim_character_id` is the character, else
`kill` (the character appears among the attackers).

## 4. Jobs

| Job | Scope | Interval | Behaviour |
|---|---|---|---|
| `killmails` | character | 1 h | Walk `/killmails/recent` pages (stop when a page contains only known ids); fetch each unknown body from ESI; store with `source = 'esi'`; link with role. Bodies are fetched with the public client (no token) so they share the generous `killmail` bucket. |
| `killmail-backfill` | global | 15 min | For each character with an unfinished `killmail_backfill` row (both kinds, created on first sight of a character): fetch up to 20 zKB pages from `next_page`, pacing 2 s; store (`source = 'zkb'`, `zkb_*` filled, hash from `zkb.hash`); `done` when a page returns fewer than 200 or `page = 100`. Returns rows stored. |
| `killmail-values` | global | 1 h | For killmails with `computed_value IS NULL`: value = Σ over victim ship + items (destroyed + dropped quantities) × `priceOf(market_prices)`; unpriced types are skipped and the killmail stays NULL until priced (the market job already includes killmail types in its types of interest — extend phase 4's set with `killmail_items.item_type_id` and `killmails.victim_ship_type_id` for the last 90 days). |

Ruling: displayed value = `zkb_total_value ?? computed_value`. Cost if wrong: minor valuation differences.

Name resolution for victims/attackers (characters, corporations, alliances) goes through phase 3's
`resolveNames` lazily at render time with a per-page bounded batch (≤ 1000 ids); systems/ships via SDE.

## 5. Statistics (`src/lib/combat/stats.ts`, pure)

For a set of `(killmail, role)` rows in a period: kills, losses, ISK destroyed, ISK lost, efficiency
`destroyed / (destroyed + lost)`, solo kills (`zkb_solo` or `attacker_count = 1`), final blows, top 5 ships flown
on kills (attacker `ship_type_id` for the character), top 5 ships lost, top 5 systems, monthly activity (kills
and losses per calendar month, last 12 months), favourite weapon.

## 6. UI

- **`/combat`** — active character with an **All characters** toggle; period tabs 30 d / 90 d / 1 y / All.
  **Stats header** (tiles: kills, losses, efficiency, ISK destroyed, ISK lost, solo kills). **Monthly activity**:
  a 12-column bar strip (kills up, losses down, CSS bars, tokens — no chart library). **Top lists**: ships
  flown, ships lost, systems. **Killmail table** (newest first, 50 per page, "more" loads next 50 via
  `GET /api/characters/[id]/killmails?offset=`): time, K/L badge, victim ship (icon+name), victim name & corp,
  system (sec class), value, attackers count, our ship (for kills: the ship the character flew).
  Backfill status line: "Backfill from zKillboard: 3,200 killmails imported (page 17/…) " until done.
- **`/combat/[killmailId]`** — header (time, system, value, K/L for the active character, zKillboard link);
  **Victim** card (portrait, name, corp/alliance, ship render, damage taken); **Fit** panel: the victim's items
  by slot from the numeric flag (Ruling — standard `invFlags` ids hard-coded in `src/lib/combat/flags.ts`:
  low 11–18, mid 19–26, high 27–34, rigs 92–94, subsystems 125–132, drone bay 87, cargo 5, implants 89,
  fighter bay 158; unknown flags → "other"), destroyed/dropped quantities and values; **Open in fitting
  designer** (`POST /api/fits/from-killmail { killmailId }` builds a local fit from the fitted items);
  **Attackers** table (name, corp/alliance, ship, weapon, damage, final-blow star), sorted by damage.
- Nav item `Combat` becomes live.

## 7. Error handling

- zKB non-200 or malformed page → job error for that run; `next_page` unchanged; retried next interval.
- ESI killmail bucket exhaustion (429/420) is handled by the client; the job records the error and resumes next
  hour where it left off (idempotent by id).
- Unknown type/system ids render as `Unknown (id)`.

## 8. Testing

- **Unit:** zKB page parser (fixture page with `zkb` block, 200 records; short page → done), role assignment,
  item flattening (one level of container nesting, `parent_idx`), value computation with partial prices,
  stats aggregation on a fixture set (efficiency, solo, top lists, monthly buckets across a year boundary),
  flag → slot mapping, pacing (fake timers).
- **Jobs:** `killmails` with a fake ESI (known-id early stop, body fetch without token), `killmail-backfill`
  (page cursor persistence, cap of 20 pages, done detection), `killmail-values`.
- **DB:** insert idempotency, `zkb_*` update on conflict, cascade on character delete.
- **Component:** stats tiles, killmail table badges, detail fit panel.
- **Acceptance on the VM:** a character's recent losses appear within an hour with values; the backfill completes
  for all four characters; the detail page of one loss matches its zKillboard page (ship, attackers, value
  within zKB's own figure); "Open in fitting designer" produces a loadable fit.

## 9. Out of scope

Corporation/alliance killboards, war tracking, live zKB feed (`ephemeral`), per-attacker damage share charts,
dogma-based "what killed me" analysis, awox/npc filtering beyond the stored flags.
