# EVE Phase 7 (Combat — killmails & PvP stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every kill and loss of every authorised character is stored (ESI for the live 90-day window, zKillboard for the backfill), valued from `market_prices`, and shown on `/combat` with PvP statistics; each killmail has a detail page carrying the victim's fit, which opens in the phase-5 fitting designer.

**Architecture:** Three worker jobs own the writes — `killmails` (per character, hourly, ESI's two-step `(id, hash)` → public body fetch), `killmail-backfill` (global, 15 min, zKillboard pages) and `killmail-values` (global, hourly, `market_prices` roll-up). Killmails are **immutable**, so every insert is `ON CONFLICT DO NOTHING` except the `zkb_*` and `computed_value` columns, and a killmail whose id is already stored is never fetched again. Everything the pages need is pre-resolved into Postgres by the jobs: `/combat` and `/combat/[killmailId]` are server components that run batched Postgres queries and never touch ESI. The statistics are a pure function over rows (`src/lib/combat/stats.ts`), so they are unit-tested without a database.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Next.js 16 app router (server components + `"use client"` islands), React 19, Mantine 9 (theme only — layout is the Midnight CSS in `src/app/globals.css`), Tabler icons, Node 24, `pg` 8, Postgres 17, vitest 4 with happy-dom + `@testing-library/react`. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase7-combat-design.md` — this plan implements all of §2–§8. Project-wide architecture decisions come from `docs/superpowers/specs/2026-09-01-eve-foundation-design.md` §2–3. The endpoint shapes, the numeric `invFlags` vocabulary and the zKillboard etiquette rules are traceable to `docs/research/esi-endpoints.md` §6 and §8d.

**Depends on:** Phase 3 (`resolveNames`, `displayNames`, `locationLabels`, the sync-job conventions, `sync_runs`), phase 4 (`market_prices`, `getPrices`, `priceOf`, the dogma engine), phase 5 (`createFit`, `FitItem`, `CloneOutcome`, `src/lib/api/json.ts`) and phase 6 (the `duration()` formatter) — all merged to `main`. Every signature this plan consumes is quoted verbatim from the code as it stands in the working tree.

## Global Constraints

- **Same stack. No new runtime dependencies.** `package.json`'s `dependencies` block does not change. No HTTP library, no date library, no chart library — the monthly activity strip is CSS bars.
- **TypeScript strict, ESM.** Imports between local TS files carry the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- **Pages and API routes read Postgres only — never ESI inline** (foundation §2.1). Every name a page shows was written to `universe_names` by a job; a page that wants a name calls `displayNames`, which is Postgres-only. See Decision 3.
- **`src/lib/combat/{flags,killmail,stats,value}.ts` stay pure and isomorphic**: no `node:*` import, no `pg`, no `src/lib/db/**`, no `src/lib/sde/**`. `src/lib/combat/load.ts` and `src/lib/combat/fit.ts` are the server-only modules in that directory and are imported **only** by server components, API routes and the worker — never by a `"use client"` component. `npm run build` is what proves it; run it before the deploy task.
- **Killmails are immutable.** Once `(killmail_id, killmail_hash)` is stored, its body is never re-fetched and its ESI columns are never rewritten. Only `zkb_total_value`, `zkb_points`, `zkb_npc`, `zkb_solo`, `zkb_awox` and `computed_value` may be updated by a later source, and only from NULL or to a non-NULL value.
- **Every pinned number in a test is hand-derivable and its derivation is written out in the task that pins it** — ISK totals, efficiency percentages, month bucket indices, bar percentages, page counts.
- **No network in tests.** The zKillboard client takes an injected `fetchImpl`, `now` and `sleep`; job tests inject a fake ESI; DB tests run against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **Pristine test output.** A test that exercises a caught-and-logged failure must stub the logger (`vi.spyOn(console, "warn").mockImplementation(() => {})` / `console.error`) so the run stays clean.
- **Midnight tokens only.** Colours come from the CSS variables in `src/app/globals.css`; new styling is a new class in that file. **Never inline a colour.** Reuse the existing classes (`card`, `card-title`, `card-stack`, `card-grid`, `table`, `badge`, `muted`, `faint`, `num`, `pos`, `neg`, `page-title`, `page-sub`, `section-title`, `banner`, `stat-row`, `stat-label`, `stat-value`, `show-more`, `ship-icon`, `module-icon`, `sec-high`, `sec-low`, `sec-null`, `coming-soon`). A width or a percentage may be inline; a colour may not.
- **Tabler icons** (`@tabler/icons-react`) for any iconography.
- **"Active character" = `readSession()?.activeCharacterId`**, falling back to the first character of `listCharacters()` — that is exactly `pickActive(characters, session?.activeCharacterId ?? null)`.
- **All routes are session-guarded by `src/proxy.ts` already.** Its matcher is `["/((?!_next/static|_next/image).*)"]` and only `/login`, `/api/health`, `/auth/*`, `/_next/*` and two static files are public. **Do not add anything from phase 7 to `PUBLIC_EXACT` or `PUBLIC_PREFIXES`.**
- **400 on a malformed body or query, 404 on an unknown id.** Reuse `parseId` from `src/lib/api/json.ts`.
- **Unknown type/system/character ids render as `Unknown (id)`-style placeholders**, never as a crash and never as an inline ESI call (spec §7).
- **`esi-killmails.read_killmails.v1` is in the portal's scope set, but the four characters have not re-logged since it was added.** Until they do, ESI answers `/killmails/recent` with a 403 (or the stored `characters.scopes` simply lacks the scope). The `killmails` job must degrade the way phase-3 jobs do: no stored scope → return `0` without calling ESI; a 403 → a `JobOutcome` warning, `sync_runs.status = 'ok'`; a 401 → let it propagate so the scheduler's `markNeedsReauth` fires.
- **Never log tokens; never print `.env`.** The killmail body endpoint is public and must be called **without** `characterId` so no `Authorization` header is attached.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`; the environment is happy-dom with `tests/setup.ts`.
- Work happens on branch **`feature/phase7-combat`**, created from `main`. **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- VM: `ssh <user>@<host>`, site `https://eve.example.com`, Ansible in `deploy/ansible`, Compose project directory `/opt/eve/src/deploy`.

## Decisions taken once, for the whole plan

These are the places the spec left a choice, or where two binding documents disagreed. They are recorded here so no task re-litigates them; each is repeated in the task that first depends on it.

1. **Killmail bodies are fetched with the public client.** `esi.get<EsiKillmail>(`/killmails/${id}/${hash}`)` is called **without** `characterId`, exactly as `market-prices` calls `/markets/prices`. That means no `Authorization` header, the generous `killmail` bucket (3600 tokens / 15 min) instead of `char-killmail` (30 / 15 min), and a shared `esi_cache` row at `character_id = 0`. The hash is the only credential a killmail body needs.
2. **A killmail already in `killmails` is never fetched again.** The list walk stops as soon as a whole page contains only known ids, and unknown ids are diffed against `knownKillmailIds` before any body request. This is what keeps the job inside the 30-token list bucket.
3. **Names are resolved at *write* time by the jobs, not at render time.** Spec §4 says "lazily at render time with a per-page bounded batch (≤ 1000 ids)"; foundation §2.1 says pages never call ESI. The foundation constraint wins — it is the project-wide rule and the parent brief repeats it. The jobs therefore call `resolveNames` over every victim and attacker `character_id` / `corporation_id` / `alliance_id` they store. `NAMES_CHUNK = 1000` is only the resolver's own internal batching size for its ESI calls, not a cap on how many ids a caller may pass in one go — the spec's "≤ 1000 ids" bound is instead enforced by the caller: the backfill job (Task 5) caps what it collects into `parties` at 1000 ids per run, deferring the rest to a later run, so a 20-page run cannot fan `resolveNames` out over the thousands of ids a full budget could otherwise touch. The pages call the Postgres-only `displayNames`. An id no job has resolved yet renders as `ID <n>`.
4. **`victim.items` is flattened depth-first, one level deep.** A container's contents immediately follow the container: `[A(c1, c2), B]` becomes idx 0 = A (`parentIdx` null), 1 = c1 (`parentIdx` 0), 2 = c2 (`parentIdx` 0), 3 = B (`parentIdx` null). ESI's schema nests exactly one level (research §6), and the flattener does not recurse past that level.
5. **A killmail is valued only when *every* type it contains has a price.** Spec §4: "unpriced types are skipped and the killmail stays NULL until priced". `computeKillmailValue` returns `null` if the victim ship or any item type is unpriced, so `computed_value` stays NULL and the next hourly run retries — which is the point of extending `typesOfInterest` with killmail types. The alternative reading (sum what is priced, ignore the rest) would make "stays NULL" unreachable. Displayed value is `zkb_total_value ?? computed_value` either way (spec §4 ruling), so a killmail from zKillboard shows a value immediately.
6. **The backfill spends at most 20 zKillboard page requests per *run*, across all cursors.** Spec §2's ruling is "one request per 2 s, at most 20 pages per run, no parallelism"; spec §4's job table reads "for each character … up to 20 pages". The §2 ruling is the explicitly-labelled one and is the stricter bound, so a run is capped at 20 pages total (≈ 40 s of pacing), cursors served round-robin in `(character_id, kind)` order starting from the least-recently-updated. With four characters the whole 20,000-killmail ceiling is still reached in days, not weeks.
7. **The backfill cursor advances after every *successful* page.** Spec §7 says a non-200 leaves `next_page` unchanged; that is satisfied by advancing per page and letting the failing page throw — `next_page` then points at exactly the page that failed, and the 19 pages before it are not re-fetched.
8. **"Killmails imported" in the backfill status line is a `count(*)`, not a stored counter.** The spec's data model has no counter column and this plan does not add one: the line reads `count(*) FROM character_killmails WHERE character_id = $1`.
9. **The zKillboard `User-Agent` is a module constant, not a new env var.** Spec §2 pins it verbatim to `YutaniOS/1.0 (you@example.com; +https://eve.example.com)`. `ESI_USER_AGENT` on the VM is currently `EVE-Plasma/0.1 (you@example.com)`, which lacks the project URL zKillboard's etiquette asks for, so reusing it would be a downgrade. No `.env`, `deploy/.env.example`, `env.j2` or `group_vars` change.
10. **Period tabs and the All-characters toggle are links carrying query parameters**, so `/combat` stays a server component: `/combat?period=90d&all=1`. The only client island on the page is the killmail table's "Show more" button, which mirrors the phase-3b `WalletTables` pattern. `period` and `all` travel to `GET /api/characters/[id]/killmails` too, so an appended page matches the rows already on screen.
11. **In the All-characters view a killmail appears once.** Rows are deduplicated on `killmail_id` with `DISTINCT ON`; the role is `loss` when any of our characters is the victim, otherwise `kill` — `role = 'loss'` short-circuits first, so a killmail on which one of ours died is never even considered for the `kill` branch below. Only when the role is `kill` does "our ship" get taken from the attacker row of the **lowest of our character ids among the attackers** (the victim is by definition never one of the attacker rows, so it never enters this comparison). Deterministic, and it stops a fleet kill counting four times.
12. **An unvalued killmail contributes 0 ISK to the statistics and renders "—" in the table.** `value` is `number | null` all the way through; `combatStats` treats `null` as 0 so a partly-valued database still produces an efficiency figure.
13. **Subsystem flags are 125–132.** Spec §6 says 125–132 (eight slots); research §6 says 125–128 and marks the whole numeric table UNVERIFIED. The spec is binding, and a wider range is harmless: a flag the game never emits simply never appears.
14. **`fitFromKillmail` uses the dogma data to tell a module from its charge.** Two rows can share one numeric flag (a launcher and the ammo loaded in it are both `HiSlot0`). The builder loads `loadDogmaData` over the killmail's type ids — exactly as `fitFromEftText` does — and the row whose type has a fitting slot (`slotOfType`) becomes the module; a second row on the same flag becomes its charge. Rows in flags that are not fittable (implants 89, fighter bay 158, anything unrecognised) are dropped from the built fit.
15. **The 200-record zKillboard page in the tests is generated from a 3-record fixture**, not committed as a 200-entry JSON file. The fixture holds three real-shaped records (verified against research §6's live sample); the "full page" case repeats the template with distinct ids inside the test.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/combat/flags.ts` | **Pure.** Numeric `invFlags` → slot name and → the phase-5 fitting flag string |
| `src/lib/combat/killmail.ts` | **Pure.** The ESI killmail shapes, `flattenItems`, `toKillmailWrite`, `roleFor`, the row types the repo stores |
| `db/schema.sql` | **Modified**: `killmails`, `killmail_attackers`, `killmail_items`, `character_killmails`, `killmail_backfill` |
| `src/lib/db/killmails.ts` | Repo: `saveKillmails`, `knownKillmailIds` (write side); read side added in Task 8 |
| `src/worker/jobs/killmails.ts` | The per-character hourly ESI job |
| `src/lib/combat/zkb.ts` | The zKillboard HTTP client: URL building, page parsing, 2 s pacing |
| `src/lib/db/killmail-backfill.ts` | Repo: the `(character, kind)` page cursors and the status line's numbers |
| `src/worker/jobs/killmail-backfill.ts` | The global 15-minute zKillboard backfill job |
| `src/lib/combat/value.ts` | **Pure.** `computeKillmailValue` over `market_prices` |
| `src/lib/db/killmail-values.ts` | Repo: `unvaluedKillmails`, `setComputedValues`, `touchValueChecked`, `pruneKillmailCache` |
| `src/worker/jobs/killmail-values.ts` | The global hourly valuation job |
| `src/lib/market/interest.ts` | **Modified**: killmail item and victim-ship types join the Fuzzwork set |
| `src/worker/jobs/index.ts` | **Modified**: the three new jobs registered |
| `src/lib/combat/stats.ts` | **Pure.** `combatStats`, `periodStart` — every figure in spec §5 |
| `src/lib/view/combat.ts` | **Pure.** Tiles, month bars, top lists, killmail rows, the backfill line |
| `src/lib/view/killmail.ts` | **Pure.** The detail page's view model: header, victim, fit panel, attackers |
| `src/lib/combat/load.ts` | **Server only.** `loadCombatPage`, `loadKillmailRows`, `loadKillmailDetail` |
| `src/lib/combat/fit.ts` | **Server only.** `fitFromKillmail` — a phase-5 fit from a victim's items |
| `src/app/api/characters/[id]/killmails/route.ts` | `GET ?offset=&period=&all=` → the next 50 rows |
| `src/app/api/fits/from-killmail/route.ts` | `POST { killmailId, characterId? }` → `{ fit }` |
| `src/app/combat/page.tsx` | **Rewritten**: stats header, monthly strip, top lists, table, backfill line |
| `src/app/combat/KillmailTable.tsx` | `"use client"` — the table and its "Show more" |
| `src/app/combat/[killmailId]/page.tsx` | The detail page |
| `src/app/combat/OpenInDesigner.tsx` | `"use client"` — POSTs to `from-killmail`, then navigates |
| `src/app/globals.css` | **Modified**: combat tabs, month strip, killmail-detail classes |
| `deploy/README.md` | **Modified**: a "Combat" section |
| `tests/fixtures/esi/killmails-recent.json` | Two `(id, hash)` refs |
| `tests/fixtures/esi/killmail.json` | One full ESI killmail body: 3 attackers, nested items |
| `tests/fixtures/zkb/kills-page.json` | Three zKillboard records with their `zkb` blocks |
| `tests/combat/flags.test.ts` | Every boundary of the numeric flag ranges |
| `tests/combat/killmail.test.ts` | Flattening, mapping, role assignment |
| `tests/combat/zkb.test.ts` | URL shape, page parsing, short page, malformed page, pacing |
| `tests/combat/value.test.ts` | Valuation with full and partial prices |
| `tests/combat/stats.test.ts` | Every figure in spec §5 on a five-row fixture |
| `tests/db/schema.test.ts` | **Modified**: the five new tables and the cascades |
| `tests/db/helpers.ts` | **Modified**: `killmails` added to the TRUNCATE list |
| `tests/db/killmails.test.ts` | Insert idempotency, `zkb_*` update on conflict, cascade |
| `tests/db/killmail-backfill.test.ts` | Cursor creation, advance, status |
| `tests/db/killmail-values.test.ts` | `unvaluedKillmails` (incl. the starvation guard), `setComputedValues`, `pruneKillmailCache` |
| `tests/db/killmail-read.test.ts` | `listCombatRows`, `allCombatRows`, `countCombatRows`, `getKillmail`, dedupe |
| `tests/db/market-interest.test.ts` | **Modified**: killmail types join the union |
| `tests/db/combat-load.test.ts` | `loadCombatPage` / `loadKillmailDetail` on real Postgres |
| `tests/worker/killmails.test.ts` | Early stop, public body fetch, missing scope, 403 warning |
| `tests/worker/killmail-backfill.test.ts` | Cursor persistence, the 20-page cap, done detection |
| `tests/worker/killmail-values.test.ts` | Batch valuation, unpriced killmails left NULL |
| `tests/worker/registration.test.ts` | **Modified**: twelve jobs, four global |
| `tests/view/combat.test.ts` | Tiles, month bars, top lists, killmail rows, backfill line |
| `tests/view/killmail.test.ts` | Header, victim, fit panel grouping, attacker ordering |
| `tests/api/killmails-route.test.ts` | Paging, period/all parameters, 400s and 404s |
| `tests/api/from-killmail-route.test.ts` | 201, 404, 400 |
| `tests/components/killmail-table.test.tsx` | Badges, values, "Show more" |
| `tests/components/open-in-designer.test.tsx` | POST body, navigation, error state |

---

### Task 1: The killmail shapes — numeric flags and the ESI body (pure)

Spec §3 (the row shapes), §6 (the `invFlags` ruling) and §8 (item flattening, role assignment).
Two pure modules and the two ESI fixtures every later task tests against. Nothing here touches
Postgres, ESI or React, so the whole task is unit tests.

**Files:**
- Create: `src/lib/combat/flags.ts`, `src/lib/combat/killmail.ts`,
  `tests/combat/flags.test.ts`, `tests/combat/killmail.test.ts`,
  `tests/fixtures/esi/killmails-recent.json`, `tests/fixtures/esi/killmail.json`

**Interfaces:**
- Consumes (verbatim from the code in the working tree):
```ts
// tests/fixtures/esi.ts
export function esiFixture<T>(name: string): T;
```
- Produces:
```ts
// src/lib/combat/flags.ts
export type KillmailSlot =
  | "high" | "mid" | "low" | "rig" | "subsystem" | "drone" | "cargo" | "implant" | "fighter" | "other";
export const KILLMAIL_SLOT_ORDER: readonly KillmailSlot[];
export const SLOT_TITLES: Record<KillmailSlot, string>;
export function slotOfFlag(flag: number): KillmailSlot;
export function fitFlagOfFlag(flag: number): string | null;

// src/lib/combat/killmail.ts
export interface EsiKillmailItem {
  item_type_id: number; flag: number; singleton: number;
  quantity_destroyed?: number; quantity_dropped?: number; items?: EsiKillmailItem[];
}
export interface EsiKillmailVictim {
  character_id?: number; corporation_id?: number; alliance_id?: number; faction_id?: number;
  damage_taken: number; ship_type_id: number;
  position?: { x: number; y: number; z: number }; items?: EsiKillmailItem[];
}
export interface EsiKillmailAttacker {
  character_id?: number; corporation_id?: number; alliance_id?: number; faction_id?: number;
  damage_done: number; final_blow: boolean; security_status: number;
  ship_type_id?: number; weapon_type_id?: number;
}
export interface EsiKillmail {
  killmail_id: number; killmail_time: string; solar_system_id: number;
  moon_id?: number; war_id?: number;
  victim: EsiKillmailVictim; attackers: EsiKillmailAttacker[];
}
export interface ZkbBlock {
  hash: string; totalValue?: number; points?: number; npc?: boolean; solo?: boolean; awox?: boolean;
}
export interface KillmailItemRow {
  idx: number; parentIdx: number | null; itemTypeId: number; flag: number; singleton: number;
  quantityDestroyed: number; quantityDropped: number;
}
export interface KillmailAttackerRow {
  idx: number; characterId: number | null; corporationId: number | null; allianceId: number | null;
  factionId: number | null; shipTypeId: number | null; weaponTypeId: number | null;
  damageDone: number; finalBlow: boolean; securityStatus: number | null;
}
export interface KillmailRow {
  killmailId: number; killmailHash: string; killmailTime: Date;
  solarSystemId: number | null; moonId: number | null; warId: number | null;
  victimCharacterId: number | null; victimCorporationId: number | null;
  victimAllianceId: number | null; victimFactionId: number | null;
  victimShipTypeId: number | null; damageTaken: number | null;
  positionX: number | null; positionY: number | null; positionZ: number | null;
  attackerCount: number; finalBlowCharacterId: number | null;
  finalBlowShipTypeId: number | null; finalBlowWeaponTypeId: number | null;
  zkbTotalValue: number | null; zkbPoints: number | null;
  zkbNpc: boolean | null; zkbSolo: boolean | null; zkbAwox: boolean | null;
  source: "esi" | "zkb";
}
export interface KillmailWrite {
  killmail: KillmailRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[];
}
export type KillRole = "kill" | "loss";
export interface CharacterKillmailLink { characterId: number; killmailId: number; role: KillRole }
export function flattenItems(items: EsiKillmailItem[] | undefined): KillmailItemRow[];
export function toKillmailWrite(
  body: EsiKillmail, hash: string, source: "esi" | "zkb", zkb?: ZkbBlock,
): KillmailWrite;
export function roleFor(body: EsiKillmail, characterId: number): KillRole | null;
export function partyIds(body: EsiKillmail): number[];
```

- [ ] **Step 1: Write the two ESI fixtures**

Create `tests/fixtures/esi/killmails-recent.json` — one page of `GET /characters/{id}/killmails/recent`:
```json
[
  { "killmail_id": 120000001, "killmail_hash": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678" },
  { "killmail_id": 120000002, "killmail_hash": "b2c3d4e5f60718293a4b5c6d7e8f901234567890" }
]
```

Create `tests/fixtures/esi/killmail.json` — the body of 120000001, a loss for character 90000101
flying a Caracal (type 621) in Jita (30000142), with one container holding two stacks:
```json
{
  "killmail_id": 120000001,
  "killmail_time": "2026-09-01T12:00:00Z",
  "solar_system_id": 30000142,
  "victim": {
    "character_id": 90000101,
    "corporation_id": 98000001,
    "alliance_id": 99000001,
    "damage_taken": 4210,
    "ship_type_id": 621,
    "position": { "x": 1.5e11, "y": -2.5e10, "z": 3.75e11 },
    "items": [
      { "item_type_id": 3634, "flag": 27, "singleton": 0, "quantity_dropped": 1 },
      { "item_type_id": 11488, "flag": 5, "singleton": 0, "quantity_destroyed": 1,
        "items": [
          { "item_type_id": 34, "flag": 0, "singleton": 0, "quantity_destroyed": 5000 },
          { "item_type_id": 35, "flag": 0, "singleton": 0, "quantity_dropped": 2000 }
        ] },
      { "item_type_id": 2456, "flag": 87, "singleton": 0, "quantity_destroyed": 5 }
    ]
  },
  "attackers": [
    { "character_id": 2112625428, "corporation_id": 98000002, "damage_done": 1200,
      "final_blow": false, "security_status": -1.4, "ship_type_id": 587, "weapon_type_id": 2929 },
    { "character_id": 90000102, "corporation_id": 98000002, "alliance_id": 99000002,
      "damage_done": 3010, "final_blow": true, "security_status": 0.6,
      "ship_type_id": 11393, "weapon_type_id": 3025 },
    { "faction_id": 500003, "damage_done": 0, "final_blow": false, "security_status": 0 }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/combat/flags.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  KILLMAIL_SLOT_ORDER, SLOT_TITLES, fitFlagOfFlag, slotOfFlag,
} from "../../src/lib/combat/flags.js";

describe("slotOfFlag", () => {
  it("maps every band from spec §6 including both boundaries", () => {
    expect([11, 14, 18].map(slotOfFlag)).toEqual(["low", "low", "low"]);
    expect([19, 22, 26].map(slotOfFlag)).toEqual(["mid", "mid", "mid"]);
    expect([27, 30, 34].map(slotOfFlag)).toEqual(["high", "high", "high"]);
    expect([92, 93, 94].map(slotOfFlag)).toEqual(["rig", "rig", "rig"]);
    expect([125, 128, 132].map(slotOfFlag)).toEqual(["subsystem", "subsystem", "subsystem"]);
    expect(slotOfFlag(87)).toBe("drone");
    expect(slotOfFlag(5)).toBe("cargo");
    expect(slotOfFlag(89)).toBe("implant");
    expect(slotOfFlag(158)).toBe("fighter");
  });
  it("calls anything outside those bands other", () => {
    expect([0, 4, 10, 35, 91, 95, 124, 133, 999].map(slotOfFlag)).toEqual(
      ["other", "other", "other", "other", "other", "other", "other", "other", "other"]);
  });
  it("names every slot it can return, in display order", () => {
    expect(KILLMAIL_SLOT_ORDER).toEqual(
      ["high", "mid", "low", "rig", "subsystem", "drone", "fighter", "implant", "cargo", "other"]);
    for (const slot of KILLMAIL_SLOT_ORDER) expect(SLOT_TITLES[slot]).toBeTruthy();
    expect(SLOT_TITLES.subsystem).toBe("Subsystems");
  });
});

describe("fitFlagOfFlag", () => {
  it("turns a numeric flag into the phase-5 fitting flag with the right index", () => {
    expect(fitFlagOfFlag(27)).toBe("HiSlot0");
    expect(fitFlagOfFlag(34)).toBe("HiSlot7");
    expect(fitFlagOfFlag(19)).toBe("MedSlot0");
    expect(fitFlagOfFlag(26)).toBe("MedSlot7");
    expect(fitFlagOfFlag(11)).toBe("LoSlot0");
    expect(fitFlagOfFlag(18)).toBe("LoSlot7");
    expect(fitFlagOfFlag(92)).toBe("RigSlot0");
    expect(fitFlagOfFlag(94)).toBe("RigSlot2");
    expect(fitFlagOfFlag(125)).toBe("SubSystemSlot0");
    expect(fitFlagOfFlag(132)).toBe("SubSystemSlot7");
    expect(fitFlagOfFlag(87)).toBe("DroneBay");
    expect(fitFlagOfFlag(5)).toBe("Cargo");
  });
  it("returns null for anything a fit cannot hold", () => {
    for (const flag of [0, 89, 158, 999]) expect(fitFlagOfFlag(flag)).toBeNull();
  });
});
```

Create `tests/combat/killmail.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  flattenItems, partyIds, roleFor, toKillmailWrite, type EsiKillmail,
} from "../../src/lib/combat/killmail.js";
import { esiFixture } from "../fixtures/esi.js";

const body = (): EsiKillmail => esiFixture<EsiKillmail>("killmail");
const VICTIM = 90000101;
const ATTACKER = 2112625428;

describe("flattenItems", () => {
  it("is depth first: a container's contents follow it and carry its idx as parentIdx", () => {
    expect(flattenItems(body().victim.items)).toEqual([
      { idx: 0, parentIdx: null, itemTypeId: 3634, flag: 27, singleton: 0,
        quantityDestroyed: 0, quantityDropped: 1 },
      { idx: 1, parentIdx: null, itemTypeId: 11488, flag: 5, singleton: 0,
        quantityDestroyed: 1, quantityDropped: 0 },
      { idx: 2, parentIdx: 1, itemTypeId: 34, flag: 0, singleton: 0,
        quantityDestroyed: 5000, quantityDropped: 0 },
      { idx: 3, parentIdx: 1, itemTypeId: 35, flag: 0, singleton: 0,
        quantityDestroyed: 0, quantityDropped: 2000 },
      { idx: 4, parentIdx: null, itemTypeId: 2456, flag: 87, singleton: 0,
        quantityDestroyed: 5, quantityDropped: 0 },
    ]);
  });
  it("returns an empty list when the victim carried nothing", () => {
    expect(flattenItems(undefined)).toEqual([]);
    expect(flattenItems([])).toEqual([]);
  });
});

describe("toKillmailWrite", () => {
  it("maps the header, counts attackers and copies the final blow onto the killmail", () => {
    const w = toKillmailWrite(body(), "a1b2c3", "esi");
    expect(w.killmail).toEqual({
      killmailId: 120000001, killmailHash: "a1b2c3",
      killmailTime: new Date("2026-09-01T12:00:00Z"),
      solarSystemId: 30000142, moonId: null, warId: null,
      victimCharacterId: VICTIM, victimCorporationId: 98000001,
      victimAllianceId: 99000001, victimFactionId: null,
      victimShipTypeId: 621, damageTaken: 4210,
      positionX: 1.5e11, positionY: -2.5e10, positionZ: 3.75e11,
      attackerCount: 3, finalBlowCharacterId: 90000102,
      finalBlowShipTypeId: 11393, finalBlowWeaponTypeId: 3025,
      zkbTotalValue: null, zkbPoints: null, zkbNpc: null, zkbSolo: null, zkbAwox: null,
      source: "esi",
    });
  });
  it("maps attackers in ESI's order, nulling every absent optional field", () => {
    const w = toKillmailWrite(body(), "a1b2c3", "esi");
    expect(w.attackers).toHaveLength(3);
    expect(w.attackers[0]).toEqual({
      idx: 0, characterId: ATTACKER, corporationId: 98000002, allianceId: null, factionId: null,
      shipTypeId: 587, weaponTypeId: 2929, damageDone: 1200, finalBlow: false, securityStatus: -1.4,
    });
    expect(w.attackers[2]).toEqual({
      idx: 2, characterId: null, corporationId: null, allianceId: null, factionId: 500003,
      shipTypeId: null, weaponTypeId: null, damageDone: 0, finalBlow: false, securityStatus: 0,
    });
  });
  it("copies the zkb block when one is supplied", () => {
    const w = toKillmailWrite(body(), "a1b2c3", "zkb", {
      hash: "a1b2c3", totalValue: 60633419.79, points: 1, npc: false, solo: true, awox: false,
    });
    expect(w.killmail.source).toBe("zkb");
    expect(w.killmail.zkbTotalValue).toBe(60633419.79);
    expect(w.killmail.zkbPoints).toBe(1);
    expect([w.killmail.zkbNpc, w.killmail.zkbSolo, w.killmail.zkbAwox]).toEqual([false, true, false]);
  });
  it("leaves the whole zkb block null when there is none, and position null when ESI omits it", () => {
    const raw = body();
    delete raw.victim.position;
    const w = toKillmailWrite(raw, "a1b2c3", "esi");
    expect([w.killmail.positionX, w.killmail.positionY, w.killmail.positionZ]).toEqual([null, null, null]);
    expect(w.killmail.zkbTotalValue).toBeNull();
  });
});

describe("roleFor", () => {
  it("is a loss for the victim, a kill for an attacker and null for a bystander", () => {
    expect(roleFor(body(), VICTIM)).toBe("loss");
    expect(roleFor(body(), ATTACKER)).toBe("kill");
    expect(roleFor(body(), 90000102)).toBe("kill");
    expect(roleFor(body(), 1)).toBeNull();
  });
});

describe("partyIds", () => {
  it("collects every character, corporation and alliance id exactly once", () => {
    expect(partyIds(body()).sort((a, b) => a - b)).toEqual([
      98000001, 98000002, 99000001, 99000002, 90000101, 2112625428, 90000102,
    ].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/combat/flags.test.ts tests/combat/killmail.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/combat/flags.js".

- [ ] **Step 4: Write `src/lib/combat/flags.ts`**

```ts
/**
 * Killmail item flags are raw SDE `invFlags.flagID` integers — a third vocabulary, unrelated to the
 * asset and fitting string enums (research §8d). The bands are spec §6's ruling: low 11-18, mid
 * 19-26, high 27-34, rigs 92-94, subsystems 125-132, drone bay 87, cargo 5, implants 89, fighter
 * bay 158; anything else is "other". Pure — a client component may import this.
 */
export type KillmailSlot =
  | "high" | "mid" | "low" | "rig" | "subsystem" | "drone" | "cargo" | "implant" | "fighter" | "other";

/** Display order of the fit panel (spec §6): the ship's own slots first, then everything carried. */
export const KILLMAIL_SLOT_ORDER: readonly KillmailSlot[] = [
  "high", "mid", "low", "rig", "subsystem", "drone", "fighter", "implant", "cargo", "other",
];

export const SLOT_TITLES: Record<KillmailSlot, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
  drone: "Drone bay", fighter: "Fighter bay", implant: "Implants", cargo: "Cargo", other: "Other",
};

/** [first flag, last flag, slot, the phase-5 flag prefix or null when a fit cannot hold it]. */
const BANDS: readonly (readonly [number, number, KillmailSlot, string | null])[] = [
  [11, 18, "low", "LoSlot"],
  [19, 26, "mid", "MedSlot"],
  [27, 34, "high", "HiSlot"],
  [92, 94, "rig", "RigSlot"],
  [125, 132, "subsystem", "SubSystemSlot"],
  [5, 5, "cargo", "Cargo"],
  [87, 87, "drone", "DroneBay"],
  [89, 89, "implant", null],
  [158, 158, "fighter", null],
];

export function slotOfFlag(flag: number): KillmailSlot {
  for (const [from, to, slot] of BANDS) if (flag >= from && flag <= to) return slot;
  return "other";
}

/**
 * The phase-5 fitting flag for a numeric killmail flag — `27` is `HiSlot0`, so the built fit lands
 * in the same slot the victim used. `null` means the item was never fitted (an implant, a fighter,
 * an unrecognised flag) and belongs in no fit.
 */
export function fitFlagOfFlag(flag: number): string | null {
  for (const [from, to, , prefix] of BANDS) {
    if (flag < from || flag > to || prefix === null) continue;
    return from === to ? prefix : `${prefix}${flag - from}`;
  }
  return null;
}
```

- [ ] **Step 5: Write `src/lib/combat/killmail.ts`**

```ts
/**
 * The ESI killmail body and the rows it becomes. Pure and isomorphic: no `pg`, no `node:*`, so the
 * repo, the worker jobs and the zKillboard parser all share one set of shapes.
 *
 * Killmails are immutable, which is why nothing here has an "update" form — a body is mapped once
 * and stored once. Only the `zkb_*` columns can arrive later, from a different source.
 */
export interface EsiKillmailItem {
  item_type_id: number; flag: number; singleton: number;
  quantity_destroyed?: number; quantity_dropped?: number; items?: EsiKillmailItem[];
}
export interface EsiKillmailVictim {
  character_id?: number; corporation_id?: number; alliance_id?: number; faction_id?: number;
  damage_taken: number; ship_type_id: number;
  position?: { x: number; y: number; z: number }; items?: EsiKillmailItem[];
}
export interface EsiKillmailAttacker {
  character_id?: number; corporation_id?: number; alliance_id?: number; faction_id?: number;
  damage_done: number; final_blow: boolean; security_status: number;
  ship_type_id?: number; weapon_type_id?: number;
}
export interface EsiKillmail {
  killmail_id: number; killmail_time: string; solar_system_id: number;
  moon_id?: number; war_id?: number;
  victim: EsiKillmailVictim; attackers: EsiKillmailAttacker[];
}

/** zKillboard's own block. Only `hash` is guaranteed; the rest are best-effort extras (research §6). */
export interface ZkbBlock {
  hash: string; totalValue?: number; points?: number; npc?: boolean; solo?: boolean; awox?: boolean;
}

export interface KillmailItemRow {
  idx: number; parentIdx: number | null; itemTypeId: number; flag: number; singleton: number;
  quantityDestroyed: number; quantityDropped: number;
}
export interface KillmailAttackerRow {
  idx: number; characterId: number | null; corporationId: number | null; allianceId: number | null;
  factionId: number | null; shipTypeId: number | null; weaponTypeId: number | null;
  damageDone: number; finalBlow: boolean; securityStatus: number | null;
}
export interface KillmailRow {
  killmailId: number; killmailHash: string; killmailTime: Date;
  solarSystemId: number | null; moonId: number | null; warId: number | null;
  victimCharacterId: number | null; victimCorporationId: number | null;
  victimAllianceId: number | null; victimFactionId: number | null;
  victimShipTypeId: number | null; damageTaken: number | null;
  positionX: number | null; positionY: number | null; positionZ: number | null;
  attackerCount: number; finalBlowCharacterId: number | null;
  finalBlowShipTypeId: number | null; finalBlowWeaponTypeId: number | null;
  zkbTotalValue: number | null; zkbPoints: number | null;
  zkbNpc: boolean | null; zkbSolo: boolean | null; zkbAwox: boolean | null;
  source: "esi" | "zkb";
}
export interface KillmailWrite {
  killmail: KillmailRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[];
}

export type KillRole = "kill" | "loss";
export interface CharacterKillmailLink { characterId: number; killmailId: number; role: KillRole }

const num = (v: number | undefined): number | null => (v === undefined ? null : v);
const bool = (v: boolean | undefined): boolean | null => (v === undefined ? null : v);

/**
 * ESI nests `items` exactly one level — a container's contents (research §6). Flattening is depth
 * first, so a container is immediately followed by what was inside it and `parentIdx` points back
 * at the container's own `idx`. `quantity_destroyed` and `quantity_dropped` are both optional and
 * normally exactly one is present; the absent one is stored as 0, never NULL, so the value job can
 * add them without a COALESCE.
 */
export function flattenItems(items: EsiKillmailItem[] | undefined): KillmailItemRow[] {
  const out: KillmailItemRow[] = [];
  const push = (item: EsiKillmailItem, parentIdx: number | null): number => {
    const idx = out.length;
    out.push({
      idx, parentIdx, itemTypeId: item.item_type_id, flag: item.flag, singleton: item.singleton,
      quantityDestroyed: item.quantity_destroyed ?? 0, quantityDropped: item.quantity_dropped ?? 0,
    });
    return idx;
  };
  for (const item of items ?? []) {
    const parent = push(item, null);
    for (const child of item.items ?? []) push(child, parent);
  }
  return out;
}

export function toKillmailWrite(
  body: EsiKillmail, hash: string, source: "esi" | "zkb", zkb?: ZkbBlock,
): KillmailWrite {
  const attackers: KillmailAttackerRow[] = body.attackers.map((a, idx) => ({
    idx,
    characterId: num(a.character_id), corporationId: num(a.corporation_id),
    allianceId: num(a.alliance_id), factionId: num(a.faction_id),
    shipTypeId: num(a.ship_type_id), weaponTypeId: num(a.weapon_type_id),
    damageDone: a.damage_done, finalBlow: a.final_blow, securityStatus: a.security_status,
  }));
  const final = attackers.find((a) => a.finalBlow) ?? null;
  const position = body.victim.position;
  return {
    killmail: {
      killmailId: body.killmail_id, killmailHash: hash,
      killmailTime: new Date(body.killmail_time),
      solarSystemId: body.solar_system_id, moonId: num(body.moon_id), warId: num(body.war_id),
      victimCharacterId: num(body.victim.character_id),
      victimCorporationId: num(body.victim.corporation_id),
      victimAllianceId: num(body.victim.alliance_id),
      victimFactionId: num(body.victim.faction_id),
      victimShipTypeId: body.victim.ship_type_id, damageTaken: body.victim.damage_taken,
      positionX: position?.x ?? null, positionY: position?.y ?? null, positionZ: position?.z ?? null,
      attackerCount: attackers.length,
      finalBlowCharacterId: final?.characterId ?? null,
      finalBlowShipTypeId: final?.shipTypeId ?? null,
      finalBlowWeaponTypeId: final?.weaponTypeId ?? null,
      zkbTotalValue: num(zkb?.totalValue), zkbPoints: num(zkb?.points),
      zkbNpc: bool(zkb?.npc), zkbSolo: bool(zkb?.solo), zkbAwox: bool(zkb?.awox),
      source,
    },
    attackers,
    items: flattenItems(body.victim.items),
  };
}

/** Spec §3: `loss` when the character is the victim, `kill` when they are among the attackers. */
export function roleFor(body: EsiKillmail, characterId: number): KillRole | null {
  if (body.victim.character_id === characterId) return "loss";
  return body.attackers.some((a) => a.character_id === characterId) ? "kill" : null;
}

/**
 * Every id worth a name: victim and attacker characters, their corporations and their alliances.
 * The jobs feed this to `resolveNames` so the pages can stay Postgres-only (Decision 3).
 */
export function partyIds(body: EsiKillmail): number[] {
  const ids = new Set<number>();
  const add = (id: number | undefined): void => { if (typeof id === "number" && id > 0) ids.add(id); };
  add(body.victim.character_id); add(body.victim.corporation_id); add(body.victim.alliance_id);
  for (const a of body.attackers) { add(a.character_id); add(a.corporation_id); add(a.alliance_id); }
  return [...ids];
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/combat/flags.test.ts tests/combat/killmail.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/combat tests/combat tests/fixtures/esi/killmail.json tests/fixtures/esi/killmails-recent.json
git commit -m "$(cat <<'EOM'
feat(combat): numeric killmail flags and the ESI killmail shapes

Pure modules: slotOfFlag/fitFlagOfFlag over spec §6's invFlags bands, and
flattenItems/toKillmailWrite/roleFor/partyIds over the ESI body. Item
flattening is depth first with parentIdx, one level of nesting.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: The phase-7 schema and the killmail write repo

Spec §3. Five tables and the one write path every source shares. The whole point of this task is
idempotency: the same killmail arriving twice, from two sources, must leave one row whose ESI
columns are untouched and whose `zkb_*` columns gain whatever the newcomer knew.

**Files:**
- Modify: `db/schema.sql`, `tests/db/helpers.ts`, `tests/db/schema.test.ts`
- Create: `src/lib/db/killmails.ts`, `tests/db/killmails.test.ts`

**Interfaces:**
- Consumes (Task 1, and verbatim from the working tree):
```ts
// src/lib/combat/killmail.ts (Task 1)
export interface KillmailWrite { killmail: KillmailRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[] }
export interface CharacterKillmailLink { characterId: number; killmailId: number; role: KillRole }
// src/lib/db/client.ts
export function getPool(): Pool;
// src/lib/chunk.ts
export function chunk<T>(items: readonly T[], size: number): T[][];
// tests/db/helpers.ts
export async function resetDb(): Promise<Pool>;
```
- Produces:
```ts
// src/lib/db/killmails.ts
export const KILLMAIL_INSERT_BATCH: number;   // 500
export async function knownKillmailIds(ids: number[]): Promise<Set<number>>;
export async function saveKillmails(
  writes: KillmailWrite[], links: CharacterKillmailLink[],
): Promise<number>;
```

- [ ] **Step 1: Write the failing test**

Create `tests/db/killmails.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { knownKillmailIds, saveKillmails } from "../../src/lib/db/killmails.js";
import { toKillmailWrite, type EsiKillmail } from "../../src/lib/combat/killmail.js";
import { esiFixture } from "../fixtures/esi.js";

let pool: Pool;
const CID = 90000101;
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
    expect(km.rows[0].final_blow_character_id).toBe("90000102");
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
```

Add `killmails` to the TRUNCATE list in `tests/db/helpers.ts` — `character_killmails` and
`killmail_backfill` cascade from `characters`, but `killmails` has no foreign key of its own:
```ts
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts, universe_names, structures, market_prices, fits, skill_plans, killmails RESTART IDENTITY CASCADE");
```

Extend the table list in `tests/db/schema.test.ts` — add these five names in sorted position:
```ts
      "character_assets", "character_attributes", "character_clones", "character_fitting_items",
      "character_fittings", "character_implants", "character_jump_clones", "character_killmails",
      "character_location",
      "character_skill_queue", "character_skill_summary", "character_skills", "character_wallet",
      "character_wallet_journal", "character_wallet_transactions", "characters", "esi_cache",
      "fit_items", "fits",
      "killmail_attackers", "killmail_backfill", "killmail_items", "killmails",
      "market_prices",
```
and add a check that the two enum-ish columns are constrained:
```ts
  it("constrains killmails.source and character_killmails.role", async () => {
    await expect(pool.query(
      `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, source)
       VALUES (1, 'h', now(), 'bogus')`)).rejects.toThrow(/check/i);
    await pool.query(
      `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, source)
       VALUES (1, 'h', now(), 'esi')`);
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (77, 'Role', 'enc')");
    await expect(pool.query(
      "INSERT INTO character_killmails (character_id, killmail_id, role) VALUES (77, 1, 'assist')"))
      .rejects.toThrow(/check/i);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `docker compose -f compose.dev.yml up -d && npx vitest run tests/db/killmails.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/db/killmails.js".

- [ ] **Step 3: Add the tables to `db/schema.sql`**

Append to the end of the file:
```sql
-- ── Phase 7: combat (killmails & PvP stats) ─────────────────────────────────
-- Killmails are immutable and shared: one row however many of our characters were on it, and no
-- foreign key to characters, so a killmail survives a character being removed. Only the zkb_* and
-- computed_value columns are ever updated (spec §3).
CREATE TABLE IF NOT EXISTS killmails (
  killmail_id                bigint PRIMARY KEY,
  killmail_hash              text NOT NULL,
  killmail_time              timestamptz NOT NULL,
  solar_system_id            int,
  moon_id                    bigint,
  war_id                     bigint,
  victim_character_id        bigint,                 -- absent for structure/POS/NPC losses
  victim_corporation_id      bigint,
  victim_alliance_id         bigint,
  victim_faction_id          int,
  victim_ship_type_id        int,
  damage_taken               bigint,
  position_x                 float8,
  position_y                 float8,
  position_z                 float8,
  attacker_count             int NOT NULL DEFAULT 0,
  final_blow_character_id    bigint,
  final_blow_ship_type_id    int,
  final_blow_weapon_type_id  int,
  zkb_total_value            numeric,
  zkb_points                 int,
  zkb_npc                    bool,
  zkb_solo                   bool,
  zkb_awox                   bool,
  computed_value             numeric,
  value_checked_at           timestamptz,            -- last time killmail-values examined this row,
                                                      -- priced or not (starvation guard, see Task 6)
  source                     text NOT NULL CHECK (source IN ('esi', 'zkb')),
  fetched_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS killmails_time_idx ON killmails (killmail_time DESC);
CREATE INDEX IF NOT EXISTS killmails_unvalued_idx
  ON killmails (value_checked_at NULLS FIRST, killmail_time DESC) WHERE computed_value IS NULL;

CREATE TABLE IF NOT EXISTS killmail_attackers (
  killmail_id      bigint NOT NULL REFERENCES killmails(killmail_id) ON DELETE CASCADE,
  idx              int NOT NULL,                     -- position in ESI's attackers array
  character_id     bigint,                           -- NPC attackers have a faction and no character
  corporation_id   bigint,
  alliance_id      bigint,
  faction_id       int,
  ship_type_id     int,
  weapon_type_id   int,
  damage_done      bigint NOT NULL DEFAULT 0,
  final_blow       bool NOT NULL DEFAULT false,
  security_status  float8,
  PRIMARY KEY (killmail_id, idx)
);
CREATE INDEX IF NOT EXISTS killmail_attackers_character_idx ON killmail_attackers (character_id);

-- flag is the raw numeric SDE invFlags id, NOT the assets/fittings string enum (research §8d).
-- parent_idx is the containing row's idx; ESI nests exactly one level.
CREATE TABLE IF NOT EXISTS killmail_items (
  killmail_id         bigint NOT NULL REFERENCES killmails(killmail_id) ON DELETE CASCADE,
  idx                 int NOT NULL,
  parent_idx          int,
  item_type_id        int NOT NULL,
  flag                int NOT NULL,
  singleton           int NOT NULL DEFAULT 0,        -- an integer, not a bool
  quantity_destroyed  bigint NOT NULL DEFAULT 0,
  quantity_dropped    bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (killmail_id, idx)
);
CREATE INDEX IF NOT EXISTS killmail_items_type_idx ON killmail_items (item_type_id);

CREATE TABLE IF NOT EXISTS character_killmails (
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  killmail_id   bigint NOT NULL REFERENCES killmails(killmail_id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('kill', 'loss')),
  PRIMARY KEY (character_id, killmail_id)
);
CREATE INDEX IF NOT EXISTS character_killmails_idx ON character_killmails (character_id, killmail_id DESC);

-- One page cursor per (character, kind). Created on first sight of a character by the backfill job.
CREATE TABLE IF NOT EXISTS killmail_backfill (
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('kills', 'losses')),
  next_page     int NOT NULL DEFAULT 1,
  done          bool NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, kind)
);
```

- [ ] **Step 4: Write `src/lib/db/killmails.ts`**

```ts
import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type { CharacterKillmailLink, KillmailWrite } from "../combat/killmail.js";

/** zKillboard hands over 200 killmails a page; 500 rows an INSERT keeps the arrays small. */
export const KILLMAIL_INSERT_BATCH = 500;

const big = (v: number | null): string | null => (v === null ? null : String(v));

/**
 * Which of these killmails we already have. The `killmails` job diffs `/killmails/recent` against
 * this before fetching a single body — killmails are immutable, so a known id is never re-fetched.
 */
export async function knownKillmailIds(ids: number[]): Promise<Set<number>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return new Set();
  const { rows } = await getPool().query<{ killmailId: string }>(
    `SELECT killmail_id AS "killmailId" FROM killmails WHERE killmail_id = ANY($1::bigint[])`,
    [wanted.map(String)]);
  return new Set(rows.map((r) => Number(r.killmailId)));
}

/**
 * `ON CONFLICT` aborts the whole statement if the same conflict target appears twice in one INSERT's
 * VALUES — "ON CONFLICT DO UPDATE command cannot affect row a second time". A killmail id can appear
 * twice in one call (two characters' cursors turning up the same kill in the same run), so de-dupe
 * defensively before chunking, mirroring `market-prices.ts`'s `dedupeByTypeId`: last write for a
 * given killmail id wins.
 */
function dedupeByKillmailId(writes: KillmailWrite[]): KillmailWrite[] {
  return [...new Map(writes.map((w) => [w.killmail.killmailId, w])).values()];
}

/** Same hazard for `(character_id, killmail_id)`. `loss` wins over `kill` so a duplicate can never
 * regress the upgrade a single call would otherwise have made. */
function dedupeLinks(links: CharacterKillmailLink[]): CharacterKillmailLink[] {
  const byKey = new Map<string, CharacterKillmailLink>();
  for (const link of links) {
    const key = `${link.characterId}:${link.killmailId}`;
    const existing = byKey.get(key);
    if (existing === undefined || (existing.role !== "loss" && link.role === "loss")) byKey.set(key, link);
  }
  return [...byKey.values()];
}

/**
 * One transaction for a batch of killmails and the links that say which of our characters were on
 * them. Spec §3: everything is `ON CONFLICT DO NOTHING` except the five `zkb_*` columns, which are
 * COALESCEd so a later zKillboard sighting fills in what ESI never sends and a later ESI sighting
 * (which carries no zkb block at all) cannot blank them. `source` is whichever source got there
 * first — it records provenance, not freshness.
 *
 * A link may be upgraded from `kill` to `loss` (a character can be the victim of a killmail we
 * first saw them attacking on — a self-destruct or a mistake in an earlier role assignment) but
 * never downgraded.
 *
 * Returns the number of rows actually written, which is what the scheduler logs.
 */
export async function saveKillmails(
  writes: KillmailWrite[], links: CharacterKillmailLink[],
): Promise<number> {
  writes = dedupeByKillmailId(writes);
  links = dedupeLinks(links);
  if (writes.length === 0 && links.length === 0) return 0;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;

    for (const batch of chunk(writes, KILLMAIL_INSERT_BATCH)) {
      const k = batch.map((w) => w.killmail);
      const res = await client.query(
        `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id, moon_id,
           war_id, victim_character_id, victim_corporation_id, victim_alliance_id, victim_faction_id,
           victim_ship_type_id, damage_taken, position_x, position_y, position_z, attacker_count,
           final_blow_character_id, final_blow_ship_type_id, final_blow_weapon_type_id,
           zkb_total_value, zkb_points, zkb_npc, zkb_solo, zkb_awox, source)
         SELECT * FROM unnest($1::bigint[], $2::text[], $3::timestamptz[], $4::int[], $5::bigint[],
           $6::bigint[], $7::bigint[], $8::bigint[], $9::bigint[], $10::int[],
           $11::int[], $12::bigint[], $13::float8[], $14::float8[], $15::float8[], $16::int[],
           $17::bigint[], $18::int[], $19::int[],
           $20::numeric[], $21::int[], $22::bool[], $23::bool[], $24::bool[], $25::text[])
         ON CONFLICT (killmail_id) DO UPDATE SET
           zkb_total_value = COALESCE(EXCLUDED.zkb_total_value, killmails.zkb_total_value),
           zkb_points      = COALESCE(EXCLUDED.zkb_points,      killmails.zkb_points),
           zkb_npc         = COALESCE(EXCLUDED.zkb_npc,         killmails.zkb_npc),
           zkb_solo        = COALESCE(EXCLUDED.zkb_solo,        killmails.zkb_solo),
           zkb_awox        = COALESCE(EXCLUDED.zkb_awox,        killmails.zkb_awox)
         WHERE killmails.zkb_total_value IS NULL AND EXCLUDED.zkb_total_value IS NOT NULL`,
        [k.map((r) => String(r.killmailId)), k.map((r) => r.killmailHash), k.map((r) => r.killmailTime),
         k.map((r) => r.solarSystemId), k.map((r) => big(r.moonId)), k.map((r) => big(r.warId)),
         k.map((r) => big(r.victimCharacterId)), k.map((r) => big(r.victimCorporationId)),
         k.map((r) => big(r.victimAllianceId)), k.map((r) => r.victimFactionId),
         k.map((r) => r.victimShipTypeId), k.map((r) => big(r.damageTaken)),
         k.map((r) => r.positionX), k.map((r) => r.positionY), k.map((r) => r.positionZ),
         k.map((r) => r.attackerCount), k.map((r) => big(r.finalBlowCharacterId)),
         k.map((r) => r.finalBlowShipTypeId), k.map((r) => r.finalBlowWeaponTypeId),
         k.map((r) => r.zkbTotalValue), k.map((r) => r.zkbPoints),
         k.map((r) => r.zkbNpc), k.map((r) => r.zkbSolo), k.map((r) => r.zkbAwox),
         k.map((r) => r.source)]);
      rows += res.rowCount ?? 0;

      const attackers = batch.flatMap((w) => w.attackers.map((a) => ({ killmailId: w.killmail.killmailId, ...a })));
      for (const part of chunk(attackers, KILLMAIL_INSERT_BATCH)) {
        const res2 = await client.query(
          `INSERT INTO killmail_attackers (killmail_id, idx, character_id, corporation_id, alliance_id,
             faction_id, ship_type_id, weapon_type_id, damage_done, final_blow, security_status)
           SELECT * FROM unnest($1::bigint[], $2::int[], $3::bigint[], $4::bigint[], $5::bigint[],
             $6::int[], $7::int[], $8::int[], $9::bigint[], $10::bool[], $11::float8[])
           ON CONFLICT (killmail_id, idx) DO NOTHING`,
          [part.map((a) => String(a.killmailId)), part.map((a) => a.idx),
           part.map((a) => big(a.characterId)), part.map((a) => big(a.corporationId)),
           part.map((a) => big(a.allianceId)), part.map((a) => a.factionId),
           part.map((a) => a.shipTypeId), part.map((a) => a.weaponTypeId),
           part.map((a) => String(a.damageDone)), part.map((a) => a.finalBlow),
           part.map((a) => a.securityStatus)]);
        rows += res2.rowCount ?? 0;
      }

      const items = batch.flatMap((w) => w.items.map((i) => ({ killmailId: w.killmail.killmailId, ...i })));
      for (const part of chunk(items, KILLMAIL_INSERT_BATCH)) {
        const res3 = await client.query(
          `INSERT INTO killmail_items (killmail_id, idx, parent_idx, item_type_id, flag, singleton,
             quantity_destroyed, quantity_dropped)
           SELECT * FROM unnest($1::bigint[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[],
             $7::bigint[], $8::bigint[])
           ON CONFLICT (killmail_id, idx) DO NOTHING`,
          [part.map((i) => String(i.killmailId)), part.map((i) => i.idx), part.map((i) => i.parentIdx),
           part.map((i) => i.itemTypeId), part.map((i) => i.flag), part.map((i) => i.singleton),
           part.map((i) => String(i.quantityDestroyed)), part.map((i) => String(i.quantityDropped))]);
        rows += res3.rowCount ?? 0;
      }
    }

    for (const batch of chunk(links, KILLMAIL_INSERT_BATCH)) {
      const res = await client.query(
        `INSERT INTO character_killmails (character_id, killmail_id, role)
         SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::text[])
         ON CONFLICT (character_id, killmail_id) DO UPDATE SET role = 'loss'
         WHERE character_killmails.role <> 'loss' AND EXCLUDED.role = 'loss'`,
        [batch.map((l) => String(l.characterId)), batch.map((l) => String(l.killmailId)),
         batch.map((l) => l.role)]);
      rows += res.rowCount ?? 0;
    }

    await client.query("COMMIT");
    return rows;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/db/killmails.test.ts tests/db/schema.test.ts`
Expected: PASS. The `written` count of 10 is 1 killmail + 3 attackers + 5 flattened item rows
(3 top-level plus the 2 inside the container) + 1 link.

- [ ] **Step 6: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add db/schema.sql src/lib/db/killmails.ts tests/db
git commit -m "$(cat <<'EOM'
feat(combat): the phase-7 schema and the killmail write repo

Five tables (killmails, killmail_attackers, killmail_items,
character_killmails, killmail_backfill) and saveKillmails/knownKillmailIds.
Inserts are ON CONFLICT DO NOTHING except the zkb_* columns, which a later
zKillboard sighting fills in; a link may be upgraded kill -> loss only.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: The `killmails` job

Spec §4, row 1. A per-character hourly job that walks `/killmails/recent` until it recognises a
whole page, fetches each unknown body from the **public** killmail endpoint, stores everything with
`source = 'esi'` and links it with the right role. Registered in `ALL_JOBS` here so the worker picks
it up as soon as the task lands.

**The scope caveat matters.** `esi-killmails.read_killmails.v1` is enabled on the portal but the four
characters have not logged in again since, so `characters.scopes` may not contain it and even a
character whose row does list it may hold a refresh token minted before the grant. Both paths
degrade: a missing stored scope returns `0` with no ESI call at all, and a 403 from ESI comes back
as a `JobOutcome` warning so the run is recorded `ok` with a readable message on `/settings`. A 401
is *not* swallowed — it must reach the scheduler so `markNeedsReauth` fires.

**Files:**
- Create: `src/worker/jobs/killmails.ts`, `tests/worker/killmails.test.ts`
- Modify: `src/worker/jobs/index.ts`, `tests/worker/registration.test.ts`

**Interfaces:**
- Consumes (verbatim from the working tree, plus Tasks 1–2):
```ts
// src/worker/scheduler.ts
export interface JobContext { characterId: number; esi: EsiClient }
export interface JobOutcome { rows: number; warn?: string }
export interface CharacterSyncJob {
  name: string; scope?: "character"; intervalMs: number; retryMs?: number;
  run(ctx: JobContext): Promise<number | JobOutcome>;
}
// src/lib/auth/sso.ts
export function hasScope(character: { scopes: string[] } | null | undefined, scope: string): boolean;
// src/lib/esi/client.ts
export class EsiError extends Error { constructor(public status: number, public path: string, message: string) }
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean; lastModified: string | null }
// EsiClient.get<T>(path, { characterId?, query?, page?, fresh? }): Promise<EsiResult<T>>
// src/lib/db/characters.ts
export async function getCharacter(id: number): Promise<Character | null>;
// src/lib/names/index.ts
export function resolveNames(ids: number[]): Promise<Map<number, ResolvedName>>;
// src/worker/jobs/resolve-guard.ts
export function isAuthOrOutage(e: unknown): boolean;
// Task 1
export function toKillmailWrite(body, hash, source, zkb?): KillmailWrite;
export function roleFor(body: EsiKillmail, characterId: number): KillRole | null;
export function partyIds(body: EsiKillmail): number[];
// Task 2
export async function knownKillmailIds(ids: number[]): Promise<Set<number>>;
export async function saveKillmails(writes: KillmailWrite[], links: CharacterKillmailLink[]): Promise<number>;
```
- Produces:
```ts
// src/worker/jobs/killmails.ts
export const KILLMAILS_INTERVAL_MS: number;   // 1 h
export const KILLMAILS_RETRY_MS: number;      // 10 min
export const KILLMAILS_SCOPE: string;         // "esi-killmails.read_killmails.v1"
export const MAX_KILLMAIL_PAGES: number;      // 10
export interface EsiKillmailRef { killmail_id: number; killmail_hash: string }
export interface KillmailsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  knownKillmailIds: (ids: number[]) => Promise<Set<number>>;
  saveKillmails: (writes: KillmailWrite[], links: CharacterKillmailLink[]) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}
export function createKillmailsJob(deps: KillmailsJobDeps): CharacterSyncJob;
export const killmailsJob: CharacterSyncJob;
```

- [ ] **Step 1: Write the failing test**

Create `tests/worker/killmails.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import {
  createKillmailsJob, killmailsJob, KILLMAILS_INTERVAL_MS, KILLMAILS_RETRY_MS,
  KILLMAILS_SCOPE, MAX_KILLMAIL_PAGES, type EsiKillmailRef, type KillmailsJobDeps,
} from "../../src/worker/jobs/killmails.js";
import type { CharacterKillmailLink, EsiKillmail, KillmailWrite } from "../../src/lib/combat/killmail.js";
import { EsiError } from "../../src/lib/esi/client.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 90000101;
const body = (id: number): EsiKillmail => ({ ...esiFixture<EsiKillmail>("killmail"), killmail_id: id });
const ref = (id: number): EsiKillmailRef => ({ killmail_id: id, killmail_hash: `hash-${id}` });

type Call = { path: string; characterId: number | undefined; page: number | undefined };

function harness(opts: {
  scopes?: string[]; pages?: EsiKillmailRef[][]; known?: number[];
  listError?: unknown; listErrorAtPage?: number;
} = {}) {
  const pages = opts.pages ?? [[ref(120000001), ref(120000002)], []];
  const calls: Call[] = [];
  const writes: KillmailWrite[] = [];
  const links: CharacterKillmailLink[] = [];
  const resolved: number[][] = [];
  const deps: KillmailsJobDeps = {
    getCharacter: async () => ({ scopes: opts.scopes ?? [KILLMAILS_SCOPE] }),
    knownKillmailIds: async () => new Set(opts.known ?? []),
    saveKillmails: async (w, l) => { writes.push(...w); links.push(...l); return w.length + l.length; },
    resolveNames: async (ids) => { resolved.push(ids); return new Map(); },
  };
  const esi = {
    get: vi.fn(async (path: string, o?: { characterId?: number; page?: number }) => {
      calls.push({ path, characterId: o?.characterId, page: o?.page });
      if (path.includes("/killmails/recent")) {
        // `listErrorAtPage` lets a test fail only page N, so pages before it can be checked as
        // having been fetched, stored and reported rather than discarded by the 403 branch.
        if (opts.listError !== undefined
            && (opts.listErrorAtPage === undefined || o?.page === opts.listErrorAtPage)) {
          throw opts.listError;
        }
        return { data: pages[(o?.page ?? 1) - 1] ?? [] };
      }
      const id = Number(path.split("/")[2]);
      return { data: body(id) };
    }),
  };
  return { job: createKillmailsJob(deps), esi, calls, writes, links, resolved };
}

describe("killmails job", () => {
  it("is an hourly character job that retries in ten minutes", () => {
    expect(killmailsJob.name).toBe("killmails");
    expect(killmailsJob.scope ?? "character").toBe("character");
    expect(killmailsJob.intervalMs).toBe(KILLMAILS_INTERVAL_MS);
    expect(KILLMAILS_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(killmailsJob.retryMs).toBe(KILLMAILS_RETRY_MS);
    expect(KILLMAILS_RETRY_MS).toBe(10 * 60 * 1000);
    expect(MAX_KILLMAIL_PAGES).toBe(10);
  });

  it("walks pages, fetches each unknown body publicly and stores it with a role", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(4);
    expect(h.calls).toEqual([
      { path: `/characters/${CID}/killmails/recent`, characterId: CID, page: 1 },
      { path: "/killmails/120000001/hash-120000001", characterId: undefined, page: undefined },
      { path: "/killmails/120000002/hash-120000002", characterId: undefined, page: undefined },
      { path: `/characters/${CID}/killmails/recent`, characterId: CID, page: 2 },
    ]);
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([120000001, 120000002]);
    expect(h.writes[0].killmail.source).toBe("esi");
    expect(h.writes[0].killmail.killmailHash).toBe("hash-120000001");
    // The fixture's victim IS our character, so both are losses.
    expect(h.links).toEqual([
      { characterId: CID, killmailId: 120000001, role: "loss" },
      { characterId: CID, killmailId: 120000002, role: "loss" },
    ]);
  });

  it("stops at the first page whose ids are all already stored", async () => {
    const h = harness({
      pages: [[ref(1), ref(2)], [ref(3), ref(4)], [ref(5)]],
      known: [3, 4],
    });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const listPages = h.calls.filter((c) => c.path.includes("recent")).map((c) => c.page);
    expect(listPages).toEqual([1, 2]);
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([1, 2]);
  });

  it("never walks past MAX_KILLMAIL_PAGES", async () => {
    const pages = Array.from({ length: 20 }, (_, i) => [ref(1000 + i)]);
    const h = harness({ pages });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.calls.filter((c) => c.path.includes("recent"))).toHaveLength(MAX_KILLMAIL_PAGES);
  });

  it("resolves every victim, attacker, corporation and alliance id exactly once", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toHaveLength(1);
    expect([...h.resolved[0]].sort((a, b) => a - b)).toEqual(
      [98000001, 98000002, 99000001, 99000002, 90000101, 2112625428, 90000102].sort((a, b) => a - b));
  });

  it("returns 0 without calling ESI when the character has not granted the scope", async () => {
    const h = harness({ scopes: [] });
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.calls).toEqual([]);
  });

  it("degrades a 403 to a warning so the run still counts as ok", async () => {
    const h = harness({ listError: new EsiError(403, "/killmails/recent", "ESI 403") });
    const outcome = await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(outcome).toEqual({
      rows: 0,
      warn: "killmail scope not on this token yet — log the character in again (ESI 403)",
    });
  });

  it("saves the pages fetched before a later page's 403, and reports what was saved", async () => {
    const h = harness({
      pages: [[ref(120000001)], [ref(120000002)]],
      listError: new EsiError(403, "/killmails/recent", "ESI 403"),
      listErrorAtPage: 2,
    });
    const outcome = await h.job.run({ characterId: CID, esi: h.esi as never });
    // Page 1's one killmail + its one loss link = 2, from the fake saveKillmails above.
    expect(outcome).toEqual({
      rows: 2,
      warn: "killmail scope not on this token yet — log the character in again (ESI 403)",
    });
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([120000001]);
    expect(h.links).toEqual([{ characterId: CID, killmailId: 120000001, role: "loss" }]);
  });

  it("lets a 401 propagate so the scheduler can mark the token for re-authorisation", async () => {
    const h = harness({ listError: new EsiError(401, "/killmails/recent", "ESI 401") });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toThrow(/401/);
  });

  it("keeps the killmails it stored when name resolution fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness();
    const job = createKillmailsJob({
      getCharacter: async () => ({ scopes: [KILLMAILS_SCOPE] }),
      knownKillmailIds: async () => new Set(),
      saveKillmails: async (w, l) => w.length + l.length,
      resolveNames: async () => { throw new Error("names are down"); },
    });
    expect(await job.run({ characterId: CID, esi: h.esi as never })).toBe(4);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/killmails.test.ts`
Expected: FAIL — "Failed to resolve import ... src/worker/jobs/killmails.js".

- [ ] **Step 3: Write `src/worker/jobs/killmails.ts`**

```ts
import type { CharacterSyncJob, JobOutcome } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { EsiError } from "../../lib/esi/client.js";
import { getCharacter } from "../../lib/db/characters.js";
import { knownKillmailIds, saveKillmails } from "../../lib/db/killmails.js";
import {
  partyIds, roleFor, toKillmailWrite,
  type CharacterKillmailLink, type EsiKillmail, type KillmailWrite,
} from "../../lib/combat/killmail.js";
import { resolveNames } from "../../lib/names/index.js";
import { isAuthOrOutage } from "./resolve-guard.js";

export const KILLMAILS_INTERVAL_MS = 60 * 60 * 1000;
export const KILLMAILS_RETRY_MS = 10 * 60 * 1000;
export const KILLMAILS_SCOPE = "esi-killmails.read_killmails.v1";
/**
 * `/killmails/recent` lives in the `char-killmail` bucket — 30 tokens / 15 min, the tightest in the
 * app (research §6). Ten pages an hour per character stays comfortably inside it, and the early
 * stop means a settled character normally spends exactly one.
 */
export const MAX_KILLMAIL_PAGES = 10;

export interface EsiKillmailRef { killmail_id: number; killmail_hash: string }

export interface KillmailsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  knownKillmailIds: (ids: number[]) => Promise<Set<number>>;
  saveKillmails: (writes: KillmailWrite[], links: CharacterKillmailLink[]) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}

export function createKillmailsJob(deps: KillmailsJobDeps): CharacterSyncJob {
  return {
    name: "killmails",
    intervalMs: KILLMAILS_INTERVAL_MS,
    retryMs: KILLMAILS_RETRY_MS,
    async run({ characterId, esi }): Promise<number | JobOutcome> {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, KILLMAILS_SCOPE)) return 0;

      const writes: KillmailWrite[] = [];
      const links: CharacterKillmailLink[] = [];
      const parties = new Set<number>();
      // Set when a later page 403s, so pages 1..N-1's writes/links below are still saved and
      // reported instead of being thrown away by an early return (they were already fetched and
      // paid for in ESI calls — discarding them would just mean re-fetching them next hour).
      let warn: string | undefined;

      for (let page = 1; page <= MAX_KILLMAIL_PAGES; page++) {
        let refs: EsiKillmailRef[];
        try {
          refs = (await esi.get<EsiKillmailRef[]>(
            `/characters/${characterId}/killmails/recent`, { characterId, page })).data;
        } catch (e) {
          // 403 = the token predates the scope grant. Every character has to log in again after
          // the portal's scope set changed; until then this is a degraded run, not a failed one.
          if (e instanceof EsiError && e.status === 403) {
            warn = "killmail scope not on this token yet — log the character in again (ESI 403)";
            break;
          }
          throw e;
        }
        if (refs.length === 0) break;

        const known = await deps.knownKillmailIds(refs.map((r) => r.killmail_id));
        const fresh = refs.filter((r) => !known.has(r.killmail_id));
        // A whole page we already have means everything older is already stored: killmails are
        // immutable and the list is newest-first, so there is nothing beyond this point to learn.
        if (fresh.length === 0) break;

        for (const r of fresh) {
          // Public route: NO characterId, so no Authorization header, the generous `killmail`
          // bucket (3600/15m) instead of `char-killmail`, and a shared character_id = 0 cache row.
          const body = (await esi.get<EsiKillmail>(
            `/killmails/${r.killmail_id}/${r.killmail_hash}`)).data;
          writes.push(toKillmailWrite(body, r.killmail_hash, "esi"));
          const role = roleFor(body, characterId);
          if (role !== null) links.push({ characterId, killmailId: r.killmail_id, role });
          for (const id of partyIds(body)) parties.add(id);
        }
      }

      const written = await deps.saveKillmails(writes, links);

      // Names are resolved here, not at render time, so the pages stay Postgres-only (Decision 3).
      if (parties.size > 0) {
        try {
          await deps.resolveNames([...parties]);
        } catch (e) {
          if (isAuthOrOutage(e)) throw e;
          // The killmails are already stored; the next run's resolveNames retries the lookup.
          console.warn(`[killmails] name resolution failed for ${characterId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return warn === undefined ? written : { rows: written, warn };
    },
  };
}

export const killmailsJob: CharacterSyncJob = createKillmailsJob({
  getCharacter, knownKillmailIds, saveKillmails, resolveNames,
});
```

- [ ] **Step 4: Register the job**

In `src/worker/jobs/index.ts`, add the import and the array entry:
```ts
import { killmailsJob } from "./killmails.js";
```
```ts
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, marketPricesJob, characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob,
  walletJob, locationJob, killmailsJob,
];
```
and update the comment above it to read "the two global jobs come first … with 8 jobs x 4 characters".

In `tests/worker/registration.test.ts`, update the four affected expectations — the first test's
title names the character-job count too, so it changes along with its body:
```ts
  it("registers the two global jobs plus the eight character jobs, globals first", () => {
    expect(ALL_JOBS.map((j) => j.name)).toEqual([
      "sde-update", "market-prices", "character-info", "skills", "clones", "assets", "fittings",
      "wallet", "location", "killmails",
    ]);
    expect(ALL_JOBS[0].scope).toBe("global");
    expect(ALL_JOBS[1].scope).toBe("global");
  });
```
```ts
    expect(byName.get("killmails")).toBe(60 * 60 * 1000);
```
```ts
  it("marks exactly two jobs global; the other eight run per character", () => {
    expect(ALL_JOBS.filter(isGlobal)).toHaveLength(2);
    const characterJobs = ALL_JOBS.filter((j): j is CharacterSyncJob => !isGlobal(j));
    expect(characterJobs).toHaveLength(8);
    for (const job of characterJobs) expect(job.scope ?? "character").toBe("character");
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/worker/killmails.test.ts tests/worker/registration.test.ts`
Expected: PASS. The first test's `4` is `writes.length + links.length` = 2 + 2 from the fake repo.

- [ ] **Step 6: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/worker/jobs tests/worker
git commit -m "$(cat <<'EOM'
feat(combat): the hourly killmails job

Walks /killmails/recent (max 10 pages, stops on a fully-known page), fetches
each unknown body from the public /killmails/{id}/{hash} route with no token,
stores it with source='esi' and links it with the character's role. A missing
scope returns 0; a 403 degrades to a warn: run; a 401 propagates.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: The zKillboard client

Spec §2 and §7. zKillboard is not ESI: no compatibility date, no rate-limit headers, no ETag — just
etiquette. This module is the whole surface: URL building (trailing slash **required**; without it
the request silently fails), the descriptive `User-Agent` and `Accept-Encoding: gzip` the docs ask
for, one request per 2 s enforced by an injected clock, and a parser that rejects a malformed page
rather than storing rubbish.

**Files:**
- Create: `src/lib/combat/zkb.ts`, `tests/combat/zkb.test.ts`, `tests/fixtures/zkb/kills-page.json`

**Interfaces:**
- Consumes (Task 1):
```ts
export interface EsiKillmail { killmail_id: number; killmail_time: string; solar_system_id: number;
  moon_id?: number; war_id?: number; victim: EsiKillmailVictim; attackers: EsiKillmailAttacker[] }
export interface ZkbBlock { hash: string; totalValue?: number; points?: number;
  npc?: boolean; solo?: boolean; awox?: boolean }
```
- Produces:
```ts
// src/lib/combat/zkb.ts
export const ZKB_BASE_URL: string;      // "https://zkillboard.com/api/"
export const ZKB_USER_AGENT: string;    // "YutaniOS/1.0 (you@example.com; +https://eve.example.com)"
export const ZKB_PAGE_SIZE: number;     // 200
export const ZKB_MAX_PAGE: number;      // 100
export const ZKB_PACE_MS: number;       // 2000
export type ZkbKind = "kills" | "losses";
export interface ZkbRecord extends EsiKillmail { zkb: ZkbBlock }
export function zkbPageUrl(kind: ZkbKind, characterId: number, page: number): string;
export function parseZkbPage(body: unknown): ZkbRecord[] | null;
export interface ZkbClientDeps {
  fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export interface ZkbClient { fetchPage(kind: ZkbKind, characterId: number, page: number): Promise<ZkbRecord[]> }
export function createZkbClient(deps?: ZkbClientDeps): ZkbClient;
```

- [ ] **Step 1: Write the fixture**

Create `tests/fixtures/zkb/kills-page.json` — three records in the shape research §6 verified live
(the full ESI killmail plus a `zkb` block). Bodies are trimmed to what the parser and the mapper
read; the third is an NPC kill with no victim character:
```json
[
  { "killmail_id": 110000001, "killmail_time": "2021-04-07T04:27:41Z", "solar_system_id": 30002320,
    "victim": { "character_id": 2112625428, "corporation_id": 98000002, "damage_taken": 1420,
      "ship_type_id": 587,
      "items": [ { "item_type_id": 3634, "flag": 27, "singleton": 0, "quantity_dropped": 1 } ] },
    "attackers": [ { "character_id": 90000101, "corporation_id": 98000001, "damage_done": 1420,
      "final_blow": true, "security_status": 0.4, "ship_type_id": 621, "weapon_type_id": 2929 } ],
    "zkb": { "hash": "349571831ca127c015bc34050b4c02b29927827d", "totalValue": 60633419.79,
      "points": 1, "npc": false, "solo": true, "awox": false } },
  { "killmail_id": 110000002, "killmail_time": "2021-04-06T22:10:03Z", "solar_system_id": 30002320,
    "victim": { "character_id": 90000102, "corporation_id": 98000003, "damage_taken": 9800,
      "ship_type_id": 11393, "items": [] },
    "attackers": [
      { "character_id": 90000101, "corporation_id": 98000001, "damage_done": 5000,
        "final_blow": false, "security_status": 0.4, "ship_type_id": 621, "weapon_type_id": 2929 },
      { "character_id": 90000001, "corporation_id": 98000001, "damage_done": 4800,
        "final_blow": true, "security_status": -1.2, "ship_type_id": 621, "weapon_type_id": 2929 } ],
    "zkb": { "hash": "b0f0e1d2c3b4a5968778695a4b3c2d1e0f102030", "totalValue": 210500000,
      "points": 8, "npc": false, "solo": false, "awox": false } },
  { "killmail_id": 110000003, "killmail_time": "2021-04-05T11:00:00Z", "solar_system_id": 30000144,
    "victim": { "corporation_id": 1000035, "faction_id": 500003, "damage_taken": 300,
      "ship_type_id": 3766, "items": [] },
    "attackers": [ { "character_id": 90000101, "corporation_id": 98000001, "damage_done": 300,
      "final_blow": true, "security_status": 0.4, "ship_type_id": 621, "weapon_type_id": 2929 } ],
    "zkb": { "hash": "c1d2e3f405162738495a6b7c8d9e0f1020304050", "totalValue": 12000,
      "points": 1, "npc": true, "solo": true, "awox": false } }
]
```

- [ ] **Step 2: Write the failing test**

Create `tests/combat/zkb.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ZKB_BASE_URL, ZKB_MAX_PAGE, ZKB_PACE_MS, ZKB_PAGE_SIZE, ZKB_USER_AGENT,
  createZkbClient, parseZkbPage, zkbPageUrl, type ZkbRecord,
} from "../../src/lib/combat/zkb.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const page = (): ZkbRecord[] =>
  JSON.parse(readFileSync(path.join(dir, "../fixtures/zkb/kills-page.json"), "utf8")) as ZkbRecord[];

const CID = 90000101;

describe("zkbPageUrl", () => {
  it("puts the page modifier after the entity filter and ends with a slash", () => {
    expect(zkbPageUrl("kills", CID, 1)).toBe(`${ZKB_BASE_URL}kills/characterID/${CID}/page/1/`);
    expect(zkbPageUrl("losses", CID, 17)).toBe(`${ZKB_BASE_URL}losses/characterID/${CID}/page/17/`);
    expect(ZKB_BASE_URL).toBe("https://zkillboard.com/api/");
  });
  it("pins the etiquette constants from spec §2", () => {
    expect(ZKB_USER_AGENT).toBe("YutaniOS/1.0 (you@example.com; +https://eve.example.com)");
    expect(ZKB_PAGE_SIZE).toBe(200);
    expect(ZKB_MAX_PAGE).toBe(100);
    expect(ZKB_PACE_MS).toBe(2000);
  });
});

describe("parseZkbPage", () => {
  it("accepts a real page and keeps the zkb block", () => {
    const rows = parseZkbPage(page())!;
    expect(rows).toHaveLength(3);
    expect(rows[0].killmail_id).toBe(110000001);
    expect(rows[0].zkb.hash).toBe("349571831ca127c015bc34050b4c02b29927827d");
    expect(rows[0].zkb.totalValue).toBe(60633419.79);
    expect(rows[2].victim.character_id).toBeUndefined();
  });
  it("accepts an empty page", () => {
    expect(parseZkbPage([])).toEqual([]);
  });
  it("rejects anything that is not an array of killmails with a hash", () => {
    expect(parseZkbPage(null)).toBeNull();
    expect(parseZkbPage({ error: "Rate limited" })).toBeNull();
    expect(parseZkbPage([{ killmail_id: 1 }])).toBeNull();
    expect(parseZkbPage([{ killmail_id: 1, killmail_time: "x", victim: {}, attackers: [], zkb: {} }])).toBeNull();
  });
});

describe("createZkbClient", () => {
  function harness(responses: { status: number; body: unknown }[]) {
    let clock = 0;
    const slept: number[] = [];
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
      const next = responses.shift() ?? { status: 200, body: [] };
      return {
        ok: next.status >= 200 && next.status < 300, status: next.status,
        json: async () => next.body,
      } as unknown as Response;
    });
    const client = createZkbClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => clock,
      sleep: async (ms) => { slept.push(ms); clock += ms; },
    });
    return { client, fetchImpl, seen, slept, tick: (ms: number) => { clock += ms; } };
  }

  it("sends the descriptive User-Agent and asks for gzip", async () => {
    const h = harness([{ status: 200, body: page() }]);
    const rows = await h.client.fetchPage("kills", CID, 1);
    expect(rows).toHaveLength(3);
    expect(h.seen[0].url).toBe(`${ZKB_BASE_URL}kills/characterID/${CID}/page/1/`);
    expect(h.seen[0].headers["User-Agent"]).toBe(ZKB_USER_AGENT);
    expect(h.seen[0].headers["Accept-Encoding"]).toBe("gzip");
    expect(h.seen[0].headers.Accept).toBe("application/json");
  });

  it("paces requests two seconds apart, counting time that has already passed", async () => {
    const h = harness([{ status: 200, body: [] }, { status: 200, body: [] }, { status: 200, body: [] }]);
    await h.client.fetchPage("kills", CID, 1);      // clock 0, no wait, next allowed at 2000
    expect(h.slept).toEqual([]);
    h.tick(500);                                    // clock 500
    await h.client.fetchPage("kills", CID, 2);      // waits 2000 - 500 = 1500, clock 2000
    expect(h.slept).toEqual([1500]);
    h.tick(5000);                                   // clock 7000, well past 4000
    await h.client.fetchPage("kills", CID, 3);      // no wait needed
    expect(h.slept).toEqual([1500]);
  });

  it("throws with the page in the message on a non-200", async () => {
    const h = harness([{ status: 503, body: null }]);
    await expect(h.client.fetchPage("losses", CID, 4)).rejects.toThrow(
      `zKillboard 503 for losses/characterID/${CID}/page/4/`);
  });

  it("throws on a malformed page rather than storing rubbish", async () => {
    const h = harness([{ status: 200, body: { error: "nope" } }]);
    await expect(h.client.fetchPage("kills", CID, 1)).rejects.toThrow(/malformed/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/combat/zkb.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/combat/zkb.js".

- [ ] **Step 4: Write `src/lib/combat/zkb.ts`**

```ts
import type { EsiKillmail, ZkbBlock } from "./killmail.js";

/**
 * zKillboard's killmail query API (research §6). It publishes no numeric rate limit — only
 * etiquette — so this client is deliberately slow and deliberately serial: one request per
 * ZKB_PACE_MS, no parallelism, a descriptive User-Agent with a contact and a project URL, and
 * `Accept-Encoding: gzip`. The trailing slash is REQUIRED; without it requests silently fail.
 */
export const ZKB_BASE_URL = "https://zkillboard.com/api/";
/**
 * Spec §2 pins this string. It is deliberately NOT `config.esiUserAgent`: that value is
 * `EVE-Plasma/0.1 (you@example.com)`, with no project URL, which is exactly what zKillboard's
 * etiquette asks you not to send.
 */
export const ZKB_USER_AGENT = "YutaniOS/1.0 (you@example.com; +https://eve.example.com)";
/** 200 killmails a page, pages 1..100 — 20,000 killmails per filter (verified, research §6). */
export const ZKB_PAGE_SIZE = 200;
export const ZKB_MAX_PAGE = 100;
/** Spec §2 ruling: one request per 2 s. Cost if it is too slow: a slower backfill. */
export const ZKB_PACE_MS = 2000;

export type ZkbKind = "kills" | "losses";
export interface ZkbRecord extends EsiKillmail { zkb: ZkbBlock }

/** Modifiers are path segments and the entity filter must come before `page` (research §6). */
export function zkbPageUrl(kind: ZkbKind, characterId: number, page: number): string {
  return `${ZKB_BASE_URL}${kind}/characterID/${characterId}/page/${page}/`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * `null` means "this is not a zKillboard page" — an HTML error document, a rate-limit JSON object,
 * a record with no usable hash. The job turns that into an error run and leaves its cursor alone.
 */
export function parseZkbPage(body: unknown): ZkbRecord[] | null {
  if (!Array.isArray(body)) return null;
  for (const row of body) {
    if (!isRecord(row)) return null;
    if (typeof row.killmail_id !== "number" || typeof row.killmail_time !== "string") return null;
    if (!isRecord(row.victim) || !Array.isArray(row.attackers)) return null;
    const zkb = row.zkb;
    if (!isRecord(zkb) || typeof zkb.hash !== "string" || zkb.hash.length === 0) return null;
  }
  return body as ZkbRecord[];
}

export interface ZkbClientDeps {
  fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export interface ZkbClient {
  fetchPage(kind: ZkbKind, characterId: number, page: number): Promise<ZkbRecord[]>;
}

export function createZkbClient(deps: ZkbClientDeps = {}): ZkbClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let nextAllowedAt = 0;

  return {
    async fetchPage(kind, characterId, page) {
      const wait = nextAllowedAt - now();
      if (wait > 0) await sleep(wait);
      nextAllowedAt = now() + ZKB_PACE_MS;

      const url = zkbPageUrl(kind, characterId, page);
      const res = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "User-Agent": ZKB_USER_AGENT,
        },
      });
      const where = `${kind}/characterID/${characterId}/page/${page}/`;
      if (!res.ok) throw new Error(`zKillboard ${res.status} for ${where}`);
      const parsed = parseZkbPage(await res.json().catch(() => null));
      if (parsed === null) throw new Error(`zKillboard returned a malformed page for ${where}`);
      return parsed;
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/combat/zkb.test.ts`
Expected: PASS. The pacing derivation: request 1 at clock 0 waits 0 and sets `nextAllowedAt` to
0 + 2000; the test advances the clock to 500, so request 2 waits 2000 − 500 = **1500** and sets
`nextAllowedAt` to 2000 + 2000; the test advances to 7000, which is past 4000, so request 3 waits 0.

- [ ] **Step 6: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/combat/zkb.ts tests/combat/zkb.test.ts tests/fixtures/zkb
git commit -m "$(cat <<'EOM'
feat(combat): the zKillboard client

URL builder (trailing slash required, page after the entity filter), page
parser that rejects anything without a zkb.hash, and a 2 s pacer driven by an
injected clock. Descriptive User-Agent and Accept-Encoding: gzip per the docs.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: The backfill cursor repo and the `killmail-backfill` job

Spec §4, row 2, and §7. A global 15-minute job that walks zKillboard pages for every character in
`(kills, losses)` order and stores what it finds with `source = 'zkb'`. zKillboard hands over the
**full ESI killmail plus a `zkb` block**, so no second ESI call is needed and `zkb.hash` is the hash
the row stores.

**The budget is 20 pages per run, total** (Decision 6, spec §2's ruling) — ≈ 40 s of pacing. Cursors
are served oldest-`updated_at` first and each advance stamps `updated_at`, so the next run starts on
a different cursor and all eight cursors progress evenly. `done` is set when a page returns fewer
than `ZKB_PAGE_SIZE` records, or when page 100 (`ZKB_MAX_PAGE`) has been fetched.

**Files:**
- Create: `src/lib/db/killmail-backfill.ts`, `src/worker/jobs/killmail-backfill.ts`,
  `tests/db/killmail-backfill.test.ts`, `tests/worker/killmail-backfill.test.ts`
- Modify: `src/worker/jobs/index.ts`, `tests/worker/registration.test.ts`

**Interfaces:**
- Consumes (Tasks 1, 2, 4, and verbatim from the working tree):
```ts
// src/worker/scheduler.ts
export interface GlobalJobContext { esi: EsiClient }
export interface GlobalSyncJob {
  name: string; scope: "global"; intervalMs: number; retryMs?: number;
  run(ctx: GlobalJobContext): Promise<number | JobOutcome>;
}
// src/lib/db/characters.ts
export async function listCharacters(): Promise<Character[]>;   // Character has { id: number, ... }
// Task 4
export type ZkbKind = "kills" | "losses";
export interface ZkbRecord extends EsiKillmail { zkb: ZkbBlock }
export const ZKB_PAGE_SIZE: number; export const ZKB_MAX_PAGE: number;
export function createZkbClient(deps?: ZkbClientDeps): ZkbClient;
// Task 1
export function toKillmailWrite(body, hash, source, zkb?): KillmailWrite;
export function roleFor(body: EsiKillmail, characterId: number): KillRole | null;
export function partyIds(body: EsiKillmail): number[];
// Task 2
export async function saveKillmails(writes: KillmailWrite[], links: CharacterKillmailLink[]): Promise<number>;
```
- Produces:
```ts
// src/lib/db/killmail-backfill.ts
export interface BackfillCursor {
  characterId: number; kind: ZkbKind; nextPage: number; done: boolean; updatedAt: Date;
}
export interface BackfillStatus {
  characterId: number; imported: number; cursors: { kind: ZkbKind; nextPage: number; done: boolean }[];
}
export async function ensureBackfillRows(characterIds: number[]): Promise<number>;
export async function listUnfinishedBackfill(): Promise<BackfillCursor[]>;
export async function advanceBackfill(
  characterId: number, kind: ZkbKind, next: { nextPage: number; done: boolean },
): Promise<void>;
export async function backfillStatus(characterIds: number[]): Promise<BackfillStatus[]>;

// src/worker/jobs/killmail-backfill.ts
export const BACKFILL_INTERVAL_MS: number;   // 15 min
export const BACKFILL_RETRY_MS: number;      // 5 min
export const MAX_BACKFILL_PAGES: number;     // 20
export const NAMES_PER_RUN_CAP: number;      // 1000
export interface BackfillJobDeps {
  listCharacterIds: () => Promise<number[]>;
  ensureBackfillRows: (ids: number[]) => Promise<number>;
  listUnfinishedBackfill: () => Promise<BackfillCursor[]>;
  advanceBackfill: (characterId: number, kind: ZkbKind, next: { nextPage: number; done: boolean }) => Promise<void>;
  fetchPage: (kind: ZkbKind, characterId: number, page: number) => Promise<ZkbRecord[]>;
  saveKillmails: (writes: KillmailWrite[], links: CharacterKillmailLink[]) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}
export function createKillmailBackfillJob(deps: BackfillJobDeps): GlobalSyncJob;
export const killmailBackfillJob: GlobalSyncJob;
```

- [ ] **Step 1: Write the failing repo test**

Create `tests/db/killmail-backfill.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import {
  advanceBackfill, backfillStatus, ensureBackfillRows, listUnfinishedBackfill,
} from "../../src/lib/db/killmail-backfill.js";

let pool: Pool;
const A = 90000101;
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/db/killmail-backfill.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/db/killmail-backfill.js".

- [ ] **Step 3: Write `src/lib/db/killmail-backfill.ts`**

```ts
import { getPool } from "./client.js";
import type { ZkbKind } from "../combat/zkb.js";

export interface BackfillCursor {
  characterId: number; kind: ZkbKind; nextPage: number; done: boolean; updatedAt: Date;
}
export interface BackfillStatus {
  characterId: number; imported: number; cursors: { kind: ZkbKind; nextPage: number; done: boolean }[];
}

const KINDS: readonly ZkbKind[] = ["kills", "losses"];

/**
 * One cursor per (character, kind), created on first sight and never reset — `DO NOTHING` means a
 * character who has already walked to page 18 stays there. Returns how many rows were created.
 */
export async function ensureBackfillRows(characterIds: number[]): Promise<number> {
  const ids = [...new Set(characterIds)];
  if (ids.length === 0) return 0;
  const pairs = ids.flatMap((id) => KINDS.map((kind) => ({ id, kind })));
  const { rowCount } = await getPool().query(
    `INSERT INTO killmail_backfill (character_id, kind)
     SELECT * FROM unnest($1::bigint[], $2::text[])
     ON CONFLICT (character_id, kind) DO NOTHING`,
    [pairs.map((p) => String(p.id)), pairs.map((p) => p.kind)]);
  return rowCount ?? 0;
}

/** Oldest-first, so the job that spends a fixed page budget starts on the least recently served. */
export async function listUnfinishedBackfill(): Promise<BackfillCursor[]> {
  const { rows } = await getPool().query<{
    characterId: string; kind: ZkbKind; nextPage: number; done: boolean; updatedAt: Date;
  }>(
    `SELECT character_id AS "characterId", kind, next_page AS "nextPage", done,
            updated_at AS "updatedAt"
     FROM killmail_backfill WHERE NOT done
     ORDER BY updated_at, character_id, kind`);
  return rows.map((r) => ({ ...r, characterId: Number(r.characterId) }));
}

export async function advanceBackfill(
  characterId: number, kind: ZkbKind, next: { nextPage: number; done: boolean },
): Promise<void> {
  await getPool().query(
    `UPDATE killmail_backfill SET next_page = $3, done = $4, updated_at = now()
     WHERE character_id = $1 AND kind = $2`,
    [characterId, kind, next.nextPage, next.done]);
}

/**
 * The `/combat` status line (spec §6). `imported` is a count of the character's linked killmails,
 * not a stored counter (Decision 8) — the spec's data model has no such column.
 */
export async function backfillStatus(characterIds: number[]): Promise<BackfillStatus[]> {
  const ids = [...new Set(characterIds)];
  if (ids.length === 0) return [];
  const pool = getPool();
  const [{ rows: cursors }, { rows: counts }] = await Promise.all([
    pool.query<{ characterId: string; kind: ZkbKind; nextPage: number; done: boolean }>(
      `SELECT character_id AS "characterId", kind, next_page AS "nextPage", done
       FROM killmail_backfill WHERE character_id = ANY($1::bigint[]) ORDER BY character_id, kind`,
      [ids.map(String)]),
    pool.query<{ characterId: string; n: number }>(
      `SELECT character_id AS "characterId", count(*)::int AS n
       FROM character_killmails WHERE character_id = ANY($1::bigint[]) GROUP BY character_id`,
      [ids.map(String)]),
  ]);
  const imported = new Map(counts.map((c) => [Number(c.characterId), c.n]));
  return ids.map((id) => ({
    characterId: id,
    imported: imported.get(id) ?? 0,
    cursors: cursors
      .filter((c) => Number(c.characterId) === id)
      .map((c) => ({ kind: c.kind, nextPage: c.nextPage, done: c.done })),
  }));
}
```

- [ ] **Step 4: Run the repo test to verify it passes**

Run: `npx vitest run tests/db/killmail-backfill.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing job test**

Create `tests/worker/killmail-backfill.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import {
  BACKFILL_INTERVAL_MS, BACKFILL_RETRY_MS, MAX_BACKFILL_PAGES, NAMES_PER_RUN_CAP,
  createKillmailBackfillJob, killmailBackfillJob, type BackfillJobDeps,
} from "../../src/worker/jobs/killmail-backfill.js";
import type { BackfillCursor } from "../../src/lib/db/killmail-backfill.js";
import type { ZkbRecord } from "../../src/lib/combat/zkb.js";
import type { CharacterKillmailLink, KillmailWrite } from "../../src/lib/combat/killmail.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = (): ZkbRecord[] =>
  JSON.parse(readFileSync(path.join(dir, "../fixtures/zkb/kills-page.json"), "utf8")) as ZkbRecord[];

const A = 90000101;

/** A full page: the fixture's first record repeated 200 times with distinct ids (Decision 15). */
function fullPage(base: number): ZkbRecord[] {
  const template = fixture()[0];
  return Array.from({ length: 200 }, (_, i) => ({ ...template, killmail_id: base + i }));
}

function harness(opts: {
  cursors?: BackfillCursor[];
  pages?: (kind: string, characterId: number, page: number) => ZkbRecord[] | Error;
} = {}) {
  const cursors = opts.cursors ?? [
    { characterId: A, kind: "kills", nextPage: 1, done: false, updatedAt: new Date(0) },
  ];
  const advanced: { characterId: number; kind: string; nextPage: number; done: boolean }[] = [];
  const fetched: { kind: string; characterId: number; page: number }[] = [];
  const writes: KillmailWrite[] = [];
  const links: CharacterKillmailLink[] = [];
  const resolved: number[][] = [];
  const deps: BackfillJobDeps = {
    listCharacterIds: async () => [A],
    ensureBackfillRows: async () => 0,
    listUnfinishedBackfill: async () => cursors,
    advanceBackfill: async (characterId, kind, next) => { advanced.push({ characterId, kind, ...next }); },
    fetchPage: async (kind, characterId, page) => {
      fetched.push({ kind, characterId, page });
      const out = opts.pages?.(kind, characterId, page) ?? fixture();
      if (out instanceof Error) throw out;
      return out;
    },
    saveKillmails: async (w, l) => { writes.push(...w); links.push(...l); return w.length; },
    resolveNames: async (ids) => { resolved.push(ids); return new Map(); },
  };
  return { job: createKillmailBackfillJob(deps), advanced, fetched, writes, links, resolved };
}

describe("killmail-backfill job", () => {
  it("is a global 15-minute job that retries in five", () => {
    expect(killmailBackfillJob.name).toBe("killmail-backfill");
    expect(killmailBackfillJob.scope).toBe("global");
    expect(killmailBackfillJob.intervalMs).toBe(BACKFILL_INTERVAL_MS);
    expect(BACKFILL_INTERVAL_MS).toBe(15 * 60 * 1000);
    expect(killmailBackfillJob.retryMs).toBe(BACKFILL_RETRY_MS);
    expect(BACKFILL_RETRY_MS).toBe(5 * 60 * 1000);
    expect(MAX_BACKFILL_PAGES).toBe(20);
  });

  it("stores a short page with source zkb, the zkb hash and the kind's role, then marks it done", async () => {
    const h = harness();
    expect(await h.job.run({ esi: undefined as never })).toBe(3);
    expect(h.fetched).toEqual([{ kind: "kills", characterId: A, page: 1 }]);
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([110000001, 110000002, 110000003]);
    expect(h.writes[0].killmail.source).toBe("zkb");
    expect(h.writes[0].killmail.killmailHash).toBe("349571831ca127c015bc34050b4c02b29927827d");
    expect(h.writes[0].killmail.zkbTotalValue).toBe(60633419.79);
    expect(h.links.every((l) => l.role === "kill")).toBe(true);
    // 3 records < ZKB_PAGE_SIZE (200), so the cursor is finished.
    expect(h.advanced).toEqual([{ characterId: A, kind: "kills", nextPage: 2, done: true }]);
  });

  it("keeps walking while pages are full and stops at the run's twenty-page budget", async () => {
    const h = harness({ pages: (_k, _c, page) => fullPage(page * 1000) });
    await h.job.run({ esi: undefined as never });
    expect(h.fetched.map((f) => f.page)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(h.advanced.at(-1)).toEqual({ characterId: A, kind: "kills", nextPage: 21, done: false });
  });

  it("hands the rest of the budget to the next cursor when one finishes", async () => {
    const h = harness({
      cursors: [
        { characterId: A, kind: "kills", nextPage: 1, done: false, updatedAt: new Date(0) },
        { characterId: A, kind: "losses", nextPage: 5, done: false, updatedAt: new Date(1) },
      ],
    });
    await h.job.run({ esi: undefined as never });
    expect(h.fetched).toEqual([
      { kind: "kills", characterId: A, page: 1 },
      { kind: "losses", characterId: A, page: 5 },
    ]);
    expect(h.advanced).toEqual([
      { characterId: A, kind: "kills", nextPage: 2, done: true },
      { characterId: A, kind: "losses", nextPage: 6, done: true },
    ]);
  });

  it("finishes a cursor that reaches page 100 even on a full page", async () => {
    const h = harness({
      cursors: [{ characterId: A, kind: "kills", nextPage: 100, done: false, updatedAt: new Date(0) }],
      pages: () => fullPage(500000),
    });
    await h.job.run({ esi: undefined as never });
    expect(h.fetched).toEqual([{ kind: "kills", characterId: A, page: 100 }]);
    expect(h.advanced).toEqual([{ characterId: A, kind: "kills", nextPage: 100, done: true }]);
  });

  it("leaves the failing page's cursor untouched and lets the error reach the scheduler", async () => {
    const h = harness({
      pages: (_k, _c, page) => (page === 1 ? fullPage(1) : new Error("zKillboard 503 for kills")),
    });
    await expect(h.job.run({ esi: undefined as never })).rejects.toThrow(/503/);
    // Page 1 was stored and advanced; page 2 threw and left next_page at 2 (Decision 7).
    expect(h.advanced).toEqual([{ characterId: A, kind: "kills", nextPage: 2, done: false }]);
  });

  it("returns 0 and calls nothing when every cursor is finished", async () => {
    const h = harness({ cursors: [] });
    expect(await h.job.run({ esi: undefined as never })).toBe(0);
    expect(h.fetched).toEqual([]);
  });

  it("caps the ids collected for name resolution at NAMES_PER_RUN_CAP per run", async () => {
    // Each record's victim is a distinct character id, so a full 20-page run turns up 4,000
    // candidate ids — far more than resolveNames should ever be asked to chase in one call
    // (Decision 3, corrected: NAMES_CHUNK is resolveNames' own batching size, not a caller bound).
    const partyPage = (page: number): ZkbRecord[] => {
      const template = fixture()[0];
      return Array.from({ length: 200 }, (_, i) => ({
        ...template,
        killmail_id: page * 1000 + i,
        victim: { ...template.victim, character_id: 800_000_000 + page * 1000 + i },
      }));
    };
    const h = harness({ pages: (_k, _c, page) => partyPage(page) });
    await h.job.run({ esi: undefined as never });
    expect(h.resolved).toHaveLength(1);
    expect(h.resolved[0]).toHaveLength(NAMES_PER_RUN_CAP);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/worker/killmail-backfill.test.ts`
Expected: FAIL — "Failed to resolve import ... src/worker/jobs/killmail-backfill.js".

- [ ] **Step 7: Write `src/worker/jobs/killmail-backfill.ts`**

```ts
import type { GlobalSyncJob } from "../scheduler.js";
import { listCharacters } from "../../lib/db/characters.js";
import { saveKillmails } from "../../lib/db/killmails.js";
import {
  advanceBackfill, ensureBackfillRows, listUnfinishedBackfill, type BackfillCursor,
} from "../../lib/db/killmail-backfill.js";
import {
  partyIds, roleFor, toKillmailWrite,
  type CharacterKillmailLink, type KillmailWrite,
} from "../../lib/combat/killmail.js";
import {
  ZKB_MAX_PAGE, ZKB_PAGE_SIZE, createZkbClient, type ZkbKind, type ZkbRecord,
} from "../../lib/combat/zkb.js";
import { resolveNames } from "../../lib/names/index.js";
import { isAuthOrOutage } from "./resolve-guard.js";

export const BACKFILL_INTERVAL_MS = 15 * 60 * 1000;
export const BACKFILL_RETRY_MS = 5 * 60 * 1000;
/**
 * Spec §2's ruling: at most 20 pages per run, no parallelism, one request per 2 s — so a run costs
 * about 40 s of wall clock and zKillboard never sees a burst from us (Decision 6).
 *
 * Accepted: `src/worker/scheduler.ts`'s `tick()` runs every due job serially, one `await` at a time,
 * so this ~40 s of pacing blocks whatever character jobs are also due in the same 15-minute tick.
 * The delay is bounded (the pacing is capped, not open-ended) and self-corrects on the next tick —
 * not worth the complexity of running the backfill off the scheduler's own loop.
 */
export const MAX_BACKFILL_PAGES = 20;
/**
 * Decision 3: `resolveNames`'s own `NAMES_CHUNK = 1000` is just its internal ESI batching size, not
 * a limit a caller may rely on — a 20-page run can turn up far more than 1000 distinct ids. This is
 * the actual per-run cap the spec's "≤ 1000 ids" bound means: once `parties` reaches it, further
 * ids are simply not collected this run and are left for a later one to pick up.
 */
export const NAMES_PER_RUN_CAP = 1000;

export interface BackfillJobDeps {
  listCharacterIds: () => Promise<number[]>;
  ensureBackfillRows: (ids: number[]) => Promise<number>;
  listUnfinishedBackfill: () => Promise<BackfillCursor[]>;
  advanceBackfill: (
    characterId: number, kind: ZkbKind, next: { nextPage: number; done: boolean },
  ) => Promise<void>;
  fetchPage: (kind: ZkbKind, characterId: number, page: number) => Promise<ZkbRecord[]>;
  saveKillmails: (writes: KillmailWrite[], links: CharacterKillmailLink[]) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}

export function createKillmailBackfillJob(deps: BackfillJobDeps): GlobalSyncJob {
  return {
    name: "killmail-backfill",
    scope: "global",
    intervalMs: BACKFILL_INTERVAL_MS,
    retryMs: BACKFILL_RETRY_MS,
    async run(): Promise<number> {
      await deps.ensureBackfillRows(await deps.listCharacterIds());
      const cursors = await deps.listUnfinishedBackfill();

      let budget = MAX_BACKFILL_PAGES;
      let stored = 0;
      const parties = new Set<number>();

      for (const cursor of cursors) {
        let page = cursor.nextPage;
        let done = false;
        while (budget > 0 && !done) {
          // A throw here leaves next_page pointing at exactly the page that failed (spec §7):
          // the pages before it were advanced one at a time as they succeeded (Decision 7).
          const records = await deps.fetchPage(cursor.kind, cursor.characterId, page);
          budget -= 1;

          const writes: KillmailWrite[] = [];
          const links: CharacterKillmailLink[] = [];
          for (const record of records) {
            writes.push(toKillmailWrite(record, record.zkb.hash, "zkb", record.zkb));
            const role = roleFor(record, cursor.characterId)
              ?? (cursor.kind === "kills" ? "kill" : "loss");
            links.push({ characterId: cursor.characterId, killmailId: record.killmail_id, role });
            // Capped at NAMES_PER_RUN_CAP (Decision 3): the rest are simply not collected this run.
            for (const id of partyIds(record)) {
              if (parties.size < NAMES_PER_RUN_CAP) parties.add(id);
            }
          }
          stored += await deps.saveKillmails(writes, links);

          // A short page is the end of the character's history; page 100 is zKillboard's ceiling.
          done = records.length < ZKB_PAGE_SIZE || page >= ZKB_MAX_PAGE;
          const nextPage = done && page >= ZKB_MAX_PAGE ? page : page + 1;
          await deps.advanceBackfill(cursor.characterId, cursor.kind, { nextPage, done });
          page = nextPage;
        }
        if (budget === 0) break;
      }

      if (parties.size > 0) {
        try {
          await deps.resolveNames([...parties]);
        } catch (e) {
          if (isAuthOrOutage(e)) throw e;
          console.warn(`[killmail-backfill] name resolution failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return stored;
    },
  };
}

const zkb = createZkbClient();

export const killmailBackfillJob: GlobalSyncJob = createKillmailBackfillJob({
  listCharacterIds: async () => (await listCharacters()).map((c) => c.id),
  ensureBackfillRows,
  listUnfinishedBackfill,
  advanceBackfill,
  fetchPage: (kind, characterId, page) => zkb.fetchPage(kind, characterId, page),
  saveKillmails,
  resolveNames,
});
```

- [ ] **Step 8: Register the job**

In `src/worker/jobs/index.ts` add the import and put it with the other global jobs, which run first:
```ts
import { killmailBackfillJob } from "./killmail-backfill.js";
```
```ts
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, marketPricesJob, killmailBackfillJob,
  characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob, walletJob, locationJob, killmailsJob,
];
```

In `tests/worker/registration.test.ts` — the first test's title names the global-job count too, so
it changes along with its body:
```ts
  it("registers the three global jobs plus the eight character jobs, globals first", () => {
    expect(ALL_JOBS.map((j) => j.name)).toEqual([
      "sde-update", "market-prices", "killmail-backfill",
      "character-info", "skills", "clones", "assets", "fittings", "wallet", "location", "killmails",
    ]);
    expect(ALL_JOBS[0].scope).toBe("global");
    expect(ALL_JOBS[1].scope).toBe("global");
    expect(ALL_JOBS[2].scope).toBe("global");
  });
```
```ts
    expect(byName.get("killmail-backfill")).toBe(15 * 60 * 1000);
```
```ts
  it("marks exactly three jobs global; the other eight run per character", () => {
    expect(ALL_JOBS.filter(isGlobal)).toHaveLength(3);
    const characterJobs = ALL_JOBS.filter((j): j is CharacterSyncJob => !isGlobal(j));
    expect(characterJobs).toHaveLength(8);
    for (const job of characterJobs) expect(job.scope ?? "character").toBe("character");
  });
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run tests/worker/killmail-backfill.test.ts tests/worker/registration.test.ts tests/db/killmail-backfill.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/db/killmail-backfill.ts src/worker/jobs tests/db/killmail-backfill.test.ts tests/worker
git commit -m "$(cat <<'EOM'
feat(combat): the zKillboard backfill job and its page cursors

killmail_backfill holds one (character, kind) cursor; the global 15-minute job
spends a 20-page budget on the oldest cursors first, storing zKillboard's full
killmails with source='zkb' and the zkb block. A short page or page 100 marks a
cursor done; a failing page leaves next_page pointing at it.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: Killmail valuation — the pure roll-up, its repo and the `killmail-values` job

Spec §4, row 3, and its ruling. `computed_value` is the sum over the victim's hull plus every item
(destroyed **and** dropped quantities) at `priceOf(market_prices)`. A killmail with even one
unpriced type stays NULL and is retried next hour (Decision 5) — which only works because this task
also teaches `typesOfInterest` about killmail types, so the Fuzzwork half of `market-prices` starts
fetching them.

**A killmail with a type `market-prices` will never price (a dropped SDE type, a type outside the
90-day window's interest set) must not starve every killmail behind it.** `unvaluedKillmails` was
originally just "newest unvalued 500", which means the same unpriceable killmails resort to the
front of every run forever, and the batch behind them is never reached. `killmails` therefore gains
a `value_checked_at` column (Task 2's schema): every killmail this job *examines* — priced or not —
is stamped, and the query only re-offers a still-unpriced row once 24 hours have passed, ordered so
the least-recently-checked row (including one never checked at all) comes first.

**Files:**
- Create: `src/lib/combat/value.ts`, `src/lib/db/killmail-values.ts`,
  `src/worker/jobs/killmail-values.ts`, `tests/combat/value.test.ts`,
  `tests/db/killmail-values.test.ts`, `tests/worker/killmail-values.test.ts`
- Modify: `src/lib/market/interest.ts`, `tests/db/market-interest.test.ts`,
  `src/worker/jobs/index.ts`, `tests/worker/registration.test.ts`

**Interfaces:**
- Consumes (verbatim from the working tree):
```ts
// src/lib/view/price.ts
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }
export function priceOf(p: Price | undefined): number | null;   // sell ?? adjusted ?? null
// src/lib/db/market-prices.ts
export async function getPrices(typeIds: number[]): Promise<Map<number, Price>>;
// src/lib/market/interest.ts
export const INTEREST_TRANSACTION_DAYS: number;   // 30
export async function typesOfInterest(): Promise<number[]>;
```
- Produces:
```ts
// src/lib/combat/value.ts
export interface KillmailValueParts {
  killmailId: number; shipTypeId: number | null; items: { typeId: number; quantity: number }[];
}
export function computeKillmailValue(
  parts: KillmailValueParts, prices: ReadonlyMap<number, Price>,
): number | null;

// src/lib/db/killmail-values.ts
export const VALUE_BATCH: number;   // 500
export async function unvaluedKillmails(limit?: number): Promise<KillmailValueParts[]>;
export async function setComputedValues(rows: { killmailId: number; value: number }[]): Promise<number>;
export async function touchValueChecked(killmailIds: number[]): Promise<number>;
export async function pruneKillmailCache(): Promise<number>;

// src/lib/market/interest.ts (modified)
export const INTEREST_KILLMAIL_DAYS: number;   // 90

// src/worker/jobs/killmail-values.ts
export const KILLMAIL_VALUES_INTERVAL_MS: number;   // 1 h
export const KILLMAIL_VALUES_RETRY_MS: number;      // 10 min
export interface KillmailValuesDeps {
  unvaluedKillmails: (limit?: number) => Promise<KillmailValueParts[]>;
  getPrices: (typeIds: number[]) => Promise<Map<number, Price>>;
  setComputedValues: (rows: { killmailId: number; value: number }[]) => Promise<number>;
  touchValueChecked: (killmailIds: number[]) => Promise<number>;
  pruneKillmailCache: () => Promise<number>;
}
export function createKillmailValuesJob(deps: KillmailValuesDeps): GlobalSyncJob;
export const killmailValuesJob: GlobalSyncJob;
```

- [ ] **Step 1: Write the failing pure test**

Create `tests/combat/value.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeKillmailValue, type KillmailValueParts } from "../../src/lib/combat/value.js";
import type { Price } from "../../src/lib/view/price.js";

const price = (sell: number | null, adjusted: number | null): Price => ({ sell, buy: null, adjusted });

// Rifter hull 587 at the Jita sell minimum; Tritanium 34 at its sell minimum; 2456 has no Jita
// price at all, so priceOf falls back to ESI's adjusted price.
const prices = new Map<number, Price>([
  [587, price(8_000_000, 7_500_000)],
  [34, price(5, 4.5)],
  [2456, price(null, 120_000)],
]);

const parts: KillmailValueParts = {
  killmailId: 1, shipTypeId: 587,
  items: [{ typeId: 34, quantity: 1000 }, { typeId: 2456, quantity: 1 }],
};

describe("computeKillmailValue", () => {
  it("sums the hull and every item at priceOf", () => {
    // 8,000,000 (hull) + 1000 x 5 = 5,000 (Tritanium) + 1 x 120,000 (adjusted) = 8,125,000
    expect(computeKillmailValue(parts, prices)).toBe(8_125_000);
  });
  it("returns null when any type is unpriced, so the killmail is retried next hour", () => {
    const missing = new Map(prices);
    missing.delete(2456);
    expect(computeKillmailValue(parts, missing)).toBeNull();
    const noHull = new Map(prices);
    noHull.delete(587);
    expect(computeKillmailValue(parts, noHull)).toBeNull();
  });
  it("counts a hull with no items, and a killmail with no hull at all", () => {
    expect(computeKillmailValue({ killmailId: 2, shipTypeId: 587, items: [] }, prices)).toBe(8_000_000);
    // 1000 x 5 = 5,000, with nothing for the missing hull.
    expect(computeKillmailValue(
      { killmailId: 3, shipTypeId: null, items: [{ typeId: 34, quantity: 1000 }] }, prices)).toBe(5_000);
  });
  it("ignores a zero-quantity row rather than demanding a price for it", () => {
    const withZero: KillmailValueParts = {
      killmailId: 4, shipTypeId: 587, items: [{ typeId: 99999, quantity: 0 }],
    };
    expect(computeKillmailValue(withZero, prices)).toBe(8_000_000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/combat/value.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/combat/value.js".

- [ ] **Step 3: Write `src/lib/combat/value.ts`**

```ts
import { priceOf, type Price } from "../view/price.js";

export interface KillmailValueParts {
  killmailId: number; shipTypeId: number | null; items: { typeId: number; quantity: number }[];
}

/**
 * Spec §4: value = victim ship + every item, destroyed and dropped quantities together, priced with
 * `priceOf` (Jita sell minimum, falling back to ESI's adjusted price).
 *
 * `null` means "not valuable yet": a type with no price at all leaves the whole killmail NULL so
 * the hourly job retries it once `market-prices` has fetched that type — which it now will, because
 * `typesOfInterest` includes killmail types. Writing a partial total instead would make spec §4's
 * "the killmail stays NULL until priced" unreachable and would quietly under-report ISK destroyed.
 * A row with quantity 0 contributes nothing and is not allowed to block the killmail.
 */
export function computeKillmailValue(
  parts: KillmailValueParts, prices: ReadonlyMap<number, Price>,
): number | null {
  let total = 0;
  if (parts.shipTypeId !== null) {
    const hull = priceOf(prices.get(parts.shipTypeId));
    if (hull === null) return null;
    total += hull;
  }
  for (const item of parts.items) {
    if (item.quantity <= 0) continue;
    const unit = priceOf(prices.get(item.typeId));
    if (unit === null) return null;
    total += unit * item.quantity;
  }
  return total;
}
```

- [ ] **Step 4: Write the failing repo test**

Create `tests/db/killmail-values.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import {
  pruneKillmailCache, setComputedValues, touchValueChecked, unvaluedKillmails,
} from "../../src/lib/db/killmail-values.js";

let pool: Pool;
beforeAll(async () => {
  pool = await resetDb();
  await pool.query(
    `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, victim_ship_type_id, source)
     VALUES (1, 'h', '2026-09-01T12:00:00Z', 621, 'esi'),
            (2, 'h', '2026-08-01T12:00:00Z', 587, 'zkb'),
            (3, 'h', '2026-07-01T12:00:00Z', NULL, 'zkb')`);
  await pool.query(
    `INSERT INTO killmail_items (killmail_id, idx, item_type_id, flag, quantity_destroyed, quantity_dropped)
     VALUES (1, 0, 34, 5, 500, 500), (1, 1, 2456, 87, 3, 0), (2, 0, 34, 5, 0, 10)`);
}, 60_000);
afterAll(closePool);

describe("unvaluedKillmails", () => {
  it("returns least-recently-checked first (all NULL here, so newest first), quantities added together", async () => {
    const rows = await unvaluedKillmails();
    expect(rows.map((r) => r.killmailId)).toEqual([1, 2, 3]);
    expect(rows[0]).toEqual({
      killmailId: 1, shipTypeId: 621,
      // 500 destroyed + 500 dropped = 1000 of Tritanium, and 3 + 0 = 3 of 2456.
      items: [{ typeId: 34, quantity: 1000 }, { typeId: 2456, quantity: 3 }],
    });
    expect(rows[1]).toEqual({ killmailId: 2, shipTypeId: 587, items: [{ typeId: 34, quantity: 10 }] });
    expect(rows[2]).toEqual({ killmailId: 3, shipTypeId: null, items: [] });
  });

  it("honours the limit", async () => {
    expect((await unvaluedKillmails(2)).map((r) => r.killmailId)).toEqual([1, 2]);
  });
});

describe("unvaluedKillmails starvation guard", () => {
  it("does not re-select an examined-but-still-unpriced id within 24h, and does after", async () => {
    // Killmail 3 was examined this run (touchValueChecked) but stayed unpriced (no ship type).
    await touchValueChecked([3]);
    expect((await unvaluedKillmails()).map((r) => r.killmailId)).toEqual([1, 2]);

    // Past the 24h grace window: eligible again, sorted after the never-checked ones (NULLS FIRST).
    await pool.query(
      "UPDATE killmails SET value_checked_at = now() - interval '25 hours' WHERE killmail_id = 3");
    expect((await unvaluedKillmails()).map((r) => r.killmailId)).toEqual([1, 2, 3]);
  });
});

describe("setComputedValues", () => {
  it("writes the values, stamps value_checked_at and drops those killmails out of the unvalued list", async () => {
    expect(await setComputedValues([{ killmailId: 1, value: 8_125_000 }, { killmailId: 3, value: 0 }])).toBe(2);
    const { rows } = await pool.query(
      "SELECT killmail_id, computed_value, value_checked_at FROM killmails ORDER BY killmail_id");
    expect(Number(rows[0].computed_value)).toBe(8_125_000);
    expect(rows[0].value_checked_at).not.toBeNull();
    expect(rows[1].computed_value).toBeNull();
    expect(Number(rows[2].computed_value)).toBe(0);
    expect(rows[2].value_checked_at).not.toBeNull();
    expect((await unvaluedKillmails()).map((r) => r.killmailId)).toEqual([2]);
  });
  it("writes nothing for an empty list", async () => {
    expect(await setComputedValues([])).toBe(0);
  });
});

describe("pruneKillmailCache", () => {
  it("deletes only killmail-body cache rows (character_id = 0, path under /killmails/) older than seven days", async () => {
    await pool.query(
      `INSERT INTO esi_cache (character_id, path, pages, updated_at) VALUES
         (0, '/killmails/1/hash1', 1, now() - interval '8 days'),
         (0, '/killmails/2/hash2', 1, now() - interval '1 day'),
         (0, '/markets/prices', 1, now() - interval '30 days'),
         (90000101, '/killmails/1/hash1', 1, now() - interval '8 days')`);
    expect(await pruneKillmailCache()).toBe(1);
    const { rows } = await pool.query(
      `SELECT character_id AS "characterId", path FROM esi_cache ORDER BY "characterId", path`);
    expect(rows.map((r) => `${r.characterId}:${r.path}`)).toEqual([
      "0:/killmails/2/hash2", "0:/markets/prices", "90000101:/killmails/1/hash1",
    ]);
  });
});
```

- [ ] **Step 5: Write `src/lib/db/killmail-values.ts`**

```ts
import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type { KillmailValueParts } from "../combat/value.js";

/** One hourly run values this many killmails, newest first. */
export const VALUE_BATCH = 500;

interface Row {
  killmailId: string; shipTypeId: number | null;
  items: { typeId: number; quantity: string }[] | null;
}

/**
 * The killmails still waiting for a price, with each item's destroyed and dropped quantities
 * already added together. `json_agg` keeps this to one query however many items there are; a
 * killmail with no items comes back with `items` NULL, which becomes an empty array.
 *
 * Ordered by `value_checked_at NULLS FIRST, killmail_time DESC` and filtered so a row already
 * examined within the last 24 hours is skipped: without this, a killmail whose type `market-prices`
 * will never fetch (a dropped SDE type, one outside the interest window) sorts to the front of
 * every run forever and starves the batch behind it. `killmail-values` stamps `value_checked_at` on
 * every id it examines this run, priced or not (`touchValueChecked` / `setComputedValues`), so a
 * still-unpriced row only comes back around once a day, and a never-checked row (`NULLS FIRST`)
 * always outranks one that has already been looked at and found wanting.
 */
export async function unvaluedKillmails(limit = VALUE_BATCH): Promise<KillmailValueParts[]> {
  const { rows } = await getPool().query<Row>(
    `SELECT k.killmail_id AS "killmailId", k.victim_ship_type_id AS "shipTypeId",
            (SELECT json_agg(json_build_object(
                      'typeId', i.item_type_id,
                      'quantity', (i.quantity_destroyed + i.quantity_dropped)::text)
                    ORDER BY i.idx)
             FROM killmail_items i WHERE i.killmail_id = k.killmail_id) AS items
     FROM killmails k
     WHERE k.computed_value IS NULL
       AND (k.value_checked_at IS NULL OR k.value_checked_at < now() - interval '24 hours')
     ORDER BY k.value_checked_at NULLS FIRST, k.killmail_time DESC
     LIMIT $1`, [limit]);
  return rows.map((r) => ({
    killmailId: Number(r.killmailId),
    shipTypeId: r.shipTypeId,
    items: (r.items ?? []).map((i) => ({ typeId: i.typeId, quantity: Number(i.quantity) })),
  }));
}

/** Sets the value and stamps `value_checked_at` in the same write — these rows were both examined
 * and successfully priced this run. */
export async function setComputedValues(
  rows: { killmailId: number; value: number }[],
): Promise<number> {
  let written = 0;
  for (const batch of chunk(rows, VALUE_BATCH)) {
    const res = await getPool().query(
      `UPDATE killmails k SET computed_value = v.value, value_checked_at = now()
       FROM (SELECT * FROM unnest($1::bigint[], $2::numeric[]) AS t(killmail_id, value)) v
       WHERE k.killmail_id = v.killmail_id`,
      [batch.map((r) => String(r.killmailId)), batch.map((r) => r.value)]);
    written += res.rowCount ?? 0;
  }
  return written;
}

/**
 * Stamps `value_checked_at` on every killmail this run examined but could **not** price — the
 * starvation guard's other half. Without this, an unpriceable killmail keeps its `value_checked_at`
 * at NULL forever and is re-selected, uselessly, at the front of every single run.
 */
export async function touchValueChecked(killmailIds: number[]): Promise<number> {
  const ids = [...new Set(killmailIds)];
  if (ids.length === 0) return 0;
  const { rowCount } = await getPool().query(
    `UPDATE killmails SET value_checked_at = now() WHERE killmail_id = ANY($1::bigint[])`,
    [ids.map(String)]);
  return rowCount ?? 0;
}

/**
 * Killmail bodies are fetched once and never read again once stored — killmails are immutable
 * (Global Constraints) — so their `esi_cache` rows (`character_id = 0`, path under `/killmails/`)
 * exist purely to dedupe an in-flight retry within the cache TTL and are write-once-never-read
 * after that. The hourly values job prunes them once a week old so `esi_cache` does not grow
 * forever on a table that will hold tens of thousands of killmails.
 */
export async function pruneKillmailCache(): Promise<number> {
  const { rowCount } = await getPool().query(
    `DELETE FROM esi_cache WHERE character_id = 0 AND path LIKE '/killmails/%'
       AND updated_at < now() - interval '7 days'`);
  return rowCount ?? 0;
}
```

- [ ] **Step 6: Extend `typesOfInterest`**

Spec §4 asks for the market job's set of interest to grow by `killmail_items.item_type_id` and
`killmails.victim_ship_type_id` for the last 90 days. Replace the query in
`src/lib/market/interest.ts`:
```ts
/** Spec §3: transactions older than this stop being worth a price lookup. */
export const INTEREST_TRANSACTION_DAYS = 30;
/** Spec §4 (phase 7): the killmail window worth valuing — ESI's own 90-day recent window. */
export const INTEREST_KILLMAIL_DAYS = 90;

export async function typesOfInterest(): Promise<number[]> {
  const { rows } = await getPool().query<{ typeId: number }>(
    `SELECT type_id AS "typeId" FROM character_assets
     UNION SELECT type_id FROM character_fitting_items
     UNION SELECT ship_type_id FROM character_fittings
     UNION SELECT type_id FROM character_wallet_transactions
       WHERE date > now() - ($1::int * interval '1 day')
     UNION SELECT i.item_type_id FROM killmail_items i
       JOIN killmails k ON k.killmail_id = i.killmail_id
       WHERE k.killmail_time > now() - ($2::int * interval '1 day')
     UNION SELECT victim_ship_type_id FROM killmails
       WHERE killmail_time > now() - ($2::int * interval '1 day')
         AND victim_ship_type_id IS NOT NULL
     ORDER BY 1`,
    [INTEREST_TRANSACTION_DAYS, INTEREST_KILLMAIL_DAYS]);
  return rows.map((r) => r.typeId);
}
```

Add to `tests/db/market-interest.test.ts`, after the existing union test:
```ts
  it("adds killmail item and victim ship types inside the 90-day window", async () => {
    await pool.query(
      `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, victim_ship_type_id, source)
       VALUES (1, 'h', now() - interval '10 days', 24698, 'esi'),
              (2, 'h', now() - interval '200 days', 11567, 'zkb')`);
    await pool.query(
      `INSERT INTO killmail_items (killmail_id, idx, item_type_id, flag)
       VALUES (1, 0, 12058, 27), (2, 0, 41155, 27)`);
    const ids = await typesOfInterest();
    expect(ids).toContain(24698);      // victim ship, 10 days ago
    expect(ids).toContain(12058);      // its module
    expect(ids).not.toContain(11567);  // 200 days ago, outside the window
    expect(ids).not.toContain(41155);
  });
```

- [ ] **Step 7: Write the failing job test**

Create `tests/worker/killmail-values.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import {
  KILLMAIL_VALUES_INTERVAL_MS, KILLMAIL_VALUES_RETRY_MS,
  createKillmailValuesJob, killmailValuesJob, type KillmailValuesDeps,
} from "../../src/worker/jobs/killmail-values.js";
import type { KillmailValueParts } from "../../src/lib/combat/value.js";
import type { Price } from "../../src/lib/view/price.js";

const price = (sell: number | null, adjusted: number | null): Price => ({ sell, buy: null, adjusted });

function harness(parts: KillmailValueParts[], prices: [number, Price][]) {
  const asked: number[][] = [];
  const written: { killmailId: number; value: number }[] = [];
  const touched: number[][] = [];
  let pruneCalls = 0;
  const deps: KillmailValuesDeps = {
    unvaluedKillmails: async () => parts,
    getPrices: async (ids) => { asked.push(ids); return new Map(prices); },
    setComputedValues: async (rows) => { written.push(...rows); return rows.length; },
    touchValueChecked: async (ids) => { touched.push(ids); return ids.length; },
    pruneKillmailCache: async () => { pruneCalls += 1; return 0; },
  };
  return {
    job: createKillmailValuesJob(deps), asked, written, touched,
    get pruneCalls() { return pruneCalls; },
  };
}

describe("killmail-values job", () => {
  it("is a global hourly job that retries in ten minutes", () => {
    expect(killmailValuesJob.name).toBe("killmail-values");
    expect(killmailValuesJob.scope).toBe("global");
    expect(killmailValuesJob.intervalMs).toBe(KILLMAIL_VALUES_INTERVAL_MS);
    expect(KILLMAIL_VALUES_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(killmailValuesJob.retryMs).toBe(KILLMAIL_VALUES_RETRY_MS);
    expect(KILLMAIL_VALUES_RETRY_MS).toBe(10 * 60 * 1000);
  });

  it("asks for every type once, writes what it could value and stamps the rest as checked", async () => {
    const h = harness(
      [
        { killmailId: 1, shipTypeId: 587, items: [{ typeId: 34, quantity: 1000 }] },
        { killmailId: 2, shipTypeId: 621, items: [{ typeId: 9999, quantity: 1 }] },
      ],
      [[587, price(8_000_000, null)], [34, price(5, null)], [621, price(30_000_000, null)]]);
    // Killmail 1: 8,000,000 + 1000 x 5 = 8,005,000. Killmail 2: type 9999 has no price -> skipped.
    expect(await h.job.run({ esi: undefined as never })).toBe(1);
    expect(h.written).toEqual([{ killmailId: 1, value: 8_005_000 }]);
    expect([...h.asked[0]].sort((a, b) => a - b)).toEqual([34, 587, 621, 9999]);
    // Killmail 2 was examined but not priced: value_checked_at is stamped so it is not re-selected
    // for 24h (starvation guard), even though it never got a value.
    expect(h.touched).toEqual([[2]]);
    expect(h.pruneCalls).toBe(1);
  });

  it("returns 0 and asks for nothing when every killmail is already valued", async () => {
    const h = harness([], []);
    expect(await h.job.run({ esi: undefined as never })).toBe(0);
    expect(h.asked).toEqual([]);
    expect(h.written).toEqual([]);
    expect(h.touched).toEqual([]);
    // The cache prune runs every tick regardless of whether there was anything to value.
    expect(h.pruneCalls).toBe(1);
  });
});
```

- [ ] **Step 8: Write `src/worker/jobs/killmail-values.ts`**

```ts
import type { GlobalSyncJob } from "../scheduler.js";
import { getPrices } from "../../lib/db/market-prices.js";
import {
  pruneKillmailCache, setComputedValues, touchValueChecked, unvaluedKillmails,
} from "../../lib/db/killmail-values.js";
import { computeKillmailValue, type KillmailValueParts } from "../../lib/combat/value.js";
import type { Price } from "../../lib/view/price.js";

export const KILLMAIL_VALUES_INTERVAL_MS = 60 * 60 * 1000;
export const KILLMAIL_VALUES_RETRY_MS = 10 * 60 * 1000;

export interface KillmailValuesDeps {
  unvaluedKillmails: (limit?: number) => Promise<KillmailValueParts[]>;
  getPrices: (typeIds: number[]) => Promise<Map<number, Price>>;
  setComputedValues: (rows: { killmailId: number; value: number }[]) => Promise<number>;
  touchValueChecked: (killmailIds: number[]) => Promise<number>;
  pruneKillmailCache: () => Promise<number>;
}

/**
 * Spec §4: one pass over the killmails `unvaluedKillmails` offers (least-recently-checked first —
 * the starvation guard), one price query for every type they mention together, and a write for each
 * killmail whose types were all priced. Every id this run looked at is stamped with
 * `value_checked_at`, whether or not it got a value: `setComputedValues` stamps the priced ones as
 * part of the same write, and `touchValueChecked` stamps the rest, so an unpriceable killmail is not
 * re-offered for 24 hours instead of starving the batch behind it every single run.
 */
export function createKillmailValuesJob(deps: KillmailValuesDeps): GlobalSyncJob {
  return {
    name: "killmail-values",
    scope: "global",
    intervalMs: KILLMAIL_VALUES_INTERVAL_MS,
    retryMs: KILLMAIL_VALUES_RETRY_MS,
    async run(): Promise<number> {
      // Killmail-body esi_cache rows are write-once-never-read; this is unrelated to valuation but
      // hourly is the natural cadence for it, so it rides along on this job's tick.
      await deps.pruneKillmailCache();

      const parts = await deps.unvaluedKillmails();
      if (parts.length === 0) return 0;

      const typeIds = new Set<number>();
      for (const p of parts) {
        if (p.shipTypeId !== null) typeIds.add(p.shipTypeId);
        for (const item of p.items) typeIds.add(item.typeId);
      }
      const prices = await deps.getPrices([...typeIds]);

      const valued: { killmailId: number; value: number }[] = [];
      const unpriced: number[] = [];
      for (const p of parts) {
        const value = computeKillmailValue(p, prices);
        if (value !== null) valued.push({ killmailId: p.killmailId, value });
        else unpriced.push(p.killmailId);
      }
      const [written] = await Promise.all([
        deps.setComputedValues(valued),
        deps.touchValueChecked(unpriced),
      ]);
      return written;
    },
  };
}

export const killmailValuesJob: GlobalSyncJob = createKillmailValuesJob({
  unvaluedKillmails, getPrices, setComputedValues, touchValueChecked, pruneKillmailCache,
});
```

- [ ] **Step 9: Register the job**

`src/worker/jobs/index.ts`:
```ts
import { killmailValuesJob } from "./killmail-values.js";
```
```ts
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, marketPricesJob, killmailBackfillJob, killmailValuesJob,
  characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob, walletJob, locationJob, killmailsJob,
];
```
`tests/worker/registration.test.ts` — the name list (and its test's title, which names the global
count too), the fourth global assertion, the interval and the counts:
```ts
  it("registers the four global jobs plus the eight character jobs, globals first", () => {
    expect(ALL_JOBS.map((j) => j.name)).toEqual([
      "sde-update", "market-prices", "killmail-backfill", "killmail-values",
      "character-info", "skills", "clones", "assets", "fittings", "wallet", "location", "killmails",
    ]);
    for (const i of [0, 1, 2, 3]) expect(ALL_JOBS[i].scope).toBe("global");
  });
```
```ts
    expect(byName.get("killmail-values")).toBe(60 * 60 * 1000);
```
```ts
  it("marks exactly four jobs global; the other eight run per character", () => {
    expect(ALL_JOBS.filter(isGlobal)).toHaveLength(4);
    const characterJobs = ALL_JOBS.filter((j): j is CharacterSyncJob => !isGlobal(j));
    expect(characterJobs).toHaveLength(8);
    for (const job of characterJobs) expect(job.scope ?? "character").toBe("character");
  });
```

- [ ] **Step 10: Run everything this task touched**

Run: `npx vitest run tests/combat/value.test.ts tests/db/killmail-values.test.ts tests/db/market-interest.test.ts tests/worker/killmail-values.test.ts tests/worker/registration.test.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/combat/value.ts src/lib/db/killmail-values.ts src/lib/market/interest.ts src/worker/jobs tests
git commit -m "$(cat <<'EOM'
feat(combat): killmail valuation

computeKillmailValue sums hull + items (destroyed + dropped) at priceOf, and
returns null when any type is unpriced so the killmail is retried. The hourly
killmail-values job values up to 500 least-recently-checked killmails at a
time, stamping value_checked_at on every id it examines (priced or not) so an
unpriceable killmail is skipped for 24h instead of starving the batch behind
it; it also prunes esi_cache's write-once-never-read killmail-body rows.
typesOfInterest now feeds killmail item and victim-ship types from the last
90 days to Fuzzwork.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: PvP statistics (`src/lib/combat/stats.ts`)

Spec §5, in full: kills, losses, ISK destroyed, ISK lost, efficiency, solo kills, final blows, top 5
ships flown on kills, top 5 ships lost, top 5 systems, the last 12 calendar months of activity, and
the favourite weapon. Pure — a `StatRow[]` in, a `CombatStats` out, no database, no clock beyond the
`now` the caller passes.

**Files:**
- Create: `src/lib/combat/stats.ts`, `tests/combat/stats.test.ts`

**Interfaces:**
- Consumes (Task 1):
```ts
export type KillRole = "kill" | "loss";
```
- Produces:
```ts
// src/lib/combat/stats.ts
export type CombatPeriod = "30d" | "90d" | "1y" | "all";
export const COMBAT_PERIODS: readonly CombatPeriod[];        // ["30d", "90d", "1y", "all"]
export const PERIOD_LABELS: Record<CombatPeriod, string>;    // "30 d" | "90 d" | "1 y" | "All"
export const DEFAULT_PERIOD: CombatPeriod;                   // "90d"
export function parsePeriod(raw: string | null | undefined): CombatPeriod;
export function periodStart(period: CombatPeriod, now: Date): Date | null;
export const TOP_N: number;        // 5
export const MONTHS_SHOWN: number; // 12
export interface StatRow {
  killmailId: number; role: KillRole; time: Date; value: number | null;
  solarSystemId: number | null; victimShipTypeId: number | null;
  ourShipTypeId: number | null; weaponTypeId: number | null;
  solo: boolean; finalBlow: boolean;
}
export interface TopEntry { id: number; count: number }
export interface MonthBucket { month: string; kills: number; losses: number }
export interface CombatStats {
  kills: number; losses: number; iskDestroyed: number; iskLost: number;
  efficiency: number | null; soloKills: number; finalBlows: number;
  shipsFlown: TopEntry[]; shipsLost: TopEntry[]; systems: TopEntry[];
  favouriteWeapon: number | null; months: MonthBucket[];
}
export function combatStats(rows: StatRow[], now: Date): CombatStats;
```

- [ ] **Step 1: Write the failing test**

Create `tests/combat/stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  COMBAT_PERIODS, DEFAULT_PERIOD, MONTHS_SHOWN, PERIOD_LABELS, TOP_N,
  combatStats, parsePeriod, periodStart, type StatRow,
} from "../../src/lib/combat/stats.js";

const NOW = new Date("2026-09-02T00:00:00Z");

/**
 * Five rows, chosen so every figure in spec §5 has a different answer:
 *   1  kill  2026-09-01  150,000,000  Jita 30000142  we flew 621, weapon 2929, final blow
 *   2  kill  2026-08-15   50,000,000  Jita 30000142  we flew 621, weapon 2929, final blow, solo
 *   3  loss  2026-07-04  200,000,000  Amarr 30002187 we lost 621
 *   4  kill  2025-10-20   25,000,000  30000144       we flew 11393, weapon 3025
 *   5  kill  2026-09-01    5,000,000  Jita 30000142  we flew 621, weapon 2929
 */
const rows: StatRow[] = [
  { killmailId: 1, role: "kill", time: new Date("2026-09-01T12:00:00Z"), value: 150_000_000,
    solarSystemId: 30000142, victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929,
    solo: false, finalBlow: true },
  { killmailId: 2, role: "kill", time: new Date("2026-08-15T09:00:00Z"), value: 50_000_000,
    solarSystemId: 30000142, victimShipTypeId: 590, ourShipTypeId: 621, weaponTypeId: 2929,
    solo: true, finalBlow: true },
  { killmailId: 3, role: "loss", time: new Date("2026-07-04T18:30:00Z"), value: 200_000_000,
    solarSystemId: 30002187, victimShipTypeId: 621, ourShipTypeId: 621, weaponTypeId: null,
    solo: false, finalBlow: false },
  { killmailId: 4, role: "kill", time: new Date("2025-10-20T03:00:00Z"), value: 25_000_000,
    solarSystemId: 30000144, victimShipTypeId: 587, ourShipTypeId: 11393, weaponTypeId: 3025,
    solo: false, finalBlow: false },
  { killmailId: 5, role: "kill", time: new Date("2026-09-01T20:00:00Z"), value: 5_000_000,
    solarSystemId: 30000142, victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929,
    solo: false, finalBlow: false },
];

describe("combatStats", () => {
  const stats = combatStats(rows, NOW);

  it("counts kills and losses and adds up the ISK on each side", () => {
    expect(stats.kills).toBe(4);
    expect(stats.losses).toBe(1);
    // 150,000,000 + 50,000,000 + 25,000,000 + 5,000,000 = 230,000,000
    expect(stats.iskDestroyed).toBe(230_000_000);
    expect(stats.iskLost).toBe(200_000_000);
  });

  it("computes efficiency as destroyed / (destroyed + lost)", () => {
    // 230,000,000 / 430,000,000 = 0.5348837209302325
    expect(stats.efficiency).toBeCloseTo(230 / 430, 12);
    expect((stats.efficiency! * 100).toFixed(1)).toBe("53.5");
  });

  it("has no efficiency at all when nothing has a value", () => {
    const blank = combatStats(
      rows.map((r) => ({ ...r, value: null })), NOW);
    expect(blank.iskDestroyed).toBe(0);
    expect(blank.iskLost).toBe(0);
    expect(blank.efficiency).toBeNull();
    expect(blank.kills).toBe(4);
  });

  it("counts solo kills and final blows on kills only", () => {
    expect(stats.soloKills).toBe(1);
    expect(stats.finalBlows).toBe(2);
  });

  it("ranks ships flown on kills, ships lost and systems, ties broken by ascending id", () => {
    expect(stats.shipsFlown).toEqual([{ id: 621, count: 3 }, { id: 11393, count: 1 }]);
    expect(stats.shipsLost).toEqual([{ id: 621, count: 1 }]);
    expect(stats.systems).toEqual([
      { id: 30000142, count: 3 }, { id: 30000144, count: 1 }, { id: 30002187, count: 1 },
    ]);
    expect(TOP_N).toBe(5);
  });

  it("keeps at most five entries in each top list", () => {
    const many: StatRow[] = Array.from({ length: 8 }, (_, i) => ({
      ...rows[0], killmailId: 100 + i, ourShipTypeId: 1000 + i, solarSystemId: 2000 + i,
    }));
    const wide = combatStats(many, NOW);
    expect(wide.shipsFlown).toHaveLength(TOP_N);
    expect(wide.systems).toHaveLength(TOP_N);
  });

  it("picks the weapon used on the most kills", () => {
    expect(stats.favouriteWeapon).toBe(2929);
    expect(combatStats([rows[2]], NOW).favouriteWeapon).toBeNull();
  });

  it("buckets twelve calendar months ending with the month of `now`", () => {
    expect(stats.months).toHaveLength(MONTHS_SHOWN);
    expect(MONTHS_SHOWN).toBe(12);
    expect(stats.months.map((m) => m.month)).toEqual([
      "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ]);
    // index 0 is the row from 2025-10-20; 9 is the July loss; 10 is August; 11 has two kills.
    expect(stats.months[0]).toEqual({ month: "2025-10", kills: 1, losses: 0 });
    expect(stats.months[9]).toEqual({ month: "2026-07", kills: 0, losses: 1 });
    expect(stats.months[10]).toEqual({ month: "2026-08", kills: 1, losses: 0 });
    expect(stats.months[11]).toEqual({ month: "2026-09", kills: 2, losses: 0 });
  });

  it("drops a row older than the twelve-month window from the strip but not from the totals", () => {
    const old: StatRow = { ...rows[0], killmailId: 9, time: new Date("2024-01-01T00:00:00Z") };
    const wide = combatStats([...rows, old], NOW);
    expect(wide.kills).toBe(5);
    expect(wide.months.reduce((n, m) => n + m.kills, 0)).toBe(4);
  });
});

describe("periods", () => {
  it("names the four tabs from spec §6", () => {
    expect(COMBAT_PERIODS).toEqual(["30d", "90d", "1y", "all"]);
    expect(PERIOD_LABELS).toEqual({ "30d": "30 d", "90d": "90 d", "1y": "1 y", all: "All" });
    expect(DEFAULT_PERIOD).toBe("90d");
  });
  it("falls back to the default for anything it does not recognise", () => {
    expect(parsePeriod("30d")).toBe("30d");
    expect(parsePeriod("all")).toBe("all");
    expect(parsePeriod(null)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("last-tuesday")).toBe(DEFAULT_PERIOD);
  });
  it("turns a period into the earliest instant it includes", () => {
    // 2026-09-02 minus 30 days is 2026-08-03; minus 90 is 2026-06-04; minus a year is 2025-09-02.
    expect(periodStart("30d", NOW)?.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(periodStart("90d", NOW)?.toISOString()).toBe("2026-06-04T00:00:00.000Z");
    expect(periodStart("1y", NOW)?.toISOString()).toBe("2025-09-02T00:00:00.000Z");
    expect(periodStart("all", NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/combat/stats.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/combat/stats.js".

- [ ] **Step 3: Write `src/lib/combat/stats.ts`**

```ts
import type { KillRole } from "./killmail.js";

/**
 * Spec §5's statistics as a pure function. Everything is derived from the rows the caller passes,
 * including the twelve-month strip, so the same code answers the page, a test and (later) an API
 * route without a database anywhere near it.
 */
export type CombatPeriod = "30d" | "90d" | "1y" | "all";
export const COMBAT_PERIODS: readonly CombatPeriod[] = ["30d", "90d", "1y", "all"];
export const PERIOD_LABELS: Record<CombatPeriod, string> = {
  "30d": "30 d", "90d": "90 d", "1y": "1 y", all: "All",
};
/** ESI's own recent window, and the one period where every killmail is certain to be complete. */
export const DEFAULT_PERIOD: CombatPeriod = "90d";
export const TOP_N = 5;
export const MONTHS_SHOWN = 12;

export function parsePeriod(raw: string | null | undefined): CombatPeriod {
  return COMBAT_PERIODS.includes(raw as CombatPeriod) ? (raw as CombatPeriod) : DEFAULT_PERIOD;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `null` = no lower bound, which is what "All" means to the SQL. */
export function periodStart(period: CombatPeriod, now: Date): Date | null {
  switch (period) {
    case "30d": return new Date(now.getTime() - 30 * DAY_MS);
    case "90d": return new Date(now.getTime() - 90 * DAY_MS);
    case "1y": {
      const start = new Date(now.getTime());
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      return start;
    }
    default: return null;
  }
}

export interface StatRow {
  killmailId: number; role: KillRole; time: Date; value: number | null;
  solarSystemId: number | null; victimShipTypeId: number | null;
  ourShipTypeId: number | null; weaponTypeId: number | null;
  solo: boolean; finalBlow: boolean;
}
export interface TopEntry { id: number; count: number }
export interface MonthBucket { month: string; kills: number; losses: number }
export interface CombatStats {
  kills: number; losses: number; iskDestroyed: number; iskLost: number;
  efficiency: number | null; soloKills: number; finalBlows: number;
  shipsFlown: TopEntry[]; shipsLost: TopEntry[]; systems: TopEntry[];
  favouriteWeapon: number | null; months: MonthBucket[];
}

/** Highest count first, ties broken by ascending id so the list never reorders itself. */
function top(counts: Map<number, number>, limit = TOP_N): TopEntry[] {
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => (b.count - a.count) || (a.id - b.id))
    .slice(0, limit);
}

function bump(counts: Map<number, number>, id: number | null): void {
  if (id === null) return;
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

/** "2026-09" — UTC, zero-padded, sortable, and what the strip's labels are derived from. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function combatStats(rows: StatRow[], now: Date): CombatStats {
  let kills = 0;
  let losses = 0;
  let iskDestroyed = 0;
  let iskLost = 0;
  let soloKills = 0;
  let finalBlows = 0;
  const shipsFlown = new Map<number, number>();
  const shipsLost = new Map<number, number>();
  const systems = new Map<number, number>();
  const weapons = new Map<number, number>();

  // The twelve buckets exist whether or not anything happened in them, so the strip is never ragged.
  const months: MonthBucket[] = [];
  const monthIndex = new Map<string, number>();
  for (let back = MONTHS_SHOWN - 1; back >= 0; back--) {
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = monthKey(cursor);
    monthIndex.set(key, months.length);
    months.push({ month: key, kills: 0, losses: 0 });
  }

  for (const row of rows) {
    const value = row.value ?? 0;      // an unvalued killmail counts as an event, not as ISK
    if (row.role === "kill") {
      kills += 1;
      iskDestroyed += value;
      if (row.solo) soloKills += 1;
      if (row.finalBlow) finalBlows += 1;
      bump(shipsFlown, row.ourShipTypeId);
      bump(weapons, row.weaponTypeId);
    } else {
      losses += 1;
      iskLost += value;
      bump(shipsLost, row.victimShipTypeId);
    }
    bump(systems, row.solarSystemId);
    const slot = monthIndex.get(monthKey(row.time));
    if (slot !== undefined) {
      if (row.role === "kill") months[slot].kills += 1; else months[slot].losses += 1;
    }
  }

  const totalIsk = iskDestroyed + iskLost;
  return {
    kills, losses, iskDestroyed, iskLost,
    efficiency: totalIsk === 0 ? null : iskDestroyed / totalIsk,
    soloKills, finalBlows,
    shipsFlown: top(shipsFlown), shipsLost: top(shipsLost), systems: top(systems),
    favouriteWeapon: top(weapons, 1)[0]?.id ?? null,
    months,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/combat/stats.test.ts`
Expected: PASS. Derivations for the pinned numbers:
- ISK destroyed = 150M + 50M + 25M + 5M = **230,000,000**; ISK lost = **200,000,000**.
- Efficiency = 230 / (230 + 200) = 230 / 430 = 0.5348837209302325 → **"53.5"** at one decimal.
- Ships flown: 621 on rows 1, 2 and 5 = **3**; 11393 on row 4 = **1**.
- Systems: 30000142 on rows 1, 2 and 5 = **3**; 30000144 and 30002187 = **1** each, so the tie
  between them resolves by ascending id — 30000144 first.
- Months: `now` is 2026-09, so the strip runs 2026-09 minus 11 months = **2025-10** to **2026-09**,
  twelve entries; 2026-07 is index 9 (2025-10 = 0, 2025-11 = 1, 2025-12 = 2, 2026-01 = 3 … 2026-07 = 9).
- `periodStart("30d")`: 2026-09-02 − 30 days = **2026-08-03**; − 90 days = **2026-06-04**
  (August has 31 days, July 31, June 30: 2 + 31 + 31 + 26 = 90 back to 4 June).

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/combat/stats.ts tests/combat/stats.test.ts
git commit -m "$(cat <<'EOM'
feat(combat): PvP statistics as a pure function

combatStats returns every figure in spec §5 — kills, losses, ISK either way,
efficiency, solo kills, final blows, top-5 ships flown/lost/systems, favourite
weapon and twelve calendar months of activity — plus the period tabs and their
start instants.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: The combat read repo

Everything the two pages query. One `DISTINCT ON` shape serves the table, the statistics and the
count, so a killmail four of our characters were on appears **once** (Decision 11), with `loss`
winning over `kill` and "our ship" taken from the lowest of our character ids on it.

**Files:**
- Modify: `src/lib/db/killmails.ts`
- Create: `tests/db/killmail-read.test.ts`

**Interfaces:**
- Consumes (Tasks 1, 2, 7):
```ts
export type KillRole = "kill" | "loss";
export interface KillmailAttackerRow { idx: number; characterId: number | null; corporationId: number | null;
  allianceId: number | null; factionId: number | null; shipTypeId: number | null;
  weaponTypeId: number | null; damageDone: number; finalBlow: boolean; securityStatus: number | null }
export interface KillmailItemRow { idx: number; parentIdx: number | null; itemTypeId: number;
  flag: number; singleton: number; quantityDestroyed: number; quantityDropped: number }
export interface StatRow { killmailId: number; role: KillRole; time: Date; value: number | null;
  solarSystemId: number | null; victimShipTypeId: number | null; ourShipTypeId: number | null;
  weaponTypeId: number | null; solo: boolean; finalBlow: boolean }
```
- Produces (added to `src/lib/db/killmails.ts`):
```ts
export const COMBAT_PAGE_SIZE: number;   // 50
export const STAT_ROW_CAP: number;       // 20000
export interface CombatRow extends StatRow {
  victimCharacterId: number | null; victimCorporationId: number | null; attackerCount: number;
}
export interface CombatQuery { since: Date | null; limit?: number; offset?: number }
export async function listCombatRows(characterIds: number[], q: CombatQuery): Promise<CombatRow[]>;
export async function allCombatRows(characterIds: number[], since: Date | null): Promise<CombatRow[]>;
export async function countCombatRows(characterIds: number[], since: Date | null): Promise<number>;
export interface KillmailHeadRow {
  killmailId: number; killmailHash: string; killmailTime: Date;
  solarSystemId: number | null; moonId: number | null; warId: number | null;
  victimCharacterId: number | null; victimCorporationId: number | null;
  victimAllianceId: number | null; victimFactionId: number | null;
  victimShipTypeId: number | null; damageTaken: number | null; attackerCount: number;
  zkbTotalValue: number | null; zkbPoints: number | null;
  zkbNpc: boolean | null; zkbSolo: boolean | null; zkbAwox: boolean | null;
  computedValue: number | null; source: "esi" | "zkb";
}
export interface KillmailFull {
  head: KillmailHeadRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[];
  roles: { characterId: number; role: KillRole }[];
}
export async function getKillmail(killmailId: number): Promise<KillmailFull | null>;
```

- [ ] **Step 1: Write the failing test**

Create `tests/db/killmail-read.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import {
  COMBAT_PAGE_SIZE, allCombatRows, countCombatRows, getKillmail, listCombatRows, saveKillmails,
} from "../../src/lib/db/killmails.js";
import { toKillmailWrite, type EsiKillmail } from "../../src/lib/combat/killmail.js";
import { esiFixture } from "../fixtures/esi.js";

let pool: Pool;
const A = 90000101;      // the fixture's victim
const B = 2112625428;     // the fixture's first attacker

function killmail(id: number, time: string, over: Partial<EsiKillmail> = {}): EsiKillmail {
  return { ...esiFixture<EsiKillmail>("killmail"), killmail_id: id, killmail_time: time, ...over };
}

beforeAll(async () => {
  pool = await resetDb();
  await pool.query(
    "INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'A', 'e'), ($2, 'B', 'e')", [A, B]);

  // 1: A's loss, B on the kill. 2: A's loss, older. 3: A's kill only.
  const base = esiFixture<EsiKillmail>("killmail");
  await saveKillmails(
    [
      toKillmailWrite(killmail(1, "2026-09-01T12:00:00Z"), "h1", "esi"),
      toKillmailWrite(killmail(2, "2026-06-01T12:00:00Z"), "h2", "zkb",
        { hash: "h2", totalValue: 12_000_000, points: 3, npc: false, solo: false, awox: false }),
      toKillmailWrite(
        killmail(3, "2026-08-01T12:00:00Z", {
          victim: { ...base.victim, character_id: 90000001 },
          attackers: [{ character_id: A, corporation_id: 98000001, damage_done: 10,
            final_blow: true, security_status: 0.1, ship_type_id: 11393, weapon_type_id: 3025 }],
        }), "h3", "esi"),
    ],
    [
      { characterId: A, killmailId: 1, role: "loss" }, { characterId: B, killmailId: 1, role: "kill" },
      { characterId: A, killmailId: 2, role: "loss" },
      { characterId: A, killmailId: 3, role: "kill" },
    ]);
  await pool.query("UPDATE killmails SET computed_value = 5000000 WHERE killmail_id = 1");
  await pool.query("UPDATE killmails SET computed_value = 999 WHERE killmail_id = 2");
}, 60_000);
afterAll(closePool);

describe("listCombatRows", () => {
  it("pages newest first and prefers the zkb value over the computed one", async () => {
    const rows = await listCombatRows([A], { since: null });
    expect(rows.map((r) => r.killmailId)).toEqual([1, 3, 2]);
    expect(rows[0]).toMatchObject({
      role: "loss", value: 5_000_000, solarSystemId: 30000142,
      victimCharacterId: A, victimCorporationId: 98000001, victimShipTypeId: 621,
      ourShipTypeId: 621, weaponTypeId: null, attackerCount: 3, solo: false, finalBlow: false,
    });
    // killmail 2 has both: zkb_total_value 12,000,000 wins over computed_value 999.
    expect(rows[2].value).toBe(12_000_000);
    // On killmail 3 we were the attacker: our ship and weapon come from the attacker row.
    expect(rows[1]).toMatchObject({ role: "kill", ourShipTypeId: 11393, weaponTypeId: 3025, finalBlow: true });
  });

  it("honours since, limit and offset", async () => {
    expect((await listCombatRows([A], { since: new Date("2026-07-01T00:00:00Z") })).map((r) => r.killmailId))
      .toEqual([1, 3]);
    expect((await listCombatRows([A], { since: null, limit: 1 })).map((r) => r.killmailId)).toEqual([1]);
    expect((await listCombatRows([A], { since: null, limit: 1, offset: 1 })).map((r) => r.killmailId)).toEqual([3]);
    expect(COMBAT_PAGE_SIZE).toBe(50);
  });

  it("shows a killmail both characters were on exactly once, as a loss", async () => {
    const rows = await listCombatRows([A, B], { since: null });
    expect(rows.map((r) => r.killmailId)).toEqual([1, 3, 2]);
    expect(rows[0].role).toBe("loss");
    // The lowest of OUR ids on killmail 1 is A (90000101), who was the victim, so our ship is the
    // ship that died, not B's Rifter.
    expect(rows[0].ourShipTypeId).toBe(621);
  });

  it("returns nothing for a character with no killmails and for an empty id list", async () => {
    expect(await listCombatRows([], { since: null })).toEqual([]);
    expect(await listCombatRows([1234], { since: null })).toEqual([]);
  });
});

describe("allCombatRows and countCombatRows", () => {
  it("agree with the paged view", async () => {
    expect((await allCombatRows([A], null)).map((r) => r.killmailId)).toEqual([1, 3, 2]);
    expect(await countCombatRows([A], null)).toBe(3);
    expect(await countCombatRows([A, B], null)).toBe(3);
    expect(await countCombatRows([A], new Date("2026-07-01T00:00:00Z"))).toBe(2);
    expect(await countCombatRows([], null)).toBe(0);
  });
});

describe("getKillmail", () => {
  it("returns the head, the attackers in order, the items in order and who of ours was on it", async () => {
    const full = (await getKillmail(1))!;
    expect(full.head).toMatchObject({
      killmailId: 1, killmailHash: "h1", solarSystemId: 30000142, victimCharacterId: A,
      victimShipTypeId: 621, damageTaken: 4210, attackerCount: 3,
      computedValue: 5_000_000, zkbTotalValue: null, source: "esi",
    });
    expect(full.head.killmailTime).toEqual(new Date("2026-09-01T12:00:00Z"));
    expect(full.attackers.map((a) => a.idx)).toEqual([0, 1, 2]);
    expect(full.attackers[1]).toMatchObject({ characterId: 90000102, finalBlow: true, damageDone: 3010 });
    expect(full.attackers[2]).toMatchObject({ characterId: null, factionId: 500003 });
    expect(full.items.map((i) => i.itemTypeId)).toEqual([3634, 11488, 34, 35, 2456]);
    expect(full.items[2]).toMatchObject({ parentIdx: 1, quantityDestroyed: 5000, quantityDropped: 0 });
    expect(full.roles).toEqual([
      { characterId: A, role: "loss" }, { characterId: B, role: "kill" },
    ]);
  });
  it("is null for a killmail we have never seen", async () => {
    expect(await getKillmail(999999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/db/killmail-read.test.ts`
Expected: FAIL — "listCombatRows is not a function".

- [ ] **Step 3: Add the read side to `src/lib/db/killmails.ts`**

Add these imports at the top of the file:
```ts
import type {
  CharacterKillmailLink, KillRole, KillmailAttackerRow, KillmailItemRow, KillmailWrite,
} from "../combat/killmail.js";
import type { StatRow } from "../combat/stats.js";
```

Append to the file:
```ts
/** Spec §6: the table shows 50 at a time and "more" loads the next 50. */
export const COMBAT_PAGE_SIZE = 50;
/** A hard ceiling on the statistics query, so "All" on a 20,000-killmail backfill stays bounded. */
export const STAT_ROW_CAP = 20_000;

export interface CombatRow extends StatRow {
  victimCharacterId: number | null; victimCorporationId: number | null; attackerCount: number;
}
export interface CombatQuery { since: Date | null; limit?: number; offset?: number }

interface CombatDbRow {
  killmailId: string; role: KillRole; time: Date; value: string | null;
  solarSystemId: number | null; victimCharacterId: string | null; victimCorporationId: string | null;
  victimShipTypeId: number | null; ourShipTypeId: number | null; weaponTypeId: number | null;
  solo: boolean; finalBlow: boolean; attackerCount: number;
}

const numeric = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * One killmail, one row, however many of our characters were on it (Decision 11):
 * `DISTINCT ON (killmail_id)` with `role = 'loss'` sorted first means a loss beats a kill, and the
 * LATERAL join picks the attacker row belonging to the LOWEST of our character ids. Displayed value
 * is `zkb_total_value ?? computed_value` (spec §4's ruling).
 */
const COMBAT_SELECT = `
  SELECT DISTINCT ON (k.killmail_id)
    k.killmail_id AS "killmailId",
    ck.role,
    k.killmail_time AS "time",
    COALESCE(k.zkb_total_value, k.computed_value) AS value,
    k.solar_system_id AS "solarSystemId",
    k.victim_character_id AS "victimCharacterId",
    k.victim_corporation_id AS "victimCorporationId",
    k.victim_ship_type_id AS "victimShipTypeId",
    CASE WHEN ck.role = 'loss' THEN k.victim_ship_type_id ELSE mine.ship_type_id END AS "ourShipTypeId",
    CASE WHEN ck.role = 'loss' THEN NULL ELSE mine.weapon_type_id END AS "weaponTypeId",
    COALESCE(k.zkb_solo, k.attacker_count = 1) AS solo,
    COALESCE(mine.final_blow, false) AS "finalBlow",
    k.attacker_count AS "attackerCount"
  FROM character_killmails ck
  JOIN killmails k ON k.killmail_id = ck.killmail_id
  LEFT JOIN LATERAL (
    SELECT a.ship_type_id, a.weapon_type_id, a.final_blow
    FROM killmail_attackers a
    WHERE a.killmail_id = k.killmail_id AND a.character_id = ANY($1::bigint[])
    ORDER BY a.character_id
    LIMIT 1
  ) mine ON true
  WHERE ck.character_id = ANY($1::bigint[])
    AND ($2::timestamptz IS NULL OR k.killmail_time >= $2)
  ORDER BY k.killmail_id, (ck.role = 'loss') DESC`;

function toCombatRow(r: CombatDbRow): CombatRow {
  return {
    killmailId: Number(r.killmailId), role: r.role, time: r.time, value: numeric(r.value),
    solarSystemId: r.solarSystemId,
    victimCharacterId: r.victimCharacterId === null ? null : Number(r.victimCharacterId),
    victimCorporationId: r.victimCorporationId === null ? null : Number(r.victimCorporationId),
    victimShipTypeId: r.victimShipTypeId, ourShipTypeId: r.ourShipTypeId,
    weaponTypeId: r.weaponTypeId, solo: r.solo, finalBlow: r.finalBlow,
    attackerCount: r.attackerCount,
  };
}

async function combatRows(
  characterIds: number[], since: Date | null, limit: number, offset: number,
): Promise<CombatRow[]> {
  if (characterIds.length === 0) return [];
  const { rows } = await getPool().query<CombatDbRow>(
    `SELECT * FROM (${COMBAT_SELECT}) t ORDER BY t."time" DESC, t."killmailId" DESC LIMIT $3 OFFSET $4`,
    [characterIds.map(String), since, limit, offset]);
  return rows.map(toCombatRow);
}

export function listCombatRows(characterIds: number[], q: CombatQuery): Promise<CombatRow[]> {
  return combatRows(characterIds, q.since, q.limit ?? COMBAT_PAGE_SIZE, q.offset ?? 0);
}

/** Every row in the period, for the statistics — capped so "All" cannot page in the whole backfill. */
export function allCombatRows(characterIds: number[], since: Date | null): Promise<CombatRow[]> {
  return combatRows(characterIds, since, STAT_ROW_CAP, 0);
}

export async function countCombatRows(characterIds: number[], since: Date | null): Promise<number> {
  if (characterIds.length === 0) return 0;
  const { rows } = await getPool().query<{ n: number }>(
    `SELECT count(DISTINCT ck.killmail_id)::int AS n
     FROM character_killmails ck
     JOIN killmails k ON k.killmail_id = ck.killmail_id
     WHERE ck.character_id = ANY($1::bigint[])
       AND ($2::timestamptz IS NULL OR k.killmail_time >= $2)`,
    [characterIds.map(String), since]);
  return rows[0]?.n ?? 0;
}

export interface KillmailHeadRow {
  killmailId: number; killmailHash: string; killmailTime: Date;
  solarSystemId: number | null; moonId: number | null; warId: number | null;
  victimCharacterId: number | null; victimCorporationId: number | null;
  victimAllianceId: number | null; victimFactionId: number | null;
  victimShipTypeId: number | null; damageTaken: number | null; attackerCount: number;
  zkbTotalValue: number | null; zkbPoints: number | null;
  zkbNpc: boolean | null; zkbSolo: boolean | null; zkbAwox: boolean | null;
  computedValue: number | null; source: "esi" | "zkb";
}
export interface KillmailFull {
  head: KillmailHeadRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[];
  roles: { characterId: number; role: KillRole }[];
}

/** The whole killmail for the detail page: four queries, no joins to fan rows out. */
export async function getKillmail(killmailId: number): Promise<KillmailFull | null> {
  const pool = getPool();
  const { rows } = await pool.query<Record<string, string | number | boolean | Date | null>>(
    `SELECT killmail_id AS "killmailId", killmail_hash AS "killmailHash",
            killmail_time AS "killmailTime", solar_system_id AS "solarSystemId",
            moon_id AS "moonId", war_id AS "warId",
            victim_character_id AS "victimCharacterId", victim_corporation_id AS "victimCorporationId",
            victim_alliance_id AS "victimAllianceId", victim_faction_id AS "victimFactionId",
            victim_ship_type_id AS "victimShipTypeId", damage_taken AS "damageTaken",
            attacker_count AS "attackerCount", zkb_total_value AS "zkbTotalValue",
            zkb_points AS "zkbPoints", zkb_npc AS "zkbNpc", zkb_solo AS "zkbSolo",
            zkb_awox AS "zkbAwox", computed_value AS "computedValue", source
     FROM killmails WHERE killmail_id = $1`, [String(killmailId)]);
  const raw = rows[0];
  if (raw === undefined) return null;

  const [attackers, items, roles] = await Promise.all([
    pool.query<Record<string, string | number | boolean | null>>(
      `SELECT idx, character_id AS "characterId", corporation_id AS "corporationId",
              alliance_id AS "allianceId", faction_id AS "factionId", ship_type_id AS "shipTypeId",
              weapon_type_id AS "weaponTypeId", damage_done AS "damageDone",
              final_blow AS "finalBlow", security_status AS "securityStatus"
       FROM killmail_attackers WHERE killmail_id = $1 ORDER BY idx`, [String(killmailId)]),
    pool.query<Record<string, string | number | null>>(
      `SELECT idx, parent_idx AS "parentIdx", item_type_id AS "itemTypeId", flag, singleton,
              quantity_destroyed AS "quantityDestroyed", quantity_dropped AS "quantityDropped"
       FROM killmail_items WHERE killmail_id = $1 ORDER BY idx`, [String(killmailId)]),
    pool.query<{ characterId: string; role: KillRole }>(
      `SELECT character_id AS "characterId", role FROM character_killmails
       WHERE killmail_id = $1 ORDER BY character_id`, [String(killmailId)]),
  ]);

  const big = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    head: {
      killmailId, killmailHash: raw.killmailHash as string,
      killmailTime: raw.killmailTime as Date,
      solarSystemId: raw.solarSystemId as number | null,
      moonId: big(raw.moonId), warId: big(raw.warId),
      victimCharacterId: big(raw.victimCharacterId),
      victimCorporationId: big(raw.victimCorporationId),
      victimAllianceId: big(raw.victimAllianceId),
      victimFactionId: raw.victimFactionId as number | null,
      victimShipTypeId: raw.victimShipTypeId as number | null,
      damageTaken: big(raw.damageTaken), attackerCount: raw.attackerCount as number,
      zkbTotalValue: big(raw.zkbTotalValue), zkbPoints: raw.zkbPoints as number | null,
      zkbNpc: raw.zkbNpc as boolean | null, zkbSolo: raw.zkbSolo as boolean | null,
      zkbAwox: raw.zkbAwox as boolean | null,
      computedValue: big(raw.computedValue), source: raw.source as "esi" | "zkb",
    },
    attackers: attackers.rows.map((a) => ({
      idx: a.idx as number, characterId: big(a.characterId), corporationId: big(a.corporationId),
      allianceId: big(a.allianceId), factionId: a.factionId as number | null,
      shipTypeId: a.shipTypeId as number | null, weaponTypeId: a.weaponTypeId as number | null,
      damageDone: Number(a.damageDone), finalBlow: a.finalBlow as boolean,
      securityStatus: a.securityStatus === null ? null : Number(a.securityStatus),
    })),
    items: items.rows.map((i) => ({
      idx: i.idx as number, parentIdx: i.parentIdx as number | null,
      itemTypeId: i.itemTypeId as number, flag: i.flag as number, singleton: i.singleton as number,
      quantityDestroyed: Number(i.quantityDestroyed), quantityDropped: Number(i.quantityDropped),
    })),
    roles: roles.rows.map((r) => ({ characterId: Number(r.characterId), role: r.role })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/db/killmail-read.test.ts tests/db/killmails.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/db/killmails.ts tests/db/killmail-read.test.ts
git commit -m "$(cat <<'EOM'
feat(combat): the combat read repo

listCombatRows / allCombatRows / countCombatRows share one DISTINCT ON shape so
a killmail several of our characters were on appears once, as a loss if any of
them died, with our ship taken from the lowest of our attacker rows. getKillmail
returns the head, attackers, items and which of ours were on it.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 9: The combat view models and the page loader

Spec §6's `/combat` content as strings: the six stat tiles, the twelve-column bar strip, the three
top lists, the killmail table rows and the backfill status line. `src/lib/view/combat.ts` is pure
(so the tests need no database) and `src/lib/combat/load.ts` is the single server-only module that
feeds it from Postgres — one `displayNames`, one `getTypes` and one `getSolarSystems` call for the
whole page, never ESI.

**Files:**
- Create: `src/lib/view/combat.ts`, `src/lib/combat/load.ts`,
  `tests/view/combat.test.ts`, `tests/db/combat-load.test.ts`

**Interfaces:**
- Consumes (verbatim from the working tree, plus Tasks 5, 7, 8):
```ts
// src/lib/view/format.ts
export function grouped(value: string | number): string;
export function stamp(date: Date | null): string;             // "2026-08-31 18:30"
export function secClass(status: number | null): SecClass;     // "sec-high" | "sec-low" | "sec-null"
export function secText(status: number | null): string;
// src/lib/view/price.ts
export function iskShort(value: number): string;               // "2.45B ISK"
// src/lib/names/label.ts
export async function displayNames(ids: number[]): Promise<Map<number, string>>;
// src/lib/sde/repo.ts
export interface SdeType { id: number; groupId: number | null; name: string | null; /* … */ }
export interface SdeSolarSystem { id: number; constellationId: number | null; regionId: number | null;
  name: string | null; securityStatus: number | null; securityClass: string | null }
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>;
export async function getSolarSystems(ids: number[]): Promise<Map<number, SdeSolarSystem>>;
// Task 8
export const COMBAT_PAGE_SIZE: number;
export interface CombatRow extends StatRow { victimCharacterId: number | null;
  victimCorporationId: number | null; attackerCount: number }
export async function listCombatRows(characterIds: number[], q: CombatQuery): Promise<CombatRow[]>;
export async function allCombatRows(characterIds: number[], since: Date | null): Promise<CombatRow[]>;
export async function countCombatRows(characterIds: number[], since: Date | null): Promise<number>;
// Task 7
export function combatStats(rows: StatRow[], now: Date): CombatStats;
export function periodStart(period: CombatPeriod, now: Date): Date | null;
// Task 5
export async function backfillStatus(characterIds: number[]): Promise<BackfillStatus[]>;
```
- Produces:
```ts
// src/lib/view/combat.ts
export interface Labels {
  names: ReadonlyMap<number, string>;
  types: ReadonlyMap<number, string>;
  systems: ReadonlyMap<number, { name: string; security: number | null }>;
}
export function nameOf(id: number | null, labels: Labels): string;
export function typeOf(id: number | null, labels: Labels): string;
export interface KillmailRowView {
  killmailId: number; href: string; time: string; role: "kill" | "loss"; roleLabel: string;
  victimShipTypeId: number | null; victimShip: string; victim: string; victimCorp: string;
  system: string; secClass: string; secText: string;
  value: string; attackers: string; ourShip: string;
}
export function killmailRows(rows: CombatRow[], labels: Labels): KillmailRowView[];
export interface StatTile { key: string; label: string; value: string }
export function statTiles(stats: CombatStats): StatTile[];
export interface MonthBarView { month: string; label: string; kills: number; losses: number;
  killPct: number; lossPct: number; title: string }
export function monthBars(stats: CombatStats): MonthBarView[];
export interface TopListView { key: string; title: string; rows: { label: string; count: string }[] }
export function topLists(stats: CombatStats, labels: Labels): TopListView[];
export function backfillLine(status: BackfillStatus[]): string | null;

// src/lib/combat/load.ts
export interface CombatPageView {
  tiles: StatTile[]; months: MonthBarView[]; topLists: TopListView[];
  rows: KillmailRowView[]; total: number; hasMore: boolean; backfill: string | null;
}
export async function loadLabels(rows: CombatRow[], stats?: CombatStats): Promise<Labels>;
export async function loadCombatPage(
  characterIds: number[], period: CombatPeriod, now?: Date,
): Promise<CombatPageView>;
export async function loadKillmailRows(
  characterIds: number[], period: CombatPeriod, offset: number, now?: Date,
): Promise<{ rows: KillmailRowView[]; hasMore: boolean }>;
```

- [ ] **Step 1: Write the failing view test**

Create `tests/view/combat.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  backfillLine, killmailRows, monthBars, nameOf, statTiles, topLists, typeOf, type Labels,
} from "../../src/lib/view/combat.js";
import { combatStats, type StatRow } from "../../src/lib/combat/stats.js";
import type { CombatRow } from "../../src/lib/db/killmails.js";

const NOW = new Date("2026-09-02T00:00:00Z");

const labels: Labels = {
  names: new Map([[90000101, "Mara Vexley"], [98000001, "Trill Industries"]]),
  types: new Map([[621, "Caracal"], [587, "Rifter"], [2929, "150mm Light AutoCannon II"]]),
  systems: new Map([[30000142, { name: "Jita", security: 0.946 }],
                    [30002187, { name: "Amarr", security: 1.0 }]]),
};

const row: CombatRow = {
  killmailId: 120000001, role: "loss", time: new Date("2026-09-01T12:00:00Z"), value: 8_125_000,
  solarSystemId: 30000142, victimCharacterId: 90000101, victimCorporationId: 98000001,
  victimShipTypeId: 621, ourShipTypeId: 621, weaponTypeId: null,
  solo: false, finalBlow: false, attackerCount: 3,
};

describe("nameOf / typeOf", () => {
  it("falls back to a readable placeholder rather than crashing", () => {
    expect(nameOf(90000101, labels)).toBe("Mara Vexley");
    expect(nameOf(4242, labels)).toBe("ID 4242");
    expect(nameOf(null, labels)).toBe("—");
    expect(typeOf(621, labels)).toBe("Caracal");
    expect(typeOf(4242, labels)).toBe("Unknown (4242)");
    expect(typeOf(null, labels)).toBe("—");
  });
});

describe("killmailRows", () => {
  it("renders one table row", () => {
    expect(killmailRows([row], labels)).toEqual([{
      killmailId: 120000001, href: "/combat/120000001", time: "2026-09-01 12:00",
      role: "loss", roleLabel: "Loss",
      victimShipTypeId: 621, victimShip: "Caracal",
      victim: "Mara Vexley", victimCorp: "Trill Industries",
      system: "Jita", secClass: "sec-high", secText: "0.9",
      // iskShort(8,125,000) = (8.125).toFixed(1) = "8.1M ISK"
      value: "8.1M ISK", attackers: "3", ourShip: "Caracal",
    }]);
  });
  it("shows a dash for an unvalued killmail and for a structure loss with no victim character", () => {
    const [view] = killmailRows(
      [{ ...row, value: null, victimCharacterId: null, ourShipTypeId: null }], labels);
    expect(view.value).toBe("—");
    expect(view.victim).toBe("—");
    expect(view.ourShip).toBe("—");
  });
  it("labels a kill", () => {
    expect(killmailRows([{ ...row, role: "kill" }], labels)[0].roleLabel).toBe("Kill");
  });
});

describe("statTiles", () => {
  const rows: StatRow[] = [
    { killmailId: 1, role: "kill", time: new Date("2026-09-01T12:00:00Z"), value: 230_000_000,
      solarSystemId: 30000142, victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929,
      solo: true, finalBlow: true },
    { killmailId: 2, role: "loss", time: new Date("2026-08-15T09:00:00Z"), value: 200_000_000,
      solarSystemId: 30002187, victimShipTypeId: 621, ourShipTypeId: 621, weaponTypeId: null,
      solo: false, finalBlow: false },
  ];
  it("shows the six tiles from spec §6 in order", () => {
    // 230,000,000 / 430,000,000 = 0.5348837… -> "53.5%"; iskShort(230,000,000) = "230.0M ISK".
    expect(statTiles(combatStats(rows, NOW))).toEqual([
      { key: "kills", label: "Kills", value: "1" },
      { key: "losses", label: "Losses", value: "1" },
      { key: "efficiency", label: "Efficiency", value: "53.5%" },
      { key: "destroyed", label: "ISK destroyed", value: "230.0M ISK" },
      { key: "lost", label: "ISK lost", value: "200.0M ISK" },
      { key: "solo", label: "Solo kills", value: "1" },
    ]);
  });
  it("shows a dash for efficiency when nothing is valued yet", () => {
    const blank = combatStats(rows.map((r) => ({ ...r, value: null })), NOW);
    expect(statTiles(blank)[2]).toEqual({ key: "efficiency", label: "Efficiency", value: "—" });
  });
});

describe("monthBars", () => {
  const rows: StatRow[] = [
    { killmailId: 1, role: "kill", time: new Date("2026-09-01T12:00:00Z"), value: 1,
      solarSystemId: null, victimShipTypeId: null, ourShipTypeId: null, weaponTypeId: null,
      solo: false, finalBlow: false },
    { killmailId: 2, role: "kill", time: new Date("2026-09-02T12:00:00Z"), value: 1,
      solarSystemId: null, victimShipTypeId: null, ourShipTypeId: null, weaponTypeId: null,
      solo: false, finalBlow: false },
    { killmailId: 3, role: "loss", time: new Date("2026-08-15T12:00:00Z"), value: 1,
      solarSystemId: null, victimShipTypeId: null, ourShipTypeId: null, weaponTypeId: null,
      solo: false, finalBlow: false },
  ];
  it("scales every bar against the busiest month", () => {
    const bars = monthBars(combatStats(rows, NOW));
    expect(bars).toHaveLength(12);
    expect(bars[11]).toEqual({
      month: "2026-09", label: "Sep", kills: 2, losses: 0,
      killPct: 100, lossPct: 0, title: "2026-09: 2 kills, 0 losses",
    });
    // The tallest column is September's 2, so August's single loss is 1 / 2 = 50%.
    expect(bars[10]).toEqual({
      month: "2026-08", label: "Aug", kills: 0, losses: 1,
      killPct: 0, lossPct: 50, title: "2026-08: 0 kills, 1 loss",
    });
    expect(bars[0].label).toBe("Oct");
    expect(bars[0].killPct).toBe(0);
  });
  it("leaves every bar at zero when there is no activity at all", () => {
    const bars = monthBars(combatStats([], NOW));
    expect(bars.every((b) => b.killPct === 0 && b.lossPct === 0)).toBe(true);
  });
});

describe("topLists", () => {
  it("names ships and systems and pluralises the counts", () => {
    const rows: StatRow[] = [
      { killmailId: 1, role: "kill", time: NOW, value: 1, solarSystemId: 30000142,
        victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929, solo: false, finalBlow: false },
      { killmailId: 2, role: "loss", time: NOW, value: 1, solarSystemId: 30002187,
        victimShipTypeId: 587, ourShipTypeId: 587, weaponTypeId: null, solo: false, finalBlow: false },
    ];
    const lists = topLists(combatStats(rows, NOW), labels);
    expect(lists.map((l) => l.key)).toEqual(["flown", "lost", "systems"]);
    expect(lists[0]).toEqual({ key: "flown", title: "Ships flown", rows: [{ label: "Caracal", count: "1" }] });
    expect(lists[1]).toEqual({ key: "lost", title: "Ships lost", rows: [{ label: "Rifter", count: "1" }] });
    expect(lists[2].rows).toEqual([{ label: "Jita", count: "1" }, { label: "Amarr", count: "1" }]);
  });
});

describe("backfillLine", () => {
  it("reports the total imported and the page still to fetch", () => {
    expect(backfillLine([{
      characterId: 1, imported: 3200,
      cursors: [{ kind: "kills", nextPage: 17, done: false }, { kind: "losses", nextPage: 4, done: true }],
    }])).toBe("Backfill from zKillboard: 3,200 killmails imported (kills page 17, losses done)");
  });
  it("says so once every cursor is finished", () => {
    expect(backfillLine([{
      characterId: 1, imported: 12,
      cursors: [{ kind: "kills", nextPage: 3, done: true }, { kind: "losses", nextPage: 2, done: true }],
    }])).toBe("Backfill from zKillboard: complete — 12 killmails imported");
  });
  it("is null before the job has ever run", () => {
    expect(backfillLine([])).toBeNull();
    expect(backfillLine([{ characterId: 1, imported: 0, cursors: [] }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/view/combat.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/view/combat.js".

- [ ] **Step 3: Write `src/lib/view/combat.ts`**

```ts
import type { CombatRow } from "../db/killmails.js";
import type { BackfillStatus } from "../db/killmail-backfill.js";
import type { CombatStats, TopEntry } from "../combat/stats.js";
import { grouped, secClass, secText, stamp } from "./format.js";
import { iskShort } from "./price.js";

const DASH = "—";

/**
 * Every label the combat pages need, already read out of Postgres. `names` is `universe_names`
 * (written by the jobs — Decision 3), `types` and `systems` are the SDE. A miss is a placeholder,
 * never an ESI call.
 */
export interface Labels {
  names: ReadonlyMap<number, string>;
  types: ReadonlyMap<number, string>;
  systems: ReadonlyMap<number, { name: string; security: number | null }>;
}

export function nameOf(id: number | null, labels: Labels): string {
  if (id === null) return DASH;
  return labels.names.get(id) ?? `ID ${id}`;
}
export function typeOf(id: number | null, labels: Labels): string {
  if (id === null) return DASH;
  return labels.types.get(id) ?? `Unknown (${id})`;
}

export interface KillmailRowView {
  killmailId: number; href: string; time: string; role: "kill" | "loss"; roleLabel: string;
  victimShipTypeId: number | null; victimShip: string; victim: string; victimCorp: string;
  system: string; secClass: string; secText: string;
  value: string; attackers: string; ourShip: string;
}

export function killmailRows(rows: CombatRow[], labels: Labels): KillmailRowView[] {
  return rows.map((row) => {
    const system = row.solarSystemId === null ? undefined : labels.systems.get(row.solarSystemId);
    const security = system?.security ?? null;
    return {
      killmailId: row.killmailId,
      href: `/combat/${row.killmailId}`,
      time: stamp(row.time),
      role: row.role,
      roleLabel: row.role === "kill" ? "Kill" : "Loss",
      victimShipTypeId: row.victimShipTypeId,
      victimShip: typeOf(row.victimShipTypeId, labels),
      victim: nameOf(row.victimCharacterId, labels),
      victimCorp: nameOf(row.victimCorporationId, labels),
      system: system?.name
        ?? (row.solarSystemId === null ? DASH : `Unknown system (${row.solarSystemId})`),
      secClass: system === undefined ? "sec-null" : secClass(security),
      secText: system === undefined ? DASH : secText(security),
      value: row.value === null ? DASH : iskShort(row.value),
      attackers: grouped(row.attackerCount),
      ourShip: typeOf(row.ourShipTypeId, labels),
    };
  });
}

export interface StatTile { key: string; label: string; value: string }

/** Spec §6's six tiles, in the order they are shown. */
export function statTiles(stats: CombatStats): StatTile[] {
  return [
    { key: "kills", label: "Kills", value: grouped(stats.kills) },
    { key: "losses", label: "Losses", value: grouped(stats.losses) },
    { key: "efficiency", label: "Efficiency",
      value: stats.efficiency === null ? DASH : `${(stats.efficiency * 100).toFixed(1)}%` },
    { key: "destroyed", label: "ISK destroyed", value: iskShort(stats.iskDestroyed) },
    { key: "lost", label: "ISK lost", value: iskShort(stats.iskLost) },
    { key: "solo", label: "Solo kills", value: grouped(stats.soloKills) },
  ];
}

export interface MonthBarView {
  month: string; label: string; kills: number; losses: number;
  killPct: number; lossPct: number; title: string;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The twelve-column strip (spec §6): kills up, losses down, both scaled against the busiest single
 * count anywhere in the year so the tallest bar is always 100%. No chart library — the page turns
 * these percentages into CSS heights.
 */
export function monthBars(stats: CombatStats): MonthBarView[] {
  const peak = Math.max(0, ...stats.months.map((m) => Math.max(m.kills, m.losses)));
  const pct = (n: number): number => (peak === 0 ? 0 : Math.round((n / peak) * 100));
  return stats.months.map((m) => ({
    month: m.month,
    label: MONTH_ABBR[Number(m.month.slice(5, 7)) - 1],
    kills: m.kills, losses: m.losses,
    killPct: pct(m.kills), lossPct: pct(m.losses),
    title: `${m.month}: ${plural(m.kills, "kill", "kills")}, ${plural(m.losses, "loss", "losses")}`,
  }));
}

export interface TopListView { key: string; title: string; rows: { label: string; count: string }[] }

function list(
  key: string, title: string, entries: TopEntry[], label: (id: number) => string,
): TopListView {
  return { key, title, rows: entries.map((e) => ({ label: label(e.id), count: grouped(e.count) })) };
}

export function topLists(stats: CombatStats, labels: Labels): TopListView[] {
  return [
    list("flown", "Ships flown", stats.shipsFlown, (id) => typeOf(id, labels)),
    list("lost", "Ships lost", stats.shipsLost, (id) => typeOf(id, labels)),
    list("systems", "Systems", stats.systems,
      (id) => labels.systems.get(id)?.name ?? `Unknown system (${id})`),
  ];
}

/**
 * Spec §6's status line. `imported` is a count of linked killmails, not a stored counter
 * (Decision 8), and the per-kind cursors are summarised so the reader can see progress.
 */
export function backfillLine(status: BackfillStatus[]): string | null {
  const cursors = status.flatMap((s) => s.cursors);
  if (cursors.length === 0) return null;
  const imported = grouped(status.reduce((n, s) => n + s.imported, 0));
  if (cursors.every((c) => c.done)) {
    return `Backfill from zKillboard: complete — ${imported} killmails imported`;
  }
  const byKind = ["kills", "losses"].map((kind) => {
    const rows = cursors.filter((c) => c.kind === kind);
    if (rows.length === 0) return null;
    if (rows.every((c) => c.done)) return `${kind} done`;
    return `${kind} page ${Math.min(...rows.filter((c) => !c.done).map((c) => c.nextPage))}`;
  }).filter((s): s is string => s !== null);
  return `Backfill from zKillboard: ${imported} killmails imported (${byKind.join(", ")})`;
}
```

- [ ] **Step 4: Run the view test to verify it passes**

Run: `npx vitest run tests/view/combat.test.ts`
Expected: PASS. The bar percentages derive from the busiest single count in the strip: September's
2 kills is the peak, so 2 / 2 = **100%** and August's 1 loss is 1 / 2 = **50%**.

- [ ] **Step 5: Write the failing loader test**

Create `tests/db/combat-load.test.ts`:
```ts
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
const A = 90000101;
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
     VALUES ($1, 'character', 'Mara Vexley'), (98000001, 'corporation', 'Trill Industries')`, [A]);
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
    expect(view.total).toBe(3);
    expect(view.hasMore).toBe(false);
    expect(view.rows.map((r) => r.killmailId)).toEqual([202, 201, 200]);
    expect(view.rows[0]).toMatchObject({
      victim: "Mara Vexley", victimCorp: "Trill Industries", victimShip: "Caracal",
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
    expect(view.total).toBe(0);
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
```

- [ ] **Step 6: Write `src/lib/combat/load.ts`**

```ts
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
```

- [ ] **Step 7: Run the loader test to verify it passes**

Run: `npx vitest run tests/db/combat-load.test.ts`
Expected: PASS. `iskShort(8,125,000)` = `(8.125).toFixed(1)` = **"8.1M ISK"**; the efficiency tile is
0 / (0 + 3 × 8,125,000) = **"0.0%"**.

- [ ] **Step 8: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/lib/view/combat.ts src/lib/combat/load.ts tests/view/combat.test.ts tests/db/combat-load.test.ts
git commit -m "$(cat <<'EOM'
feat(combat): the /combat view models and their loader

Pure builders for the six stat tiles, the twelve-column CSS bar strip, the three
top lists, the killmail table rows and the backfill status line, plus a
server-only loader that fills them from Postgres in three batched lookups.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 10: `GET /api/characters/[id]/killmails` and the `KillmailTable` island

Spec §6's "more" behaviour. The route hands back exactly the view models the page already rendered,
so an appended row can never disagree with the ones above it, and it carries `period` and `all` so
paging respects the tabs (Decision 10). The table itself is the page's only client island.

**Files:**
- Create: `src/app/api/characters/[id]/killmails/route.ts`, `src/app/combat/KillmailTable.tsx`,
  `tests/api/killmails-route.test.ts`, `tests/components/killmail-table.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes (verbatim from the working tree, plus Tasks 7 and 9):
```ts
// src/lib/api/json.ts
export function parseId(raw: string): number | null;
// src/lib/db/characters.ts
export async function getCharacter(id: number): Promise<Character | null>;
export async function listCharacters(): Promise<Character[]>;
// src/lib/combat/stats.ts
export function parsePeriod(raw: string | null | undefined): CombatPeriod;
// src/lib/combat/load.ts
export async function loadKillmailRows(
  characterIds: number[], period: CombatPeriod, offset: number, now?: Date,
): Promise<{ rows: KillmailRowView[]; hasMore: boolean }>;
```
- Produces:
```ts
// src/app/api/characters/[id]/killmails/route.ts
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
// body: { rows: KillmailRowView[]; hasMore: boolean }

// src/app/combat/KillmailTable.tsx
export function KillmailTable(props: {
  characterId: number; period: string; all: boolean;
  initial: KillmailRowView[]; initialHasMore: boolean;
}): JSX.Element;
```

- [ ] **Step 1: Write the failing route test**

Create `tests/api/killmails-route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getCharacter, listCharacters, loadKillmailRows } = vi.hoisted(() => ({
  getCharacter: vi.fn(), listCharacters: vi.fn(), loadKillmailRows: vi.fn(),
}));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter, listCharacters }));
vi.mock("../../src/lib/combat/load.js", () => ({ loadKillmailRows }));

const { GET } = await import("../../src/app/api/characters/[id]/killmails/route.js");

const CID = 90000101;
const OTHER = 2112625428;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (query: string) =>
  new NextRequest(`https://eve.example.com/api/characters/${CID}/killmails${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "A" } : null));
  listCharacters.mockResolvedValue([{ id: CID }, { id: OTHER }]);
  loadKillmailRows.mockResolvedValue({ rows: [{ killmailId: 1 }], hasMore: true });
});

describe("GET /api/characters/[id]/killmails", () => {
  it("returns the next page for one character", async () => {
    const res = await GET(request("?offset=50"), ctx(String(CID)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rows: [{ killmailId: 1 }], hasMore: true });
    expect(loadKillmailRows).toHaveBeenCalledWith([CID], "90d", 50);
  });

  it("defaults the offset to zero and the period to 90d", async () => {
    await GET(request(""), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenCalledWith([CID], "90d", 0);
  });

  it("passes the period through and falls back for a bogus one", async () => {
    await GET(request("?period=1y"), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenCalledWith([CID], "1y", 0);
    await GET(request("?period=forever"), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenLastCalledWith([CID], "90d", 0);
  });

  it("uses every character when all=1", async () => {
    await GET(request("?all=1"), ctx(String(CID)));
    expect(loadKillmailRows).toHaveBeenCalledWith([CID, OTHER], "90d", 0);
  });

  it("rejects a bad id and a bad offset", async () => {
    expect((await GET(request(""), ctx("nope"))).status).toBe(400);
    expect((await GET(request("?offset=-1"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?offset=abc"), ctx(String(CID)))).status).toBe(400);
    expect(loadKillmailRows).not.toHaveBeenCalled();
  });

  it("404s for a character that does not exist", async () => {
    expect((await GET(request(""), ctx("12345"))).status).toBe(404);
    expect(loadKillmailRows).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/api/killmails-route.test.ts`
Expected: FAIL — "Failed to resolve import ... killmails/route.js".

- [ ] **Step 3: Write the route**

Create `src/app/api/characters/[id]/killmails/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCharacter, listCharacters } from "../../../../../lib/db/characters.js";
import { parseId } from "../../../../../lib/api/json.js";
import { parsePeriod } from "../../../../../lib/combat/stats.js";
import { loadKillmailRows } from "../../../../../lib/combat/load.js";

type Ctx = { params: Promise<{ id: string }> };

/** Absent offset means the first page; anything that is not a non-negative integer is a 400. */
function parseOffset(raw: string | null): number | null {
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  if (id === null || offset === null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(id)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const period = parsePeriod(req.nextUrl.searchParams.get("period"));
  // The All-characters toggle travels with the request so an appended page matches the tab.
  const all = req.nextUrl.searchParams.get("all") === "1";
  const characterIds = all ? (await listCharacters()).map((c) => c.id) : [id];
  // Same builders the page uses, so the rows the client appends match the ones already on screen.
  return NextResponse.json(await loadKillmailRows(characterIds, period, offset));
}
```

- [ ] **Step 4: Write the failing component test**

Create `tests/components/killmail-table.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KillmailTable } from "../../src/app/combat/KillmailTable.js";
import type { KillmailRowView } from "../../src/lib/view/combat.js";

const CID = 90000101;

function row(id: number, over: Partial<KillmailRowView> = {}): KillmailRowView {
  return {
    killmailId: id, href: `/combat/${id}`, time: "2026-09-01 12:00",
    role: "loss", roleLabel: "Loss", victimShipTypeId: 621, victimShip: "Caracal",
    victim: "Mara Vexley", victimCorp: "Trill Industries",
    system: "Jita", secClass: "sec-high", secText: "0.9",
    value: "8.1M ISK", attackers: "3", ourShip: "Caracal", ...over,
  };
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { vi.restoreAllMocks(); });

describe("KillmailTable", () => {
  it("renders a row with its badge, value and link", () => {
    render(<KillmailTable characterId={CID} period="90d" all={false}
             initial={[row(1)]} initialHasMore={false} />);
    expect(screen.getByRole("link", { name: /Caracal/ })).toHaveAttribute("href", "/combat/1");
    expect(screen.getByText("Loss")).toHaveClass("badge", "loss");
    expect(screen.getByText("8.1M ISK")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toHaveClass("sec-high");
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("says so when there is nothing to show", () => {
    render(<KillmailTable characterId={CID} period="90d" all={false} initial={[]} initialHasMore={false} />);
    expect(screen.getByText(/no killmails/i)).toBeInTheDocument();
  });

  it("appends the next page, carrying the period and the all flag", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ rows: [row(2, { roleLabel: "Kill", role: "kill" })], hasMore: false }),
      { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<KillmailTable characterId={CID} period="1y" all
             initial={[row(1)]} initialHasMore />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText("Kill")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/characters/${CID}/killmails?offset=1&period=1y&all=1`);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("shows the error and keeps the button when the request fails", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<KillmailTable characterId={CID} period="90d" all={false}
             initial={[row(1)]} initialHasMore />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText(/could not load more \(500\)/)).toHaveClass("neg"));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Write `src/app/combat/KillmailTable.tsx`**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import type { KillmailRowView } from "../../lib/view/combat.js";

interface Props {
  characterId: number; period: string; all: boolean;
  initial: KillmailRowView[]; initialHasMore: boolean;
}

/**
 * The killmail table and its "Show more", mirroring phase-3b's WalletTables. The rows arrive
 * already formatted from `src/lib/view/combat.ts`, and the route hands back the same shapes, so an
 * appended page cannot disagree with what is already on screen.
 */
export function KillmailTable({ characterId, period, all, initial, initialHasMore }: Props) {
  const [rows, setRows] = useState<KillmailRowView[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const query = `offset=${rows.length}&period=${period}&all=${all ? "1" : "0"}`;
      const res = await fetch(`/api/characters/${characterId}/killmails?${query}`);
      if (!res.ok) throw new Error(`could not load more (${res.status})`);
      const body = (await res.json()) as { rows: KillmailRowView[]; hasMore: boolean };
      setRows([...rows, ...body.rows]);
      setHasMore(body.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return <p className="faint">No killmails in this period — the killmails job runs hourly and the
      zKillboard backfill every 15 minutes.</p>;
  }

  return (<>
    <table className="table killmail-table">
      <thead>
        <tr>
          <th>Time</th><th></th><th>Ship</th><th>Victim</th><th>System</th>
          <th className="num">Value</th><th className="num">Attackers</th><th>Our ship</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.killmailId}>
            <td className="muted">{row.time}</td>
            <td><span className={`badge ${row.role}`}>{row.roleLabel}</span></td>
            <td>
              <Link className="km-ship" href={row.href}>
                {row.victimShipTypeId === null ? null : (
                  <img className="module-icon" alt=""
                       src={`https://images.evetech.net/types/${row.victimShipTypeId}/icon?size=32`} />
                )}
                {row.victimShip}
              </Link>
            </td>
            <td>{row.victim}<span className="faint km-corp">{row.victimCorp}</span></td>
            <td>{row.system} <span className={row.secClass}>{row.secText}</span></td>
            <td className="num">{row.value}</td>
            <td className="num muted">{row.attackers}</td>
            <td className="muted">{row.ourShip}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {hasMore ? (
      <button type="button" className="show-more" disabled={busy} onClick={more}>
        {busy ? "Loading…" : "Show more"}
      </button>
    ) : null}
    {error === null ? null : <p className="neg">{error}</p>}
  </>);
}
```

- [ ] **Step 6: Add the table's CSS**

Append to `src/app/globals.css`, in a new phase-7 block:
```css
/* ---------- Combat (phase 7) ---------- */
.badge.kill { background: rgba(52,211,153,.14); color: var(--pos); }
.badge.loss { background: rgba(247,109,122,.14); color: var(--neg); }
.km-ship { display: inline-flex; align-items: center; gap: 8px; color: var(--text); text-decoration: none; }
.km-ship:hover { color: var(--accent-2); }
.km-corp { display: block; font-size: 11px; }
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npx vitest run tests/api/killmails-route.test.ts tests/components/killmail-table.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
git add src/app/api/characters src/app/combat src/app/globals.css tests/api/killmails-route.test.ts tests/components/killmail-table.test.tsx
git commit -m "$(cat <<'EOM'
feat(combat): the killmails paging route and the table island

GET /api/characters/[id]/killmails?offset=&period=&all= returns the same view
models the page rendered; KillmailTable appends them behind a Show more button
and carries the period and the All-characters flag with every request.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 11: The `/combat` page

Spec §6's list page, replacing the ComingSoon card. A server component: the period tabs and the
All-characters toggle are `Link`s carrying query parameters (Decision 10), so the only client code
on the page is the table from Task 10.

**Files:**
- Rewrite: `src/app/combat/page.tsx`
- Modify: `src/app/globals.css`
- Create: `src/app/combat/CombatFilters.tsx`

**Interfaces:**
- Consumes (verbatim from the working tree, plus Tasks 7, 9, 10):
```ts
// src/lib/auth/session.ts
export async function readSession(): Promise<SessionPayload | null>;   // { activeCharacterId, iat }
// src/lib/view/characters.ts
export function pickActive<T extends { id: number }>(characters: T[], activeId: number | null): T | null;
// src/app/components/NoCharacter.tsx
export function NoCharacter({ title }: { title: string }): JSX.Element;
// src/lib/combat/stats.ts
export const COMBAT_PERIODS: readonly CombatPeriod[];
export const PERIOD_LABELS: Record<CombatPeriod, string>;
export function parsePeriod(raw: string | null | undefined): CombatPeriod;
// src/lib/combat/load.ts
export async function loadCombatPage(characterIds, period, now?): Promise<CombatPageView>;
// src/app/combat/KillmailTable.tsx
export function KillmailTable(props: { characterId; period; all; initial; initialHasMore }): JSX.Element;
```
- Produces:
```ts
// src/app/combat/CombatFilters.tsx  (a server component — plain links, no state)
export function CombatFilters(props: { period: string; all: boolean }): JSX.Element;
// src/app/combat/page.tsx
export default async function CombatPage(
  { searchParams }: { searchParams: Promise<{ period?: string; all?: string }> },
): Promise<JSX.Element>;
```

- [ ] **Step 1: Write `src/app/combat/CombatFilters.tsx`**

```tsx
import Link from "next/link";
import { COMBAT_PERIODS, PERIOD_LABELS } from "../../lib/combat/stats.js";

/**
 * The period tabs and the All-characters toggle. Plain links carrying query parameters, so the page
 * stays a server component and a reload lands on exactly the view that was shared (Decision 10).
 */
export function CombatFilters({ period, all }: { period: string; all: boolean }) {
  const href = (p: string, a: boolean): string => `/combat?period=${p}${a ? "&all=1" : ""}`;
  return (
    <div className="combat-filters">
      <div className="combat-tabs" role="group" aria-label="Period">
        {COMBAT_PERIODS.map((p) => (
          <Link key={p} className="combat-tab" href={href(p, all)}
                data-active={p === period || undefined}
                aria-current={p === period ? "page" : undefined}>
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </div>
      <Link className="combat-tab" href={href(period, !all)} data-active={all || undefined}>
        All characters
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/combat/page.tsx`**

```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadCombatPage } from "../../lib/combat/load.js";
import { parsePeriod } from "../../lib/combat/stats.js";
import { pickActive } from "../../lib/view/characters.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { CombatFilters } from "./CombatFilters.js";
import { KillmailTable } from "./KillmailTable.js";

export default async function CombatPage(
  { searchParams }: { searchParams: Promise<{ period?: string; all?: string }> },
) {
  const [session, characters, query] = await Promise.all([readSession(), listCharacters(), searchParams]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Combat" />;

  const period = parsePeriod(query.period);
  const all = query.all === "1";
  const characterIds = all ? characters.map((c) => c.id) : [character.id];
  const view = await loadCombatPage(characterIds, period);

  return (<>
    <h1 className="page-title">Combat</h1>
    <p className="page-sub">{all ? `${characters.length} characters` : character.name}</p>
    <CombatFilters period={period} all={all} />

    <div className="card-grid stat-tiles">
      {view.tiles.map((tile) => (
        <div className="card" key={tile.key}>
          <span className="stat-label">{tile.label}</span>
          <span className="stat-value">{tile.value}</span>
        </div>
      ))}
    </div>

    <div className="card-stack">
      <div className="card">
        <h2 className="card-title">Monthly activity</h2>
        <div className="month-strip">
          {view.months.map((m) => (
            <div className="month-col" key={m.month} title={m.title}>
              <div className="month-half up">
                <div className="month-bar kill" style={{ height: `${m.killPct}%` }} />
              </div>
              <div className="month-half down">
                <div className="month-bar loss" style={{ height: `${m.lossPct}%` }} />
              </div>
              <span className="month-label">{m.label}</span>
            </div>
          ))}
        </div>
        <p className="faint month-legend">Kills above the line, losses below.</p>
      </div>

      <div className="card-grid top-lists">
        {view.topLists.map((list) => (
          <div className="card" key={list.key}>
            <h2 className="card-title">{list.title}</h2>
            {list.rows.length === 0
              ? <p className="faint">Nothing yet.</p>
              : (
                <ul className="top-list">
                  {list.rows.map((row) => (
                    <li key={row.label}><span>{row.label}</span><span className="num muted">{row.count}</span></li>
                  ))}
                </ul>
              )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="card-title">Killmails</h2>
        {view.backfill === null ? null : <p className="faint">{view.backfill}</p>}
        <KillmailTable characterId={character.id} period={period} all={all}
                       initial={view.rows} initialHasMore={view.hasMore} />
      </div>
    </div>
  </>);
}
```

- [ ] **Step 3: Add the page's CSS**

Append to the phase-7 block in `src/app/globals.css`:
```css
.combat-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 20px; }
.combat-tabs { display: inline-flex; gap: 4px; }
.combat-tab {
  padding: 6px 14px; border-radius: 99px; border: 1px solid var(--border);
  background: var(--card); color: var(--muted); font-size: 13px; text-decoration: none;
}
.combat-tab:hover { border-color: var(--border-hi); color: var(--text); }
.combat-tab[data-active] { background: var(--raised); border-color: var(--accent); color: var(--text); }
.card-grid.stat-tiles { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); margin-bottom: 20px; }
.card-grid.top-lists { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.month-strip { display: flex; gap: 6px; align-items: stretch; height: 160px; }
.month-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.month-half { flex: 1; width: 100%; display: flex; }
.month-half.up { align-items: flex-end; }
.month-half.down { align-items: flex-start; }
.month-bar { width: 100%; border-radius: 3px; min-height: 1px; }
.month-bar.kill { background: var(--pos); }
.month-bar.loss { background: var(--neg); }
.month-label { font-size: 11px; color: var(--faint); }
.month-legend { margin: 10px 0 0; font-size: 12px; }
.top-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 13px; }
.top-list li { display: flex; justify-content: space-between; gap: 12px; }
```

- [ ] **Step 4: Prove the page builds and nothing regressed**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run typecheck
npm run build
npm test
```
Expected: `tsc --noEmit` clean; `next build` succeeds — a failure naming `pg`, `node:fs` or `dns`
means `KillmailTable.tsx` (a `"use client"` file) imported `src/lib/combat/load.js` or a `db`
module instead of only the pure `src/lib/view/combat.js` types; the whole suite passes.

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
git add src/app/combat src/app/globals.css
git commit -m "$(cat <<'EOM'
feat(combat): the /combat page

Replaces the ComingSoon card with the stats tiles, the twelve-month CSS bar
strip, the three top lists and the killmail table. Period tabs and the
All-characters toggle are links carrying query parameters, so the page stays a
server component and a shared URL reproduces the view.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 12: The killmail detail page

Spec §6's `/combat/[killmailId]`: header, victim card, the fit panel grouped by the numeric flag
from Task 1, and the attackers table sorted by damage. The "Open in fitting designer" button is
Task 13 — this task renders everything else.

`src/lib/view/killmail.ts` defines its two image-URL helpers locally rather than importing
`src/lib/view/fit-sheet.ts` or `src/lib/fits/editor-view.ts`, both of which drag the whole dogma
engine in for a one-line string; the module stays pure and cheap.

**Files:**
- Create: `src/lib/view/killmail.ts`, `src/app/combat/[killmailId]/page.tsx`,
  `tests/view/killmail.test.ts`
- Modify: `src/lib/combat/load.ts`, `src/app/globals.css`

**Interfaces:**
- Consumes (Tasks 1, 8, 9, and verbatim from the working tree):
```ts
// Task 1
export type KillmailSlot = "high" | "mid" | "low" | "rig" | "subsystem" | "drone" | "cargo" | "implant" | "fighter" | "other";
export const KILLMAIL_SLOT_ORDER: readonly KillmailSlot[];
export const SLOT_TITLES: Record<KillmailSlot, string>;
export function slotOfFlag(flag: number): KillmailSlot;
// Task 8
export interface KillmailFull { head: KillmailHeadRow; attackers: KillmailAttackerRow[];
  items: KillmailItemRow[]; roles: { characterId: number; role: KillRole }[] }
export async function getKillmail(killmailId: number): Promise<KillmailFull | null>;
// Task 9
export interface Labels { names: ReadonlyMap<number, string>; types: ReadonlyMap<number, string>;
  systems: ReadonlyMap<number, { name: string; security: number | null }> }
export function nameOf(id: number | null, labels: Labels): string;
export function typeOf(id: number | null, labels: Labels): string;
// src/lib/view/format.ts
export function grouped(value: string | number): string;
export function isk(value: number): string;
export function stamp(date: Date | null): string;
export function secClass(status: number | null): SecClass;
export function secText(status: number | null): string;
// src/lib/view/price.ts
export function priceOf(p: Price | undefined): number | null;
export function iskShort(value: number): string;
// src/lib/view/characters.ts
export function portraitUrl(id: number, size?: 64 | 128 | 256): string;
// src/lib/db/market-prices.ts
export async function getPrices(typeIds: number[]): Promise<Map<number, Price>>;
```
- Produces:
```ts
// src/lib/view/killmail.ts
export const ZKILLBOARD_KILL_URL: string;   // "https://zkillboard.com/kill/"
export interface KillmailHeaderView {
  killmailId: number; time: string; system: string; secClass: string; secText: string;
  value: string; roleLabel: string | null; zkbHref: string; points: string | null;
  flags: string[];
}
export interface VictimView {
  name: string; corp: string; alliance: string | null; portrait: string | null;
  shipTypeId: number | null; shipName: string; shipRender: string | null; damageTaken: string;
}
export interface FitItemView {
  idx: number; typeId: number; icon: string; name: string;
  destroyed: string | null; dropped: string | null; value: string; inContainer: string | null;
}
export interface FitSlotView { slot: KillmailSlot; title: string; rows: FitItemView[] }
export interface AttackerView {
  idx: number; name: string; corp: string; alliance: string | null;
  ship: string; shipTypeId: number | null; weapon: string;
  damage: string; share: string; finalBlow: boolean; security: string;
}
export interface KillmailView {
  header: KillmailHeaderView; victim: VictimView;
  slots: FitSlotView[]; attackers: AttackerView[]; fittedTypeIds: number[];
}
export function killmailView(
  full: KillmailFull, labels: Labels, prices: ReadonlyMap<number, Price>, viewerIds: number[],
): KillmailView;

// src/lib/combat/load.ts (added)
export async function loadKillmailDetail(
  killmailId: number, viewerIds: number[],
): Promise<KillmailView | null>;
```

- [ ] **Step 1: Write the failing test**

Create `tests/view/killmail.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { killmailView, ZKILLBOARD_KILL_URL } from "../../src/lib/view/killmail.js";
import type { Labels } from "../../src/lib/view/combat.js";
import type { KillmailFull } from "../../src/lib/db/killmails.js";
import type { Price } from "../../src/lib/view/price.js";

const A = 90000101;
const price = (sell: number | null): Price => ({ sell, buy: null, adjusted: null });

const labels: Labels = {
  names: new Map([
    [A, "Mara Vexley"], [98000001, "Trill Industries"], [99000001, "Trill Alliance"],
    [2112625428, "Bad Guy"], [98000002, "Bad Corp"],
  ]),
  types: new Map([
    [621, "Caracal"], [587, "Rifter"], [3634, "Heavy Missile Launcher II"],
    [11488, "Small Secure Container"], [34, "Tritanium"], [2456, "Warrior II"],
    [2929, "150mm Light AutoCannon II"],
  ]),
  systems: new Map([[30000142, { name: "Jita", security: 0.946 }]]),
};

const prices = new Map<number, Price>([
  [3634, price(2_000_000)], [34, price(5)], [2456, price(500_000)],
]);

const full: KillmailFull = {
  head: {
    killmailId: 120000001, killmailHash: "h", killmailTime: new Date("2026-09-01T12:00:00Z"),
    solarSystemId: 30000142, moonId: null, warId: null,
    victimCharacterId: A, victimCorporationId: 98000001, victimAllianceId: 99000001,
    victimFactionId: null, victimShipTypeId: 621, damageTaken: 4210, attackerCount: 2,
    zkbTotalValue: 60_633_419.79, zkbPoints: 7, zkbNpc: false, zkbSolo: false, zkbAwox: false,
    computedValue: 8_125_000, source: "zkb",
  },
  attackers: [
    { idx: 0, characterId: 2112625428, corporationId: 98000002, allianceId: null, factionId: null,
      shipTypeId: 587, weaponTypeId: 2929, damageDone: 1200, finalBlow: false, securityStatus: -1.4 },
    { idx: 1, characterId: null, corporationId: null, allianceId: null, factionId: 500003,
      shipTypeId: null, weaponTypeId: null, damageDone: 3010, finalBlow: true, securityStatus: 0 },
  ],
  items: [
    { idx: 0, parentIdx: null, itemTypeId: 3634, flag: 27, singleton: 0,
      quantityDestroyed: 1, quantityDropped: 0 },
    { idx: 1, parentIdx: null, itemTypeId: 11488, flag: 5, singleton: 0,
      quantityDestroyed: 1, quantityDropped: 0 },
    { idx: 2, parentIdx: 1, itemTypeId: 34, flag: 0, singleton: 0,
      quantityDestroyed: 5000, quantityDropped: 0 },
    { idx: 3, parentIdx: null, itemTypeId: 2456, flag: 87, singleton: 0,
      quantityDestroyed: 3, quantityDropped: 2 },
  ],
  roles: [{ characterId: A, role: "loss" }],
};

describe("killmailView", () => {
  const view = killmailView(full, labels, prices, [A]);

  it("builds the header, preferring the zKillboard value", () => {
    expect(view.header).toEqual({
      killmailId: 120000001, time: "2026-09-01 12:00",
      system: "Jita", secClass: "sec-high", secText: "0.9",
      // iskShort(60,633,419.79) = (60.633…).toFixed(1) = "60.6M ISK"
      value: "60.6M ISK", roleLabel: "Loss",
      zkbHref: `${ZKILLBOARD_KILL_URL}120000001/`, points: "7", flags: [],
    });
  });

  it("has no role label when none of our characters were on it, and lists the zkb flags", () => {
    const solo = killmailView(
      { ...full, head: { ...full.head, zkbSolo: true, zkbNpc: true }, roles: [] }, labels, prices, [A]);
    expect(solo.header.roleLabel).toBeNull();
    expect(solo.header.flags).toEqual(["Solo", "NPC"]);
  });

  it("falls back to the computed value when zKillboard has none", () => {
    const computed = killmailView(
      { ...full, head: { ...full.head, zkbTotalValue: null } }, labels, prices, [A]);
    expect(computed.header.value).toBe("8.1M ISK");
  });

  it("builds the victim card", () => {
    expect(view.victim).toEqual({
      name: "Mara Vexley", corp: "Trill Industries", alliance: "Trill Alliance",
      portrait: "https://images.evetech.net/characters/90000101/portrait?size=128",
      shipTypeId: 621, shipName: "Caracal",
      shipRender: "https://images.evetech.net/types/621/render?size=128",
      damageTaken: "4,210",
    });
  });

  it("groups the items by slot in display order and values each row", () => {
    expect(view.slots.map((s) => s.slot)).toEqual(["high", "drone", "cargo"]);
    expect(view.slots[0]).toEqual({
      slot: "high", title: "High",
      rows: [{
        idx: 0, typeId: 3634, icon: "https://images.evetech.net/types/3634/icon?size=32",
        name: "Heavy Missile Launcher II", destroyed: "1", dropped: null,
        // 1 x 2,000,000 = 2,000,000.00 ISK
        value: "2,000,000.00 ISK", inContainer: null,
      }],
    });
    // 3 destroyed + 2 dropped = 5 Warrior II at 500,000 = 2,500,000.00 ISK
    expect(view.slots[1].rows[0]).toMatchObject({
      name: "Warrior II", destroyed: "3", dropped: "2", value: "2,500,000.00 ISK",
    });
    // The container's contents stay in the container's slot, tagged with its name.
    expect(view.slots[2].rows.map((r) => r.name)).toEqual(["Small Secure Container", "Tritanium"]);
    expect(view.slots[2].rows[1].inContainer).toBe("Small Secure Container");
    // 5000 x 5 = 25,000.00 ISK
    expect(view.slots[2].rows[1].value).toBe("25,000.00 ISK");
  });

  it("shows a dash for an item with no price", () => {
    const noPrice = killmailView(full, labels, new Map(), [A]);
    expect(noPrice.slots[0].rows[0].value).toBe("—");
  });

  it("lists only the fitted type ids, so the designer never tries to fit a cargo hold", () => {
    expect(view.fittedTypeIds).toEqual([3634, 2456]);
  });

  it("sorts attackers by damage, marks the final blow and shows each one's share", () => {
    expect(view.attackers.map((a) => a.idx)).toEqual([1, 0]);
    expect(view.attackers[0]).toEqual({
      idx: 1, name: "—", corp: "—", alliance: null, ship: "—", shipTypeId: null, weapon: "—",
      // 3010 / 4210 = 0.71496… -> "71.5%"
      damage: "3,010", share: "71.5%", finalBlow: true, security: "0.0",
    });
    expect(view.attackers[1]).toMatchObject({
      name: "Bad Guy", corp: "Bad Corp", ship: "Rifter",
      weapon: "150mm Light AutoCannon II",
      // 1200 / 4210 = 0.28503… -> "28.5%"
      damage: "1,200", share: "28.5%", finalBlow: false, security: "-1.4",
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/view/killmail.test.ts`
Expected: FAIL — "Failed to resolve import ... src/lib/view/killmail.js".

- [ ] **Step 3: Write `src/lib/view/killmail.ts`**

```ts
import {
  KILLMAIL_SLOT_ORDER, SLOT_TITLES, slotOfFlag, type KillmailSlot,
} from "../combat/flags.js";
import type { KillmailFull } from "../db/killmails.js";
import { portraitUrl } from "./characters.js";
import { nameOf, typeOf, type Labels } from "./combat.js";
import { grouped, isk, secClass, secText, stamp } from "./format.js";
import { iskShort, priceOf, type Price } from "./price.js";

const DASH = "—";
export const ZKILLBOARD_KILL_URL = "https://zkillboard.com/kill/";

/**
 * These two are copied rather than imported from `src/lib/view/fit-sheet.ts` /
 * `src/lib/fits/editor-view.ts`: both of those modules pull the whole dogma engine in for a
 * one-line string, and this module has no other reason to depend on it.
 */
const iconUrl = (typeId: number): string =>
  `https://images.evetech.net/types/${typeId}/icon?size=32`;
const renderUrl = (typeId: number): string =>
  `https://images.evetech.net/types/${typeId}/render?size=128`;

export interface KillmailHeaderView {
  killmailId: number; time: string; system: string; secClass: string; secText: string;
  value: string; roleLabel: string | null; zkbHref: string; points: string | null;
  flags: string[];
}
export interface VictimView {
  name: string; corp: string; alliance: string | null; portrait: string | null;
  shipTypeId: number | null; shipName: string; shipRender: string | null; damageTaken: string;
}
export interface FitItemView {
  idx: number; typeId: number; icon: string; name: string;
  destroyed: string | null; dropped: string | null; value: string; inContainer: string | null;
}
export interface FitSlotView { slot: KillmailSlot; title: string; rows: FitItemView[] }
export interface AttackerView {
  idx: number; name: string; corp: string; alliance: string | null;
  ship: string; shipTypeId: number | null; weapon: string;
  damage: string; share: string; finalBlow: boolean; security: string;
}
export interface KillmailView {
  header: KillmailHeaderView; victim: VictimView;
  slots: FitSlotView[]; attackers: AttackerView[]; fittedTypeIds: number[];
}

/** Spec §4's ruling: the displayed value is zKillboard's, falling back to ours. */
function displayValue(head: KillmailFull["head"]): number | null {
  return head.zkbTotalValue ?? head.computedValue;
}

/** The slots a fit can actually hold — what "Open in fitting designer" is allowed to use. */
const FITTABLE: ReadonlySet<KillmailSlot> = new Set<KillmailSlot>([
  "high", "mid", "low", "rig", "subsystem", "drone",
]);

export function killmailView(
  full: KillmailFull, labels: Labels, prices: ReadonlyMap<number, Price>, viewerIds: number[],
): KillmailView {
  const head = full.head;
  const system = head.solarSystemId === null ? undefined : labels.systems.get(head.solarSystemId);
  const security = system?.security ?? null;
  const value = displayValue(head);

  // A killmail several of our characters were on is a loss if any of them died (Decision 11).
  const mine = full.roles.filter((r) => viewerIds.includes(r.characterId));
  const roleLabel = mine.length === 0 ? null : mine.some((r) => r.role === "loss") ? "Loss" : "Kill";

  const flags = [
    head.zkbSolo === true ? "Solo" : null,
    head.zkbNpc === true ? "NPC" : null,
    head.zkbAwox === true ? "Awox" : null,
  ].filter((f): f is string => f !== null);

  const byIdx = new Map(full.items.map((i) => [i.idx, i]));
  const bySlot = new Map<KillmailSlot, FitItemView[]>();
  const fittedTypeIds: number[] = [];
  for (const item of full.items) {
    // A container's contents belong to the container's slot, not to flag 0's "other".
    const parent = item.parentIdx === null ? null : byIdx.get(item.parentIdx) ?? null;
    const slot = slotOfFlag(parent === null ? item.flag : parent.flag);
    const unit = priceOf(prices.get(item.itemTypeId));
    const quantity = item.quantityDestroyed + item.quantityDropped;
    const rows = bySlot.get(slot) ?? [];
    rows.push({
      idx: item.idx, typeId: item.itemTypeId, icon: iconUrl(item.itemTypeId),
      name: typeOf(item.itemTypeId, labels),
      destroyed: item.quantityDestroyed > 0 ? grouped(item.quantityDestroyed) : null,
      dropped: item.quantityDropped > 0 ? grouped(item.quantityDropped) : null,
      value: unit === null ? DASH : isk(unit * quantity),
      inContainer: parent === null ? null : typeOf(parent.itemTypeId, labels),
    });
    bySlot.set(slot, rows);
    if (parent === null && FITTABLE.has(slot)) fittedTypeIds.push(item.itemTypeId);
  }
  const slots: FitSlotView[] = KILLMAIL_SLOT_ORDER
    .filter((slot) => bySlot.has(slot))
    .map((slot) => ({ slot, title: SLOT_TITLES[slot], rows: bySlot.get(slot)! }));

  const damageTaken = head.damageTaken ?? 0;
  const attackers: AttackerView[] = [...full.attackers]
    .sort((a, b) => (b.damageDone - a.damageDone) || (a.idx - b.idx))
    .map((a) => ({
      idx: a.idx,
      name: nameOf(a.characterId, labels),
      corp: nameOf(a.corporationId, labels),
      alliance: a.allianceId === null ? null : nameOf(a.allianceId, labels),
      ship: typeOf(a.shipTypeId, labels), shipTypeId: a.shipTypeId,
      weapon: typeOf(a.weaponTypeId, labels),
      damage: grouped(a.damageDone),
      share: damageTaken === 0 ? DASH : `${((a.damageDone / damageTaken) * 100).toFixed(1)}%`,
      finalBlow: a.finalBlow,
      security: a.securityStatus === null ? DASH : a.securityStatus.toFixed(1),
    }));

  return {
    header: {
      killmailId: head.killmailId, time: stamp(head.killmailTime),
      system: system?.name
        ?? (head.solarSystemId === null ? DASH : `Unknown system (${head.solarSystemId})`),
      secClass: system === undefined ? "sec-null" : secClass(security),
      secText: system === undefined ? DASH : secText(security),
      value: value === null ? DASH : iskShort(value),
      roleLabel,
      zkbHref: `${ZKILLBOARD_KILL_URL}${head.killmailId}/`,
      points: head.zkbPoints === null ? null : grouped(head.zkbPoints),
      flags,
    },
    victim: {
      name: nameOf(head.victimCharacterId, labels),
      corp: nameOf(head.victimCorporationId, labels),
      alliance: head.victimAllianceId === null ? null : nameOf(head.victimAllianceId, labels),
      portrait: head.victimCharacterId === null ? null : portraitUrl(head.victimCharacterId, 128),
      shipTypeId: head.victimShipTypeId,
      shipName: typeOf(head.victimShipTypeId, labels),
      shipRender: head.victimShipTypeId === null ? null : renderUrl(head.victimShipTypeId),
      damageTaken: grouped(damageTaken),
    },
    slots, attackers, fittedTypeIds,
  };
}
```

- [ ] **Step 4: Add `loadKillmailDetail` to `src/lib/combat/load.ts`**

Add the imports:
```ts
import { getKillmail } from "../db/killmails.js";
import { getPrices } from "../db/market-prices.js";
import { killmailView, type KillmailView } from "../view/killmail.js";
```
and the function:
```ts
/**
 * The detail page's data: one killmail, one batched name lookup, one type lookup, one system lookup
 * and one price query. Postgres only — an id no job has resolved shows as `ID <n>`.
 */
export async function loadKillmailDetail(
  killmailId: number, viewerIds: number[],
): Promise<KillmailView | null> {
  const full = await getKillmail(killmailId);
  if (full === null) return null;

  const nameIds = new Set<number>();
  const typeIds = new Set<number>();
  for (const id of [full.head.victimCharacterId, full.head.victimCorporationId, full.head.victimAllianceId]) {
    if (id !== null) nameIds.add(id);
  }
  for (const a of full.attackers) {
    for (const id of [a.characterId, a.corporationId, a.allianceId]) if (id !== null) nameIds.add(id);
    for (const id of [a.shipTypeId, a.weaponTypeId]) if (id !== null) typeIds.add(id);
  }
  if (full.head.victimShipTypeId !== null) typeIds.add(full.head.victimShipTypeId);
  for (const item of full.items) typeIds.add(item.itemTypeId);

  const [names, types, systems, prices] = await Promise.all([
    displayNames([...nameIds]),
    getTypes([...typeIds]),
    getSolarSystems(full.head.solarSystemId === null ? [] : [full.head.solarSystemId]),
    getPrices([...typeIds]),
  ]);
  const labels: Labels = {
    names,
    types: new Map([...types].flatMap(([id, t]) => (t.name === null ? [] : [[id, t.name] as const]))),
    systems: new Map([...systems].map(([id, s]) => [id, {
      name: s.name ?? `Unknown system (${id})`, security: s.securityStatus,
    }])),
  };
  return killmailView(full, labels, prices, viewerIds);
}
```

- [ ] **Step 5: Write `src/app/combat/[killmailId]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSession } from "../../../lib/auth/session.js";
import { listCharacters } from "../../../lib/db/characters.js";
import { parseId } from "../../../lib/api/json.js";
import { loadKillmailDetail } from "../../../lib/combat/load.js";
import { pickActive } from "../../../lib/view/characters.js";
import { NoCharacter } from "../../components/NoCharacter.js";

export default async function KillmailPage(
  { params }: { params: Promise<{ killmailId: string }> },
) {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Combat" />;

  const killmailId = parseId((await params).killmailId);
  if (killmailId === null) notFound();
  const view = await loadKillmailDetail(killmailId, characters.map((c) => c.id));
  if (view === null) notFound();

  return (<>
    <h1 className="page-title">{view.victim.shipName}</h1>
    <p className="page-sub">
      {view.header.time} · {view.header.system}{" "}
      <span className={view.header.secClass}>{view.header.secText}</span> · {view.header.value}
      {view.header.roleLabel === null ? null : (
        <> · <span className={`badge ${view.header.roleLabel.toLowerCase()}`}>{view.header.roleLabel}</span></>
      )}
    </p>

    <div className="card-stack">
      <div className="card km-head">
        <div className="km-head-meta">
          {view.header.points === null ? null : <span className="muted">{view.header.points} points</span>}
          {view.header.flags.map((flag) => <span className="badge running" key={flag}>{flag}</span>)}
        </div>
        <a className="fit-btn" href={view.header.zkbHref} target="_blank" rel="noreferrer">
          View on zKillboard
        </a>
      </div>

      <div className="card km-victim">
        {view.victim.portrait === null ? null
          : <img className="ov-portrait" src={view.victim.portrait} alt="" />}
        <div>
          <h2 className="card-title">{view.victim.name}</h2>
          <p className="muted">{view.victim.corp}{view.victim.alliance === null ? "" : ` · ${view.victim.alliance}`}</p>
          <p className="faint">{view.victim.shipName} · {view.victim.damageTaken} damage taken</p>
        </div>
        {view.victim.shipRender === null ? null
          : <img className="fit-render" src={view.victim.shipRender} alt="" />}
      </div>

      <div className="card">
        <h2 className="card-title">Fit</h2>
        {view.slots.length === 0 ? <p className="faint">This killmail carries no items.</p> : (
          view.slots.map((slot) => (
            <div className="km-slot" key={slot.slot}>
              <h3 className="slot-title">{slot.title}</h3>
              <table className="table">
                <thead>
                  <tr><th>Item</th><th className="num">Destroyed</th><th className="num">Dropped</th><th className="num">Value</th></tr>
                </thead>
                <tbody>
                  {slot.rows.map((row) => (
                    <tr key={row.idx}>
                      <td>
                        <span className="km-ship">
                          <img className="module-icon" src={row.icon} alt="" />
                          {row.name}
                        </span>
                        {row.inContainer === null ? null
                          : <span className="faint km-corp">in {row.inContainer}</span>}
                      </td>
                      <td className="num">{row.destroyed ?? "—"}</td>
                      <td className="num">{row.dropped ?? "—"}</td>
                      <td className="num muted">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Attackers</h2>
        <table className="table">
          <thead>
            <tr><th></th><th>Name</th><th>Corporation</th><th>Ship</th><th>Weapon</th>
              <th className="num">Damage</th><th className="num">Share</th><th className="num">Sec</th></tr>
          </thead>
          <tbody>
            {view.attackers.map((a) => (
              <tr key={a.idx}>
                <td>{a.finalBlow ? <span className="badge kill" title="Final blow">★</span> : null}</td>
                <td>{a.name}</td>
                <td className="muted">{a.corp}{a.alliance === null ? "" : ` · ${a.alliance}`}</td>
                <td>{a.ship}</td>
                <td className="muted">{a.weapon}</td>
                <td className="num">{a.damage}</td>
                <td className="num muted">{a.share}</td>
                <td className="num muted">{a.security}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p><Link className="fit-btn" href="/combat">Back to combat</Link></p>
    </div>
  </>);
}
```

- [ ] **Step 6: Add the detail page's CSS**

Append to the phase-7 block in `src/app/globals.css`:
```css
.km-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.km-head-meta { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.km-victim { display: flex; align-items: center; gap: 20px; }
.km-victim .fit-render { margin-left: auto; }
.km-slot + .km-slot { margin-top: 18px; }
```

- [ ] **Step 7: Run the tests and the build**

Run: `npx vitest run tests/view/killmail.test.ts && npm run typecheck && npm run build`
Expected: PASS and a clean build. Derivations for the pinned numbers:
`iskShort(60,633,419.79)` → 60,633,419.79 / 1e6 = 60.63341979 → `.toFixed(1)` = **"60.6M ISK"**;
attacker shares are 3010 / 4210 = 0.714964… → **"71.5%"** and 1200 / 4210 = 0.285035… → **"28.5%"**;
the Warrior II row is (3 destroyed + 2 dropped) × 500,000 = **2,500,000.00 ISK**; the Tritanium row
is 5000 × 5 = **25,000.00 ISK**.

- [ ] **Step 8: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
git add src/lib/view/killmail.ts src/lib/combat/load.ts src/app/combat src/app/globals.css tests/view/killmail.test.ts
git commit -m "$(cat <<'EOM'
feat(combat): the killmail detail page

/combat/[killmailId] shows the header (time, system, value, K/L, zKillboard
link), the victim card, the victim's fit grouped by the numeric invFlags band
with destroyed/dropped quantities and values, and the attackers sorted by damage
with their share and a final-blow star.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 13: `POST /api/fits/from-killmail` and "Open in fitting designer"

Spec §6's last piece: turn the victim's fit into a phase-5 local fit and open it in the designer.
The numeric flags carry the slot index, so a module lands in exactly the slot the victim had it in.
Two rows can share one flag (a launcher and the ammo loaded in it), so the builder loads the dogma
data over the killmail's types and uses `slotOfType` to tell the module from its charge
(Decision 14). Only fittable slots are used: modules and the drone bay — cargo, implants and
fighters are loot, not the fit.

**Files:**
- Create: `src/lib/combat/fit.ts`, `src/app/api/fits/from-killmail/route.ts`,
  `src/app/combat/OpenInDesigner.tsx`, `tests/api/from-killmail-route.test.ts`,
  `tests/components/open-in-designer.test.tsx`
- Modify: `src/app/combat/[killmailId]/page.tsx`

**Interfaces:**
- Consumes (verbatim from the working tree, plus Tasks 1, 8):
```ts
// src/lib/fits/clone.ts
export type CloneOutcome =
  | { kind: "ok"; fit: FitRow; unresolved: string[] }
  | { kind: "notFound" }
  | { kind: "failed" };
// src/lib/fits/parse.ts
export function clampFitName(raw: string): string;
// src/lib/fits/doc.ts
export interface FitItem { typeId: number; quantity: number; flag: string;
  chargeTypeId: number | null; state: FitItemState }
export type FitItemState = "offline" | "online" | "active" | "overload";
export const CARGO_FLAG: string;      // "Cargo"
// src/lib/dogma/index.ts (re-exported from build.ts / fit.ts / data.ts)
export const DRONE_BAY_FLAG: string;  // "DroneBay"
export function slotOfType(type: DogmaType): SlotKind | null;
export interface DogmaType { id: TypeId; groupId: GroupId; categoryId: number; name: string | null;
  attrs: Map<AttrId, number>; effects: Map<EffectId, boolean> }
export interface DogmaData { attributes: …; effects: …; groups: …; types: Map<TypeId, DogmaType> }
// src/lib/dogma/sde-loader.ts
export async function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>;
// src/lib/db/fits.ts
export interface FitInput { name: string; shipTypeId: number; description?: string;
  characterId?: number | null; items?: FitItem[] }
export async function createFit(input: FitInput): Promise<FitRow>;
// Task 1
export function fitFlagOfFlag(flag: number): string | null;
// Task 8
export async function getKillmail(killmailId: number): Promise<KillmailFull | null>;
```
- Produces:
```ts
// src/lib/combat/fit.ts
export function killmailFitItems(
  items: KillmailItemRow[], data: { types: ReadonlyMap<number, DogmaType> },
): FitItem[];
export async function fitFromKillmail(
  killmailId: number, characterId: number | null,
): Promise<CloneOutcome>;

// src/app/api/fits/from-killmail/route.ts
export async function POST(req: NextRequest): Promise<Response>;
// body in:  { killmailId: number; characterId?: number }
// body out: { fit: FitRow; unresolved: [] } with 201

// src/app/combat/OpenInDesigner.tsx
export function OpenInDesigner(props: { killmailId: number; characterId: number }): JSX.Element;
```

- [ ] **Step 1: Write the failing route test**

Create `tests/api/from-killmail-route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getCharacter, fitFromKillmail } = vi.hoisted(() => ({
  getCharacter: vi.fn(), fitFromKillmail: vi.fn(),
}));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/combat/fit.js", () => ({ fitFromKillmail }));

const { POST } = await import("../../src/app/api/fits/from-killmail/route.js");

const CID = 90000101;
const post = (body: unknown) => new NextRequest("https://eve.example.com/api/fits/from-killmail", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID } : null));
  fitFromKillmail.mockResolvedValue({ kind: "ok", fit: { id: 42, name: "Caracal" }, unresolved: [] });
});

describe("POST /api/fits/from-killmail", () => {
  it("creates the fit and answers 201", async () => {
    const res = await POST(post({ killmailId: 120000001, characterId: CID }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ fit: { id: 42, name: "Caracal" }, unresolved: [] });
    expect(fitFromKillmail).toHaveBeenCalledWith(120000001, CID);
  });

  it("accepts a body with no character and builds an All skills V fit", async () => {
    await POST(post({ killmailId: 120000001 }));
    expect(fitFromKillmail).toHaveBeenCalledWith(120000001, null);
  });

  it("400s on a malformed body", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ killmailId: "x" }))).status).toBe(400);
    expect((await POST(post({ killmailId: 0 }))).status).toBe(400);
    expect(fitFromKillmail).not.toHaveBeenCalled();
  });

  it("404s for a character we do not have and for a killmail we do not have", async () => {
    expect((await POST(post({ killmailId: 1, characterId: 999 }))).status).toBe(404);
    fitFromKillmail.mockResolvedValue({ kind: "notFound" });
    expect((await POST(post({ killmailId: 1 }))).status).toBe(404);
  });

  it("400s when the fit could not be built", async () => {
    fitFromKillmail.mockResolvedValue({ kind: "failed" });
    expect((await POST(post({ killmailId: 1 }))).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/api/from-killmail-route.test.ts`
Expected: FAIL — "Failed to resolve import ... from-killmail/route.js".

- [ ] **Step 3: Write `src/lib/combat/fit.ts`**

```ts
/**
 * "Open in fitting designer" (spec §6). Server only: it reads the killmail, the dogma data and the
 * fits repo. Never import this from a `"use client"` component.
 */
import { createFit } from "../db/fits.js";
import { getKillmail } from "../db/killmails.js";
import { DRONE_BAY_FLAG, slotOfType, type DogmaType } from "../dogma/index.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import type { CloneOutcome } from "../fits/clone.js";
import { CARGO_FLAG, type FitItem } from "../fits/doc.js";
import { clampFitName } from "../fits/parse.js";
import { fitFlagOfFlag } from "./flags.js";
import type { KillmailItemRow } from "./killmail.js";

/**
 * Killmail items → phase-5 fit items. The numeric flag carries the slot index, so a module lands in
 * exactly the slot the victim had it in.
 *
 * Two rows can share one flag — a launcher and the ammo loaded in it are both `HiSlot0`. The row
 * whose type has a fitting slot (`slotOfType`) is the module; a second row on the same flag is its
 * charge (Decision 14). Contents of containers (`parentIdx !== null`), cargo, implants, fighters and
 * unknown flags are dropped: they were never fitted.
 *
 * Note: `fitFlagOfFlag` accepts the whole 125–132 subsystem band (Decision 13), so flags 129–132
 * would map to `SubSystemSlot4`..`SubSystemSlot7` here too — slots that never occur in game (a ship
 * has at most four subsystems). Harmless: ESI never emits those flags, so this wider range simply
 * never fires for them, exactly as `flags.ts`'s own docstring already notes for `slotOfFlag`.
 */
export function killmailFitItems(
  items: KillmailItemRow[], data: { types: ReadonlyMap<number, DogmaType> },
): FitItem[] {
  const byFlag = new Map<string, KillmailItemRow[]>();
  for (const item of items) {
    if (item.parentIdx !== null) continue;
    const flag = fitFlagOfFlag(item.flag);
    if (flag === null || flag === CARGO_FLAG) continue;
    const rows = byFlag.get(flag) ?? [];
    rows.push(item);
    byFlag.set(flag, rows);
  }

  const out: FitItem[] = [];
  for (const [flag, rows] of byFlag) {
    if (flag === DRONE_BAY_FLAG) {
      for (const row of rows) {
        out.push({
          typeId: row.itemTypeId,
          quantity: Math.max(1, row.quantityDestroyed + row.quantityDropped),
          flag, chargeTypeId: null, state: "active",
        });
      }
      continue;
    }
    const isModule = (row: KillmailItemRow): boolean => {
      const type = data.types.get(row.itemTypeId);
      return type !== undefined && slotOfType(type) !== null;
    };
    const module = rows.find(isModule) ?? rows[0];
    const charge = rows.find((row) => row !== module) ?? null;
    out.push({
      typeId: module.itemTypeId, quantity: 1, flag,
      chargeTypeId: charge === null ? null : charge.itemTypeId, state: "active",
    });
  }
  return out;
}

export async function fitFromKillmail(
  killmailId: number, characterId: number | null,
): Promise<CloneOutcome> {
  const full = await getKillmail(killmailId);
  if (full === null) return { kind: "notFound" };
  const shipTypeId = full.head.victimShipTypeId;
  if (shipTypeId === null) return { kind: "failed" };

  try {
    const typeIds = [shipTypeId, ...full.items.map((i) => i.itemTypeId)];
    const data = await loadDogmaData([...new Set(typeIds)]);
    const shipName = data.types.get(shipTypeId)?.name ?? `Type ${shipTypeId}`;
    const fit = await createFit({
      name: clampFitName(`${shipName} — killmail ${killmailId}`),
      description: `Imported from killmail ${killmailId}`,
      shipTypeId,
      characterId,
      items: killmailFitItems(full.items, data),
    });
    return { kind: "ok", fit, unresolved: [] };
  } catch (e) {
    console.error(`[combat] could not build a fit from killmail ${killmailId}`, e);
    return { kind: "failed" };
  }
}
```

- [ ] **Step 4: Write `src/app/api/fits/from-killmail/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { fitFromKillmail } from "../../../../lib/combat/fit.js";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const killmailId = (body as { killmailId?: unknown } | null)?.killmailId;
  const rawCharacter = (body as { characterId?: unknown } | null)?.characterId;
  if (!positive(killmailId) || (rawCharacter !== undefined && !positive(rawCharacter))) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // No character means the phase-5 "All skills V" pilot, exactly like an EFT import.
  const characterId = rawCharacter === undefined ? null : rawCharacter;
  if (characterId !== null && (await getCharacter(characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const outcome = await fitFromKillmail(killmailId, characterId);
  if (outcome.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (outcome.kind === "failed") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: [] }, { status: 201 });
}
```

- [ ] **Step 5: Write the failing component test**

Create `tests/components/open-in-designer.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OpenInDesigner } from "../../src/app/combat/OpenInDesigner.js";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { push.mockClear(); vi.restoreAllMocks(); });

describe("OpenInDesigner", () => {
  it("posts the killmail and the character, then opens the new fit", async () => {
    const posts: { url: string; body: unknown }[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ fit: { id: 42 } }), { status: 201 });
    }) as unknown as typeof fetch;

    render(<OpenInDesigner killmailId={120000001} characterId={90000101} />);
    fireEvent.click(screen.getByRole("button", { name: /open in fitting designer/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/fitting/42"));
    expect(posts).toEqual([{
      url: "/api/fits/from-killmail",
      body: { killmailId: 120000001, characterId: 90000101 },
    }]);
  });

  it("reports a failure instead of silently doing nothing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = (async () => new Response("nope", { status: 400 })) as unknown as typeof fetch;
    render(<OpenInDesigner killmailId={1} characterId={2} />);
    fireEvent.click(screen.getByRole("button", { name: /open in fitting designer/i }));
    await waitFor(() => expect(screen.getByText(/could not build a fit/i)).toHaveClass("neg"));
    expect(push).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
```

- [ ] **Step 6: Write `src/app/combat/OpenInDesigner.tsx`**

```tsx
"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { IconTool } from "@tabler/icons-react";

/** Spec §6: POST the killmail, then go straight to the new fit in the phase-5 designer. */
export function OpenInDesigner({ killmailId, characterId }: { killmailId: number; characterId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/fits/from-killmail", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ killmailId, characterId }),
      });
      if (!res.ok) throw new Error(`/api/fits/from-killmail answered ${res.status}`);
      const json = (await res.json()) as { fit: { id: number } };
      router.push(`/fitting/${json.fit.id}`);
    } catch (e) {
      console.error("[combat] could not build a fit from the killmail", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [killmailId, characterId, router]);

  return (<>
    <button type="button" className="fit-btn" disabled={busy} onClick={open}>
      <IconTool size={16} /> {busy ? "Building…" : "Open in fitting designer"}
    </button>
    {failed ? <p className="neg">Could not build a fit from this killmail.</p> : null}
  </>);
}
```

- [ ] **Step 7: Put the button on the detail page**

In `src/app/combat/[killmailId]/page.tsx`, add the import:
```tsx
import { OpenInDesigner } from "../OpenInDesigner.js";
```
and put the button in the Fit card's heading row, replacing the bare `<h2 className="card-title">Fit</h2>`:
```tsx
        <div className="km-head-meta">
          <h2 className="card-title">Fit</h2>
          <OpenInDesigner killmailId={view.header.killmailId} characterId={character.id} />
        </div>
```

- [ ] **Step 8: Run the tests and the build**

Run: `npx vitest run tests/api/from-killmail-route.test.ts tests/components/open-in-designer.test.tsx && npm run typecheck && npm run build`
Expected: PASS and a clean build. A build error naming `pg` means `OpenInDesigner.tsx` imported
`src/lib/combat/fit.js` instead of talking to the route.

- [ ] **Step 9: Commit**

```bash
cd /home/daniel/AI/Plasma/EVE
git add src/lib/combat/fit.ts src/app/api/fits/from-killmail src/app/combat tests/api/from-killmail-route.test.ts tests/components/open-in-designer.test.tsx
git commit -m "$(cat <<'EOM'
feat(combat): open a killmail's fit in the fitting designer

POST /api/fits/from-killmail builds a phase-5 fit from the victim's fitted
items: the numeric flag gives the exact slot, slotOfType tells a module from
the charge sharing its flag, and the drone bay comes across as drone rows.
Cargo, implants and fighters are dropped — they were never fitted.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 14: Deploy phase 7 to the VM and record acceptance

The acceptance for the phase and for the project. No Ansible or env changes: the existing `eve` role
rsyncs the repo, rebuilds the image, runs `npm run migrate` (which now applies the five phase-7
tables from `db/schema.sql`) and restarts the app and the worker.

**Phase 7 adds no `sde_*` tables**, so — unlike phase 6 — a forced `npm run sde:import` is **not**
needed and must not be run: it would re-download ~95 MB and swap the reference tables for no gain.

**The re-login caveat is part of the acceptance.** `esi-killmails.read_killmails.v1` is on the
portal's scope set, but a character whose refresh token predates that change cannot read
`/killmails/recent`. Such a character shows a `warn:` run on `/settings` (or simply `rows=0`) until
Daniel logs it in again through **Add character**. The zKillboard backfill needs no scope at all, so
`/combat` fills in with history even before anyone re-logs — that is the first thing to check.

**Files:**
- Modify: `deploy/README.md` (a "Combat" section)

**Interfaces:**
- Consumes: Tasks 1–13, all committed on `feature/phase7-combat`.
- Produces: `https://eve.example.com/combat` live, `/combat/<killmailId>` serving the detail page,
  and populated `killmails` / `killmail_attackers` / `killmail_items` / `character_killmails` /
  `killmail_backfill` tables in the production database.

- [ ] **Step 1: Confirm the branch is clean and green**

```bash
cd /home/daniel/AI/Plasma/EVE
git status --short
docker compose -f compose.dev.yml up -d
npm test && npm run typecheck && npm run build
```
Expected: no uncommitted changes; every test passes with pristine output; `tsc --noEmit` clean;
`next build` succeeds. A build failure naming `pg`, `node:fs` or `dns` means a `"use client"`
component imported `src/lib/combat/load.js`, `src/lib/combat/fit.js` or a `db` module — fix that
before deploying.

- [ ] **Step 2: Document combat in `deploy/README.md`**

Add a new section after "Skill planner":

```markdown
## Combat (killmails & PvP stats)

`/combat` is the killboard: stats tiles, a twelve-month activity strip, top ships and systems, and
the killmail table. `/combat/<id>` is one killmail — victim, fit, attackers — and "Open in fitting
designer" turns the victim's fit into a local fit.

Three jobs feed it, and none of the pages ever calls ESI:

- **`killmails`** (per character, hourly). Walks `GET /characters/{id}/killmails/recent` — at most
  10 pages, stopping as soon as a whole page holds only ids we already have — then fetches each new
  body from the **public** `GET /killmails/{id}/{hash}`. The body route takes no token, so it uses
  the generous `killmail` bucket (3600 tokens/15 min) rather than `char-killmail` (30/15 min).
  ESI only keeps **90 days**.
- **`killmail-backfill`** (global, every 15 minutes). Walks
  `https://zkillboard.com/api/{kills|losses}/characterID/{id}/page/{n}/` — 200 killmails a page,
  pages 1–100, so up to 20,000 per filter. zKillboard publishes no rate limit, only etiquette, so
  the client sends a descriptive `User-Agent`, asks for gzip, waits **2 s between requests** and
  spends at most **20 pages per run**. A zKillboard page carries the full ESI killmail plus a `zkb`
  block, so no second ESI call is needed and `zkb.hash` is the hash we store.
- **`killmail-values`** (global, hourly). Values the newest 500 unvalued killmails from
  `market_prices`: victim hull plus every item at destroyed + dropped quantity. A killmail with any
  unpriced type stays NULL and is retried — `typesOfInterest` now feeds killmail types from the
  last 90 days to the Fuzzwork half of `market-prices`, so those prices arrive. The displayed value
  is `zkb_total_value` first, ours second.

Killmails are **immutable**: `(killmail_id, killmail_hash)` is stored once, never re-fetched, and
only the `zkb_*` and `computed_value` columns are ever updated.

**A character must have logged in since the killmail scope was added.** The portal grants
`esi-killmails.read_killmails.v1`, but a refresh token minted before that grant cannot use it: the
`killmails` job records `warn: killmail scope not on this token yet — log the character in again`
on `/settings` and returns no rows. Fix it with **Add character** in the top-right menu — the SSO
round trip mints a new token with the full scope set. The zKillboard backfill needs no scope, so
history appears either way.

Item slots on a killmail come from the raw numeric `invFlags` id, not the string enum the assets and
fittings endpoints use: low 11–18, mid 19–26, high 27–34, rigs 92–94, subsystems 125–132, drone bay
87, cargo 5, implants 89, fighter bay 158.

Everything is behind the session cookie: `src/proxy.ts` guards every path except `/login`,
`/api/health`, `/auth/*` and `/_next/*`.
```

- [ ] **Step 3: Deploy**

```bash
cd deploy/ansible && script -qc "ansible-playbook site.yml --tags eve" /dev/null
```
Expected: play recap with `failed=0`. The image rebuild takes a few minutes on the VM.
(`script -qc … /dev/null` gives Ansible the TTY it wants; without it the playbook can abort on
non-blocking stdio.)

- [ ] **Step 4: Confirm the containers came back and the site is healthy**

```bash
ssh <user>@<host> 'docker ps --format "{{.Names}} {{.Status}}"'
curl -sS https://eve.example.com/api/health
```
Expected: `eve-app`, `eve-worker`, `eve-postgres`, `traefik` all `Up`; health returns
`{"ok":true,"db":true}`.

- [ ] **Step 5: Confirm the migration created the five combat tables and their cascades**

```bash
ssh <user>@<host> "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select table_name from information_schema.tables
  where table_schema='public' and table_name like '%killmail%' order by table_name\""
ssh <user>@<host> "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select conrelid::regclass, conname, confdeltype from pg_constraint
  where confrelid in ('characters'::regclass,'killmails'::regclass) and contype='f'
    and conrelid::regclass::text like '%killmail%' order by 1,2\""
```
Expected: `character_killmails`, `killmail_attackers`, `killmail_backfill`, `killmail_items`,
`killmails` — all five combat tables, `character_killmails` included since the pattern now matches
anywhere in the name, not just a `killmail` prefix. Every listed foreign key has `confdeltype = c`,
i.e. cascade.

- [ ] **Step 6: Watch the first backfill run**

The `killmail-backfill` job is global and due on the worker's very first tick, so it should appear
within a minute of the restart. Give it two runs (about 15 minutes) and then:

```bash
ssh <user>@<host> 'cd /opt/eve/src/deploy && docker compose logs --tail=80 worker | grep killmail'
ssh <user>@<host> "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select job, status, rows, coalesce(error,'-') from sync_runs
  where job like 'killmail%' order by started_at desc limit 12\""
ssh <user>@<host> "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select (select count(*) from killmails),
         (select count(*) from character_killmails),
         (select count(*) from killmails where computed_value is not null),
         (select count(*) from killmails where zkb_total_value is not null)\""
```
Expected: `killmail-backfill global ok rows=<n>` lines with `n` in the low thousands after a couple
of runs; `killmails` and `character_killmails` non-zero; `zkb_total_value` populated on essentially
every backfilled row. `killmails` rows may be `0` or carry the `warn:` scope message until step 7.

- [ ] **Step 7: Re-authorise the characters so the ESI half works**

In a browser on the tailnet, open `https://eve.example.com`, and for **each** of the four
characters use the top-right menu → **Add character** and complete the EVE SSO round trip. This
replaces the stored refresh token with one carrying `esi-killmails.read_killmails.v1`. Then:

```bash
ssh <user>@<host> "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select name, 'esi-killmails.read_killmails.v1' = any(scopes) from characters order by name\""
```
Expected: `t` for all four. Within the hour the `killmails` job's `sync_runs` rows turn `ok` with a
non-zero `rows` on any character who has died or scored recently, and no `warn:` message.

- [ ] **Step 8: Acceptance — Daniel, in a browser on the tailnet**

Work through this list and record the result of each item.

1. `https://eve.example.com/combat` loads with the nav item **Combat** highlighted and **no**
   "Coming in phase 7" card.
2. The stats header shows six tiles — Kills, Losses, Efficiency, ISK destroyed, ISK lost, Solo
   kills — with real numbers for the active character over the default **90 d** tab.
3. The period tabs **30 d / 90 d / 1 y / All** each reload the page and change the numbers; the URL
   carries `?period=…` and pasting that URL into a new tab reproduces the same view.
4. **All characters** toggles on, the sub-heading changes to "4 characters", and the numbers grow.
   A killmail several of your characters were on appears exactly **once**, and as a **Loss** if any
   of them died on it.
5. **Monthly activity** shows twelve columns with kills above the line (green) and losses below
   (red), the busiest month's bar reaching full height, and each column's tooltip reading e.g.
   "2026-07: 3 kills, 1 loss".
6. **Ships flown / Ships lost / Systems** each list up to five entries with real names — not
   `Unknown (…)`. An `Unknown (…)` here means the SDE has not been imported; an `ID …` in the
   killmail table's Victim column means the name jobs have not caught up yet, which is expected for
   a fresh backfill and resolves within an hour.
7. The **Killmail table** shows 50 rows newest first, each with a time, a green **Kill** or red
   **Loss** badge, the victim's ship icon and name, the victim and their corporation, the system
   with its security colour, a value, an attacker count and your ship. **Show more** appends the
   next 50 and stops when there are no more; opening DevTools → Network shows exactly one request
   per click, to `/api/characters/<id>/killmails?offset=…&period=…&all=…`.
8. The **backfill status line** above the table reads
   "Backfill from zKillboard: N killmails imported (kills page P, losses page Q)" and N grows
   between reloads. Once every cursor is finished it reads "complete — N killmails imported".
   Confirm it eventually says complete for all four characters (this may take a day; note where it
   had got to if it has not).
9. Click a **loss**. The detail page opens with the ship name as the title, and time, system with
   its security colour, value and a **Loss** badge underneath.
10. **The zKillboard cross-check (the most important item on this list).** Click **View on
    zKillboard** and compare, side by side: the ship, the system, the number of attackers, the
    final-blow pilot, and the value. The value should be zKillboard's own figure exactly (we
    display `zkb_total_value` when we have it). Any disagreement about the ship, the system or the
    attackers is a real bug — record the killmail id.
11. The **Fit** panel groups the victim's items into High / Mid / Low / Rigs / Subsystems / Drone
    bay / Cargo with destroyed and dropped quantities and a per-row value, and a container's
    contents are listed under the container with "in <container name>".
12. **Open in fitting designer** → the phase-5 editor opens on a new fit named
    "<Ship> — killmail <id>", with the modules in the same slots the victim had them in and the
    ammo attached to its launcher or turret. The fit loads without a "could not compute" card.
13. The **Attackers** table is sorted by damage, highest first; the final-blow pilot carries a star;
    the damage shares add up to about 100%; NPC attackers show "—" for their name.
14. Open a **kill** (a killmail you were an attacker on): the badge reads **Kill**, and the "Our
    ship" column on `/combat` showed the ship you were flying, not the victim's.
15. `/settings` → **Sync status** lists `killmails`, `killmail-backfill` and `killmail-values` with
    `ok` badges. Any `killmails` row still showing the re-login warning names a character that
    step 7 missed.
16. Break something on purpose: open `https://eve.example.com/combat/1` (a killmail id that cannot
    exist). Expect Next's 404 page, not a stack trace.

- [ ] **Step 9: Commit the acceptance and merge**

```bash
cd /home/daniel/AI/Plasma/EVE
git add deploy/README.md
git commit -m "$(cat <<'EOM'
Deploy phase 7 (combat) and record acceptance

Acceptance: the five killmail tables were created by the migration; the
zKillboard backfill imported <n> killmails across the four characters and
reached <page> before/at completion; after re-authorising all four characters
the killmails job turned ok and pulled the ESI 90-day window; killmail-values
priced <m> killmails from market_prices. A loss detail page matched its
zKillboard page on ship, system, attackers, final blow and value (<id>); the
fit panel grouped the items by their numeric flags; "Open in fitting designer"
produced a loadable fit with the modules in their original slots. Period tabs,
the All-characters toggle, Show more and the 404 path all behaved as listed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
git checkout main && git merge --no-ff feature/phase7-combat
```

---

## Self-review

**1. Spec coverage.**

| Spec | Task |
|---|---|
| §2 `GET /characters/{id}/killmails/recent` (scope, 300 s cache, paginated, 30 tokens/15 min) | 3 |
| §2 `GET /killmails/{id}/{hash}` public, cacheable forever, the hash is the credential | 3 (Decision 1) |
| §2 zKillboard `GET /api/{kills\|losses}/characterID/{id}/page/{n}/`, trailing slash, 200/page, pages 1–100 | 4 |
| §2 zKB etiquette: 1 h cache, gzip, the exact `User-Agent` string, one request per 2 s, ≤ 20 pages per run, no parallelism | 4 (client), 5 (budget), Decisions 6 and 9 |
| §3 `killmails` columns, including `zkb_*`, `computed_value`, `source`, `fetched_at` | 2 |
| §3 `killmail_attackers`, `killmail_items` (`parent_idx`), `character_killmails`, `killmail_backfill` | 2 |
| §3 indexes on `killmails (killmail_time DESC)`, `character_killmails (character_id, killmail_id)`, `killmail_attackers (character_id)` | 2 |
| §3 immutability: `ON CONFLICT DO NOTHING` except `zkb_*` and `computed_value` | 2 |
| §3 `role` = `loss` when the character is the victim, else `kill` | 1 (`roleFor`), 2 (link upgrade) |
| §4 `killmails` job: hourly, page walk with known-id early stop, public body fetch, `source='esi'` | 3 |
| §4 `killmail-backfill` job: global, 15 min, `next_page` cursor, 20 pages, 2 s pacing, `source='zkb'`, `zkb.hash`, done detection | 5 |
| §4 `killmail-values` job: global, hourly, hull + items (destroyed + dropped) × `priceOf` | 6 |
| §4 unpriced types leave the killmail NULL until priced | 6 (Decision 5) |
| §4 `typesOfInterest` gains killmail item and victim-ship types for 90 days | 6 |
| §4 ruling: displayed value = `zkb_total_value ?? computed_value` | 8 (list SQL), 12 (detail header) |
| §4 name resolution via `resolveNames` with a ≤ 1000-id batch; systems/ships via the SDE | 3 and 5 resolve at write time (Decision 3); 9 and 12 read via `displayNames`, `getTypes`, `getSolarSystems` |
| §5 kills, losses, ISK destroyed, ISK lost, efficiency | 7 |
| §5 solo kills (`zkb_solo` or `attacker_count = 1`), final blows | 7 (the `solo` column is computed in Task 8's SQL) |
| §5 top 5 ships flown, ships lost, systems; monthly activity, last 12 months; favourite weapon | 7 |
| §6 `/combat`: active character + All-characters toggle, period tabs 30 d / 90 d / 1 y / All | 11 (Decision 10) |
| §6 stats header tiles | 9, 11 |
| §6 monthly activity: 12 columns, kills up, losses down, CSS bars, tokens, no chart library | 9, 11 |
| §6 top lists: ships flown, ships lost, systems | 9, 11 |
| §6 killmail table, 50 per page, `GET /api/characters/[id]/killmails?offset=` | 9, 10 |
| §6 table columns: time, K/L badge, victim ship icon+name, victim & corp, system with sec class, value, attacker count, our ship | 9, 10 |
| §6 backfill status line | 5 (repo), 9 (`backfillLine`), 11 |
| §6 `/combat/[killmailId]`: header with time, system, value, K/L, zKillboard link | 12 |
| §6 victim card: portrait, name, corp/alliance, ship render, damage taken | 12 |
| §6 fit panel from the numeric flag, with the hard-coded `invFlags` bands in `src/lib/combat/flags.ts` | 1, 12 |
| §6 destroyed/dropped quantities and values in the fit panel | 12 |
| §6 `POST /api/fits/from-killmail { killmailId }` and "Open in fitting designer" | 13 |
| §6 attackers table (name, corp/alliance, ship, weapon, damage, final-blow star), sorted by damage | 12 |
| §6 nav item `Combat` becomes live | 11 (the nav entry already exists; the ComingSoon card is replaced) |
| §7 zKB non-200 or malformed page → job error, `next_page` unchanged | 4 (throws), 5 (Decision 7) |
| §7 ESI 429/420 handled by the client; the job resumes next hour, idempotent by id | 3 (`knownKillmailIds` + `ON CONFLICT`), and the client's existing halt/breaker |
| §7 unknown type/system ids render as `Unknown (id)` | 9 (`typeOf`, `nameOf`), 12 |
| §8 unit: zKB page parser (fixture with `zkb`, 200 records, short page), pacing | 4, 5 (Decision 15) |
| §8 unit: role assignment; item flattening with one level of nesting and `parent_idx` | 1 |
| §8 unit: value computation with partial prices | 6 |
| §8 unit: stats aggregation (efficiency, solo, top lists, monthly buckets across a year boundary) | 7 |
| §8 unit: flag → slot mapping | 1 |
| §8 jobs: `killmails` with a fake ESI (early stop, body fetch without token) | 3 |
| §8 jobs: `killmail-backfill` (cursor persistence, 20-page cap, done detection) | 5 |
| §8 jobs: `killmail-values` | 6 |
| §8 DB: insert idempotency, `zkb_*` update on conflict, cascade on character delete | 2 |
| §8 component: stats tiles, killmail table badges, detail fit panel | 9 (tiles as view models), 10 (table), 12 (fit panel view model) |
| §8 acceptance on the VM | 14 |
| §9 out of scope (corp/alliance killboards, wars, the live zKB feed, damage-share charts, dogma "what killed me", awox/npc filtering) | not implemented anywhere |

No spec requirement is left without a task.

**2. Placeholder scan.** No "TBD", no "similar to Task N", no "add error handling", no step that
describes without showing. Every code step carries complete code. The deliberately open values are
the acceptance commit message's `<n>` / `<m>` / `<page>` / `<id>` placeholders (Task 14 Step 9),
which are measurements the operator fills in.

**3. Type consistency.** Traced end to end:
`KillmailSlot` / `KILLMAIL_SLOT_ORDER` / `SLOT_TITLES` / `slotOfFlag` / `fitFlagOfFlag` (1) →
`killmailView` (12) and `killmailFitItems` (13).
`EsiKillmail` / `EsiKillmailItem` / `EsiKillmailVictim` / `EsiKillmailAttacker` / `ZkbBlock` (1) →
`ZkbRecord extends EsiKillmail` (4) → `toKillmailWrite` (1) in both jobs (3, 5).
`KillmailWrite` / `KillmailRow` / `KillmailAttackerRow` / `KillmailItemRow` / `CharacterKillmailLink`
/ `KillRole` (1) → `saveKillmails` (2) → the two jobs (3, 5) → `KillmailFull` (8) → `killmailView`
(12) and `killmailFitItems` (13).
`KillmailValueParts` (6, in `src/lib/combat/value.ts`) is what `unvaluedKillmails` (6) returns and
what `computeKillmailValue` (6) consumes — one definition, imported by the repo, not redeclared.
`ZkbKind` (4) → `BackfillCursor` / `BackfillStatus` (5) → `BackfillJobDeps` (5) and `backfillLine` (9).
`StatRow` (7) is exactly the subset of `CombatRow` (8) that `combatStats` reads, and `CombatRow`
`extends StatRow`, so `allCombatRows`'s result passes straight into `combatStats` (9).
`CombatStats` / `TopEntry` / `MonthBucket` (7) → `statTiles` / `monthBars` / `topLists` (9).
`CombatPeriod` / `parsePeriod` / `periodStart` (7) → `loadCombatPage` / `loadKillmailRows` (9) →
the route (10) → `CombatFilters` and the page (11).
`Labels` / `nameOf` / `typeOf` (9) → `killmailRows` (9) and `killmailView` (12); both loaders build
it the same way from `displayNames` + `getTypes` + `getSolarSystems`.
`KillmailRowView` (9) → the route's JSON (10) → `KillmailTable`'s props and state (10) → the page (11).
`KillmailView` / `KillmailHeaderView` / `VictimView` / `FitSlotView` / `FitItemView` / `AttackerView`
(12) → the detail page (12) → `OpenInDesigner`'s `killmailId` prop (13).
`FitItem` / `CloneOutcome` / `FitInput` are phase-5's, used unchanged by `killmailFitItems` and
`fitFromKillmail` (13); the route's response shape matches `from-fitting`'s exactly.

**4. Corrections and choices made while writing this plan** (they matter to the executor):
- **Spec §4's "resolve names lazily at render time" contradicts foundation §2.1's "pages never call
  ESI".** This plan resolves at write time in the two jobs and reads with the Postgres-only
  `displayNames` (Decision 3). The visible consequence is that a freshly backfilled killmail can
  show `ID 2112625428` for a few minutes until the next job run resolves it.
- **Spec §2's "at most 20 pages per run" and §4's "for each character … up to 20 pages" disagree.**
  The plan takes the §2 ruling: 20 pages per *run*, across all cursors (Decision 6).
- **Subsystem flags are 125–132 per spec §6, not 125–128 per the research** (Decision 13); the
  research explicitly marks its numeric table UNVERIFIED, so the spec wins and the wider band is
  harmless.
- **`computed_value` is all-or-nothing** (Decision 5). The alternative reading of spec §4 would make
  "the killmail stays NULL until priced" unreachable.
- **The zKillboard `User-Agent` is a module constant, not `config.esiUserAgent`** (Decision 9): the
  deployed `ESI_USER_AGENT` is `EVE-Plasma/0.1 (you@example.com)` and carries no project URL, which
  is exactly what zKillboard's etiquette asks for. No new env var either way.
- **Two killmail item rows can share one numeric flag** (a launcher and its ammo). The fit builder
  resolves that with the dogma engine's `slotOfType` rather than a heuristic on quantity
  (Decision 14).
- **The "imported" figure in the backfill line is a `count(*)`**, because the spec's data model has
  no counter column and this plan does not add one (Decision 8).
- **`tests/db/helpers.ts` needs `killmails` in its TRUNCATE list**: `character_killmails` and
  `killmail_backfill` cascade from `characters`, but `killmails` itself has no foreign key, so
  without this a DB test would inherit rows from the previous file (Task 2).
- **`@testing-library/user-event` is not a dependency.** Component tests use `fireEvent` and swap
  `globalThis.fetch`, which is what `tests/components/wallet-tables.test.tsx` does.
- **Phase 7 adds no `sde_*` tables, so the deploy must NOT force `npm run sde:import`** — unlike
  phase 6, where it was mandatory (Task 14).

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast
   iteration. Uses `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute the tasks in one session with checkpoints, using
   `superpowers:executing-plans`.
