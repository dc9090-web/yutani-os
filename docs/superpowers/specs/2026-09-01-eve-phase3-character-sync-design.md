# EVE Phase 3 — Character Sync

**Date:** 2026-09-01
**Status:** Approved by delegation (project overview §2; rulings recorded inline)
**Depends on:** Phase 1 (Foundation), Phase 2 (SDE) — `sde_*` tables and `src/lib/sde/repo.ts`
**Research:** `docs/research/esi-endpoints.md` (ESI schemas, scopes, cache timers, rate-limit buckets)

## 1. Goal

The worker keeps every authorised character's **skills, skill queue, attributes, clones & implants, assets,
saved fittings, wallet (balance, journal, transactions) and location/ship** in Postgres, and the site shows
them: a real Overview, and the Skills, Assets and Wallet pages. Fittings and clones are stored for phases 4–6;
only summaries of them are shown here. Pages read only Postgres.

## 2. ESI client hardening (`src/lib/esi/`)

Required by the endpoints below and verified by the research:

1. **Compatibility date.** `scripts/esi-types.ts` sends `X-Compatibility-Date` when fetching the OpenAPI spec;
   `ESI_COMPATIBILITY_DATE` is pinned to a **published** date, `2026-08-18`, in `.env.example`, `.env`,
   `deploy/ansible/group_vars/eve.yml` and the regenerated `types.gen.ts` (2026-08-28 is not a published date;
   ESI rounds it down silently). Ruling: bump both together, never separately.
2. **`post<T>(path, body: unknown, opts: { characterId?: number }): Promise<T>`** — JSON POST, bearer when
   `characterId` given, no ESI cache (POST responses carry no cache headers), same rate-limit/error handling as
   `get`. Callers chunk bodies to ≤ 1000 unique IDs.
3. **Per-character rate-limit buckets.** `groupWait` is keyed by `(group, characterId)`; a throttled character
   never delays another.
4. **Error-limit awareness.** Read `X-ESI-Error-Limit-Remain` / `-Reset` on every response; when remain < 20,
   the next call waits until the reset. 5xx responses count against this limit (verified), so:
5. **Outage breaker.** Any 502/503/504 sets `unavailableUntil = now + 60 s`; until then every call throws
   `EsiUnavailableError` (subclass of `EsiError`, status 503) without touching ESI. Jobs fail fast, the
   scheduler records the error, the next interval retries.
6. **Torn pagination guard.** `getAll` compares each page's `Last-Modified` with page 1's; on mismatch it
   restarts the walk once, then throws `EsiError(409, path, "paginated resource changed mid-walk")`.
7. **Existing behaviour retained:** ETag/Expires cache in `esi_cache`, 429 `Retry-After`, 420 halt, 401 →
   `NeedsReauthError` (phase 1 spec §3.7).

## 3. Scopes

`SCOPES` gains `esi-universe.read_structures.v1` and `esi-location.read_online.v1` (full set the project needs,
per phase-1 §3.2 intent). `characters.scopes` already records what each token was granted. Every job checks
`hasScope(character, scope)` before calling an endpoint and **skips** (not fails) endpoints the token lacks —
characters authorised under the phase-1 scope set keep syncing everything except structure names and online
status until they re-login.

Ruling: the two scopes are added now (immutable per refresh token; cheaper before four characters are onboarded).
**Operator action required:** enable both scopes on the app at developers.eveonline.com before characters
log in again; a login attempt with scopes the app lacks is rejected by EVE SSO and surfaces as
`/login?error=sso`. Cost if wrong: one re-login per character.

## 4. Data model (`db/schema.sql`, idempotent; `character_id bigint REFERENCES characters(id) ON DELETE CASCADE` on every table)

```
character_skill_summary   character_id PK, total_sp bigint, unallocated_sp bigint, updated_at
character_skills          (character_id, skill_id int) PK, trained_level int, active_level int, skillpoints bigint
character_skill_queue     (character_id, queue_position int) PK, skill_id int, finished_level int,
                          start_date timestamptz, finish_date timestamptz, level_start_sp bigint,
                          level_end_sp bigint, training_start_sp bigint
character_attributes      character_id PK, charisma int, intelligence int, memory int, perception int, willpower int,
                          bonus_remaps int, last_remap_date timestamptz, accrued_remap_cooldown_date timestamptz, updated_at
character_implants        (character_id, type_id int) PK                     -- active clone
character_clones          character_id PK, home_location_id bigint, home_location_type text,
                          last_clone_jump_date timestamptz, last_station_change_date timestamptz, updated_at
character_jump_clones     (character_id, jump_clone_id bigint) PK, location_id bigint, location_type text,
                          name text, implants int[] NOT NULL DEFAULT '{}'
character_assets          (character_id, item_id bigint) PK, type_id int, quantity bigint, location_id bigint,
                          location_type text, location_flag text, is_singleton bool, is_blueprint_copy bool, name text
character_fittings        (character_id, fitting_id bigint) PK, name text, description text, ship_type_id int
character_fitting_items   (character_id, fitting_id bigint, idx int) PK, type_id int, quantity int, flag text
character_wallet          character_id PK, balance numeric(20,2), updated_at
character_wallet_journal  (character_id, id bigint) PK, date timestamptz, ref_type text, description text,
                          amount numeric(20,2), balance numeric(20,2), reason text, context_id bigint,
                          context_id_type text, first_party_id bigint, second_party_id bigint,
                          tax numeric(20,2), tax_receiver_id bigint
character_wallet_transactions (character_id, transaction_id bigint) PK, date timestamptz, type_id int,
                          quantity bigint, unit_price numeric(20,2), client_id bigint, location_id bigint,
                          is_buy bool, is_personal bool, journal_ref_id bigint
character_location        character_id PK, solar_system_id int, station_id bigint, structure_id bigint,
                          ship_item_id bigint, ship_type_id int, ship_name text, online bool,
                          last_login timestamptz, last_logout timestamptz, updated_at
universe_names            id bigint PK, category text, name text, updated_at     -- POST /universe/names cache
structures                id bigint PK, name text, solar_system_id int, type_id int, owner_id bigint,
                          forbidden bool NOT NULL DEFAULT false, updated_at
```

Indexes: `character_assets (character_id, location_id)`, `character_wallet_journal (character_id, date DESC)`,
`character_wallet_transactions (character_id, date DESC)`, `character_skill_queue (character_id, finish_date)`.

Ruling: enums from ESI (`location_flag`, `ref_type`, `location_type`) are stored as raw `text` — CCP adds
members without a compatibility-date bump. Cost if wrong: none.

## 5. Sync jobs (`src/worker/jobs/`, all `scope: "character"`)

Intervals follow the ESI cache timers and the tightest buckets (`fitting` and `char-wallet` 150 tokens/15 min).
Each job returns the number of rows written and replaces its tables for that character **in one transaction**
(delete + insert) unless stated otherwise.

| Job | Interval | Endpoints | Notes |
|---|---|---|---|
| `skills` | 1 h | `/skills`, `/skillqueue`, `/attributes` | Overlay: every queue entry with `finish_date` in the past is applied on top of `/skills` (`trained_level = finished_level`, `skillpoints = level_end_sp`, `active_level = max(active, finished_level)`) — CCP documents `/skills` as stale until next login. Queue replaced wholesale; missing dates (paused queue) stored as `NULL`. |
| `clones` | 6 h | `/clones`, `/implants` | Replaces `character_clones`, `character_jump_clones`, `character_implants`. |
| `assets` | 1 h | `/assets` (paginated), `POST /assets/names` | Names requested only for `is_singleton` items, chunks of 1000 unique IDs; `is_blueprint_copy` absent → `false`. Replaced wholesale. After writing, calls `resolveLocations` (§6) for the distinct root `location_id`s. |
| `fittings` | 6 h | `/fittings` | Items stored in file order with `idx`; `flag` may be `Invalid`. Replaced wholesale. |
| `wallet` | 1 h | `/wallet`, `/wallet/journal` (paginated), `/wallet/transactions` (`from_id` cursor) | Journal and transactions **accumulate** (`ON CONFLICT DO NOTHING`); ESI keeps 30 days, we keep forever. Transactions cursor: fetch, then `from_id = min(transaction_id) - 1` while the batch is non-empty and contains at least one unseen id, at most 10 batches per run. Balance upserted. Party IDs (`first_party_id`, `second_party_id`, `client_id`) are resolved through `resolveNames`. |
| `location` | 15 min | `/location`, `/ship`, `/online` (scope-gated) | Upsert. Ruling: 15 min, not the 5 s cache — "where is my character" on the Overview, not live tracking; polling faster risks a ban. |
| `character-info` | 6 h | (phase 1) | unchanged |

Scheduler: character jobs keep phase-1 staggering; with 7 jobs × 4 characters the per-tick fan-out is fine.
A job that throws `EsiUnavailableError` is recorded as `error` with that message; nothing else changes.

## 6. Name resolution (`src/lib/names/`)

- `resolveNames(ids: number[]): Promise<Map<number, { name; category }>>` — serves from `universe_names`;
  misses go to `POST /universe/names` (public, chunks of 1000); a 404 on a chunk bisects it down to single
  IDs, and unresolvable IDs are cached as `category = 'unknown'` for 7 days so they are not retried each run.
  Rows older than 30 days for `character`/`corporation`/`alliance` are refreshed; other categories never expire.
- `resolveLocations(locationIds: number[], characterId: number)`: for each id — `30000000–39999999` →
  `sde_solar_systems`; `60000000–69999999` → `resolveNames` (category `station`); `>= 1000000000000` →
  `structures` (fetch `/universe/structures/{id}` with the character's token when the row is missing or older
  than 7 days and the token has `esi-universe.read_structures.v1`; a 403 stores `forbidden = true, name = NULL`);
  anything else → unresolved.
- `locationLabel(id): Promise<{ name: string; solarSystemId: number | null; kind: 'station'|'structure'|'system'|'unknown' }>` —
  read-only helper for pages: `"Unknown structure (1035…)"` when forbidden/unknown.

## 7. UI

All pages are server components reading Postgres through `src/lib/db/*` repos; interactive bits (expand/filter)
are small client components. Midnight tokens only; Tabler icons; ISK formatted `1,234,567.89 ISK`, SP as
`12.3M SP`; times relative (`in 3 h 12 m`, `2 days ago`). "Active character" = `session.activeCharacterId`;
pages without one show the first character.

- **`/` Overview** — one card per character (all characters): portrait, name, corp · alliance, **wallet
  balance**, **location** (system name with security colour class `sec-high|sec-low|sec-null` by
  `security_status` ≥ 0.5 / > 0 / ≤ 0, docked-at label, current ship type + name, online dot when known),
  **training**: current queue head (`Skill V · finishes in 3 h`) or "Queue empty"/"Not synced", total SP,
  last sync time, re-authorise badge (phase 1).
- **`/skills`** — active character. Summary card (total SP, unallocated SP, attributes with implant bonuses
  computed as `base + Σ implant attribute bonus` using `sde_type_attributes` 175–179
  (`charismaBonus`…`willpowerBonus`), remap info). **Training queue** table: position, skill (name from
  `sde_types`), level, start/finish, progress bar for the head entry. **Skills** grouped by `sde_groups`
  (category 16), each group collapsible with group SP, each skill: name, level as five boxes (trained; active
  shown dimmer when lower), SP. **Clones** card: active implants (names, attribute bonus), jump clones
  (location label, implants), home location.
- **`/assets`** — active character. Locations list (label, item count, total volume from `sde_types.volume × quantity`),
  each expandable into a tree: items whose `location_type = 'item'` nest under their parent `item_id`;
  ships/containers show custom `name`; row = type name, quantity, readable flag (`HiSlot3` → `High slot 4`,
  `Cargo` → `Cargo hold`, `Hangar`), BPC badge. Filter box (type name substring) and location sort by item count.
  Rendered from one query per character; tree assembled in `src/lib/view/assets.ts` (pure, unit-tested).
- **`/wallet`** — active character. Balance; **Journal** (latest 100, newest first: date, type (`ref_type`
  humanised: `market_transaction` → `Market transaction`), first/second party names, amount coloured by sign
  via `.pos`/`.neg` classes, balance); **Transactions** (latest 100: date, buy/sell, type name, quantity, unit
  price, total, location label). "Show more" reveals the next 100 client-side from a `/api/characters/[id]/wallet?offset=`
  JSON route.
- **Settings › Sync status** — unchanged table; now lists every job. Static-data card from phase 2 unchanged.

## 8. API routes

`GET /api/characters/[id]/wallet?kind=journal|transactions&offset=N` (session-guarded by `proxy.ts`, 100 rows,
same shapes as the page). No write routes.

## 9. Error handling

- One failing job never affects another; each records `sync_runs.error`. 401 → `needs_reauth` (phase 1).
- Scope missing → endpoint skipped, job still `ok`; the Overview shows `—` for the missing datum.
- ESI outage → `EsiUnavailableError` recorded per job; the breaker prevents burning the error limit.
- Pages render whatever is in Postgres; "Not synced yet" placeholders where a table has no rows.

## 10. Testing

- **Fixtures:** `tests/fixtures/esi/*.json` — one realistic response per endpoint (hand-written from the
  research schemas, including a paused queue entry, an `Invalid` fitting flag, an `is_blueprint_copy`-absent
  asset, a journal row without `amount`).
- **Unit:** ESI client — `post`, per-character buckets, error-limit wait, outage breaker, torn-pagination
  restart/throw (mocked fetch, fake clock); skills overlay; transactions cursor loop; `resolveNames` bisecting;
  `resolveLocations` id ranges; assets tree builder; flag/ref_type humanisers; ISK/SP/relative-time formatters.
- **DB (real Postgres):** each repo's replace/accumulate semantics (journal re-import adds nothing; assets
  replace removes stale rows; cascade on character delete).
- **Jobs:** each job with a fake `esi` and mocked repos (phase-1 pattern), including scope-gating and the
  `EsiUnavailableError` path.
- **Component:** Overview card, Skills group/level boxes, Assets tree expand/filter, Wallet tables.
- **Acceptance on the VM:** after deploy, within two ticks every character has `ok` runs for all seven jobs;
  Overview shows balance/location/training; `/skills` matches the in-game skill sheet for one character;
  `/assets` shows the docked ship's fitted modules nested under it; `/wallet` shows recent journal entries.

## 11. Out of scope

Dogma/fitting maths (phase 4), fitting/ship UI beyond storage (phases 4–5), skill planning (phase 6),
killmails (phase 7), market prices, corporation wallets/assets, live location tracking, contracts, industry.
