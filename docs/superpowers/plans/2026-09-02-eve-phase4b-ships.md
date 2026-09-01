# EVE Phase 4b (Market Prices and the Ships Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `market_prices` table fed hourly from ESI `/markets/prices` and Fuzzwork's Jita aggregates, and the `/ships` pages: a list of the active character's actually-fitted ships and saved fits with CPU/PG gauges, missing-skill counts and estimated values, plus a full fit sheet per ship (`/ships/asset/[itemId]`) and per saved fit (`/ships/fit/[fittingId]`) with slot columns, gauges, problems, missing skills, cargo/drones, value and an "affected by" popover.

**Architecture:** The market half is a global DI worker job (`market-prices`) over two pure I/O modules — `src/lib/market/fuzzwork.ts` (HTTP, chunked) and `src/lib/market/interest.ts` (one SQL) — writing through `src/lib/db/market-prices.ts`. The UI half follows the phase-3b pattern exactly: server components read Postgres only, run the phase-4a dogma engine per request, and hand **plain serialisable view objects** to presentational components. All transformation lives in pure, unit-tested helpers (`src/lib/view/price.ts`, `src/lib/view/ships.ts`, `src/lib/view/fit-sheet.ts`); the single `"use client"` island is the "affected by" popover, which is fed pre-computed `explain` rows so no `DogmaData` ever crosses to the browser. `src/lib/ships/load.ts` is the one place that assembles a character's fit context, so both routes and the list page make exactly one `loadDogmaData` call per request.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Next.js 16 server components + one `"use client"` island, Mantine 9 (theme only — layout is the Midnight CSS in `src/app/globals.css`), Tabler icons, Node 24, `pg` 8, Postgres 17, vitest 4 with happy-dom + `@testing-library/react`. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase4-ships-fittings-design.md` — this plan implements **§3 (market prices)**, **§4 (UI)**, **§5 (schema)**, **§6 (error handling)**, the market / builder-integration / component bullets of **§7**, and §7's **acceptance on the VM**. §2 (the engine) and §7's engine-unit-test bullets are phase 4a.

**Depends on:** `docs/superpowers/plans/2026-09-02-eve-phase4a-dogma.md`, fully implemented and committed on `feature/phase4-ships` before this plan starts. Its final "Interfaces for phase 4b" section is the contract; every task below quotes verbatim the signatures it consumes. **This plan adds nothing to `src/lib/dogma/`.**

**Research:** `docs/research/esi-endpoints.md` §4 (region 10000002, `GET /markets/prices`, Fuzzwork aggregates) and §1.3/§1.5 (rate-limit groups, User-Agent).

## Global Constraints

- **TypeScript strict, ESM.** Imports between local TS files carry the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- **Server components read only Postgres and run the engine.** A page never calls ESI and never fetches our own API. `export const dynamic = "force-dynamic"` is already set in `src/app/layout.tsx`; do not add per-page caching directives.
- **`"use client"` only for interaction.** In this phase that is exactly one component: the "affected by" popover. A client component must not import `pg`, `src/lib/db/**`, `src/lib/sde/**` or `src/lib/dogma/sde-loader.js` — `npm run build` is what proves it, so run it before the final task.
- **Never ship `DogmaData` to the browser.** `explain()` runs on the server; the popover receives plain `{ carrier, operator, value, penalised }` strings.
- **Batch every lookup.** One `loadDogmaData(...)`, one `locationLabels(...)`, one `getPrices(...)`, one `getTypes(...)` per request. Never query inside a row loop. Item and skill **names come from `DogmaData`** (`data.types.get(id)?.name`), so `getTypes` is only needed for the ship-bonus skill names.
- **Midnight tokens only.** Colours come from the CSS variables in `src/app/globals.css`; new styling is a new class in that file. **Never inline a colour.** Reuse the existing classes (`card`, `card-title`, `card-grid`, `card-stack`, `table`, `badge`, `muted`, `faint`, `pos`, `neg`, `num`, `page-title`, `page-sub`, `coming-soon`, `progress`, `sec-*`).
- **Tabler icons** (`@tabler/icons-react`) for any iconography.
- **"Active character" = `readSession()?.activeCharacterId`**, falling back to the first character of `listCharacters()` — that is exactly `pickActive(characters, session?.activeCharacterId ?? null)`. No character at all → `<NoCharacter title="Ships" />`.
- **"Not synced yet" placeholders.** An empty list renders a `faint` sentence, never a blank card and never a crash.
- **Engine exceptions are caught per fit** (spec §6): the card or the sheet shows "Could not compute" and the error goes to `console.error`. `UnknownTypeError` and `DogmaCycleError` are the two the engine throws.
- **Unknown type ids** are listed as `Unknown type (id)` and excluded from the calculation (spec §6) — `BuiltFit.unknown` carries them.
- **No skills synced** → `skills: new Map()`, every skill reads level 0, and both pages say so in a banner (spec §6).
- **Market values are ISK numbers, never strings, inside the app.** `numeric` columns come back from `pg` as strings; the repo converts them with `Number(...)` exactly once, like every other phase-3 repo.
- **Fuzzwork is third-party and may fail.** A Fuzzwork failure leaves the ESI prices in place and records the run `ok` with `warn: …` in the error column (spec §3). An ESI failure is a real error.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`; the environment is happy-dom with `tests/setup.ts`. DB tests use `tests/db/helpers.ts` (`resetDb`, `resetSde`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **No network in tests.** The market tests inject a fake `fetch`; the engine-backed tests read the committed phase-4a snapshot `tests/fixtures/dogma/rifter.json` through `tests/dogma/fixture.ts`.
- Work happens on branch `feature/phase4-ships` (created by phase 4a Task 1). **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- VM: `ssh daniel@10.5.5.150`, site `https://eve.plasma66.com`, Ansible in `deploy/ansible`, Compose project directory `/opt/eve/src/deploy`.

## File Structure

| Path | Responsibility |
|---|---|
| `db/schema.sql` | **Modified**: the `market_prices` table (spec §5) |
| `src/lib/db/market-prices.ts` | `upsertEsiPrices`, `upsertJitaPrices`, `getPrices`; owns `EsiPriceRow`/`JitaPriceRow` |
| `src/lib/view/price.ts` | Pure: `Price`, `priceOf`, `rollUpValue`, `unpricedNote`, `iskShort` |
| `src/lib/market/fuzzwork.ts` | `fetchAggregates(typeIds, fetchImpl, userAgent)` — chunks of 500, string/`"0"` parsing |
| `src/lib/market/interest.ts` | `typesOfInterest()` — one UNION query across four tables |
| `src/worker/scheduler.ts` | **Modified**: a job may return `{ rows, warn }`; the warning lands in `sync_runs.error` behind `WARN_PREFIX`, status stays `ok` |
| `src/lib/view/format.ts` | **Modified**: `WARN_PREFIX`, `isWarning` |
| `src/app/settings/SyncStatus.tsx` | **Modified**: a `warn:` row is amber, not red |
| `src/worker/jobs/market-prices.ts` | The hourly global job: ESI prices → Fuzzwork aggregates → warn-on-Fuzzwork-failure |
| `src/worker/jobs/index.ts` | **Modified**: `marketPricesJob` registered in `ALL_JOBS` |
| `src/lib/sde/repo.ts` | **Modified (new)**: `getTypeBonuses(typeId)` for the fit sheet's ship bonuses |
| `src/lib/ships/load.ts` | Server-only: `loadFitData(characterId)` — assets, fittings, one `loadDogmaData`, the `FitContext` |
| `src/lib/view/ships.ts` | Pure: `assembledShips`, `shipLocationLabel`, `gauge`, `bonusLabel`, `toShipCard`, `errorShipCard`, `sortShipCards` |
| `src/lib/view/fit-sheet.ts` | Pure: `buildFitSheet` and its view types, `operatorLabel`, `stateLabel`, `explainRows`, `problemText` |
| `src/app/ships/page.tsx` | `/ships` — fitted ships and saved fits |
| `src/app/ships/ShipCard.tsx` | Presentational card (server component) |
| `src/app/ships/FitSheet.tsx` | Presentational fit sheet (server component) |
| `src/app/ships/AffectedBy.tsx` | `"use client"` — the only interactive component; the CPU/PG popover |
| `src/app/ships/asset/[itemId]/page.tsx` | Fit sheet for an assembled ship in assets |
| `src/app/ships/fit/[fittingId]/page.tsx` | Fit sheet for a saved ESI fitting |
| `src/app/globals.css` | **Modified**: `.gauge`/`.over`, ship-card, fit-sheet, popover and `.warn-text` classes |
| `tests/db/helpers.ts` | **Modified**: `market_prices` added to the TRUNCATE list |
| `tests/db/schema.test.ts` | **Modified**: `market_prices` in the table list |
| `tests/db/market-prices.test.ts` | Repo upserts and `getPrices` on real Postgres |
| `tests/db/market-interest.test.ts` | `typesOfInterest` on real Postgres |
| `tests/db/sde-repo.test.ts` | **Modified**: `getTypeBonuses` |
| `tests/db/ships-load.test.ts` | `loadFitData` on real Postgres + the mini SDE |
| `tests/market/fuzzwork.test.ts` | `fetchAggregates` with a fake `fetch` |
| `tests/worker/market-prices.test.ts` | The job with injected deps + a fake ESI client |
| `tests/worker/scheduler.test.ts` | **Modified**: the warning outcome |
| `tests/worker/registration.test.ts` | **Modified**: `market-prices` in `ALL_JOBS` |
| `tests/view/price.test.ts` | `priceOf`, `rollUpValue`, `unpricedNote`, `iskShort` |
| `tests/view/format.test.ts` | **Modified**: `isWarning` |
| `tests/view/ships.test.ts` | `assembledShips`, `shipLocationLabel`, `gauge`, `bonusLabel`, `toShipCard` |
| `tests/view/ships-rifter.test.ts` | Builder integration: hand-written asset rows + the `rifter` snapshot → card numbers |
| `tests/view/fit-sheet.test.ts` | `buildFitSheet` — slots, problems, missing skills, value, explain rows |
| `tests/components/ship-card.test.tsx` | Card gauges, missing-skill badge, "Could not compute" |
| `tests/components/fit-sheet.test.tsx` | Sheet problems, missing skills, value, cargo/drones |
| `tests/components/affected-by.test.tsx` | Popover open/close |

---

### Task 1: The `market_prices` table, its repo, and `priceOf`

Spec §3/§5: two sources, one row per type. ESI's `/markets/prices` fills `adjusted_price`/`average_price`
for every market type in the game; Fuzzwork's Jita aggregates fill `jita_sell_min`/`jita_buy_max` for the
types of interest. A price the source does not have is `NULL`, never `0`.

**Files:**
- Create: `src/lib/db/market-prices.ts`, `src/lib/view/price.ts`, `tests/db/market-prices.test.ts`, `tests/view/price.test.ts`
- Modify: `db/schema.sql` (append), `tests/db/helpers.ts:17` (TRUNCATE list), `tests/db/schema.test.ts:17-25` (table list)

**Interfaces:**
- Consumes (phase 1/2, verbatim):
```ts
// src/lib/db/client.ts
export function getPool(): Pool
// src/lib/chunk.ts
export function chunk<T>(items: readonly T[], size: number): T[][]
```
- Produces:
```ts
// src/lib/view/price.ts — pure, zero imports, safe in a client component
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }
export function priceOf(p: Price | undefined): number | null;        // sell ?? adjusted ?? null

// src/lib/db/market-prices.ts
export interface EsiPriceRow { typeId: number; adjustedPrice: number | null; averagePrice: number | null }
export interface JitaPriceRow { typeId: number; sellMin: number | null; buyMax: number | null }
export function upsertEsiPrices(rows: EsiPriceRow[]): Promise<number>;
export function upsertJitaPrices(rows: JitaPriceRow[]): Promise<number>;
export function getPrices(typeIds: number[]): Promise<Map<number, Price>>;
```

**Decisions recorded here (do not re-litigate them):**
- The columns are plain `numeric`, exactly as the spec writes them — **not** the `numeric(20,2)` the wallet
  tables use. Fuzzwork's minimum sell prices legitimately carry more than two decimals.
- The two upserts touch **disjoint column sets**, so a Fuzzwork run never clears the ESI values and vice
  versa. That is what makes the "Fuzzwork failure degrades to ESI prices" rule in spec §3 true.
- `priceOf` lives in `src/lib/view/price.ts`, not in the repo, because client-side value formatting must
  not drag `pg` into the bundle. The repo imports the `Price` **type** from it (type-only, erased).

- [ ] **Step 1: Write the failing tests**

Create `tests/view/price.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { priceOf } from "../../src/lib/view/price.js";

describe("priceOf", () => {
  it("prefers the Jita sell price", () => {
    expect(priceOf({ sell: 5, buy: 4, adjusted: 9 })).toBe(5);
  });
  it("falls back to the ESI adjusted price when there is no sell price", () => {
    expect(priceOf({ sell: null, buy: 4, adjusted: 9 })).toBe(9);
  });
  it("is null when neither source has a price, and for an unknown type", () => {
    expect(priceOf({ sell: null, buy: 4, adjusted: null })).toBeNull();
    expect(priceOf(undefined)).toBeNull();
  });
});
```

Create `tests/db/market-prices.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { getPrices, upsertEsiPrices, upsertJitaPrices } from "../../src/lib/db/market-prices.js";

beforeAll(async () => { await resetDb(); }, 60_000);
afterAll(closePool);

describe("market_prices repo", () => {
  it("upserts ESI prices, then Jita prices, without either clearing the other", async () => {
    expect(await upsertEsiPrices([
      { typeId: 34, adjustedPrice: 4.2, averagePrice: 4.5 },
      { typeId: 587, adjustedPrice: 8_000_000, averagePrice: null },
    ])).toBe(2);
    expect(await upsertJitaPrices([{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }])).toBe(1);

    const prices = await getPrices([34, 587, 999999]);
    expect(prices.get(34)).toEqual({ sell: 3.85, buy: 3.67, adjusted: 4.2 });
    expect(prices.get(587)).toEqual({ sell: null, buy: null, adjusted: 8_000_000 });
    expect(prices.has(999999)).toBe(false);
  });

  it("overwrites an existing row and leaves the other source's columns alone", async () => {
    await upsertEsiPrices([{ typeId: 34, adjustedPrice: 4.9, averagePrice: 5.1 }]);
    expect((await getPrices([34])).get(34)).toEqual({ sell: 3.85, buy: 3.67, adjusted: 4.9 });
    await upsertJitaPrices([{ typeId: 34, sellMin: null, buyMax: null }]);
    expect((await getPrices([34])).get(34)).toEqual({ sell: null, buy: null, adjusted: 4.9 });
  });

  it("returns numbers, not the strings pg gives back for numeric", async () => {
    const price = (await getPrices([34])).get(34)!;
    expect(typeof price.adjusted).toBe("number");
  });

  it("no-ops on empty input", async () => {
    expect(await upsertEsiPrices([])).toBe(0);
    expect(await upsertJitaPrices([])).toBe(0);
    expect(await getPrices([])).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/price.test.ts tests/db/market-prices.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/price.js"` and the same for `market-prices.js`.

- [ ] **Step 3: Add the table to `db/schema.sql`**

Append at the end of the file:
```sql

-- Spec §3: two sources, one row per type. ESI /markets/prices supplies the reference values
-- (adjusted/average); Fuzzwork's Jita (region 10000002) aggregates supply the tradeable ones.
-- NULL means "that source has no price for this type" — never 0.
CREATE TABLE IF NOT EXISTS market_prices (
  type_id         int PRIMARY KEY,
  adjusted_price  numeric,
  average_price   numeric,
  jita_sell_min   numeric,
  jita_buy_max    numeric,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Write `src/lib/view/price.ts`**

```ts
/**
 * Pure price helpers. No imports at all, so a client component can use them without dragging `pg`
 * into the bundle; `src/lib/db/market-prices.ts` imports `Price` from here, not the other way round.
 */

/** One type's prices. `null` = that source has no price. */
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }

/**
 * Spec §3: `priceOf(p) = sell ?? adjusted ?? null`. The Jita sell minimum is what an item costs to
 * replace; ESI's adjusted price is the degraded fallback when Fuzzwork has nothing (or is down).
 */
export function priceOf(p: Price | undefined): number | null {
  if (p === undefined) return null;
  return p.sell ?? p.adjusted ?? null;
}
```

- [ ] **Step 5: Write `src/lib/db/market-prices.ts`**

```ts
import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type { Price } from "../view/price.js";

/** A row of ESI `GET /markets/prices`, already camelCased. */
export interface EsiPriceRow { typeId: number; adjustedPrice: number | null; averagePrice: number | null }
/** A row of Fuzzwork's Jita aggregates. */
export interface JitaPriceRow { typeId: number; sellMin: number | null; buyMax: number | null }

// /markets/prices returns ~15k rows in one response; insert them in batches like the asset repo.
const INSERT_BATCH = 2000;

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * Upserts only the two ESI columns, so a Fuzzwork run's values survive untouched (spec §3: a
 * Fuzzwork failure degrades prices to ESI's, never to nothing).
 */
export async function upsertEsiPrices(rows: EsiPriceRow[]): Promise<number> {
  let written = 0;
  for (const batch of chunk(rows, INSERT_BATCH)) {
    const res = await getPool().query(
      `INSERT INTO market_prices (type_id, adjusted_price, average_price, updated_at)
       SELECT *, now() FROM unnest($1::int[], $2::numeric[], $3::numeric[])
       ON CONFLICT (type_id) DO UPDATE SET adjusted_price = EXCLUDED.adjusted_price,
         average_price = EXCLUDED.average_price, updated_at = now()`,
      [batch.map((r) => r.typeId), batch.map((r) => r.adjustedPrice), batch.map((r) => r.averagePrice)]);
    written += res.rowCount ?? 0;
  }
  return written;
}

/** The mirror image: only the two Jita columns, so the ESI reference values survive. */
export async function upsertJitaPrices(rows: JitaPriceRow[]): Promise<number> {
  let written = 0;
  for (const batch of chunk(rows, INSERT_BATCH)) {
    const res = await getPool().query(
      `INSERT INTO market_prices (type_id, jita_sell_min, jita_buy_max, updated_at)
       SELECT *, now() FROM unnest($1::int[], $2::numeric[], $3::numeric[])
       ON CONFLICT (type_id) DO UPDATE SET jita_sell_min = EXCLUDED.jita_sell_min,
         jita_buy_max = EXCLUDED.jita_buy_max, updated_at = now()`,
      [batch.map((r) => r.typeId), batch.map((r) => r.sellMin), batch.map((r) => r.buyMax)]);
    written += res.rowCount ?? 0;
  }
  return written;
}

/** One query per page (spec §4). Types with no row at all are simply absent from the map. */
export async function getPrices(typeIds: number[]): Promise<Map<number, Price>> {
  const wanted = [...new Set(typeIds)];
  if (wanted.length === 0) return new Map();
  const { rows } = await getPool().query<{ typeId: number; sell: string | null; buy: string | null; adjusted: string | null }>(
    `SELECT type_id AS "typeId", jita_sell_min AS sell, jita_buy_max AS buy, adjusted_price AS adjusted
     FROM market_prices WHERE type_id = ANY($1::int[])`, [wanted]);
  return new Map(rows.map((r) => [r.typeId, { sell: num(r.sell), buy: num(r.buy), adjusted: num(r.adjusted) }]));
}
```

- [ ] **Step 6: Add `market_prices` to the two test fixtures that enumerate tables**

In `tests/db/helpers.ts`, the TRUNCATE in `resetDb` — `market_prices` has no foreign key to
`characters`, so `CASCADE` does not reach it and it must be listed explicitly:
```ts
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts, universe_names, structures, market_prices RESTART IDENTITY CASCADE");
```

In `tests/db/schema.test.ts`, the expected table list — insert `"market_prices",` between
`"esi_cache",` and `"sde_categories",` (the list is sorted):
```ts
      "character_wallet_journal", "character_wallet_transactions", "characters", "esi_cache",
      "market_prices",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/view/price.test.ts tests/db/market-prices.test.ts tests/db/schema.test.ts`
Expected: PASS (all three files).

- [ ] **Step 8: Commit**

```bash
git add db/schema.sql src/lib/db/market-prices.ts src/lib/view/price.ts \
        tests/db/market-prices.test.ts tests/db/helpers.ts tests/db/schema.test.ts tests/view/price.test.ts
git commit -m "$(cat <<'EOM'
Add the market_prices table, its repo and priceOf

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: The Fuzzwork aggregates client

Spec §3 and research §4: `https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=<csv>`, chunks of
500 type ids, `User-Agent: <ESI_USER_AGENT>`, **all numeric values are JSON strings**, and a type with no
orders answers with numeric `0`s — both shapes mean "no price" (`NULL`).

**Files:**
- Create: `src/lib/market/fuzzwork.ts`, `tests/market/fuzzwork.test.ts`

**Interfaces:**
- Consumes (Task 1 and phase 1, verbatim):
```ts
// src/lib/db/market-prices.ts (type-only import — erased at compile time)
export interface JitaPriceRow { typeId: number; sellMin: number | null; buyMax: number | null }
// src/lib/chunk.ts
export function chunk<T>(items: readonly T[], size: number): T[][]
// src/lib/config.ts
export function getConfig(): AppConfig                 // AppConfig.esiUserAgent: string
```
- Produces:
```ts
export const FUZZWORK_AGGREGATES_URL = "https://market.fuzzwork.co.uk/aggregates/";
export const JITA_REGION_ID = 10000002;
export const FUZZWORK_CHUNK = 500;
export function parsePrice(raw: unknown): number | null;
export function fetchAggregates(
  typeIds: number[], fetchImpl?: typeof fetch, userAgent?: string,
): Promise<JitaPriceRow[]>;
```

**Decisions recorded here (do not re-litigate them):**
- **Chunk size 500**, per spec §3. Research §4 measured the real ceiling as a URI-length limit around
  1300 ids (2000 → `414`); 500 keeps the URL near 3 KB with plenty of headroom.
- A type the response **omits** produces no row: we blank stored prices only when Fuzzwork explicitly
  reports no orders, never because a response was short.
- `userAgent` defaults to `getConfig().esiUserAgent` **lazily** (default parameters are evaluated per
  call), so a test that passes a user agent never touches the environment.
- A non-2xx response throws. The job above it turns that into the `warn:` outcome; this module does not
  know about `sync_runs`.

- [ ] **Step 1: Write the failing test**

Create `tests/market/fuzzwork.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { FUZZWORK_CHUNK, fetchAggregates, parsePrice } from "../../src/lib/market/fuzzwork.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("parsePrice", () => {
  it("parses the string values Fuzzwork sends", () => {
    expect(parsePrice("3.85")).toBe(3.85);
    expect(parsePrice("15207338606.0")).toBe(15207338606);
  });
  it("maps the empty-market shapes to null", () => {
    expect(parsePrice("0")).toBeNull();       // string zero — spec §3
    expect(parsePrice(0)).toBeNull();         // numeric zero — research §4, verified with PLEX
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("not a number")).toBeNull();
  });
});

describe("fetchAggregates", () => {
  it("asks Jita for one chunk, parses sell.min and buy.max, and sends the user agent", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      "34": { buy: { max: "3.67", min: "0.01" }, sell: { min: "3.85", max: "38420.0" } },
      "587": { buy: { max: "0" }, sell: { min: "0" } },
    }));
    const rows = await fetchAggregates([34, 587], fetchImpl as unknown as typeof fetch, "EVE/0.1 dac9dc@gmail.com");

    expect(rows).toEqual([
      { typeId: 34, sellMin: 3.85, buyMax: 3.67 },
      { typeId: 587, sellMin: null, buyMax: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=34,587");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("EVE/0.1 dac9dc@gmail.com");
  });

  it("chunks at 500 ids per request and deduplicates", async () => {
    const ids = [...Array(1201).keys()].map((i) => i + 1);
    const seen: number[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const types = new URL(url).searchParams.get("types")!.split(",");
      seen.push(types.length);
      return jsonResponse(Object.fromEntries(types.map((t) => [t, { sell: { min: "1.5" }, buy: { max: "1.0" } }])));
    });
    const rows = await fetchAggregates([...ids, 1, 2], fetchImpl as unknown as typeof fetch, "ua");
    expect(FUZZWORK_CHUNK).toBe(500);
    expect(seen).toEqual([500, 500, 201]);
    expect(rows).toHaveLength(1201);
    expect(rows[0]).toEqual({ typeId: 1, sellMin: 1.5, buyMax: 1 });
  });

  it("skips a type the response leaves out rather than blanking it", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ "34": { sell: { min: "3.85" }, buy: { max: "3.67" } } }));
    expect(await fetchAggregates([34, 44992], fetchImpl as unknown as typeof fetch, "ua"))
      .toEqual([{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }]);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("Request-URI Too Large", { status: 414 }));
    await expect(fetchAggregates([34], fetchImpl as unknown as typeof fetch, "ua")).rejects.toThrow(/414/);
  });

  it("does not call fetch at all for an empty type list", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    expect(await fetchAggregates([], fetchImpl as unknown as typeof fetch, "ua")).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/market/fuzzwork.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/market/fuzzwork.js"`.

- [ ] **Step 3: Write `src/lib/market/fuzzwork.ts`**

```ts
import { chunk } from "../chunk.js";
import { getConfig } from "../config.js";
import type { JitaPriceRow } from "../db/market-prices.js";

/**
 * Fuzzwork's precalculated market aggregates (research §4). One request replaces ~371 pages of
 * ESI `/markets/{region}/orders`, which is why the spec picks it for "what is this worth".
 * It is one person's server with no SLA, so the caller must tolerate failure.
 */
export const FUZZWORK_AGGREGATES_URL = "https://market.fuzzwork.co.uk/aggregates/";
/** The Forge — the region Jita is in (research §4, verified). */
export const JITA_REGION_ID = 10000002;
/**
 * Spec §3. The real limit is URI length, not a type count: 1300 ids answered 200 and 2000 earned a
 * `414 Request-URI Too Large` (research §4), so 500 leaves generous headroom.
 */
export const FUZZWORK_CHUNK = 500;

interface Side { min?: unknown; max?: unknown }
interface Aggregate { buy?: Side; sell?: Side }

/**
 * Every value is a JSON **string** ("3.85"); a type with no orders comes back as numeric `0`s
 * instead (both shapes verified in research §4). Either way, no price means NULL, not zero.
 */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Jita sell minimum and buy maximum for each requested type, in chunks of `FUZZWORK_CHUNK`.
 * Types missing from a response are skipped, so a short answer never blanks stored prices.
 * Throws on a non-2xx response; the `market-prices` job turns that into a `warn:` run.
 */
export async function fetchAggregates(
  typeIds: number[],
  fetchImpl: typeof fetch = fetch,
  userAgent: string = getConfig().esiUserAgent,
): Promise<JitaPriceRow[]> {
  const out: JitaPriceRow[] = [];
  for (const batch of chunk([...new Set(typeIds)], FUZZWORK_CHUNK)) {
    const url = `${FUZZWORK_AGGREGATES_URL}?region=${JITA_REGION_ID}&types=${batch.join(",")}`;
    const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": userAgent } });
    if (!res.ok) throw new Error(`Fuzzwork ${res.status} for ${batch.length} types`);
    const body = (await res.json()) as Record<string, Aggregate>;
    for (const typeId of batch) {
      const aggregate = body[String(typeId)];
      if (aggregate === undefined) continue;
      out.push({ typeId, sellMin: parsePrice(aggregate.sell?.min), buyMax: parsePrice(aggregate.buy?.max) });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/market/fuzzwork.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/market/fuzzwork.ts tests/market/fuzzwork.test.ts
git commit -m "$(cat <<'EOM'
Add the Fuzzwork Jita aggregates client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: `typesOfInterest` — the types worth a Jita price

Spec §3: the distinct `type_id`s across `character_assets`, `character_fitting_items`,
`character_fittings.ship_type_id` and `character_wallet_transactions` from the last 30 days. **One SQL
statement** — the union and the deduplication happen in Postgres, not in the process.

**Files:**
- Create: `src/lib/market/interest.ts`, `tests/db/market-interest.test.ts`

**Interfaces:**
- Consumes (phase 1, verbatim): `getPool(): Pool` from `src/lib/db/client.ts`.
- Produces:
```ts
export const INTEREST_TRANSACTION_DAYS = 30;
export function typesOfInterest(): Promise<number[]>;      // distinct, ascending
```

- [ ] **Step 1: Write the failing test**

Create `tests/db/market-interest.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { typesOfInterest } from "../../src/lib/market/interest.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);

describe("typesOfInterest", () => {
  it("is empty on an empty database", async () => {
    expect(await typesOfInterest()).toEqual([]);
  });

  it("unions assets, fitting items, fitting hulls and recent transactions", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'Trill', 'enc')");
    await pool.query(
      `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag)
       VALUES (1, 100, 587, 1, 60003760, 'station', 'Hangar'), (1, 101, 519, 1, 100, 'item', 'LoSlot0')`);
    await pool.query(
      "INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES (1, 7, 'Fit', '', 626)");
    await pool.query(
      `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
       VALUES (1, 7, 0, 2889, 1, 'HiSlot0')`);
    await pool.query(
      `INSERT INTO character_wallet_transactions (character_id, transaction_id, date, type_id, quantity, unit_price)
       VALUES (1, 900, now() - interval '5 days', 34, 1000, 3.85),
              (1, 901, now() - interval '40 days', 35, 1000, 8.10)`);

    // 35 was traded 40 days ago, outside the 30-day window; everything else is in.
    expect(await typesOfInterest()).toEqual([34, 519, 587, 626, 2889]);
  });

  it("deduplicates a type that appears in several places", async () => {
    await pool.query(
      `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag)
       VALUES (1, 102, 34, 500, 60003760, 'station', 'Hangar')`);
    const ids = await typesOfInterest();
    expect(ids.filter((id) => id === 34)).toEqual([34]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/market-interest.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/market/interest.js"`.

- [ ] **Step 3: Write `src/lib/market/interest.ts`**

```ts
import { getPool } from "../db/client.js";

/** Spec §3: transactions older than this stop being worth a price lookup. */
export const INTEREST_TRANSACTION_DAYS = 30;

/**
 * The types the Jita half of the price job fetches (spec §3): everything the characters own,
 * everything in a saved fit (items *and* hulls) and everything traded recently. One statement —
 * `UNION` deduplicates in Postgres, so nothing is pulled into the process to be sorted by hand.
 * With four characters this is a few thousand ids, i.e. a handful of Fuzzwork requests.
 */
export async function typesOfInterest(): Promise<number[]> {
  const { rows } = await getPool().query<{ typeId: number }>(
    `SELECT type_id AS "typeId" FROM character_assets
     UNION SELECT type_id FROM character_fitting_items
     UNION SELECT ship_type_id FROM character_fittings
     UNION SELECT type_id FROM character_wallet_transactions
       WHERE date > now() - ($1::int * interval '1 day')
     ORDER BY 1`,
    [INTEREST_TRANSACTION_DAYS]);
  return rows.map((r) => r.typeId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/db/market-interest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/market/interest.ts tests/db/market-interest.test.ts
git commit -m "$(cat <<'EOM'
Add typesOfInterest for the Jita price lookup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: Job warnings — an `ok` run that carries a `warn:` message

Spec §3: "Fuzzwork failure leaves ESI prices in place and records the run as `ok` with a warning in the
error column prefixed `warn:`". Today `SyncJob.run` returns `Promise<number>` and the scheduler writes
`finishRun(id, { status: "ok", rows })` with no way to say anything else. This task widens the return type
to `number | JobOutcome` and teaches `/settings` to render a warning in amber rather than red.

**Files:**
- Modify: `src/worker/scheduler.ts` (the two job interfaces, `record`), `src/lib/view/format.ts` (append), `src/app/settings/SyncStatus.tsx`, `src/app/globals.css`
- Modify (tests): `tests/worker/scheduler.test.ts`, `tests/view/format.test.ts`, `tests/components/sync-status.test.tsx`

**Interfaces:**
- Consumes (phase 1/2, verbatim):
```ts
// src/lib/db/sync-runs.ts
export interface SyncRunSummary { job: string; characterId: number | null; startedAt: Date; finishedAt: Date | null; status: "running" | "ok" | "error"; rows: number | null; error: string | null }
export async function finishRun(id: number, r: { status: "ok" | "error"; rows?: number; error?: string }): Promise<void>
```
- Produces:
```ts
// src/worker/scheduler.ts
export interface JobOutcome { rows: number; warn?: string }
// CharacterSyncJob.run(ctx: JobContext): Promise<number | JobOutcome>
// GlobalSyncJob.run(ctx: GlobalJobContext): Promise<number | JobOutcome>

// src/lib/view/format.ts
export const WARN_PREFIX = "warn: ";
export function isWarning(error: string | null): boolean;
```

**Decisions recorded here (do not re-litigate them):**
- `WARN_PREFIX` lives in `src/lib/view/format.ts`, which has **zero imports**, so both the worker (which
  writes the prefix) and the settings page (which reads it) share one literal and cannot drift. The
  scheduler importing a `view` module is deliberate: it is a display convention for a DB column.
- A warning does **not** change the rebooking: the run is `ok`, so the job waits `intervalMs`, not `retryMs`.
- Returning a bare `number` stays valid — every existing job is untouched.

- [ ] **Step 1: Write the failing tests**

In `tests/worker/scheduler.test.ts`, add these two cases inside `describe("Scheduler", …)`:
```ts
  it("records a warning outcome as ok, prefixing the error column", async () => {
    const run = vi.fn(async () => ({ rows: 5, warn: "fuzzwork 503 for 900 types" }));
    const { s, finished } = make([{ name: "g", scope: "global", intervalMs: 60_000, retryMs: 10_000, run }], []);
    expect(await s.tick()).toBe(1);
    expect(finished).toEqual([{ id: 1, status: "ok", rows: 5, error: "warn: fuzzwork 503 for 900 types" }]);
  });

  it("reboots a warned run on the full interval, not the retry interval", async () => {
    const run = vi.fn(async () => ({ rows: 1, warn: "partial" }));
    const { s, advance } = make([{ name: "g", scope: "global", intervalMs: 60_000, retryMs: 10_000, run }], []);
    await s.tick();
    advance(10_001); expect(await s.tick()).toBe(0);      // retryMs would have fired here
    advance(50_000); expect(await s.tick()).toBe(1);      // intervalMs did
  });
```

In `tests/view/format.test.ts`, extend the existing import on line 2 to
```ts
import { WARN_PREFIX, grouped, isWarning, isk, sp, roman, relativeTime, secClass, secText, stamp, trainingLabel } from "../../src/lib/view/format.js";
```
and add:
```ts
describe("isWarning", () => {
  it("recognises the scheduler's warning prefix", () => {
    expect(WARN_PREFIX).toBe("warn: ");
    expect(isWarning("warn: fuzzwork 503")).toBe(true);
  });
  it("treats a real error and a missing message as not-a-warning", () => {
    expect(isWarning("ESI 500 for /markets/prices")).toBe(false);
    expect(isWarning(null)).toBe(false);
  });
});
```

In `tests/components/sync-status.test.tsx`, add:
```ts
  it("shows a warning row in amber and a real error in red", () => {
    const { container } = render(<SyncStatus
      runs={[
        { job: "market-prices", characterId: null, startedAt: new Date(), finishedAt: new Date(), status: "ok", rows: 12, error: "warn: fuzzwork 503" },
        { job: "skills", characterId: 1, startedAt: new Date(), finishedAt: new Date(), status: "error", rows: null, error: "boom" },
      ]}
      names={{ 1: "TrilliumONE" }} />);
    expect(screen.getByText("warn: fuzzwork 503")).toHaveClass("warn-text");
    expect(screen.getByText("boom")).toHaveClass("neg");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/worker/scheduler.test.ts tests/view/format.test.ts tests/components/sync-status.test.tsx`
Expected: FAIL — the scheduler test reports `error: undefined` instead of the prefixed message,
`isWarning` is not exported, and the warning cell still has class `neg`.

- [ ] **Step 3: Append the two helpers to `src/lib/view/format.ts`**

```ts
/**
 * A job that partly succeeded records `ok` and puts its message in `sync_runs.error` behind this
 * prefix (spec §3). The worker's scheduler writes it and the settings page reads it, so the literal
 * lives here — in the one module with no imports at all — rather than in either of them.
 */
export const WARN_PREFIX = "warn: ";

export function isWarning(error: string | null): boolean {
  return error !== null && error.startsWith(WARN_PREFIX);
}
```

- [ ] **Step 4: Widen the job contract in `src/worker/scheduler.ts`**

Add the import at the top of the file, after the existing imports:
```ts
import { WARN_PREFIX } from "../lib/view/format.js";
```

Add the outcome type above `CharacterSyncJob`:
```ts
/**
 * What a job's `run` may return. A bare number is "everything worked, this many rows"; the object
 * form adds a non-fatal warning — the run still counts as `ok` and still waits the full interval,
 * but the message is written to `sync_runs.error` behind `WARN_PREFIX` so `/settings` can show it
 * (spec §3: a Fuzzwork outage degrades prices, it does not fail the run).
 */
export interface JobOutcome { rows: number; warn?: string }
```

Change both `run` signatures:
```ts
  run(ctx: JobContext): Promise<number | JobOutcome>;         // CharacterSyncJob
  run(ctx: GlobalJobContext): Promise<number | JobOutcome>;   // GlobalSyncJob
```

Replace the body of `record` (only the `exec` type and the try-block change):
```ts
  private async record(name: string, characterId: number | null, exec: () => Promise<number | JobOutcome>): Promise<"ok" | "error"> {
    const who = characterId === null ? "global" : `character=${characterId}`;
    const id = await this.deps.startRun(name, characterId);
    try {
      const outcome = await exec();
      const { rows, warn } = typeof outcome === "number" ? { rows: outcome, warn: undefined } : outcome;
      const error = warn === undefined ? undefined : `${WARN_PREFIX}${warn}`;
      await this.deps.finishRun(id, { status: "ok", rows, error });
      this.log(`${name} ${who} ok rows=${rows}${error === undefined ? "" : ` (${error})`}`);
      return "ok";
    } catch (e) {
```
(The `catch` block is unchanged.)

- [ ] **Step 5: Colour a warning in `src/app/settings/SyncStatus.tsx`**

```tsx
import type { SyncRunSummary } from "../../lib/db/sync-runs.js";
import { isWarning } from "../../lib/view/format.js";
export function SyncStatus({ runs, names }: { runs: SyncRunSummary[]; names: Record<number, string> }) {
```
and the error cell:
```tsx
            <td className={isWarning(r.error) ? "warn-text" : "neg"}>{r.error ?? ""}</td>
```

- [ ] **Step 6: Add the class to `src/app/globals.css`**

Append at the end of the file:
```css

/* ---------- Ships & market (phase 4) ---------- */
.warn-text { color: var(--warn); }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/worker tests/view/format.test.ts tests/components/sync-status.test.tsx && npm run typecheck`
Expected: PASS, and `tsc --noEmit` clean — the widened return type must not break any existing job.

- [ ] **Step 8: Commit**

```bash
git add src/worker/scheduler.ts src/lib/view/format.ts src/app/settings/SyncStatus.tsx src/app/globals.css \
        tests/worker/scheduler.test.ts tests/view/format.test.ts tests/components/sync-status.test.tsx
git commit -m "$(cat <<'EOM'
Let a sync job report a non-fatal warning on an ok run

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: The `market-prices` global job

Spec §3: every hour, `GET /markets/prices` (public, no character) upserts the reference prices for every
type, then the types of interest get their Jita prices from Fuzzwork. Fuzzwork failing is a warning, ESI
failing is an error. Follows the phase-2 `sde-update` dependency-injection shape exactly.

**Files:**
- Create: `src/worker/jobs/market-prices.ts`, `tests/worker/market-prices.test.ts`
- Modify: `src/worker/jobs/index.ts`, `tests/worker/registration.test.ts`

**Interfaces:**
- Consumes (Tasks 1–4 and phase 1/3a, verbatim):
```ts
// src/worker/scheduler.ts
export interface GlobalJobContext { esi: EsiClient }
export interface GlobalSyncJob {
  name: string; scope: "global"; intervalMs: number; retryMs?: number;
  run(ctx: GlobalJobContext): Promise<number | JobOutcome>;
}
export interface JobOutcome { rows: number; warn?: string }
// src/lib/esi/client.ts — `characterId` omitted ⇒ a public, unauthenticated call
async get<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number>; page?: number; fresh?: boolean }): Promise<EsiResult<T>>
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean; lastModified: string | null }
// src/lib/db/market-prices.ts (Task 1)
export interface EsiPriceRow { typeId: number; adjustedPrice: number | null; averagePrice: number | null }
export interface JitaPriceRow { typeId: number; sellMin: number | null; buyMax: number | null }
export function upsertEsiPrices(rows: EsiPriceRow[]): Promise<number>
export function upsertJitaPrices(rows: JitaPriceRow[]): Promise<number>
// src/lib/market/fuzzwork.ts (Task 2)
export function fetchAggregates(typeIds: number[], fetchImpl?: typeof fetch, userAgent?: string): Promise<JitaPriceRow[]>
// src/lib/market/interest.ts (Task 3)
export function typesOfInterest(): Promise<number[]>
```
- Produces:
```ts
export const MARKET_PRICES_INTERVAL_MS = 60 * 60 * 1000;
export const MARKET_PRICES_RETRY_MS = 10 * 60 * 1000;
export interface EsiMarketPrice { type_id: number; adjusted_price?: number; average_price?: number }
export function toEsiPriceRow(p: EsiMarketPrice): EsiPriceRow;
export const REAL_FETCH_ESI_PRICES: (esi: EsiClient) => Promise<EsiPriceRow[]>;
export interface MarketPricesDeps {
  fetchEsiPrices: (esi: EsiClient) => Promise<EsiPriceRow[]>;
  typesOfInterest: () => Promise<number[]>;
  fetchAggregates: (typeIds: number[]) => Promise<JitaPriceRow[]>;
  upsertEsiPrices: (rows: EsiPriceRow[]) => Promise<number>;
  upsertJitaPrices: (rows: JitaPriceRow[]) => Promise<number>;
  log?: (msg: string) => void;
}
export function createMarketPricesJob(deps: MarketPricesDeps): GlobalSyncJob;
export const marketPricesJob: GlobalSyncJob;
```

**Decisions recorded here (do not re-litigate them):**
- **1 h interval, 10 min retry** (spec §3 for the interval; the retry mirrors `sde-update`, and the
  registration test asserts every job's `retryMs < intervalMs`).
- `/markets/prices` is called **without** `characterId`, so `EsiClient` sends no `Authorization` header
  and caches under `character_id = 0`. Its `Expires` header is one hour (research §4), which lines up
  with the interval — a tick that lands inside the window is answered from `esi_cache` for free.
- The ESI half runs **first and unconditionally**; the Fuzzwork half is skipped when nothing is of
  interest yet (a fresh database with no assets), which is a plain `ok`, not a warning.
- `rows` is the sum of both upserts' row counts, so `/settings` shows real work.

- [ ] **Step 1: Write the failing test**

Create `tests/worker/market-prices.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import {
  MARKET_PRICES_INTERVAL_MS, MARKET_PRICES_RETRY_MS, REAL_FETCH_ESI_PRICES, createMarketPricesJob,
  marketPricesJob, toEsiPriceRow, type MarketPricesDeps,
} from "../../src/worker/jobs/market-prices.js";
import { fetchAggregates } from "../../src/lib/market/fuzzwork.js";
import type { EsiClient } from "../../src/lib/esi/client.js";
import type { JobOutcome } from "../../src/worker/scheduler.js";

const ESI_PRICES = [
  { typeId: 34, adjustedPrice: 4.2, averagePrice: 4.5 },
  { typeId: 587, adjustedPrice: 8_000_000, averagePrice: null },
];

function deps(over: Partial<MarketPricesDeps> = {}): MarketPricesDeps {
  return {
    fetchEsiPrices: vi.fn(async () => ESI_PRICES),
    typesOfInterest: vi.fn(async () => [34, 587]),
    fetchAggregates: vi.fn(async () => [{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }]),
    upsertEsiPrices: vi.fn(async (rows) => rows.length),
    upsertJitaPrices: vi.fn(async (rows) => rows.length),
    log: () => {},
    ...over,
  };
}

const esi = {} as EsiClient;

describe("market-prices job", () => {
  it("is an hourly global job that retries after ten minutes", () => {
    expect(marketPricesJob.name).toBe("market-prices");
    expect(marketPricesJob.scope).toBe("global");
    expect(marketPricesJob.intervalMs).toBe(MARKET_PRICES_INTERVAL_MS);
    expect(MARKET_PRICES_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(marketPricesJob.retryMs).toBe(MARKET_PRICES_RETRY_MS);
    expect(MARKET_PRICES_RETRY_MS).toBe(10 * 60 * 1000);
  });

  it("maps an ESI /markets/prices entry, defaulting the optional fields to null", () => {
    expect(toEsiPriceRow({ type_id: 34, adjusted_price: 4.2, average_price: 4.5 }))
      .toEqual({ typeId: 34, adjustedPrice: 4.2, averagePrice: 4.5 });
    expect(toEsiPriceRow({ type_id: 44992 })).toEqual({ typeId: 44992, adjustedPrice: null, averagePrice: null });
  });

  it("writes ESI prices, then Jita prices for the types of interest, and sums the rows", async () => {
    const d = deps();
    expect(await createMarketPricesJob(d).run({ esi })).toBe(3);          // 2 ESI + 1 Jita
    expect(d.fetchEsiPrices).toHaveBeenCalledWith(esi);
    expect(d.upsertEsiPrices).toHaveBeenCalledWith(ESI_PRICES);
    expect(d.fetchAggregates).toHaveBeenCalledWith([34, 587]);
    expect(d.upsertJitaPrices).toHaveBeenCalledWith([{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }]);
  });

  it("skips Fuzzwork entirely when nothing is of interest yet", async () => {
    const d = deps({ typesOfInterest: vi.fn(async () => []) });
    expect(await createMarketPricesJob(d).run({ esi })).toBe(2);
    expect(d.fetchAggregates).not.toHaveBeenCalled();
  });

  it("returns a warning instead of failing when Fuzzwork is down, keeping the ESI prices", async () => {
    const d = deps({ fetchAggregates: vi.fn(async () => { throw new Error("Fuzzwork 503 for 2 types"); }) });
    const outcome = (await createMarketPricesJob(d).run({ esi })) as JobOutcome;
    expect(outcome.rows).toBe(2);
    expect(outcome.warn).toMatch(/Fuzzwork 503/);
    expect(d.upsertEsiPrices).toHaveBeenCalledTimes(1);
    expect(d.upsertJitaPrices).not.toHaveBeenCalled();
  });

  it("propagates an ESI failure as a real error and writes nothing", async () => {
    const d = deps({ fetchEsiPrices: vi.fn(async () => { throw new Error("ESI 500 for /markets/prices"); }) });
    await expect(createMarketPricesJob(d).run({ esi })).rejects.toThrow(/ESI 500/);
    expect(d.upsertEsiPrices).not.toHaveBeenCalled();
    expect(d.fetchAggregates).not.toHaveBeenCalled();
  });

  it("calls /markets/prices publicly — no characterId, so no Authorization header", async () => {
    const get = vi.fn(async () => ({ data: [{ type_id: 34, adjusted_price: 4.2 }], status: 200, pages: 1, fromCache: false, lastModified: null }));
    const rows = await REAL_FETCH_ESI_PRICES({ get } as unknown as EsiClient);
    expect(get).toHaveBeenCalledWith("/markets/prices");
    expect(rows).toEqual([{ typeId: 34, adjustedPrice: 4.2, averagePrice: null }]);
  });

  it("passes the interest list through the real Fuzzwork client", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ "34": { sell: { min: "3.85" }, buy: { max: "3.67" } } }), { status: 200 }));
    const d = deps({ fetchAggregates: (ids) => fetchAggregates(ids, fetchImpl as unknown as typeof fetch, "ua") });
    expect(await createMarketPricesJob(d).run({ esi })).toBe(3);
    expect(new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]).searchParams.get("types")).toBe("34,587");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/market-prices.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/market-prices.js"`.

- [ ] **Step 3: Write `src/worker/jobs/market-prices.ts`**

```ts
import type { EsiClient } from "../../lib/esi/client.js";
import type { GlobalSyncJob, JobOutcome } from "../scheduler.js";
import { fetchAggregates } from "../../lib/market/fuzzwork.js";
import { typesOfInterest } from "../../lib/market/interest.js";
import {
  upsertEsiPrices, upsertJitaPrices, type EsiPriceRow, type JitaPriceRow,
} from "../../lib/db/market-prices.js";

/** Spec §3. ESI caches /markets/prices for an hour, so the interval and the cache line up exactly. */
export const MARKET_PRICES_INTERVAL_MS = 60 * 60 * 1000;
export const MARKET_PRICES_RETRY_MS = 10 * 60 * 1000;

/** One entry of `GET /markets/prices`; both price fields are optional (research §4). */
export interface EsiMarketPrice { type_id: number; adjusted_price?: number; average_price?: number }

export function toEsiPriceRow(p: EsiMarketPrice): EsiPriceRow {
  return { typeId: p.type_id, adjustedPrice: p.adjusted_price ?? null, averagePrice: p.average_price ?? null };
}

/**
 * The real ESI half, exported so the test can prove the call is public (no `characterId`, therefore
 * no `Authorization` header and a shared `character_id = 0` cache row).
 */
export const REAL_FETCH_ESI_PRICES = async (esi: EsiClient): Promise<EsiPriceRow[]> => {
  const res = await esi.get<EsiMarketPrice[]>("/markets/prices");
  return res.data.map(toEsiPriceRow);
};

/** Every side effect is injected so the job is unit-tested with fakes, exactly like `sde-update`. */
export interface MarketPricesDeps {
  fetchEsiPrices: (esi: EsiClient) => Promise<EsiPriceRow[]>;
  typesOfInterest: () => Promise<number[]>;
  fetchAggregates: (typeIds: number[]) => Promise<JitaPriceRow[]>;
  upsertEsiPrices: (rows: EsiPriceRow[]) => Promise<number>;
  upsertJitaPrices: (rows: JitaPriceRow[]) => Promise<number>;
  log?: (msg: string) => void;
}

/**
 * ESI first (one request, ~1.1 MB, every market type in the game), then Fuzzwork for the types of
 * interest. An ESI failure propagates and the scheduler records an `error` run; a Fuzzwork failure
 * comes back as a `JobOutcome` warning instead, because the ESI prices already written are a valid
 * — if less accurate — answer (spec §3).
 */
export function createMarketPricesJob(deps: MarketPricesDeps): GlobalSyncJob {
  const log = deps.log ?? ((): void => {});
  return {
    name: "market-prices",
    scope: "global",
    intervalMs: MARKET_PRICES_INTERVAL_MS,
    retryMs: MARKET_PRICES_RETRY_MS,
    async run({ esi }): Promise<number | JobOutcome> {
      const esiRows = await deps.fetchEsiPrices(esi);
      let rows = await deps.upsertEsiPrices(esiRows);
      log(`market-prices: ${rows} ESI reference prices`);

      const typeIds = await deps.typesOfInterest();
      if (typeIds.length === 0) {
        log("market-prices: nothing of interest yet, skipping Fuzzwork");
        return rows;
      }
      try {
        const jita = await deps.fetchAggregates(typeIds);
        rows += await deps.upsertJitaPrices(jita);
        log(`market-prices: ${jita.length} Jita aggregates for ${typeIds.length} types of interest`);
      } catch (e) {
        const message = (e as Error).message ?? String(e);
        log(`market-prices: Fuzzwork failed, keeping ESI prices: ${message}`);
        return { rows, warn: `Fuzzwork aggregates failed for ${typeIds.length} types: ${message}` };
      }
      return rows;
    },
  };
}

export const marketPricesJob: GlobalSyncJob = createMarketPricesJob({
  fetchEsiPrices: REAL_FETCH_ESI_PRICES,
  typesOfInterest: () => typesOfInterest(),
  fetchAggregates: (typeIds) => fetchAggregates(typeIds),
  upsertEsiPrices: (rows) => upsertEsiPrices(rows),
  upsertJitaPrices: (rows) => upsertJitaPrices(rows),
  log: (msg) => console.log(`[worker] ${msg}`),
});
```

- [ ] **Step 4: Register the job in `src/worker/jobs/index.ts`**

```ts
import type { SyncJob } from "../scheduler.js";
import { sdeUpdateJob } from "./sde-update.js";
import { marketPricesJob } from "./market-prices.js";
import { characterInfoJob } from "./character-info.js";
import { skillsJob } from "./skills.js";
import { clonesJob } from "./clones.js";
import { assetsJob } from "./assets.js";
import { fittingsJob } from "./fittings.js";
import { walletJob } from "./wallet.js";
import { locationJob } from "./location.js";

/**
 * Registration order. The two global jobs come first so a fresh database imports the SDE and pulls
 * prices on the very first tick; the character jobs are staggered by the scheduler, so with 7 jobs
 * x 4 characters the per-tick fan-out stays small.
 */
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, marketPricesJob, characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob, walletJob, locationJob,
];
```

- [ ] **Step 5: Update `tests/worker/registration.test.ts`**

Three assertions change — the name list, the global count and the interval table:
```ts
  it("registers the two global jobs plus the seven character jobs, globals first", () => {
    expect(ALL_JOBS.map((j) => j.name)).toEqual([
      "sde-update", "market-prices", "character-info", "skills", "clones", "assets", "fittings", "wallet", "location",
    ]);
    expect(ALL_JOBS[0].scope).toBe("global");
    expect(ALL_JOBS[1].scope).toBe("global");
  });
```
in the interval test, add:
```ts
    expect(byName.get("market-prices")).toBe(60 * 60 * 1000);
```
and in the scope test:
```ts
  it("marks exactly two jobs global; the other seven run per character", () => {
    expect(ALL_JOBS.filter(isGlobal)).toHaveLength(2);
    const characterJobs = ALL_JOBS.filter((j): j is CharacterSyncJob => !isGlobal(j));
    expect(characterJobs).toHaveLength(7);
    for (const job of characterJobs) expect(job.scope ?? "character").toBe("character");
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/worker && npm run typecheck`
Expected: PASS — including `registration.test.ts`'s "unique name, positive interval, shorter retry" check,
which `market-prices` satisfies (10 min < 1 h).

- [ ] **Step 7: Commit**

```bash
git add src/worker/jobs/market-prices.ts src/worker/jobs/index.ts \
        tests/worker/market-prices.test.ts tests/worker/registration.test.ts
git commit -m "$(cat <<'EOM'
Add the hourly market-prices job (ESI reference + Fuzzwork Jita)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: Ship bonuses — `getTypeBonuses` (**new — phase 2 imports the table but never reads it**) and `bonusLabel`

The fit sheet's header shows the hull's bonuses with the character's level of each bonus skill (spec §4).
Phase 2 imports `sde_type_bonuses` but `src/lib/sde/repo.ts` has no reader for it, so this task adds one.
The stored `bonus_text` is CCP's English string **with `showinfo` anchors in it**
(`bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire`), so the display helper strips
the markup and puts the value in front.

**Files:**
- Modify: `src/lib/sde/repo.ts` (append), `tests/db/sde-repo.test.ts` (append a `describe`)
- Create: `src/lib/view/ships.ts`, `tests/view/ships.test.ts`

**Interfaces:**
- Consumes (phase 1/2, verbatim):
```ts
// src/lib/db/client.ts
export function getPool(): Pool
// src/lib/sde/ddl.ts — the table this reads (phase 2)
//   sde_type_bonuses(type_id int, idx int, kind text CHECK (kind IN ('skill','role','misc')),
//                    skill_type_id int, importance int, bonus float8, bonus_text text, unit_id int,
//                    PRIMARY KEY (type_id, idx))
```
- Produces:
```ts
// src/lib/sde/repo.ts
export interface SdeTypeBonus {
  idx: number; kind: "skill" | "role" | "misc" | null; skillTypeId: number | null;
  importance: number | null; bonus: number | null; bonusText: string | null; unitId: number | null;
}
export function getTypeBonuses(typeId: number): Promise<SdeTypeBonus[]>;   // ordered by idx

// src/lib/view/ships.ts
export function stripBonusMarkup(text: string): string;
export function bonusLabel(b: { bonus: number | null; bonusText: string | null; unitId: number | null }): string;
```

**Decisions recorded here (do not re-litigate them):**
- Unit ids **105 (Percentage), 109 (Modifier Percent) and 127 (Absolute Percent)** all display as `%`
  (verified in `dogmaUnits` in `tests/fixtures/sde-mini.zip`); any other unit renders the bare number.
- The reader is per-type, not batched, because a fit sheet shows exactly one hull. The `/ships` list
  does not show bonuses at all.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/sde-repo.test.ts` (and add `getTypeBonuses` to the existing import from
`../../src/lib/sde/repo.js`):
```ts
describe("type bonuses", () => {
  it("reads the Rifter's two skill bonuses in file order", async () => {
    expect(await getTypeBonuses(587)).toEqual([
      {
        idx: 0, kind: "skill", skillTypeId: 3329, importance: 1, bonus: 7.5, unitId: 105,
        bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire",
      },
      {
        idx: 1, kind: "skill", skillTypeId: 3329, importance: 2, bonus: 10, unitId: 105,
        bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff",
      },
    ]);
  });

  it("returns an empty list for a type with no bonuses", async () => {
    expect(await getTypeBonuses(519)).toEqual([]);
    expect(await getTypeBonuses(999999)).toEqual([]);
  });
});
```

Create `tests/view/ships.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { bonusLabel, stripBonusMarkup } from "../../src/lib/view/ships.js";

describe("stripBonusMarkup", () => {
  it("removes the SDE's showinfo anchors", () => {
    expect(stripBonusMarkup("bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire"))
      .toBe("bonus to Small Projectile Turret rate of fire");
  });
  it("leaves plain text alone", () => {
    expect(stripBonusMarkup("Can fit Covert Ops Cloaking Devices")).toBe("Can fit Covert Ops Cloaking Devices");
  });
});

describe("bonusLabel", () => {
  it("puts a percentage in front of the stripped text", () => {
    expect(bonusLabel({
      bonus: 7.5, unitId: 105,
      bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire",
    })).toBe("7.5% bonus to Small Projectile Turret rate of fire");
  });
  it("renders a non-percentage unit as a bare number", () => {
    expect(bonusLabel({ bonus: 3, unitId: 1, bonusText: "extra <a href=showinfo:1>metres</a>" }))
      .toBe("3 extra metres");
  });
  it("renders a role bonus with no numeric value as just its text", () => {
    expect(bonusLabel({ bonus: null, unitId: null, bonusText: "Can fit Covert Ops Cloaking Devices" }))
      .toBe("Can fit Covert Ops Cloaking Devices");
  });
  it("survives a bonus with no text at all", () => {
    expect(bonusLabel({ bonus: 5, unitId: 105, bonusText: null })).toBe("5%");
    expect(bonusLabel({ bonus: null, unitId: null, bonusText: null })).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/ships.test.ts tests/db/sde-repo.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/ships.js"`, and
`getTypeBonuses is not a function`.

- [ ] **Step 3: Append the reader to `src/lib/sde/repo.ts`**

Add the interface next to the other exported interfaces at the top:
```ts
export interface SdeTypeBonus {
  idx: number; kind: "skill" | "role" | "misc" | null; skillTypeId: number | null;
  importance: number | null; bonus: number | null; bonusText: string | null; unitId: number | null;
}
```
and the reader at the end of the file:
```ts
/**
 * A hull's traits (spec §4): the per-skill bonuses first, in the SDE's own order, then role and misc
 * bonuses. `bonus_text` is CCP's English string and still carries `showinfo` anchors — see
 * `bonusLabel` in `src/lib/view/ships.ts` for the display side.
 */
export async function getTypeBonuses(typeId: number): Promise<SdeTypeBonus[]> {
  const { rows } = await getPool().query<SdeTypeBonus>(
    `SELECT idx, kind, skill_type_id AS "skillTypeId", importance, bonus,
            bonus_text AS "bonusText", unit_id AS "unitId"
     FROM sde_type_bonuses WHERE type_id = $1 ORDER BY idx`, [typeId]);
  return rows;
}
```

- [ ] **Step 4: Write `src/lib/view/ships.ts`**

```ts
/**
 * Pure view helpers for the Ships pages. No I/O, no React — every function here is unit-tested and
 * the components stay dumb (the phase-3b pattern).
 */

/** dogmaUnits 105 Percentage, 109 Modifier Percent, 127 Absolute Percent all display as "%". */
const PERCENT_UNIT_IDS: ReadonlySet<number> = new Set([105, 109, 127]);

/** The SDE's bonus text carries `<a href=showinfo:3302>…</a>` anchors; the page shows plain text. */
export function stripBonusMarkup(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/** "7.5% bonus to Small Projectile Turret rate of fire" — value first, then the stripped text. */
export function bonusLabel(b: { bonus: number | null; bonusText: string | null; unitId: number | null }): string {
  const text = stripBonusMarkup(b.bonusText ?? "").trim();
  if (b.bonus === null) return text;
  const value = `${b.bonus}${b.unitId !== null && PERCENT_UNIT_IDS.has(b.unitId) ? "%" : ""}`;
  return text === "" ? value : `${value} ${text}`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/view/ships.test.ts tests/db/sde-repo.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sde/repo.ts src/lib/view/ships.ts tests/db/sde-repo.test.ts tests/view/ships.test.ts
git commit -m "$(cat <<'EOM'
Read sde_type_bonuses and render a hull bonus line

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: Value roll-up and the gauge view model

The card and the sheet both need "what is this worth, and how many items had no price" and "how full is
this resource pool". Both are pure, so both get unit tests and neither ever lives in a component.

**Files:**
- Modify: `src/lib/view/price.ts` (append), `src/lib/view/ships.ts` (append), `tests/view/price.test.ts` (append), `tests/view/ships.test.ts` (append)

**Interfaces:**
- Consumes (Task 1 and Task 6, verbatim):
```ts
// src/lib/view/price.ts
export interface Price { sell: number | null; buy: number | null; adjusted: number | null }
export function priceOf(p: Price | undefined): number | null
```
plus the phase-4a statistics shape this task formats (from `src/lib/dogma/index.ts`, verbatim):
```ts
interface ResourcePool { used: number; output: number }
```
- Produces:
```ts
// src/lib/view/price.ts
export interface ValuedEntry { typeId: number; quantity: number }
export interface ValueRoll { total: number; unpriced: number }
export function rollUpValue(entries: ValuedEntry[], prices: ReadonlyMap<number, Price>): ValueRoll;
export function unpricedNote(unpriced: number): string | null;      // "3 items unpriced" | null
export function iskShort(value: number): string;                    // "12.3M ISK"

// src/lib/view/ships.ts
export interface GaugeView { label: string; unit: string; used: number; output: number; text: string; percent: number; over: boolean }
export function gauge(label: string, unit: string, pool: { used: number; output: number }, digits?: number): GaugeView;
```

**Decisions recorded here (do not re-litigate them):**
- **`unpriced` counts entries (stacks), not units** — "3 items unpriced" means three lines of the fit had
  no price, which is what the operator can act on.
- `percent` is **clamped to 100** so an over-full bar never overflows its track; `over` (`used > output`,
  the same comparison `validateFit` makes) is what tells the reader it is over, via the `.over` class.
- An `output` of 0 with any usage reads as 100 % and `over: true` — a ship with no powergrid at all and a
  module fitted really is over budget.
- `iskShort` is for cards and slot rows; the sheet's Estimated-value panel uses the existing
  `isk()` from `src/lib/view/format.ts` so the exact figure is visible somewhere.

- [ ] **Step 1: Write the failing tests**

Append to `tests/view/price.test.ts` (extend the existing import to
`import { iskShort, priceOf, rollUpValue, unpricedNote } from "../../src/lib/view/price.js";`):
```ts
const prices = new Map([
  [34, { sell: 3.85, buy: 3.67, adjusted: 4.2 }],
  [587, { sell: null, buy: null, adjusted: 8_000_000 }],
  [519, { sell: null, buy: 100, adjusted: null }],
]);

describe("rollUpValue", () => {
  it("multiplies each entry by its quantity at priceOf", () => {
    expect(rollUpValue([{ typeId: 34, quantity: 1000 }, { typeId: 587, quantity: 1 }], prices))
      .toEqual({ total: 3850 + 8_000_000, unpriced: 0 });
  });
  it("counts entries with no usable price instead of guessing", () => {
    expect(rollUpValue([{ typeId: 519, quantity: 2 }, { typeId: 999, quantity: 1 }, { typeId: 34, quantity: 1 }], prices))
      .toEqual({ total: 3.85, unpriced: 2 });
  });
  it("is zero for no entries", () => {
    expect(rollUpValue([], prices)).toEqual({ total: 0, unpriced: 0 });
  });
});

describe("unpricedNote", () => {
  it("is null when everything was priced and singular for one", () => {
    expect(unpricedNote(0)).toBeNull();
    expect(unpricedNote(1)).toBe("1 item unpriced");
    expect(unpricedNote(4)).toBe("4 items unpriced");
  });
});

describe("iskShort", () => {
  it("scales to B/M/k and keeps small numbers whole", () => {
    expect(iskShort(2_450_000_000)).toBe("2.45B ISK");
    expect(iskShort(12_340_000)).toBe("12.3M ISK");
    expect(iskShort(91_200)).toBe("91k ISK");
    expect(iskShort(850)).toBe("850 ISK");
    expect(iskShort(0)).toBe("0 ISK");
  });
});
```

Append to `tests/view/ships.test.ts` (extend the import to
`import { bonusLabel, gauge, stripBonusMarkup } from "../../src/lib/view/ships.js";`):
```ts
describe("gauge", () => {
  it("formats the used/output pair to two decimals and computes the percentage", () => {
    expect(gauge("CPU", "tf", { used: 121.5, output: 162.5 })).toEqual({
      label: "CPU", unit: "tf", used: 121.5, output: 162.5,
      text: "121.50 / 162.50 tf", percent: 74.8, over: false,
    });
  });
  it("marks an over-budget pool and clamps the bar at 100 %", () => {
    const g = gauge("Powergrid", "MW", { used: 60, output: 51.25 });
    expect(g.over).toBe(true);
    expect(g.percent).toBe(100);
  });
  it("uses whole numbers when asked, for calibration", () => {
    expect(gauge("Calibration", "", { used: 300, output: 400 }, 0).text).toBe("300 / 400 ");
  });
  it("treats any usage of a zero output as full and over", () => {
    expect(gauge("Powergrid", "MW", { used: 5, output: 0 })).toMatchObject({ percent: 100, over: true });
    expect(gauge("Powergrid", "MW", { used: 0, output: 0 })).toMatchObject({ percent: 0, over: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/price.test.ts tests/view/ships.test.ts`
Expected: FAIL — `rollUpValue is not a function`, `gauge is not a function`.

- [ ] **Step 3: Append to `src/lib/view/price.ts`**

```ts
/** One line of a value roll-up: a type and how many of it. */
export interface ValuedEntry { typeId: number; quantity: number }
export interface ValueRoll { total: number; unpriced: number }

/**
 * Spec §4's "Estimated value … with n items unpriced". `unpriced` counts **entries**, not units: it
 * tells the reader how many lines of the fit the total is missing, which is the actionable number.
 */
export function rollUpValue(entries: ValuedEntry[], prices: ReadonlyMap<number, Price>): ValueRoll {
  let total = 0;
  let unpriced = 0;
  for (const entry of entries) {
    const unit = priceOf(prices.get(entry.typeId));
    if (unit === null) unpriced += 1;
    else total += unit * entry.quantity;
  }
  return { total, unpriced };
}

export function unpricedNote(unpriced: number): string | null {
  if (unpriced === 0) return null;
  return `${unpriced} item${unpriced === 1 ? "" : "s"} unpriced`;
}

/**
 * Compact ISK for cards and slot rows ("2.45B ISK"). The sheet's value panel uses `isk()` from
 * `format.ts` so the exact figure is always available somewhere on the page.
 */
export function iskShort(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B ISK`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ISK`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k ISK`;
  return `${Math.round(value)} ISK`;
}
```

- [ ] **Step 4: Append to `src/lib/view/ships.ts`**

```ts
/** A resource bar: CPU, powergrid or calibration. `over` drives the `.over` CSS class (spec §4). */
export interface GaugeView {
  label: string; unit: string; used: number; output: number;
  text: string; percent: number; over: boolean;
}

/**
 * `percent` is clamped to 100 so the bar never overflows its track; `over` is the honest
 * `used > output` test — the same one `validateFit` makes, with no epsilon, because the engine
 * already rounded CPU and powergrid to two decimals.
 */
export function gauge(
  label: string, unit: string, pool: { used: number; output: number }, digits = 2,
): GaugeView {
  const raw = pool.output > 0 ? (pool.used / pool.output) * 100 : pool.used > 0 ? 100 : 0;
  return {
    label, unit, used: pool.used, output: pool.output,
    text: `${pool.used.toFixed(digits)} / ${pool.output.toFixed(digits)} ${unit}`,
    percent: Math.round(Math.min(100, raw) * 10) / 10,
    over: pool.used > pool.output,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/view/price.test.ts tests/view/ships.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/view/price.ts src/lib/view/ships.ts tests/view/price.test.ts tests/view/ships.test.ts
git commit -m "$(cat <<'EOM'
Add the value roll-up and gauge view helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: `loadFitData` — one dogma load per request

Both `/ships` and the two fit sheets need the same four repo reads and **one** `loadDogmaData` call over
every type id they are about to model. Phase 4a's loader spells out exactly which ids that is, so this
module is the single place that assembles them.

**Files:**
- Create: `src/lib/ships/load.ts`, `tests/db/ships-load.test.ts`

**Interfaces:**
- Consumes (phase 3a and phase 4a, verbatim):
```ts
// src/lib/db/character-assets.ts
export interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean;
  name: string | null;
}
export async function listAssets(characterId: number): Promise<AssetRow[]>
// src/lib/db/character-fittings.ts
export interface FittingItemRow { idx: number; typeId: number; quantity: number; flag: string }
export interface FittingRow { fittingId: number; name: string; description: string; shipTypeId: number; items: FittingItemRow[] }
export async function listFittings(characterId: number): Promise<FittingRow[]>
// src/lib/db/character-skills.ts
export interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
export async function listSkills(characterId: number): Promise<SkillRow[]>
// src/lib/db/character-clones.ts
export async function listImplants(characterId: number): Promise<number[]>
// src/lib/dogma/sde-loader.ts  (server only — the one engine module that touches Postgres)
function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData>
function resetDogmaCache(): void        // tests only
// src/lib/dogma/index.ts
interface FitContext { data: DogmaData; skills: Map<TypeId, number>; implants: TypeId[] }
```
  4a's contract, quoted: *"What a page must pass in: every hull, module, charge and drone type id it is
  about to model, **plus every skill id in `ctx.skills` and every implant id in `ctx.implants`**. … One
  call per request is enough — the maps are process-wide."* and *"With phase 3 unsynced, pass
  `skills: new Map()` — every skill reads as level 0 and the page says so."*
- Produces:
```ts
export interface FitData {
  assets: AssetRow[]; fittings: FittingRow[]; ctx: FitContext; skillsSynced: boolean;
}
export function loadFitData(characterId: number): Promise<FitData>;
```

**Decisions recorded here (do not re-litigate them):**
- `trainedLevel`, not `activeLevel`: the sheet answers "can I fly this", and a skill whose level is
  suppressed by an unplugged clone is still trained. (Missing-skill problems compare against trained.)
- `skillsSynced` is `skills.length > 0`. That is the spec §6 "missing skills data" banner trigger.
- The whole asset list is read, exactly like `/assets` does; there is no per-ship query.

- [ ] **Step 1: Write the failing test**

Create `tests/db/ships-load.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import { resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { loadFitData } from "../../src/lib/ships/load.js";

let pool: Pool;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
  resetDogmaCache();
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'Trill', 'enc'), (2, 'Fresh', 'enc')");
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton, name)
     VALUES (1, 1000, 587, 1, 60003760, 'station', 'Hangar', true, 'Scarlet Dart'),
            (1, 1001, 519, 1, 1000, 'item', 'LoSlot0', true, NULL)`);
  await pool.query(
    "INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES (1, 7, 'Solo', '', 587)");
  await pool.query(
    `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
     VALUES (1, 7, 0, 519, 1, 'LoSlot0')`);
  await pool.query(
    "INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints) VALUES (1, 3300, 5, 4, 256000)");
  // 34 stands in for an implant: the mini SDE has no implant type, and the loader only cares that
  // the id reaches ctx.implants and loadDogmaData.
  await pool.query("INSERT INTO character_implants (character_id, type_id) VALUES (1, 34)");
}, 180_000);
afterAll(closePool);

describe("loadFitData", () => {
  it("reads the four tables and loads every type it will model, plus the required-skill closure", async () => {
    const data = await loadFitData(1);
    expect(data.assets.map((a) => a.itemId)).toEqual([1000, 1001]);
    expect(data.fittings).toHaveLength(1);
    expect(data.fittings[0].items).toEqual([{ idx: 0, typeId: 519, quantity: 1, flag: "LoSlot0" }]);

    for (const typeId of [587, 519, 3300, 34]) expect(data.ctx.data.types.has(typeId)).toBe(true);
    // 3329 (Minmatar Frigate) is nobody's asset — loadDogmaData pulls it in as the Rifter's
    // required skill, which is what makes the recursive missing-skill expansion possible.
    expect(data.ctx.data.types.has(3329)).toBe(true);
  });

  it("uses trained levels and reports that skills are synced", async () => {
    const data = await loadFitData(1);
    expect(data.ctx.skills).toEqual(new Map([[3300, 5]]));
    expect(data.ctx.implants).toEqual([34]);
    expect(data.skillsSynced).toBe(true);
  });

  it("gives an unsynced character an empty skill map and says so", async () => {
    const data = await loadFitData(2);
    expect(data.assets).toEqual([]);
    expect(data.fittings).toEqual([]);
    expect(data.ctx.skills.size).toBe(0);
    expect(data.ctx.implants).toEqual([]);
    expect(data.skillsSynced).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/ships-load.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/ships/load.js"`.

- [ ] **Step 3: Write `src/lib/ships/load.ts`**

```ts
import { listAssets, type AssetRow } from "../db/character-assets.js";
import { listFittings, type FittingRow } from "../db/character-fittings.js";
import { listSkills } from "../db/character-skills.js";
import { listImplants } from "../db/character-clones.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import type { FitContext } from "../dogma/index.js";

export interface FitData {
  assets: AssetRow[];
  fittings: FittingRow[];
  ctx: FitContext;
  /** False when phase 3 has not synced skills yet — spec §6 wants the page to say so. */
  skillsSynced: boolean;
}

/**
 * Everything the Ships pages need, in four repo reads and **one** `loadDogmaData` call (spec §4's
 * batching rule; phase 4a's loader memoises attributes, effects and groups process-wide and types
 * per id, so a second call in the same request would be waste, not breakage).
 *
 * The id set is exactly what phase 4a asks for: every asset type, every saved-fit hull and item,
 * every trained skill and every implant. The loader adds the transitive `requiredSkillN` closure
 * itself, so the recursive missing-skill expansion always has the types it needs.
 *
 * Trained level, not active level: the sheet answers "can I fly this", and an unplugged clone does
 * not untrain a skill.
 */
export async function loadFitData(characterId: number): Promise<FitData> {
  const [assets, fittings, skills, implants] = await Promise.all([
    listAssets(characterId),
    listFittings(characterId),
    listSkills(characterId),
    listImplants(characterId),
  ]);

  const typeIds = new Set<number>();
  for (const asset of assets) typeIds.add(asset.typeId);
  for (const fitting of fittings) {
    typeIds.add(fitting.shipTypeId);
    for (const item of fitting.items) typeIds.add(item.typeId);
  }
  for (const skill of skills) typeIds.add(skill.skillId);
  for (const implant of implants) typeIds.add(implant);

  const data = await loadDogmaData([...typeIds]);
  return {
    assets,
    fittings,
    skillsSynced: skills.length > 0,
    ctx: { data, skills: new Map(skills.map((s) => [s.skillId, s.trainedLevel])), implants },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/db/ships-load.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ships/load.ts tests/db/ships-load.test.ts
git commit -m "$(cat <<'EOM'
Add loadFitData: one dogma load per Ships request

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 9: Ship cards — the view model, the component, and the Rifter builder integration test

Spec §4's card: custom name, type, location label, CPU/PG mini-gauges, missing-skill count, value; sorted
by value descending; a fit the engine could not compute shows "Could not compute" (spec §6). This task
also carries the spec §7 **builder integration test**: hand-written asset rows plus the committed phase-4a
`rifter` snapshot, straight through `fitFromAssets` → `fitStats` → `toShipCard`, asserting the numbers.

**Files:**
- Modify: `src/lib/view/ships.ts` (append), `tests/view/ships.test.ts` (append)
- Create: `src/app/ships/Gauge.tsx`, `src/app/ships/ShipCard.tsx`, `tests/components/ship-card.test.tsx`, `tests/view/ships-rifter.test.ts`

**Interfaces:**
- Consumes (phase 4a barrel `src/lib/dogma/index.ts`, verbatim):
```ts
const CATEGORY: { ship: 6; module: 7; charge: 8; skill: 16; drone: 18; implant: 20; subsystem: 32; fighter: 87 };
interface DogmaData { attributes: Map<AttrId, DogmaAttribute>; effects: Map<EffectId, DogmaEffect>; types: Map<TypeId, DogmaType>; groups: Map<GroupId, DogmaGroup> }
interface DogmaType { id: TypeId; groupId: GroupId; categoryId: number; name: string | null; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean> }
interface Item {
  kind: ItemKind; typeId: TypeId; categoryId: number; groupId: GroupId; name: string | null;
  state: State; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean>;
  charge?: Item; container?: Item; domain: ItemDomain; ownerModifiable: boolean;
}
interface Slotted { item: Item; slot: SlotKind; index: number }
interface Fit { data: DogmaData; ship: Item; character: Item; skills: Map<TypeId, Item>; implants: Item[]; modules: Slotted[]; drones: Item[] }
interface ResourcePool { used: number; output: number }
interface SlotUsage { used: number; total: number }
interface ModuleStat { item: Item; slot: SlotKind; index: number; cpu: number; power: number; calibration: number; state: State; charged: boolean }
interface FitStats {
  cpu: ResourcePool; power: ResourcePool; calibration: ResourcePool;
  slots: Record<SlotKind, SlotUsage>; hardpoints: Record<Hardpoint, SlotUsage>; modules: ModuleStat[];
}
type ProblemKind = "cpu" | "power" | "calibration" | "slot" | "hardpoint" | "rigSize" | "shipRestriction" | "maxGroupFitted" | "skill";
interface MissingSkill { skillTypeId: TypeId; required: number; have: number }
interface Problem { kind: ProblemKind; item?: Item; detail: string; skill?: MissingSkill }
interface FitEntry { typeId: TypeId; quantity: number; flag: string; name: string | null }
interface BuiltFit { fit: Fit; cargo: FitEntry[]; drones: FitEntry[]; unfittable: FitEntry[]; unknown: FitEntry[] }
function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit
function fitStats(fit: Fit): FitStats
function validateFit(fit: Fit): Problem[]            // NB: one argument — Fit already carries `data`
function missingSkills(fit: Fit): MissingSkill[]     // deduplicated, ascending by skillTypeId
function itemLabel(item: Item): string               // `item.name ?? \`type ${item.typeId}\``
```
  plus Task 1 `Price`/`priceOf`, Task 7 `ValuedEntry`/`ValueRoll`/`rollUpValue`/`unpricedNote`/`iskShort`/`gauge`/`GaugeView`,
  and phase-3a `AssetRow` and `locationLabels`:
```ts
// src/lib/names/index.ts
export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }
export async function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>
```
- Produces:
```ts
// src/lib/view/ships.ts
export interface ShipGroup { ship: AssetRow; children: AssetRow[] }
export function assembledShips(assets: AssetRow[], data: DogmaData): ShipGroup[];
export function shipLocationLabel(
  ship: AssetRow, places: ReadonlyMap<number, { name: string }>, byItemId: ReadonlyMap<number, AssetRow>, data: DogmaData,
): string;
export function fitValueEntries(built: BuiltFit): ValuedEntry[];
export interface ShipCardView {
  key: string; href: string; name: string | null; typeId: number; typeName: string; location: string;
  cpu: GaugeView | null; power: GaugeView | null; missingSkills: number;
  value: string | null; valueRaw: number; unpriced: string | null; error: string | null;
}
export function toShipCard(input: {
  key: string; href: string; name: string | null; typeId: number; typeName: string; location: string;
  stats: FitStats; problems: Problem[]; entries: ValuedEntry[]; prices: ReadonlyMap<number, Price>;
}): ShipCardView;
export function errorShipCard(input: {
  key: string; href: string; name: string | null; typeId: number; typeName: string; location: string;
}): ShipCardView;
export function sortShipCards(cards: ShipCardView[]): ShipCardView[];

// src/app/ships/Gauge.tsx (server component)
export function Gauge({ view }: { view: GaugeView }): React.JSX.Element;
// src/app/ships/ShipCard.tsx (server component)
export function ShipCard({ card }: { card: ShipCardView }): React.JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- **A hull the SDE does not know cannot get a card.** `assembledShips` finds ships by
  `data.types.get(typeId)?.categoryId === CATEGORY.ship`, so an unknown type id is not recognisable as a
  ship at all. Spec §6's `Unknown type (id)` rule applies to the *contents* of a known ship, which
  phase 4a reports in `BuiltFit.unknown`.
- **A ship nested in another ship** (frigate escape bay, ship maintenance bay) gets its own card *and*
  appears in its parent's cargo list. Both statements are true, so both are shown.
- **A loaded charge is valued as one unit.** The engine models a charge as a single `Item` with no stack
  size; ammunition sitting in the cargo hold is valued at its full quantity. This under-counts a loaded
  magazine and is the documented simplification.
- `errorShipCard` sets `valueRaw: -1` so "Could not compute" cards sort below a genuinely worthless one.
- The card links to the sheet, so the whole card is a `Link` — one target, no nested interactive elements.

- [ ] **Step 1: Write the failing tests**

Append to `tests/view/ships.test.ts` (extend the import to
`import { assembledShips, bonusLabel, errorShipCard, fitValueEntries, gauge, shipLocationLabel, sortShipCards, stripBonusMarkup, toShipCard } from "../../src/lib/view/ships.js";`
and add `import type { AssetRow } from "../../src/lib/db/character-assets.js";`):
```ts
function asset(over: Partial<AssetRow> & { itemId: number; typeId: number }): AssetRow {
  return {
    quantity: 1, locationId: 60003760, locationType: "station", locationFlag: "Hangar",
    isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  };
}

/** A stand-in for DogmaData: assembledShips and shipLocationLabel only read `types`. */
const data = {
  types: new Map([
    [587, { id: 587, groupId: 25, categoryId: 6, name: "Rifter", attrs: new Map(), effects: new Map() }],
    [519, { id: 519, groupId: 76, categoryId: 7, name: "Gyrostabilizer II", attrs: new Map(), effects: new Map() }],
    [28606, { id: 28606, groupId: 448, categoryId: 6, name: "Orca", attrs: new Map(), effects: new Map() }],
  ]),
  attributes: new Map(), effects: new Map(), groups: new Map(),
} as unknown as import("../../src/lib/dogma/index.js").DogmaData;

describe("assembledShips", () => {
  it("finds assembled hulls and the items sitting inside them", () => {
    const rows = [
      asset({ itemId: 1, typeId: 587, isSingleton: true, name: "Scarlet Dart" }),
      asset({ itemId: 2, typeId: 519, isSingleton: true, locationId: 1, locationType: "item", locationFlag: "LoSlot0" }),
      asset({ itemId: 3, typeId: 519, quantity: 4 }),                       // a packaged stack in the hangar
      asset({ itemId: 4, typeId: 587, quantity: 2 }),                       // packaged hulls: not assembled
    ];
    const groups = assembledShips(rows, data);
    expect(groups).toHaveLength(1);
    expect(groups[0].ship.itemId).toBe(1);
    expect(groups[0].children.map((c) => c.itemId)).toEqual([2]);
  });

  it("gives a ship inside another ship its own group", () => {
    const rows = [
      asset({ itemId: 1, typeId: 28606, isSingleton: true }),
      asset({ itemId: 2, typeId: 587, isSingleton: true, locationId: 1, locationType: "item", locationFlag: "ShipHangar" }),
    ];
    expect(assembledShips(rows, data).map((g) => g.ship.itemId)).toEqual([1, 2]);
  });

  it("ignores a hull whose type the SDE does not know", () => {
    expect(assembledShips([asset({ itemId: 1, typeId: 999999, isSingleton: true })], data)).toEqual([]);
  });
});

describe("shipLocationLabel", () => {
  const places = new Map([[60003760, { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" }]]);

  it("names the place a ship is parked in", () => {
    const ship = asset({ itemId: 1, typeId: 587, isSingleton: true });
    expect(shipLocationLabel(ship, places, new Map(), data)).toBe("Jita IV - Moon 4 - Caldari Navy Assembly Plant");
  });

  it("falls back to a readable placeholder for an unresolved place", () => {
    const ship = asset({ itemId: 1, typeId: 587, locationId: 60000001 });
    expect(shipLocationLabel(ship, places, new Map(), data)).toBe("Unknown location (60000001)");
  });

  it("names the containing ship when the parent is an item", () => {
    const carrier = asset({ itemId: 9, typeId: 28606, isSingleton: true, name: "Mule" });
    const ship = asset({ itemId: 1, typeId: 587, locationId: 9, locationType: "item", locationFlag: "ShipHangar" });
    expect(shipLocationLabel(ship, places, new Map([[9, carrier]]), data)).toBe("Mule");
    const unnamed = { ...carrier, name: null };
    expect(shipLocationLabel(ship, places, new Map([[9, unnamed]]), data)).toBe("Orca");
    expect(shipLocationLabel(ship, places, new Map(), data)).toBe("Container 9");
  });
});

describe("toShipCard / errorShipCard / sortShipCards", () => {
  const stats = {
    cpu: { used: 121.5, output: 162.5 }, power: { used: 30, output: 51.25 },
    calibration: { used: 0, output: 400 },
    slots: { high: { used: 1, total: 4 }, mid: { used: 0, total: 3 }, low: { used: 1, total: 3 }, rig: { used: 0, total: 3 }, subsystem: { used: 0, total: 0 } },
    hardpoints: { turret: { used: 1, total: 3 }, launcher: { used: 0, total: 2 } },
    modules: [],
  } as unknown as import("../../src/lib/dogma/index.js").FitStats;
  const base = { key: "asset:1", href: "/ships/asset/1", name: "Scarlet Dart", typeId: 587, typeName: "Rifter", location: "Jita 4-4" };

  it("builds a card with both gauges, the missing-skill count and the value", () => {
    const card = toShipCard({
      ...base, stats,
      problems: [
        { kind: "skill", detail: "Minmatar Frigate I required", skill: { skillTypeId: 3329, required: 1, have: 0 } },
        { kind: "cpu", detail: "CPU over" },
      ] as unknown as import("../../src/lib/dogma/index.js").Problem[],
      entries: [{ typeId: 587, quantity: 1 }],
      prices: new Map([[587, { sell: 8_000_000, buy: null, adjusted: null }]]),
    });
    expect(card.cpu!.text).toBe("121.50 / 162.50 tf");
    expect(card.power!.over).toBe(false);
    expect(card.missingSkills).toBe(1);
    expect(card.value).toBe("8.0M ISK");
    expect(card.valueRaw).toBe(8_000_000);
    expect(card.unpriced).toBeNull();
    expect(card.error).toBeNull();
  });

  it("reports unpriced entries", () => {
    const card = toShipCard({ ...base, stats, problems: [], entries: [{ typeId: 587, quantity: 1 }], prices: new Map() });
    expect(card.value).toBe("0 ISK");
    expect(card.unpriced).toBe("1 item unpriced");
  });

  it("builds a could-not-compute card with no gauges, sorted last", () => {
    const broken = errorShipCard(base);
    expect(broken.error).toBe("Could not compute");
    expect(broken.cpu).toBeNull();
    expect(broken.power).toBeNull();
    const worthless = toShipCard({ ...base, key: "asset:2", stats, problems: [], entries: [], prices: new Map() });
    expect(sortShipCards([broken, worthless]).map((c) => c.key)).toEqual(["asset:2", "asset:1"]);
  });

  it("sorts by value descending", () => {
    const make = (key: string, sell: number) => toShipCard({
      ...base, key, stats, problems: [], entries: [{ typeId: 587, quantity: 1 }],
      prices: new Map([[587, { sell, buy: null, adjusted: null }]]),
    });
    expect(sortShipCards([make("a", 10), make("b", 900), make("c", 100)]).map((c) => c.key)).toEqual(["b", "c", "a"]);
  });
});
```

Create `tests/view/ships-rifter.test.ts` — the builder integration test (spec §7):
```ts
import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { fitFromAssets, fitStats, missingSkills, validateFit } from "../../src/lib/dogma/index.js";
import { fitValueEntries, toShipCard } from "../../src/lib/view/ships.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import type { Price } from "../../src/lib/view/price.js";

function asset(over: Partial<AssetRow> & { itemId: number; typeId: number }): AssetRow {
  return {
    quantity: 1, locationId: 1000, locationType: "item", locationFlag: "Cargo",
    isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  };
}

const SHIP = asset({
  itemId: 1000, typeId: 587, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, name: "Scarlet Dart",
});
const CHILDREN: AssetRow[] = [
  asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0", isSingleton: true }),  // 200mm AutoCannon II
  asset({ itemId: 1002, typeId: 12608, locationFlag: "HiSlot0", quantity: 400 }),     // Hail S, loaded
  asset({ itemId: 1003, typeId: 519, locationFlag: "LoSlot0", isSingleton: true }),   // Gyrostabilizer II
  asset({ itemId: 1004, typeId: 2456, locationFlag: "DroneBay", quantity: 5 }),       // Hobgoblin II
  asset({ itemId: 1005, typeId: 12608, locationFlag: "Cargo", quantity: 1000 }),      // spare Hail S
];

// CPU Management V and Power Grid Management V, nothing else — so the hull's own skill is missing.
const ctx = { data: fixtureData("rifter"), skills: new Map([[3426, 5], [3413, 5]]), implants: [] };

const PRICES = new Map<number, Price>([
  [587, { sell: 8_000_000, buy: null, adjusted: null }],
  [2889, { sell: 1_500_000, buy: null, adjusted: null }],
  [519, { sell: null, buy: null, adjusted: 1_000_000 }],
  [12608, { sell: 100, buy: null, adjusted: null }],
  [2456, { sell: 500_000, buy: null, adjusted: null }],
]);

describe("a Rifter built from asset rows", () => {
  it("puts the charge under its module, the drones in the bay and the rest in cargo", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    expect(built.fit.modules.map((m) => [m.slot, m.index, m.item.typeId])).toEqual([
      ["high", 0, 2889],
      ["low", 0, 519],
    ]);
    expect(built.fit.modules[0].item.charge?.typeId).toBe(12608);
    expect(built.drones).toEqual([{ typeId: 2456, quantity: 5, flag: "DroneBay", name: "Hobgoblin II" }]);
    expect(built.cargo.map((c) => [c.typeId, c.quantity])).toEqual([[12608, 1000]]);
    expect(built.unknown).toEqual([]);
  });

  it("computes the fitting numbers the fixture pins down", () => {
    const stats = fitStats(fitFromAssets(SHIP, CHILDREN, ctx).fit);
    // Phase 4a's asserted Rifter numbers: 130/41 at skills 0, 162.5/51.25 at CPU Management V and
    // Power Grid Management V.
    expect(stats.cpu.output).toBe(162.5);
    expect(stats.power.output).toBe(51.25);
    expect(stats.cpu.used).toBeGreaterThan(0);
    expect(stats.power.used).toBeGreaterThan(0);
    expect(stats.slots.high.used).toBe(1);
    expect(stats.slots.low.used).toBe(1);
    expect(stats.hardpoints.turret.used).toBe(1);
  });

  it("reports the hull's own skill as missing", () => {
    const fit = fitFromAssets(SHIP, CHILDREN, ctx).fit;
    // 3329 is Minmatar Frigate: the Rifter requires it and this character has not trained it.
    expect(missingSkills(fit).map((s) => s.skillTypeId)).toContain(3329);
    expect(validateFit(fit).filter((p) => p.kind === "skill").length).toBeGreaterThan(0);
  });

  it("turns all of that into the card the /ships grid renders", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    const stats = fitStats(built.fit);
    const card = toShipCard({
      key: "asset:1000", href: "/ships/asset/1000", name: SHIP.name, typeId: 587, typeName: "Rifter",
      location: "Jita 4-4", stats, problems: validateFit(built.fit),
      entries: fitValueEntries(built), prices: PRICES,
    });
    expect(card.cpu!.text).toBe(`${stats.cpu.used.toFixed(2)} / 162.50 tf`);
    expect(card.cpu!.over).toBe(false);
    expect(card.power!.text).toBe(`${stats.power.used.toFixed(2)} / 51.25 MW`);
    expect(card.missingSkills).toBeGreaterThan(0);
    // 8,000,000 hull + 1,500,000 gun + 100 loaded round + 1,000,000 gyro + 100,000 spare ammo
    //   + 2,500,000 drones = 13,100,100
    expect(card.valueRaw).toBe(13_100_100);
    expect(card.value).toBe("13.1M ISK");
    expect(card.unpriced).toBeNull();
  });

  it("counts entries with no price at all", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    const prices = new Map(PRICES);
    prices.delete(519);
    const card = toShipCard({
      key: "asset:1000", href: "/ships/asset/1000", name: SHIP.name, typeId: 587, typeName: "Rifter",
      location: "Jita 4-4", stats: fitStats(built.fit), problems: [],
      entries: fitValueEntries(built), prices,
    });
    expect(card.unpriced).toBe("1 item unpriced");
    expect(card.valueRaw).toBe(12_100_100);
  });
});
```

Create `tests/components/ship-card.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShipCard } from "../../src/app/ships/ShipCard.js";
import type { ShipCardView } from "../../src/lib/view/ships.js";

const card: ShipCardView = {
  key: "asset:1000", href: "/ships/asset/1000", name: "Scarlet Dart", typeId: 587, typeName: "Rifter",
  location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  cpu: { label: "CPU", unit: "tf", used: 121.5, output: 162.5, text: "121.50 / 162.50 tf", percent: 74.8, over: false },
  power: { label: "Powergrid", unit: "MW", used: 60, output: 51.25, text: "60.00 / 51.25 MW", percent: 100, over: true },
  missingSkills: 2, value: "13.1M ISK", valueRaw: 13_100_100, unpriced: "1 item unpriced", error: null,
};

describe("ShipCard", () => {
  it("shows the custom name, type, location and value, linking to the sheet", () => {
    render(<ShipCard card={card} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/ships/asset/1000");
    expect(screen.getByText("Scarlet Dart")).toBeInTheDocument();
    expect(screen.getByText("Rifter")).toBeInTheDocument();
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(screen.getByText("13.1M ISK")).toBeInTheDocument();
    expect(screen.getByText("1 item unpriced")).toBeInTheDocument();
    expect(screen.getByText("2 missing skills")).toBeInTheDocument();
  });

  it("draws both gauges and marks only the over-budget one", () => {
    const { container } = render(<ShipCard card={card} />);
    const gauges = container.querySelectorAll(".gauge");
    expect(gauges).toHaveLength(2);
    expect(gauges[0]).not.toHaveClass("over");
    expect(gauges[1]).toHaveClass("over");
    expect(gauges[0].querySelector(".gauge-fill")).toHaveStyle({ width: "74.8%" });
    expect(screen.getByText("121.50 / 162.50 tf")).toBeInTheDocument();
  });

  it("falls back to the type name when the ship was never renamed", () => {
    render(<ShipCard card={{ ...card, name: null, missingSkills: 0 }} />);
    expect(screen.getAllByText("Rifter").length).toBeGreaterThan(0);
    expect(screen.getByText("All skills trained")).toBeInTheDocument();
  });

  it("shows Could not compute instead of gauges when the engine threw", () => {
    const { container } = render(<ShipCard card={{
      ...card, cpu: null, power: null, value: null, unpriced: null, error: "Could not compute",
    }} />);
    expect(screen.getByText("Could not compute")).toBeInTheDocument();
    expect(container.querySelectorAll(".gauge")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/ships.test.ts tests/view/ships-rifter.test.ts tests/components/ship-card.test.tsx`
Expected: FAIL — `assembledShips is not a function` and
`Failed to resolve import "../../src/app/ships/ShipCard.js"`.

- [ ] **Step 3: Append the view model to `src/lib/view/ships.ts`**

Add the imports at the top of the file (above the existing `PERCENT_UNIT_IDS`):
```ts
import type { AssetRow } from "../db/character-assets.js";
import { CATEGORY, type BuiltFit, type DogmaData, type FitStats, type Problem } from "../dogma/index.js";
import { iskShort, rollUpValue, unpricedNote, type Price, type ValuedEntry } from "./price.js";
```
and append:
```ts
/** An assembled hull and the asset rows sitting directly inside it. */
export interface ShipGroup { ship: AssetRow; children: AssetRow[] }

/**
 * Spec §4's "fitted ships": every assembled (singleton) asset whose type is in category 6, together
 * with the rows whose `location_id` is that ship's `item_id` — which is where ESI puts fitted
 * modules, their charges, the drone bay and the cargo hold alike (phase 4a's builder sorts them out).
 *
 * A hull whose type the SDE does not know cannot be recognised as a ship and gets no card; spec §6's
 * `Unknown type (id)` rule is about the *contents* of a known ship (`BuiltFit.unknown`). A ship
 * inside another ship gets its own group as well as a line in its parent's cargo — both are true.
 */
export function assembledShips(assets: AssetRow[], data: DogmaData): ShipGroup[] {
  const byLocation = new Map<number, AssetRow[]>();
  for (const asset of assets) {
    const bucket = byLocation.get(asset.locationId);
    if (bucket === undefined) byLocation.set(asset.locationId, [asset]);
    else bucket.push(asset);
  }
  return assets
    .filter((a) => a.isSingleton && data.types.get(a.typeId)?.categoryId === CATEGORY.ship)
    .map((ship) => ({ ship, children: byLocation.get(ship.itemId) ?? [] }));
}

/**
 * Where the card says the ship is. A `location_type` of "item" means the parent is another of the
 * character's items (a ship maintenance bay, a container), and `locationLabels` must never be asked
 * about an item id — so that case is answered from the asset rows instead.
 */
export function shipLocationLabel(
  ship: AssetRow,
  places: ReadonlyMap<number, { name: string }>,
  byItemId: ReadonlyMap<number, AssetRow>,
  data: DogmaData,
): string {
  if (ship.locationType !== "item") {
    return places.get(ship.locationId)?.name ?? `Unknown location (${ship.locationId})`;
  }
  const parent = byItemId.get(ship.locationId);
  if (parent === undefined) return `Container ${ship.locationId}`;
  return parent.name ?? data.types.get(parent.typeId)?.name ?? `Container ${ship.locationId}`;
}

/**
 * Spec §4's estimated value: ship + fitted modules + their charges + drones + cargo. A loaded charge
 * counts as **one** unit — the engine models it as a single item with no stack size; ammunition in
 * the cargo hold is counted at its real quantity.
 */
export function fitValueEntries(built: BuiltFit): ValuedEntry[] {
  const entries: ValuedEntry[] = [{ typeId: built.fit.ship.typeId, quantity: 1 }];
  for (const slotted of built.fit.modules) {
    entries.push({ typeId: slotted.item.typeId, quantity: 1 });
    if (slotted.item.charge !== undefined) entries.push({ typeId: slotted.item.charge.typeId, quantity: 1 });
  }
  for (const drone of built.drones) entries.push({ typeId: drone.typeId, quantity: drone.quantity });
  for (const item of built.cargo) entries.push({ typeId: item.typeId, quantity: item.quantity });
  return entries;
}

/** One card in the `/ships` grid. Everything is a string or a number — no engine objects. */
export interface ShipCardView {
  key: string; href: string; name: string | null; typeId: number; typeName: string; location: string;
  cpu: GaugeView | null; power: GaugeView | null; missingSkills: number;
  value: string | null; valueRaw: number; unpriced: string | null; error: string | null;
}

export function toShipCard(input: {
  key: string; href: string; name: string | null; typeId: number; typeName: string; location: string;
  stats: FitStats; problems: Problem[]; entries: ValuedEntry[]; prices: ReadonlyMap<number, Price>;
}): ShipCardView {
  const roll = rollUpValue(input.entries, input.prices);
  return {
    key: input.key, href: input.href, name: input.name, typeId: input.typeId,
    typeName: input.typeName, location: input.location,
    cpu: gauge("CPU", "tf", input.stats.cpu),
    power: gauge("Powergrid", "MW", input.stats.power),
    missingSkills: input.problems.filter((p) => p.kind === "skill").length,
    value: iskShort(roll.total), valueRaw: roll.total, unpriced: unpricedNote(roll.unpriced), error: null,
  };
}

/**
 * Spec §6: an engine exception is caught per fit and the card says so. `valueRaw` is -1 so these
 * sort below a genuinely worthless fit rather than mixing in with the zero-value ones.
 */
export function errorShipCard(input: {
  key: string; href: string; name: string | null; typeId: number; typeName: string; location: string;
}): ShipCardView {
  return {
    ...input, cpu: null, power: null, missingSkills: 0,
    value: null, valueRaw: -1, unpriced: null, error: "Could not compute",
  };
}

/** Spec §4: value descending. Ties break on type name then key so the order is never Map-dependent. */
export function sortShipCards(cards: ShipCardView[]): ShipCardView[] {
  return [...cards].sort((a, b) =>
    b.valueRaw - a.valueRaw || a.typeName.localeCompare(b.typeName) || a.key.localeCompare(b.key));
}
```

- [ ] **Step 4: Write `src/app/ships/Gauge.tsx`**

```tsx
import type { GaugeView } from "../../lib/view/ships.js";

/**
 * One resource bar, shared by the card and the fit sheet. The width is a length, not a colour, so
 * it is allowed to be inline; `.over` is what turns the bar red (spec §4).
 */
export function Gauge({ view }: { view: GaugeView }) {
  return (
    <div className="gauge-row">
      <span className="gauge-label">{view.label}</span>
      <span className={`gauge${view.over ? " over" : ""}`}>
        <span className="gauge-fill" style={{ width: `${view.percent}%` }} />
      </span>
      <span className="gauge-text num">{view.text}</span>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/app/ships/ShipCard.tsx`**

```tsx
import Link from "next/link";
import type { ShipCardView } from "../../lib/view/ships.js";
import { Gauge } from "./Gauge.js";

/** One fitted ship or saved fit. The whole card is the link to its sheet. */
export function ShipCard({ card }: { card: ShipCardView }) {
  const computed = card.cpu !== null && card.power !== null;
  return (
    <Link href={card.href} className="card ship-card">
      <div className="ship-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://images.evetech.net/types/${card.typeId}/icon?size=64`} alt="" className="ship-icon" />
        <div>
          <h2 className="ship-name">{card.name ?? card.typeName}</h2>
          <p className="ship-type muted">{card.typeName}</p>
        </div>
      </div>
      <p className="ship-loc faint">{card.location}</p>
      {computed ? (
        <>
          <Gauge view={card.cpu!} />
          <Gauge view={card.power!} />
          <div className="ship-foot">
            <span className={card.missingSkills > 0 ? "badge error" : "faint"}>
              {card.missingSkills > 0
                ? `${card.missingSkills} missing skill${card.missingSkills === 1 ? "" : "s"}`
                : "All skills trained"}
            </span>
            <span className="num">{card.value}</span>
          </div>
          {card.unpriced === null ? null : <p className="faint ship-unpriced">{card.unpriced}</p>}
        </>
      ) : (
        <p className="neg">{card.error ?? "Could not compute"}</p>
      )}
    </Link>
  );
}
```

- [ ] **Step 6: Add the card and gauge classes to `src/app/globals.css`**

Append to the phase-4 block:
```css
.gauge-row { display: grid; grid-template-columns: 74px 1fr auto; gap: 8px; align-items: center; margin-top: 6px; }
.gauge-label { font-size: 12px; color: var(--faint); }
.gauge { height: 6px; border-radius: 99px; background: var(--raised); overflow: hidden; display: block; }
.gauge-fill { display: block; height: 100%; background: var(--accent); }
.gauge.over .gauge-fill { background: var(--neg); }
.gauge-text { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ship-card { display: flex; flex-direction: column; gap: 4px; text-decoration: none; color: inherit; }
.ship-card:hover { border-color: var(--border-hi); }
.ship-head { display: flex; gap: 12px; align-items: center; }
.ship-icon { width: 48px; height: 48px; border-radius: 8px; border: 1px solid var(--divider); background: var(--raised); }
.ship-name { margin: 0; font-family: var(--font-poppins), sans-serif; font-size: 16px; font-weight: 600; }
.ship-type { margin: 2px 0 0; font-size: 13px; }
.ship-loc { font-size: 12px; margin: 6px 0 2px; }
.ship-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; font-size: 13px; }
.ship-unpriced { margin: 4px 0 0; font-size: 12px; }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/view tests/components/ship-card.test.tsx && npm run typecheck`
Expected: PASS, `tsc --noEmit` clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/view/ships.ts src/app/ships/Gauge.tsx src/app/ships/ShipCard.tsx src/app/globals.css \
        tests/view/ships.test.ts tests/view/ships-rifter.test.ts tests/components/ship-card.test.tsx
git commit -m "$(cat <<'EOM'
Add the ship card view model, component and the Rifter builder integration test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 10: The `/ships` page

Spec §4: the active character's **Fitted ships** (one card per assembled ship in assets) and **Saved fits**
(one card per ESI fitting), each sorted by value descending, with empty states when nothing is synced and
the spec §6 banner when skills are not synced. The page itself stays thin: two pure builders do the work.

**Files:**
- Modify: `src/lib/view/ships.ts` (append), `tests/view/ships-rifter.test.ts` (append), `src/app/ships/page.tsx` (replace the placeholder), `src/app/globals.css`

**Interfaces:**
- Consumes (phase 1/3a/3b and phase 4a, verbatim):
```ts
// src/lib/auth/session.ts
export async function readSession(): Promise<{ activeCharacterId: number | null } | null>
// src/lib/db/characters.ts
export async function listCharacters(): Promise<Character[]>      // Character.id, .name
// src/lib/view/characters.ts
export function pickActive<T extends { id: number }>(characters: T[], activeId: number | null): T | null
// src/lib/names/index.ts
export async function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>   // LocationLabel.name
// src/lib/db/market-prices.ts (Task 1)
export function getPrices(typeIds: number[]): Promise<Map<number, Price>>
// src/lib/ships/load.ts (Task 8)
export function loadFitData(characterId: number): Promise<FitData>
export interface FitData { assets: AssetRow[]; fittings: FittingRow[]; ctx: FitContext; skillsSynced: boolean }
// src/lib/dogma/index.ts (phase 4a)
interface FitContext { data: DogmaData; skills: Map<TypeId, number>; implants: TypeId[] }
interface BuiltFit { fit: Fit; cargo: FitEntry[]; drones: FitEntry[]; unfittable: FitEntry[]; unknown: FitEntry[] }
function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit
function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit
function fitStats(fit: Fit): FitStats
function validateFit(fit: Fit): Problem[]
class UnknownTypeError extends Error { readonly typeId: TypeId }
class DogmaCycleError extends Error { readonly attrId: AttrId }
```
  plus Task 9 `ShipGroup`, `assembledShips`, `shipLocationLabel`, `fitValueEntries`, `toShipCard`,
  `errorShipCard`, `sortShipCards`, `ShipCardView`, and `<ShipCard>`.
- Produces:
```ts
// src/lib/view/ships.ts
export const SAVED_FIT_LOCATION = "Saved fit";
export interface ComputedFit { built: BuiltFit; stats: FitStats; problems: Problem[] }
export function computeFit(build: () => BuiltFit, what: string): ComputedFit | null;
export function assetShipCards(
  groups: ShipGroup[], ctx: FitContext,
  places: ReadonlyMap<number, { name: string }>, byItemId: ReadonlyMap<number, AssetRow>,
  prices: ReadonlyMap<number, Price>,
): ShipCardView[];
export function savedFitCards(
  fittings: FittingRow[], ctx: FitContext, prices: ReadonlyMap<number, Price>,
): ShipCardView[];
// src/app/ships/page.tsx
export default async function ShipsPage(): Promise<React.JSX.Element>;
```

**Decisions recorded here (do not re-litigate them):**
- **`computeFit` wraps the build *and* the maths.** `fitStats` and `validateFit` both call `getAttr`, so a
  `DogmaCycleError` can surface after a successful build; catching only around the builder would still
  crash the page. Spec §6's "engine exceptions are caught per fit" means all three.
- **Prices are fetched for every type the character owns or has in a fitting**, in one `getPrices` call,
  *before* the fits are built. That keeps card construction a single pure pass and costs one `= ANY(...)`
  over a few thousand ids.
- A saved fit has no location, so its card's location line reads `Saved fit`.
- The banner is rendered whenever `skillsSynced` is false, even if the character has no ships — it explains
  the empty page too.

- [ ] **Step 1: Write the failing tests**

Append to `tests/view/ships-rifter.test.ts` (extend the import to
`import { assetShipCards, computeFit, fitValueEntries, savedFitCards, toShipCard } from "../../src/lib/view/ships.js";`
and add `import { vi } from "vitest";` to the existing vitest import, plus
`import type { FittingRow } from "../../src/lib/db/character-fittings.js";`):
```ts
describe("computeFit", () => {
  it("returns the built fit, its stats and its problems", () => {
    const computed = computeFit(() => fitFromAssets(SHIP, CHILDREN, ctx), "asset:1000")!;
    expect(computed.stats.cpu.output).toBe(162.5);
    expect(computed.problems.some((p) => p.kind === "skill")).toBe(true);
    expect(computed.built.fit.ship.typeId).toBe(587);
  });

  it("logs and returns null when the engine throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(computeFit(() => { throw new Error("unknown hull"); }, "asset:9")).toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("asset:9"), expect.any(Error));
    spy.mockRestore();
  });
});

describe("assetShipCards / savedFitCards", () => {
  const places = new Map([[60003760, { name: "Jita 4-4" }]]);

  it("builds one card per assembled ship, sorted by value", () => {
    const groups = [{ ship: SHIP, children: CHILDREN }];
    const cards = assetShipCards(groups, ctx, places, new Map([[1000, SHIP]]), PRICES);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      key: "asset:1000", href: "/ships/asset/1000", name: "Scarlet Dart", typeName: "Rifter",
      location: "Jita 4-4", value: "13.1M ISK", error: null,
    });
  });

  it("shows Could not compute for a hull the engine cannot build", () => {
    const broken = { ...SHIP, itemId: 2000, typeId: 999999 };
    const cards = assetShipCards([{ ship: broken, children: [] }], ctx, places, new Map(), PRICES);
    expect(cards[0].error).toBe("Could not compute");
    expect(cards[0].typeName).toBe("Unknown type (999999)");
  });

  it("builds a card per saved fit, labelled as a saved fit", () => {
    const fitting: FittingRow = {
      fittingId: 7, name: "Solo Rifter", description: "", shipTypeId: 587,
      items: [{ idx: 0, typeId: 519, quantity: 1, flag: "LoSlot0" }],
    };
    const cards = savedFitCards([fitting], ctx, PRICES);
    expect(cards[0]).toMatchObject({
      key: "fit:7", href: "/ships/fit/7", name: "Solo Rifter", typeName: "Rifter", location: "Saved fit",
    });
    expect(cards[0].cpu!.output).toBe(162.5);
    expect(cards[0].valueRaw).toBe(9_000_000);   // 8,000,000 hull + 1,000,000 gyro
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/view/ships-rifter.test.ts`
Expected: FAIL — `computeFit is not a function`.

- [ ] **Step 3: Append the three builders to `src/lib/view/ships.ts`**

Extend the dogma import to bring in the four functions as values:
```ts
import {
  CATEGORY, fitFromAssets, fitFromFitting, fitStats, validateFit,
  type BuiltFit, type DogmaData, type FitContext, type FitStats, type Problem,
} from "../dogma/index.js";
import type { FittingRow } from "../db/character-fittings.js";
```
and append:
```ts
/** A saved fit is not anywhere, so its card's location line says what it is instead. */
export const SAVED_FIT_LOCATION = "Saved fit";

export interface ComputedFit { built: BuiltFit; stats: FitStats; problems: Problem[] }

/**
 * Spec §6: engine exceptions are caught per fit and logged, and the card says "Could not compute".
 * The build *and* the maths are inside the try — `fitStats` and `validateFit` both call `getAttr`,
 * so a cycle or an unknown attribute surfaces after a perfectly successful build.
 */
export function computeFit(build: () => BuiltFit, what: string): ComputedFit | null {
  try {
    const built = build();
    return { built, stats: fitStats(built.fit), problems: validateFit(built.fit) };
  } catch (e) {
    console.error(`[ships] could not compute ${what}`, e);
    return null;
  }
}

/** Spec §4's "Fitted ships" grid, value descending. */
export function assetShipCards(
  groups: ShipGroup[],
  ctx: FitContext,
  places: ReadonlyMap<number, { name: string }>,
  byItemId: ReadonlyMap<number, AssetRow>,
  prices: ReadonlyMap<number, Price>,
): ShipCardView[] {
  return sortShipCards(groups.map((group) => {
    const base = {
      key: `asset:${group.ship.itemId}`,
      href: `/ships/asset/${group.ship.itemId}`,
      name: group.ship.name,
      typeId: group.ship.typeId,
      typeName: ctx.data.types.get(group.ship.typeId)?.name ?? `Unknown type (${group.ship.typeId})`,
      location: shipLocationLabel(group.ship, places, byItemId, ctx.data),
    };
    const computed = computeFit(() => fitFromAssets(group.ship, group.children, ctx), base.key);
    if (computed === null) return errorShipCard(base);
    return toShipCard({
      ...base, stats: computed.stats, problems: computed.problems,
      entries: fitValueEntries(computed.built), prices,
    });
  }));
}

/** Spec §4's "Saved fits" grid — the same card, built from `character_fittings*`. */
export function savedFitCards(
  fittings: FittingRow[], ctx: FitContext, prices: ReadonlyMap<number, Price>,
): ShipCardView[] {
  return sortShipCards(fittings.map((fitting) => {
    const base = {
      key: `fit:${fitting.fittingId}`,
      href: `/ships/fit/${fitting.fittingId}`,
      name: fitting.name,
      typeId: fitting.shipTypeId,
      typeName: ctx.data.types.get(fitting.shipTypeId)?.name ?? `Unknown type (${fitting.shipTypeId})`,
      location: SAVED_FIT_LOCATION,
    };
    const computed = computeFit(() => fitFromFitting(fitting, fitting.items, ctx), base.key);
    if (computed === null) return errorShipCard(base);
    return toShipCard({
      ...base, stats: computed.stats, problems: computed.problems,
      entries: fitValueEntries(computed.built), prices,
    });
  }));
}
```

- [ ] **Step 4: Replace `src/app/ships/page.tsx`**

```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getPrices } from "../../lib/db/market-prices.js";
import { locationLabels } from "../../lib/names/index.js";
import { loadFitData } from "../../lib/ships/load.js";
import { pickActive } from "../../lib/view/characters.js";
import { assembledShips, assetShipCards, savedFitCards } from "../../lib/view/ships.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { ShipCard } from "./ShipCard.js";

export default async function ShipsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const { assets, fittings, ctx, skillsSynced } = await loadFitData(character.id);
  const groups = assembledShips(assets, ctx.data);
  const byItemId = new Map(assets.map((a) => [a.itemId, a]));

  // Two batched lookups for the whole page: one price query over every type the character owns or
  // has in a fitting, and one locationLabels pass over the places the ships are parked in. Ships
  // sitting inside another item are labelled from the asset rows, never from locationLabels.
  const priceIds = [
    ...assets.map((a) => a.typeId),
    ...fittings.flatMap((f) => [f.shipTypeId, ...f.items.map((i) => i.typeId)]),
  ];
  const [prices, places] = await Promise.all([
    getPrices(priceIds),
    locationLabels(groups.filter((g) => g.ship.locationType !== "item").map((g) => g.ship.locationId)),
  ]);

  const ships = assetShipCards(groups, ctx, places, byItemId, prices);
  const fits = savedFitCards(fittings, ctx, prices);

  return (<>
    <h1 className="page-title">Ships</h1>
    <p className="page-sub">{character.name}</p>
    {skillsSynced ? null : (
      <p className="card banner">
        No skills synced yet — every skill is treated as level 0, so fitting numbers and missing-skill
        counts are worst case. The skills job runs hourly.
      </p>
    )}
    <h2 className="section-title">Fitted ships</h2>
    {ships.length === 0
      ? <p className="faint">No assembled ships in your assets yet — the assets job runs hourly.</p>
      : <div className="card-grid ships">{ships.map((card) => <ShipCard key={card.key} card={card} />)}</div>}
    <h2 className="section-title">Saved fits</h2>
    {fits.length === 0
      ? <p className="faint">No saved fits — the fittings job runs every 6 hours.</p>
      : <div className="card-grid ships">{fits.map((card) => <ShipCard key={card.key} card={card} />)}</div>}
  </>);
}
```

- [ ] **Step 5: Add the page classes to `src/app/globals.css`**

Append to the phase-4 block:
```css
.section-title { font-family: var(--font-poppins), sans-serif; font-size: 18px; font-weight: 600; margin: 28px 0 14px; }
.card-grid.ships { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.banner { border-color: var(--warn); color: var(--warn); font-size: 13px; padding: 14px 18px; margin: 0 0 8px; }
```

- [ ] **Step 6: Run the tests and prove the page compiles**

```bash
npx vitest run tests/view
npm run typecheck
npm run build
```
Expected: tests PASS; `tsc --noEmit` clean; `next build` succeeds — which is also the proof that no
client component reaches `pg` (the page and every component it renders are server components).

- [ ] **Step 7: Smoke-check the page locally**

```bash
docker compose -f compose.dev.yml up -d
npm run dev
```
Open `http://localhost:3000/ships`. Expected: the two sections render; with an empty dev database both
show their "not synced" sentences rather than crashing. Stop the dev server afterwards.

- [ ] **Step 8: Commit**

```bash
git add src/lib/view/ships.ts src/app/ships/page.tsx src/app/globals.css tests/view/ships-rifter.test.ts
git commit -m "$(cat <<'EOM'
Add the /ships page: fitted ships and saved fits

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 11: `buildFitSheet` — the whole fit sheet as plain data

Spec §4's sheet: header with the ship render and the hull's bonuses at the character's skill level; five
slot columns with per-module CPU/PG (2 dp), charge and state; three gauges; slot and hardpoint counters;
Problems; Missing skills (have → need); Cargo & drones; Estimated value with "n items unpriced"; and, per
CPU/PG cell, the `explain` rows the popover shows. **The engine runs here, on the server**; everything
this function returns is a string, a number or a boolean.

**Files:**
- Create: `src/lib/view/fit-sheet.ts`, `tests/view/fit-sheet.test.ts`

**Interfaces:**
- Consumes (phase 4a barrel, verbatim):
```ts
type SlotKind = "high" | "mid" | "low" | "rig" | "subsystem";
type Hardpoint = "turret" | "launcher";
const SLOT_KINDS: readonly SlotKind[]            // ["high","mid","low","rig","subsystem"] — column order
const HARDPOINTS: readonly Hardpoint[]           // ["turret","launcher"]
enum Operator { PreAssign = 1, PreMul, PreDiv, ModAdd, ModSub, PostMul, PostMulImmune, PostDiv, PostPercent, PostAssign }
enum State { Offline = 1, Online, Active, Overload }
const ATTR: { …; power: 30; cpu: 50; … }
interface Item { kind: ItemKind; typeId: TypeId; categoryId: number; groupId: GroupId; name: string | null; state: State; attrs: Map<AttrId, number>; effects: Map<EffectId, boolean>; charge?: Item; container?: Item; domain: ItemDomain; ownerModifiable: boolean }
interface Fit { data: DogmaData; ship: Item; character: Item; skills: Map<TypeId, Item>; implants: Item[]; modules: Slotted[]; drones: Item[] }
interface AppliedModifier {
  carrier: Item; carrierTypeId: TypeId; carrierName: string | null; effectId: EffectId;
  operator: Operator; modifyingAttrId: AttrId; rawValue: number; value: number; penalised: boolean;
}
function explain(fit: Fit, item: Item, attrId: AttrId): AppliedModifier[]     // the "affected by" popover
interface ResourcePool { used: number; output: number }
interface SlotUsage { used: number; total: number }
interface ModuleStat { item: Item; slot: SlotKind; index: number; cpu: number; power: number; calibration: number; state: State; charged: boolean }
interface FitStats { cpu: ResourcePool; power: ResourcePool; calibration: ResourcePool; slots: Record<SlotKind, SlotUsage>; hardpoints: Record<Hardpoint, SlotUsage>; modules: ModuleStat[] }
type ProblemKind = "cpu" | "power" | "calibration" | "slot" | "hardpoint" | "rigSize" | "shipRestriction" | "maxGroupFitted" | "skill";
interface MissingSkill { skillTypeId: TypeId; required: number; have: number }
interface Problem { kind: ProblemKind; item?: Item; detail: string; skill?: MissingSkill }
interface FitEntry { typeId: TypeId; quantity: number; flag: string; name: string | null }
interface BuiltFit { fit: Fit; cargo: FitEntry[]; drones: FitEntry[]; unfittable: FitEntry[]; unknown: FitEntry[] }
function itemLabel(item: Item): string               // `item.name ?? \`type ${item.typeId}\``
```
  plus Task 1 `Price`/`priceOf`, Task 6 `bonusLabel`, Task 7 `rollUpValue`/`unpricedNote`/`ValuedEntry`,
  Task 9 `gauge`/`GaugeView`/`fitValueEntries`, and phase-3b `isk` from `src/lib/view/format.ts`:
```ts
export function isk(value: number): string       // "1,234,567.89 ISK"
```
- Produces:
```ts
export function shipRenderUrl(typeId: number): string;      // images.evetech.net render, size 128
export function stateLabel(state: State): string;
export function operatorLabel(op: Operator): string;
export function problemText(p: Problem): string;
export function explainRows(applied: AppliedModifier[]): ExplainRowView[];
export interface ExplainRowView { carrier: string; operator: string; value: string; penalised: boolean }
export interface ModuleRowView {
  key: string; name: string; typeId: number; charge: string | null;
  cpu: string; power: string; state: string;
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[];
}
export interface SlotColumnView { slot: SlotKind; title: string; used: number; total: number; rows: ModuleRowView[] }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
export interface EntryView { key: string; name: string; quantity: number; value: string | null }
export interface BonusView { skill: string | null; level: number | null; text: string }
export interface ValueLineView { label: string; value: string }
export interface FitSheetView {
  title: string; subtitle: string; typeId: number; typeName: string; renderUrl: string; skillsSynced: boolean;
  bonuses: BonusView[]; gauges: GaugeView[]; slots: SlotColumnView[]; counters: CounterView[];
  problems: ProblemView[]; missing: MissingSkillView[];
  cargo: EntryView[]; drones: EntryView[]; unfittable: EntryView[]; unknown: EntryView[];
  value: { total: string; lines: ValueLineView[]; unpriced: string | null };
}
export interface FitSheetInput {
  title: string; subtitle: string; typeId: number; typeName: string;
  built: BuiltFit; stats: FitStats; problems: Problem[];
  bonuses: readonly { skillTypeId: number | null; bonus: number | null; bonusText: string | null; unitId: number | null }[];
  skillLevels: ReadonlyMap<number, number>;
  skillNames: ReadonlyMap<number, string>;
  prices: ReadonlyMap<number, Price>;
  skillsSynced: boolean;
}
export function buildFitSheet(input: FitSheetInput): FitSheetView;
```

**Decisions recorded here (do not re-litigate them):**
- **`explain` is called on the server, twice per module** (CPU and powergrid) and turned into strings.
  `DogmaData` never leaves the server — the popover gets `ExplainRowView[]` and nothing else.
- An `explain` call that throws is logged and yields an empty row list: a module whose "affected by"
  cannot be computed must not take down a sheet that otherwise renders (spec §6's spirit).
- The popover shows `rawValue` — the carrier attribute's own number (`-25` for Weapon Upgrades V) — because
  that is what the in-game "affected by" panel shows; `value` is the engine's normalised form.
- **Value lines are Hull / Modules & rigs / Charges / Drones / Cargo**, each priced separately, and their
  sum is exactly `rollUpValue(fitValueEntries(built))`. A test pins that invariant.
- Empty value lines are dropped, except Hull, which is always shown.
- A slot column with no slots at all (`total === 0`) is still rendered, so the five columns line up;
  the counters row is what says "0 / 0".

- [ ] **Step 1: Write the failing test**

Create `tests/view/fit-sheet.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY, fitFromAssets, fitStats, validateFit } from "../../src/lib/dogma/index.js";
import { buildFitSheet, operatorLabel, problemText, stateLabel } from "../../src/lib/view/fit-sheet.js";
import { fitValueEntries } from "../../src/lib/view/ships.js";
import { rollUpValue } from "../../src/lib/view/price.js";
import { isk } from "../../src/lib/view/format.js";
import { Operator, State } from "../../src/lib/dogma/index.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import type { Price } from "../../src/lib/view/price.js";

function asset(over: Partial<AssetRow> & { itemId: number; typeId: number }): AssetRow {
  return {
    quantity: 1, locationId: 1000, locationType: "item", locationFlag: "Cargo",
    isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  };
}

const SHIP = asset({
  itemId: 1000, typeId: 587, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, name: "Scarlet Dart",
});
const CHILDREN: AssetRow[] = [
  asset({ itemId: 1001, typeId: 2889, locationFlag: "HiSlot0", isSingleton: true }),
  asset({ itemId: 1002, typeId: 12608, locationFlag: "HiSlot0", quantity: 400 }),
  asset({ itemId: 1003, typeId: 519, locationFlag: "LoSlot0", isSingleton: true }),
  asset({ itemId: 1004, typeId: 2456, locationFlag: "DroneBay", quantity: 5 }),
  asset({ itemId: 1005, typeId: 12608, locationFlag: "Cargo", quantity: 1000 }),
];

const data = fixtureData("rifter");
// CPU Management V, Power Grid Management V, Weapon Upgrades V — the last one is what puts a
// modifier on the turret's CPU, which is what the "affected by" popover exists to show.
const skillLevels = new Map([[3426, 5], [3413, 5], [3318, 5]]);
const ctx = { data, skills: skillLevels, implants: [] };
const skillNames = new Map(
  [...data.types.values()].filter((t) => t.categoryId === CATEGORY.skill).map((t) => [t.id, t.name ?? `Skill ${t.id}`]),
);
const PRICES = new Map<number, Price>([
  [587, { sell: 8_000_000, buy: null, adjusted: null }],
  [2889, { sell: 1_500_000, buy: null, adjusted: null }],
  [519, { sell: null, buy: null, adjusted: 1_000_000 }],
  [12608, { sell: 100, buy: null, adjusted: null }],
]);
// Exactly what getTypeBonuses(587) returns against the SDE.
const BONUSES = [
  { skillTypeId: 3329, bonus: 7.5, unitId: 105, bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire" },
  { skillTypeId: 3329, bonus: 10, unitId: 105, bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff" },
];

function sheet(over: Partial<Parameters<typeof buildFitSheet>[0]> = {}) {
  const built = fitFromAssets(SHIP, CHILDREN, ctx);
  return buildFitSheet({
    title: "Scarlet Dart", subtitle: "Jita 4-4", typeId: 587, typeName: "Rifter",
    built, stats: fitStats(built.fit), problems: validateFit(built.fit),
    bonuses: BONUSES, skillLevels, skillNames, prices: PRICES, skillsSynced: true, ...over,
  });
}

describe("label helpers", () => {
  it("names states and operators", () => {
    expect(stateLabel(State.Offline)).toBe("Offline");
    expect(stateLabel(State.Overload)).toBe("Overload");
    expect(operatorLabel(Operator.PostPercent)).toBe("%");
    expect(operatorLabel(Operator.ModAdd)).toBe("+");
    expect(operatorLabel(Operator.PostMul)).toBe("×");
  });
  it("prefixes a problem with the item it is about", () => {
    expect(problemText({ kind: "cpu", detail: "12.00 tf over" })).toBe("12.00 tf over");
    expect(problemText({
      kind: "maxGroupFitted", detail: "only 1 may be fitted",
      item: { name: "Damage Control II", typeId: 2048 } as never,
    })).toBe("Damage Control II — only 1 may be fitted");
  });
});

describe("buildFitSheet", () => {
  it("builds the header, the render URL and the hull bonuses at the character's level", () => {
    const view = sheet();
    expect(view.title).toBe("Scarlet Dart");
    expect(view.subtitle).toBe("Jita 4-4");
    expect(view.typeName).toBe("Rifter");
    expect(view.renderUrl).toBe("https://images.evetech.net/types/587/render?size=128");
    expect(view.bonuses).toEqual([
      { skill: "Minmatar Frigate", level: 0, text: "7.5% bonus to Small Projectile Turret rate of fire" },
      { skill: "Minmatar Frigate", level: 0, text: "10% bonus to Small Projectile Turret falloff" },
    ]);
  });

  it("has three gauges, with the fixture's Rifter outputs", () => {
    const view = sheet();
    expect(view.gauges.map((g) => g.label)).toEqual(["CPU", "Powergrid", "Calibration"]);
    expect(view.gauges[0].text.endsWith("/ 162.50 tf")).toBe(true);
    expect(view.gauges[1].text.endsWith("/ 51.25 MW")).toBe(true);
    expect(view.gauges[0].over).toBe(false);
  });

  it("lays out five slot columns and puts each module in its own", () => {
    const view = sheet();
    expect(view.slots.map((s) => s.slot)).toEqual(["high", "mid", "low", "rig", "subsystem"]);
    expect(view.slots.map((s) => s.title)).toEqual(["High", "Mid", "Low", "Rigs", "Subsystems"]);
    const high = view.slots[0];
    expect(high.used).toBe(1);
    expect(high.rows).toHaveLength(1);
    expect(high.rows[0].name).toBe("200mm AutoCannon II");
    expect(high.rows[0].charge).toBe("Hail S");
    expect(high.rows[0].cpu).toMatch(/^\d+\.\d{2}$/);      // two decimals, spec §4
    expect(high.rows[0].power).toMatch(/^\d+\.\d{2}$/);
    expect(high.rows[0].state).toBe("Active");
    expect(view.slots[2].rows[0].name).toBe("Gyrostabilizer II");
    expect(view.slots[1].rows).toEqual([]);
  });

  it("explains the turret's CPU with the skill that modifies it", () => {
    const row = sheet().slots[0].rows[0];
    expect(row.cpuExplain.map((r) => r.carrier)).toContain("Weapon Upgrades");
    const applied = row.cpuExplain.find((r) => r.carrier === "Weapon Upgrades")!;
    expect(applied.operator).toBe("%");
    expect(applied.value).toBe("-25");
    expect(typeof applied.penalised).toBe("boolean");
  });

  it("counts slots and hardpoints", () => {
    const view = sheet();
    expect(view.counters.find((c) => c.label === "High")).toMatchObject({ used: 1, over: false });
    expect(view.counters.find((c) => c.label === "Turrets")).toMatchObject({ used: 1, over: false });
    expect(view.counters.find((c) => c.label === "Launchers")).toMatchObject({ used: 0 });
  });

  it("lists problems and the missing skills with have → need", () => {
    const view = sheet();
    expect(view.problems.every((p) => p.text.length > 0 && p.label.length > 0)).toBe(true);
    const frigate = view.missing.find((m) => m.skillTypeId === 3329)!;
    expect(frigate).toMatchObject({ name: "Minmatar Frigate", have: 0 });
    expect(frigate.need).toBeGreaterThanOrEqual(1);
  });

  it("lists cargo and drones with quantities and values", () => {
    const view = sheet();
    expect(view.cargo).toEqual([{ key: "Cargo:12608:0", name: "Hail S", quantity: 1000, value: "100,000.00 ISK" }]);
    expect(view.drones).toEqual([{ key: "DroneBay:2456:0", name: "Hobgoblin II", quantity: 5, value: null }]);
    expect(view.unfittable).toEqual([]);
    expect(view.unknown).toEqual([]);
  });

  it("rolls the value up per group and totals exactly what fitValueEntries prices", () => {
    const built = fitFromAssets(SHIP, CHILDREN, ctx);
    const view = sheet();
    const expected = rollUpValue(fitValueEntries(built), PRICES);
    expect(view.value.total).toBe(isk(expected.total));
    expect(view.value.lines.map((l) => l.label)).toEqual(["Hull", "Modules & rigs", "Charges", "Drones", "Cargo"]);
    expect(view.value.lines[0].value).toBe(isk(8_000_000));
    expect(view.value.unpriced).toBe("1 item unpriced");   // the Hobgoblin has no price
  });

  it("passes the unsynced-skills flag through", () => {
    expect(sheet({ skillsSynced: false }).skillsSynced).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/view/fit-sheet.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/fit-sheet.js"`.

- [ ] **Step 3: Write `src/lib/view/fit-sheet.ts`**

```ts
import {
  ATTR, HARDPOINTS, Operator, SLOT_KINDS, State, explain, itemLabel,
  type AppliedModifier, type BuiltFit, type Fit, type FitEntry, type FitStats, type Hardpoint,
  type Item, type ModuleStat, type Problem, type ProblemKind, type SlotKind,
} from "../dogma/index.js";
import { isk } from "./format.js";
import { priceOf, rollUpValue, unpricedNote, type Price, type ValuedEntry } from "./price.js";
import { bonusLabel, gauge, type GaugeView } from "./ships.js";

const SLOT_TITLES: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
};
const HARDPOINT_TITLES: Record<Hardpoint, string> = { turret: "Turrets", launcher: "Launchers" };
const PROBLEM_LABELS: Record<ProblemKind, string> = {
  cpu: "CPU", power: "Powergrid", calibration: "Calibration", slot: "Slots", hardpoint: "Hardpoints",
  rigSize: "Rig size", shipRestriction: "Ship restriction", maxGroupFitted: "Max group fitted", skill: "Skill",
};

export function shipRenderUrl(typeId: number): string {
  return `https://images.evetech.net/types/${typeId}/render?size=128`;
}

export function stateLabel(state: State): string {
  switch (state) {
    case State.Offline: return "Offline";
    case State.Online: return "Online";
    case State.Active: return "Active";
    case State.Overload: return "Overload";
    default: return `State ${state}`;
  }
}

/** The in-game "affected by" panel's shorthand for each operator. */
export function operatorLabel(op: Operator): string {
  switch (op) {
    case Operator.PreAssign:
    case Operator.PostAssign: return "=";
    case Operator.PreMul:
    case Operator.PostMul:
    case Operator.PostMulImmune: return "×";
    case Operator.PreDiv:
    case Operator.PostDiv: return "÷";
    case Operator.ModAdd: return "+";
    case Operator.ModSub: return "−";
    case Operator.PostPercent: return "%";
    default: return "?";
  }
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export interface ExplainRowView { carrier: string; operator: string; value: string; penalised: boolean }

/** `rawValue` is the carrier attribute's own number (-25 for Weapon Upgrades V) — what EVE shows. */
export function explainRows(applied: AppliedModifier[]): ExplainRowView[] {
  return applied.map((a) => ({
    carrier: a.carrierName ?? `type ${a.carrierTypeId}`,
    operator: operatorLabel(a.operator),
    value: num(a.rawValue),
    penalised: a.penalised,
  }));
}

/**
 * A module whose "affected by" cannot be computed must not take down a sheet that otherwise renders,
 * so the failure is logged and the popover comes up empty.
 */
function safeExplain(fit: Fit, item: Item, attrId: number): ExplainRowView[] {
  try {
    return explainRows(explain(fit, item, attrId));
  } catch (e) {
    console.error(`[ships] could not explain attribute ${attrId} of type ${item.typeId}`, e);
    return [];
  }
}

export function problemText(p: Problem): string {
  return p.item === undefined ? p.detail : `${itemLabel(p.item)} — ${p.detail}`;
}

export interface ModuleRowView {
  key: string; name: string; typeId: number; charge: string | null;
  cpu: string; power: string; state: string;
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[];
}
export interface SlotColumnView { slot: SlotKind; title: string; used: number; total: number; rows: ModuleRowView[] }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
export interface EntryView { key: string; name: string; quantity: number; value: string | null }
export interface BonusView { skill: string | null; level: number | null; text: string }
export interface ValueLineView { label: string; value: string }

export interface FitSheetView {
  title: string; subtitle: string; typeId: number; typeName: string; renderUrl: string; skillsSynced: boolean;
  bonuses: BonusView[]; gauges: GaugeView[]; slots: SlotColumnView[]; counters: CounterView[];
  problems: ProblemView[]; missing: MissingSkillView[];
  cargo: EntryView[]; drones: EntryView[]; unfittable: EntryView[]; unknown: EntryView[];
  value: { total: string; lines: ValueLineView[]; unpriced: string | null };
}

export interface FitSheetInput {
  title: string; subtitle: string; typeId: number; typeName: string;
  built: BuiltFit; stats: FitStats; problems: Problem[];
  bonuses: readonly { skillTypeId: number | null; bonus: number | null; bonusText: string | null; unitId: number | null }[];
  skillLevels: ReadonlyMap<number, number>;
  skillNames: ReadonlyMap<number, string>;
  prices: ReadonlyMap<number, Price>;
  skillsSynced: boolean;
}

function moduleRow(fit: Fit, stat: ModuleStat): ModuleRowView {
  return {
    key: `${stat.slot}:${stat.index}`,
    name: itemLabel(stat.item),
    typeId: stat.item.typeId,
    charge: stat.item.charge === undefined ? null : itemLabel(stat.item.charge),
    cpu: stat.cpu.toFixed(2),
    power: stat.power.toFixed(2),
    state: stateLabel(stat.state),
    cpuExplain: safeExplain(fit, stat.item, ATTR.cpu),
    powerExplain: safeExplain(fit, stat.item, ATTR.power),
  };
}

function entryViews(entries: FitEntry[], prices: ReadonlyMap<number, Price>): EntryView[] {
  return entries.map((entry, index) => {
    const unit = priceOf(prices.get(entry.typeId));
    return {
      key: `${entry.flag}:${entry.typeId}:${index}`,
      // spec §6: a type the SDE does not know is shown as "Unknown type (id)" and excluded from the maths.
      name: entry.name ?? `Unknown type (${entry.typeId})`,
      quantity: entry.quantity,
      value: unit === null ? null : isk(unit * entry.quantity),
    };
  });
}

function entriesOf(list: FitEntry[]): ValuedEntry[] {
  return list.map((e) => ({ typeId: e.typeId, quantity: e.quantity }));
}

export function buildFitSheet(input: FitSheetInput): FitSheetView {
  const { built, stats, prices } = input;
  const fit = built.fit;

  const bySlot = new Map<SlotKind, ModuleStat[]>();
  for (const stat of stats.modules) {
    const bucket = bySlot.get(stat.slot);
    if (bucket === undefined) bySlot.set(stat.slot, [stat]);
    else bucket.push(stat);
  }
  const slots: SlotColumnView[] = SLOT_KINDS.map((slot) => ({
    slot,
    title: SLOT_TITLES[slot],
    used: stats.slots[slot].used,
    total: stats.slots[slot].total,
    rows: [...(bySlot.get(slot) ?? [])].sort((a, b) => a.index - b.index).map((stat) => moduleRow(fit, stat)),
  }));

  const counters: CounterView[] = [
    ...SLOT_KINDS.map((slot) => ({
      label: SLOT_TITLES[slot], used: stats.slots[slot].used, total: stats.slots[slot].total,
      over: stats.slots[slot].used > stats.slots[slot].total,
    })),
    ...HARDPOINTS.map((hardpoint) => ({
      label: HARDPOINT_TITLES[hardpoint], used: stats.hardpoints[hardpoint].used,
      total: stats.hardpoints[hardpoint].total,
      over: stats.hardpoints[hardpoint].used > stats.hardpoints[hardpoint].total,
    })),
  ];

  const missing: MissingSkillView[] = input.problems
    .flatMap((p) => (p.kind === "skill" && p.skill !== undefined ? [p.skill] : []))
    .map((s) => ({
      skillTypeId: s.skillTypeId,
      name: input.skillNames.get(s.skillTypeId) ?? `Skill ${s.skillTypeId}`,
      have: s.have, need: s.required,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Spec §4: ship + fitted + charges + drones + cargo. The per-group sums add up to exactly
  // rollUpValue(fitValueEntries(built)) — a test pins that.
  const moduleEntries: ValuedEntry[] = [];
  const chargeEntries: ValuedEntry[] = [];
  for (const slotted of fit.modules) {
    moduleEntries.push({ typeId: slotted.item.typeId, quantity: 1 });
    if (slotted.item.charge !== undefined) chargeEntries.push({ typeId: slotted.item.charge.typeId, quantity: 1 });
  }
  const groups: { label: string; entries: ValuedEntry[] }[] = [
    { label: "Hull", entries: [{ typeId: fit.ship.typeId, quantity: 1 }] },
    { label: "Modules & rigs", entries: moduleEntries },
    { label: "Charges", entries: chargeEntries },
    { label: "Drones", entries: entriesOf(built.drones) },
    { label: "Cargo", entries: entriesOf(built.cargo) },
  ];
  let total = 0;
  let unpriced = 0;
  const lines: ValueLineView[] = [];
  for (const group of groups) {
    const roll = rollUpValue(group.entries, prices);
    total += roll.total;
    unpriced += roll.unpriced;
    if (group.label === "Hull" || group.entries.length > 0) lines.push({ label: group.label, value: isk(roll.total) });
  }

  return {
    title: input.title, subtitle: input.subtitle, typeId: input.typeId, typeName: input.typeName,
    renderUrl: shipRenderUrl(input.typeId), skillsSynced: input.skillsSynced,
    bonuses: input.bonuses.map((b) => ({
      skill: b.skillTypeId === null ? null : input.skillNames.get(b.skillTypeId) ?? `Skill ${b.skillTypeId}`,
      level: b.skillTypeId === null ? null : input.skillLevels.get(b.skillTypeId) ?? 0,
      text: bonusLabel(b),
    })),
    gauges: [
      gauge("CPU", "tf", stats.cpu),
      gauge("Powergrid", "MW", stats.power),
      gauge("Calibration", "", stats.calibration, 0),
    ],
    slots, counters,
    problems: input.problems.map((p) => ({ kind: p.kind, label: PROBLEM_LABELS[p.kind], text: problemText(p) })),
    missing,
    cargo: entryViews(built.cargo, prices),
    drones: entryViews(built.drones, prices),
    unfittable: entryViews(built.unfittable, prices),
    unknown: entryViews(built.unknown, prices),
    value: { total: isk(total), lines, unpriced: unpricedNote(unpriced) },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/view/fit-sheet.test.ts && npm run typecheck`
Expected: PASS (10 tests), `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/fit-sheet.ts tests/view/fit-sheet.test.ts
git commit -m "$(cat <<'EOM'
Build the fit sheet view model from the engine's output

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 12: The fit sheet components and the "affected by" popover

Spec §4's sheet, rendered. `FitSheet` is a presentational **server** component over `FitSheetView`;
`AffectedBy` is the phase's only `"use client"` island — it receives the already-computed `ExplainRowView[]`
and does nothing but open and close.

**Files:**
- Create: `src/app/ships/FitSheet.tsx`, `src/app/ships/AffectedBy.tsx`, `tests/components/fit-sheet.test.tsx`, `tests/components/affected-by.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes (Task 11 and Task 9, verbatim):
```ts
// src/lib/view/fit-sheet.ts
export interface ExplainRowView { carrier: string; operator: string; value: string; penalised: boolean }
export interface ModuleRowView { key: string; name: string; typeId: number; charge: string | null; cpu: string; power: string; state: string; cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[] }
export interface SlotColumnView { slot: SlotKind; title: string; used: number; total: number; rows: ModuleRowView[] }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
export interface EntryView { key: string; name: string; quantity: number; value: string | null }
export interface BonusView { skill: string | null; level: number | null; text: string }
export interface ValueLineView { label: string; value: string }
export interface FitSheetView {
  title: string; subtitle: string; typeId: number; typeName: string; renderUrl: string; skillsSynced: boolean;
  bonuses: BonusView[]; gauges: GaugeView[]; slots: SlotColumnView[]; counters: CounterView[];
  problems: ProblemView[]; missing: MissingSkillView[];
  cargo: EntryView[]; drones: EntryView[]; unfittable: EntryView[]; unknown: EntryView[];
  value: { total: string; lines: ValueLineView[]; unpriced: string | null };
}
// src/app/ships/Gauge.tsx (Task 9)
export function Gauge({ view }: { view: GaugeView }): React.JSX.Element
// src/lib/view/format.ts
export function roman(level: number): string          // "V" for 5, "" for 0
```
- Produces:
```ts
export function AffectedBy({ label, value, rows }: { label: string; value: string; rows: ExplainRowView[] }): React.JSX.Element;
export function FitSheet({ view }: { view: FitSheetView }): React.JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- A cell with **no** modifiers renders as plain text, not a dead button — there is nothing to show.
- The popover is inline (a `<span>` positioned by CSS), not a portal: it lives inside a table cell and
  needs no focus trapping. Clicking the button again closes it; `aria-expanded` says which it is.
- `AffectedBy` imports **only** `react`, `@tabler/icons-react` and a type from `fit-sheet.ts`. It must
  never import the dogma barrel, a repo or `pg` — `npm run build` is the check.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/affected-by.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AffectedBy } from "../../src/app/ships/AffectedBy.js";

const rows = [
  { carrier: "Weapon Upgrades", operator: "%", value: "-25", penalised: false },
  { carrier: "Zainou 'Gypsy' CPU Management EE-601", operator: "%", value: "1", penalised: true },
];

describe("AffectedBy", () => {
  it("shows the value and opens the modifier list on click", () => {
    render(<AffectedBy label="CPU" value="6.75" rows={rows} />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("6.75");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Weapon Upgrades")).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Weapon Upgrades")).toBeInTheDocument();
    expect(screen.getByText("% -25")).toBeInTheDocument();
    expect(screen.getByText(/penalised/)).toBeInTheDocument();
  });

  it("closes again on a second click", () => {
    render(<AffectedBy label="CPU" value="6.75" rows={rows} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Weapon Upgrades")).toBeNull();
  });

  it("renders a plain number when nothing modifies the attribute", () => {
    render(<AffectedBy label="Powergrid" value="2.00" rows={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("2.00")).toBeInTheDocument();
  });
});
```

Create `tests/components/fit-sheet.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FitSheet } from "../../src/app/ships/FitSheet.js";
import type { FitSheetView } from "../../src/lib/view/fit-sheet.js";

const view: FitSheetView = {
  title: "Scarlet Dart", subtitle: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  typeId: 587, typeName: "Rifter", renderUrl: "https://images.evetech.net/types/587/render?size=128",
  skillsSynced: true,
  bonuses: [{ skill: "Minmatar Frigate", level: 4, text: "7.5% bonus to Small Projectile Turret rate of fire" }],
  gauges: [
    { label: "CPU", unit: "tf", used: 121.5, output: 162.5, text: "121.50 / 162.50 tf", percent: 74.8, over: false },
    { label: "Powergrid", unit: "MW", used: 60, output: 51.25, text: "60.00 / 51.25 MW", percent: 100, over: true },
    { label: "Calibration", unit: "", used: 0, output: 400, text: "0 / 400 ", percent: 0, over: false },
  ],
  slots: [
    {
      slot: "high", title: "High", used: 1, total: 4,
      rows: [{
        key: "high:0", name: "200mm AutoCannon II", typeId: 2889, charge: "Hail S",
        cpu: "6.75", power: "12.80", state: "Active",
        cpuExplain: [{ carrier: "Weapon Upgrades", operator: "%", value: "-25", penalised: false }],
        powerExplain: [],
      }],
    },
    { slot: "mid", title: "Mid", used: 0, total: 3, rows: [] },
    { slot: "low", title: "Low", used: 0, total: 3, rows: [] },
    { slot: "rig", title: "Rigs", used: 0, total: 3, rows: [] },
    { slot: "subsystem", title: "Subsystems", used: 0, total: 0, rows: [] },
  ],
  counters: [
    { label: "High", used: 1, total: 4, over: false },
    { label: "Turrets", used: 5, total: 3, over: true },
  ],
  problems: [
    { kind: "power", label: "Powergrid", text: "8.75 MW over the ship's output" },
    { kind: "skill", label: "Skill", text: "200mm AutoCannon II — Small Autocannon Specialization I required" },
  ],
  missing: [{ skillTypeId: 3329, name: "Minmatar Frigate", have: 0, need: 1 }],
  cargo: [{ key: "Cargo:12608:0", name: "Hail S", quantity: 1000, value: "100,000.00 ISK" }],
  drones: [{ key: "DroneBay:2456:0", name: "Hobgoblin II", quantity: 5, value: null }],
  unfittable: [],
  unknown: [{ key: "HiSlot1:99999:0", name: "Unknown type (99999)", quantity: 1, value: null }],
  value: {
    total: "13,100,100.00 ISK",
    lines: [{ label: "Hull", value: "8,000,000.00 ISK" }, { label: "Cargo", value: "100,000.00 ISK" }],
    unpriced: "1 item unpriced",
  },
};

describe("FitSheet", () => {
  it("renders the header, the render image and the hull bonuses with the character's level", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Scarlet Dart");
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://images.evetech.net/types/587/render?size=128");
    expect(screen.getByText(/Minmatar Frigate IV/)).toBeInTheDocument();
    expect(screen.getByText(/7.5% bonus to Small Projectile Turret rate of fire/)).toBeInTheDocument();
  });

  it("draws three gauges and marks the over-budget one", () => {
    const { container } = render(<FitSheet view={view} />);
    const gauges = container.querySelectorAll(".gauge");
    expect(gauges).toHaveLength(3);
    expect(gauges[1]).toHaveClass("over");
    expect(screen.getByText("121.50 / 162.50 tf")).toBeInTheDocument();
  });

  it("lists the module with its charge, both resource figures and its state", () => {
    render(<FitSheet view={view} />);
    expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument();
    expect(screen.getByText(/· Hail S/)).toBeInTheDocument();      // the charge beside its turret
    expect(screen.getByText("12.80")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    // The CPU cell has modifiers, so it is a popover button; powergrid has none, so it is plain text.
    fireEvent.click(screen.getByRole("button", { name: /CPU 6.75/ }));
    expect(screen.getByText("Weapon Upgrades")).toBeInTheDocument();
  });

  it("shows the slot and hardpoint counters, flagging the over-full one", () => {
    const { container } = render(<FitSheet view={view} />);
    expect(container.querySelectorAll(".counter-label")[0]?.textContent).toBe("High");   // scoped: the slot column title also starts with "High"
    expect(screen.getByText("5 / 3")).toBeInTheDocument();
    expect(container.querySelectorAll(".counter.over")).toHaveLength(1);
  });

  it("lists problems and missing skills as have → need", () => {
    render(<FitSheet view={view} />);
    expect(screen.getByText("8.75 MW over the ship's output")).toBeInTheDocument();
    expect(screen.getByText(/Small Autocannon Specialization I required/)).toBeInTheDocument();
    expect(screen.getByText("Minmatar Frigate")).toBeInTheDocument();
    expect(screen.getByText("0 → 1")).toBeInTheDocument();
  });

  it("lists cargo, drones, unknown types and the estimated value", () => {
    render(<FitSheet view={view} />);
    expect(screen.getByText("Hail S ×1000")).toBeInTheDocument();
    expect(screen.getByText("Hobgoblin II ×5")).toBeInTheDocument();
    expect(screen.getByText("Unknown type (99999) ×1")).toBeInTheDocument();
    expect(screen.getByText("13,100,100.00 ISK")).toBeInTheDocument();
    expect(screen.getByText("1 item unpriced")).toBeInTheDocument();
  });

  it("says so when no problems, no missing skills and no skills synced", () => {
    render(<FitSheet view={{
      ...view, skillsSynced: false, problems: [], missing: [], cargo: [], drones: [], unknown: [],
    }} />);
    expect(screen.getByText(/No skills synced yet/)).toBeInTheDocument();
    expect(screen.getByText("No problems — this fit is legal.")).toBeInTheDocument();
    expect(screen.getByText("Every skill for this fit is trained.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in the cargo hold or drone bay.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/affected-by.test.tsx tests/components/fit-sheet.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/ships/AffectedBy.js"` and the same for `FitSheet.js`.

- [ ] **Step 3: Write `src/app/ships/AffectedBy.tsx`**

```tsx
"use client";
import { useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ExplainRowView } from "../../lib/view/fit-sheet.js";

/**
 * Spec §4's "affected by" popover. The rows are computed on the server by `explain()` — this
 * component only opens and closes, so no engine data and no `DogmaData` ever reaches the browser.
 */
export function AffectedBy({ label, value, rows }: { label: string; value: string; rows: ExplainRowView[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return <span className="num">{value}</span>;
  return (
    <span className="affected">
      <button
        type="button" className="affected-btn num" aria-expanded={open}
        aria-label={`${label} ${value}, affected by ${rows.length} modifier${rows.length === 1 ? "" : "s"}`}
        onClick={() => setOpen((current) => !current)}
      >
        {value}
        <IconInfoCircle size={12} />
      </button>
      {open ? (
        <span className="popover" role="dialog" aria-label={`Affected by — ${label}`}>
          <span className="popover-title">Affected by</span>
          <ul className="popover-list">
            {rows.map((row, index) => (
              <li key={`${row.carrier}:${index}`}>
                <span>{row.carrier}</span>
                <span className="num">{row.operator} {row.value}</span>
                {row.penalised ? <span className="faint"> penalised</span> : null}
              </li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 4: Write `src/app/ships/FitSheet.tsx`**

```tsx
import type { FitSheetView, EntryView } from "../../lib/view/fit-sheet.js";
import { roman } from "../../lib/view/format.js";
import { AffectedBy } from "./AffectedBy.js";
import { Gauge } from "./Gauge.js";

function EntryList({ entries }: { entries: EntryView[] }) {
  return (
    <ul className="entry-list">
      {entries.map((entry) => (
        <li key={entry.key}>
          <span>{entry.name} ×{entry.quantity}</span>
          <span className="num muted">{entry.value ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Spec §4's fit sheet. Every value here was computed on the server by `buildFitSheet`. */
export function FitSheet({ view }: { view: FitSheetView }) {
  const holdEmpty = view.cargo.length === 0 && view.drones.length === 0;
  return (
    <div className="card-stack">
      <div className="card fit-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.renderUrl} alt="" className="fit-render" />
        <div>
          <h1 className="page-title">{view.title}</h1>
          <p className="page-sub">{view.typeName} · {view.subtitle}</p>
          <ul className="bonus-list">
            {view.bonuses.map((bonus, index) => (
              <li key={index}>
                {bonus.skill === null ? null : (
                  <span className="bonus-skill">{bonus.skill} {roman(bonus.level ?? 0)}</span>
                )}
                <span>{bonus.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {view.skillsSynced ? null : (
        <p className="card banner">
          No skills synced yet — every skill is treated as level 0, so these numbers are worst case.
        </p>
      )}

      <div className="card">
        <h2 className="card-title">Fitting</h2>
        {view.gauges.map((gauge) => <Gauge key={gauge.label} view={gauge} />)}
        <div className="counters">
          {view.counters.map((counter) => (
            <span key={counter.label} className={`counter${counter.over ? " over" : ""}`}>
              <span className="counter-label">{counter.label}</span>
              <span className="num">{counter.used} / {counter.total}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Modules</h2>
        <div className="slot-cols">
          {view.slots.map((column) => (
            <div key={column.slot} className="slot-col">
              <h3 className="slot-title">{column.title} <span className="faint">{column.used} / {column.total}</span></h3>
              {column.rows.length === 0 ? <p className="faint">Empty</p> : (
                <table className="table">
                  <tbody>
                    {column.rows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="module-icon" src={`https://images.evetech.net/types/${row.typeId}/icon?size=32`} alt="" />
                          {row.name}
                          {row.charge === null ? null : <span className="charge faint"> · {row.charge}</span>}
                        </td>
                        <td className="num"><AffectedBy label="CPU" value={row.cpu} rows={row.cpuExplain} /></td>
                        <td className="num"><AffectedBy label="Powergrid" value={row.power} rows={row.powerExplain} /></td>
                        <td className="muted">{row.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Problems</h2>
        {view.problems.length === 0 ? <p className="faint">No problems — this fit is legal.</p> : (
          <ul className="problem-list">
            {view.problems.map((problem, index) => (
              <li key={index}><span className="badge error">{problem.label}</span> {problem.text}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Missing skills</h2>
        {view.missing.length === 0 ? <p className="faint">Every skill for this fit is trained.</p> : (
          <table className="table">
            <thead><tr><th>Skill</th><th className="num">Have → need</th></tr></thead>
            <tbody>
              {view.missing.map((skill) => (
                <tr key={skill.skillTypeId}>
                  <td>{skill.name}</td>
                  <td className="num">{skill.have} → {skill.need}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Cargo &amp; drones</h2>
        {holdEmpty ? <p className="faint">Nothing in the cargo hold or drone bay.</p> : (
          <>
            {view.drones.length === 0 ? null : <><h3 className="slot-title">Drone bay</h3><EntryList entries={view.drones} /></>}
            {view.cargo.length === 0 ? null : <><h3 className="slot-title">Cargo</h3><EntryList entries={view.cargo} /></>}
          </>
        )}
        {view.unknown.length === 0 ? null : (
          <>
            <h3 className="slot-title">Unknown types</h3>
            <p className="faint">The static data does not know these types, so they are excluded from the calculation.</p>
            <EntryList entries={view.unknown} />
          </>
        )}
        {view.unfittable.length === 0 ? null : (
          <>
            <h3 className="slot-title">Not fitted</h3>
            <p className="faint">Saved with no slot, so the fitting window would not place them either.</p>
            <EntryList entries={view.unfittable} />
          </>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Estimated value</h2>
        <ul className="value-list">
          {view.value.lines.map((line) => (
            <li key={line.label}><span>{line.label}</span><span className="num">{line.value}</span></li>
          ))}
          <li className="value-total"><span>Total</span><span className="num">{view.value.total}</span></li>
        </ul>
        {view.value.unpriced === null ? null : <p className="faint">{view.value.unpriced}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the sheet classes to `src/app/globals.css`**

Append to the phase-4 block:
```css
.fit-head { display: flex; gap: 20px; align-items: flex-start; }
.fit-render { width: 128px; height: 128px; border-radius: 12px; border: 1px solid var(--divider); background: var(--raised); }
.fit-head .page-title { font-size: 26px; }
.fit-head .page-sub { margin-bottom: 12px; }
.bonus-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
.bonus-skill { color: var(--accent); margin-right: 8px; }
.counters { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.counter { display: flex; gap: 8px; align-items: baseline; background: var(--raised); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 12px; }
.counter.over { border-color: var(--neg); color: var(--neg); }
.counter-label { color: var(--faint); }
.slot-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
.slot-col { min-width: 0; }
.module-icon { width: 20px; height: 20px; vertical-align: middle; margin-right: 6px; border-radius: 3px; }
.slot-title { font-family: var(--font-poppins), sans-serif; font-size: 13px; font-weight: 600; margin: 0 0 6px; }
.charge { font-size: 12px; }
.affected { position: relative; display: inline-block; }
.affected-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; padding: 0; color: var(--text); font: inherit; cursor: pointer; }
.affected-btn:hover { color: var(--accent); }
.popover { position: absolute; right: 0; top: 100%; z-index: 50; width: 260px; display: block; background: var(--raised); border: 1px solid var(--border-hi); border-radius: 10px; padding: 10px 12px; box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5); }
.popover-title { display: block; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--faint); margin-bottom: 6px; }
.popover-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12px; }
.popover-list li { display: flex; justify-content: space-between; gap: 10px; }
.problem-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 13px; }
.entry-list { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; font-size: 13px; }
.entry-list li, .value-list li { display: flex; justify-content: space-between; gap: 12px; }
.value-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; }
.value-total { border-top: 1px solid var(--hairline); padding-top: 6px; font-weight: 600; }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components && npm run typecheck`
Expected: PASS, `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/ships/FitSheet.tsx src/app/ships/AffectedBy.tsx src/app/globals.css \
        tests/components/fit-sheet.test.tsx tests/components/affected-by.test.tsx
git commit -m "$(cat <<'EOM'
Add the fit sheet component and the affected-by popover

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 13: The two fit-sheet routes

Spec §4: `/ships/asset/[itemId]` for an assembled ship in assets and `/ships/fit/[fittingId]` for a saved
ESI fitting. Both are server components that load the character's fit data, build the one fit they are
about, price it, read the hull's bonuses and hand a `FitSheetView` to `<FitSheet>`. Neither route needs a
proxy change: `src/proxy.ts` protects everything that is not explicitly public.

**Files:**
- Create: `src/lib/ships/sheet.ts`, `src/app/ships/CouldNotCompute.tsx`, `src/app/ships/asset/[itemId]/page.tsx`, `src/app/ships/fit/[fittingId]/page.tsx`, `tests/db/ships-sheet.test.ts`
- Modify: `tests/components/fit-sheet.test.tsx` (append the `CouldNotCompute` case)

**Interfaces:**
- Consumes (Tasks 1, 6, 8–12 and phase 1/2/3a, verbatim):
```ts
// src/lib/ships/load.ts (Task 8)
export interface FitData { assets: AssetRow[]; fittings: FittingRow[]; ctx: FitContext; skillsSynced: boolean }
export function loadFitData(characterId: number): Promise<FitData>
// src/lib/view/ships.ts (Tasks 9, 10)
export const SAVED_FIT_LOCATION = "Saved fit";
export interface ShipGroup { ship: AssetRow; children: AssetRow[] }
export function assembledShips(assets: AssetRow[], data: DogmaData): ShipGroup[]
export function shipLocationLabel(ship: AssetRow, places: ReadonlyMap<number, { name: string }>, byItemId: ReadonlyMap<number, AssetRow>, data: DogmaData): string
export function fitValueEntries(built: BuiltFit): ValuedEntry[]
export interface ComputedFit { built: BuiltFit; stats: FitStats; problems: Problem[] }
export function computeFit(build: () => BuiltFit, what: string): ComputedFit | null
// src/lib/view/fit-sheet.ts (Task 11)
export function buildFitSheet(input: FitSheetInput): FitSheetView
// src/lib/sde/repo.ts (Task 6 + phase 2)
export function getTypeBonuses(typeId: number): Promise<SdeTypeBonus[]>
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>       // SdeType.name: string | null
// src/lib/db/market-prices.ts (Task 1)
export function getPrices(typeIds: number[]): Promise<Map<number, Price>>
// src/lib/names/index.ts
export async function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>
// src/lib/api/json.ts
export function parseId(raw: string): number | null
// src/lib/dogma/index.ts
const CATEGORY: { ship: 6; module: 7; charge: 8; skill: 16; drone: 18; implant: 20; subsystem: 32; fighter: 87 };
function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit
function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit
```
- Produces:
```ts
// src/lib/ships/sheet.ts
export type SheetResult =
  | { kind: "ok"; view: FitSheetView }
  | { kind: "notFound" }
  | { kind: "error"; title: string };
export function assetSheet(characterId: number, itemId: number): Promise<SheetResult>;
export function fittingSheet(characterId: number, fittingId: number): Promise<SheetResult>;
// src/app/ships/CouldNotCompute.tsx
export function CouldNotCompute({ title }: { title: string }): React.JSX.Element;
// the two route modules' default exports
```

**Decisions recorded here (do not re-litigate them):**
- **A saved fit's subtitle is `Saved fit`, not its description.** ESI fitting descriptions are
  player-authored HTML; the sheet does not render user HTML.
- Both routes call `loadFitData` and therefore read the whole asset list. That is the same query
  `/assets` already makes; there is no per-ship query and no second dogma load.
- An id that is not a positive integer, or that the character does not own, is a **404**
  (`notFound()`), not an empty sheet.
- The bonus skills get their names from **one** `getTypes` call; every other name on the page comes
  from `DogmaData`.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/ships-sheet.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import { resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { assetSheet, fittingSheet } from "../../src/lib/ships/sheet.js";

let pool: Pool;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
  resetDogmaCache();
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'Trill', 'enc')");
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton, name)
     VALUES (1, 1000, 587, 1, 60003760, 'station', 'Hangar', true, 'Scarlet Dart'),
            (1, 1001, 519, 1, 1000, 'item', 'LoSlot0', true, NULL)`);
  await pool.query(
    "INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES (1, 7, 'Solo Rifter', '<b>hi</b>', 587)");
  await pool.query(
    `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
     VALUES (1, 7, 0, 519, 1, 'LoSlot0')`);
  await pool.query("INSERT INTO market_prices (type_id, jita_sell_min) VALUES (587, 8000000)");
}, 180_000);
afterAll(closePool);

describe("assetSheet", () => {
  it("renders the docked Rifter's sheet from the mini SDE", async () => {
    const result = await assetSheet(1, 1000);
    // If this is not "ok", read the logged engine error: the sheet must render for a hull whose
    // required skills are only partly present in the mini SDE (phase 4a: unknown ids are skipped).
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const view = result.view;
    expect(view.title).toBe("Scarlet Dart");
    expect(view.typeName).toBe("Rifter");
    expect(view.renderUrl).toBe("https://images.evetech.net/types/587/render?size=128");
    // Phase 4a's asserted bare-hull numbers at skills 0.
    expect(view.gauges[0].text.endsWith("/ 130.00 tf")).toBe(true);
    expect(view.gauges[1].text.endsWith("/ 41.00 MW")).toBe(true);
    expect(view.slots.find((s) => s.slot === "low")!.rows[0].name).toBe("Gyrostabilizer II");
    expect(view.bonuses.map((b) => b.skill)).toEqual(["Minmatar Frigate", "Minmatar Frigate"]);
    expect(view.bonuses[0].level).toBe(0);
    expect(view.skillsSynced).toBe(false);
    expect(view.value.lines[0]).toEqual({ label: "Hull", value: "8,000,000.00 ISK" });
    expect(view.value.unpriced).toBe("1 item unpriced");     // the Gyrostabilizer has no price
  });

  it("404s for an item the character does not own", async () => {
    expect(await assetSheet(1, 999999)).toEqual({ kind: "notFound" });
  });

  it("404s for an item that is not an assembled ship", async () => {
    expect(await assetSheet(1, 1001)).toEqual({ kind: "notFound" });
  });
});

describe("fittingSheet", () => {
  it("renders a saved fit and never shows its player-authored description", async () => {
    const result = await fittingSheet(1, 7);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.view.title).toBe("Solo Rifter");
    expect(result.view.subtitle).toBe("Saved fit");
    expect(result.view.slots.find((s) => s.slot === "low")!.rows[0].name).toBe("Gyrostabilizer II");
  });

  it("404s for an unknown fitting", async () => {
    expect(await fittingSheet(1, 4242)).toEqual({ kind: "notFound" });
  });
});
```

Append to `tests/components/fit-sheet.test.tsx`:
```tsx
import { CouldNotCompute } from "../../src/app/ships/CouldNotCompute.js";

describe("CouldNotCompute", () => {
  it("names the fit and offers a way back", () => {
    render(<CouldNotCompute title="Scarlet Dart" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Scarlet Dart");
    expect(screen.getByText(/Could not compute/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ships/ })).toHaveAttribute("href", "/ships");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/db/ships-sheet.test.ts tests/components/fit-sheet.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/lib/ships/sheet.js"` and the same for
`CouldNotCompute.js`.

- [ ] **Step 3: Write `src/lib/ships/sheet.ts`**

```ts
import { getPrices } from "../db/market-prices.js";
import { getTypeBonuses, getTypes } from "../sde/repo.js";
import { locationLabels } from "../names/index.js";
import { CATEGORY, fitFromAssets, fitFromFitting, type BuiltFit } from "../dogma/index.js";
import { buildFitSheet, type FitSheetView } from "../view/fit-sheet.js";
import {
  SAVED_FIT_LOCATION, assembledShips, computeFit, fitValueEntries, shipLocationLabel,
} from "../view/ships.js";
import { loadFitData, type FitData } from "./load.js";

export type SheetResult =
  | { kind: "ok"; view: FitSheetView }
  | { kind: "notFound" }
  | { kind: "error"; title: string };

/**
 * The half both routes share: run the engine once, price everything on the sheet in one query, read
 * the hull's bonuses, and name the bonus skills with one `getTypes`. Every other name on the page
 * already lives in `DogmaData`.
 */
async function sheetFor(input: {
  data: FitData; key: string; title: string; subtitle: string; typeId: number; typeName: string;
  build: () => BuiltFit;
}): Promise<SheetResult> {
  const computed = computeFit(input.build, input.key);
  if (computed === null) return { kind: "error", title: input.title };
  const { built, stats, problems } = computed;

  const priceIds = [
    ...fitValueEntries(built).map((e) => e.typeId),
    ...built.unfittable.map((e) => e.typeId),
    ...built.unknown.map((e) => e.typeId),
  ];
  const [prices, bonuses] = await Promise.all([getPrices(priceIds), getTypeBonuses(input.typeId)]);
  const bonusSkillIds = [...new Set(bonuses.map((b) => b.skillTypeId).filter((id): id is number => id !== null))];
  const bonusTypes = await getTypes(bonusSkillIds);

  const skillNames = new Map<number, string>();
  for (const type of input.data.ctx.data.types.values()) {
    if (type.categoryId === CATEGORY.skill && type.name !== null) skillNames.set(type.id, type.name);
  }
  for (const [id, type] of bonusTypes) if (type.name !== null) skillNames.set(id, type.name);

  return {
    kind: "ok",
    view: buildFitSheet({
      title: input.title, subtitle: input.subtitle, typeId: input.typeId, typeName: input.typeName,
      built, stats, problems, bonuses,
      skillLevels: input.data.ctx.skills, skillNames, prices, skillsSynced: input.data.skillsSynced,
    }),
  };
}

/** `/ships/asset/[itemId]` — an assembled ship in the character's assets. */
export async function assetSheet(characterId: number, itemId: number): Promise<SheetResult> {
  const data = await loadFitData(characterId);
  const group = assembledShips(data.assets, data.ctx.data).find((g) => g.ship.itemId === itemId);
  if (group === undefined) return { kind: "notFound" };

  const places = await locationLabels(
    group.ship.locationType === "item" ? [] : [group.ship.locationId]);
  const byItemId = new Map(data.assets.map((a) => [a.itemId, a]));
  const typeName = data.ctx.data.types.get(group.ship.typeId)?.name ?? `Unknown type (${group.ship.typeId})`;

  return sheetFor({
    data, key: `asset:${itemId}`,
    title: group.ship.name ?? typeName,
    subtitle: shipLocationLabel(group.ship, places, byItemId, data.ctx.data),
    typeId: group.ship.typeId, typeName,
    build: () => fitFromAssets(group.ship, group.children, data.ctx),
  });
}

/** `/ships/fit/[fittingId]` — a saved ESI fitting. */
export async function fittingSheet(characterId: number, fittingId: number): Promise<SheetResult> {
  const data = await loadFitData(characterId);
  const fitting = data.fittings.find((f) => f.fittingId === fittingId);
  if (fitting === undefined) return { kind: "notFound" };
  const typeName = data.ctx.data.types.get(fitting.shipTypeId)?.name ?? `Unknown type (${fitting.shipTypeId})`;

  return sheetFor({
    data, key: `fit:${fittingId}`,
    title: fitting.name,
    // Deliberately not the description: it is player-authored HTML from the EVE client.
    subtitle: SAVED_FIT_LOCATION,
    typeId: fitting.shipTypeId, typeName,
    build: () => fitFromFitting(fitting, fitting.items, data.ctx),
  });
}
```

- [ ] **Step 4: Write `src/app/ships/CouldNotCompute.tsx`**

```tsx
import Link from "next/link";

/** Spec §6: an engine exception on a sheet is logged and the page says so instead of crashing. */
export function CouldNotCompute({ title }: { title: string }) {
  return (<>
    <h1 className="page-title">{title}</h1>
    <div className="card coming-soon">
      Could not compute this fit — the error was logged. <Link href="/ships">Back to Ships</Link>
    </div>
  </>);
}
```

- [ ] **Step 5: Write `src/app/ships/asset/[itemId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { readSession } from "../../../../lib/auth/session.js";
import { listCharacters } from "../../../../lib/db/characters.js";
import { parseId } from "../../../../lib/api/json.js";
import { assetSheet } from "../../../../lib/ships/sheet.js";
import { pickActive } from "../../../../lib/view/characters.js";
import { NoCharacter } from "../../../components/NoCharacter.js";
import { CouldNotCompute } from "../../CouldNotCompute.js";
import { FitSheet } from "../../FitSheet.js";

export default async function AssetFitPage({ params }: { params: Promise<{ itemId: string }> }) {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const itemId = parseId((await params).itemId);
  if (itemId === null) notFound();
  const result = await assetSheet(character.id, itemId);
  if (result.kind === "notFound") notFound();
  if (result.kind === "error") return <CouldNotCompute title={result.title} />;
  return <FitSheet view={result.view} />;
}
```

- [ ] **Step 6: Write `src/app/ships/fit/[fittingId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { readSession } from "../../../../lib/auth/session.js";
import { listCharacters } from "../../../../lib/db/characters.js";
import { parseId } from "../../../../lib/api/json.js";
import { fittingSheet } from "../../../../lib/ships/sheet.js";
import { pickActive } from "../../../../lib/view/characters.js";
import { NoCharacter } from "../../../components/NoCharacter.js";
import { CouldNotCompute } from "../../CouldNotCompute.js";
import { FitSheet } from "../../FitSheet.js";

export default async function SavedFitPage({ params }: { params: Promise<{ fittingId: string }> }) {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const fittingId = parseId((await params).fittingId);
  if (fittingId === null) notFound();
  const result = await fittingSheet(character.id, fittingId);
  if (result.kind === "notFound") notFound();
  if (result.kind === "error") return <CouldNotCompute title={result.title} />;
  return <FitSheet view={result.view} />;
}
```

- [ ] **Step 7: Run the tests and the build**

```bash
npx vitest run tests/db/ships-sheet.test.ts tests/components/fit-sheet.test.tsx
npm run typecheck
npm run build
```
Expected: tests PASS; `tsc --noEmit` clean; `next build` succeeds and lists the two dynamic routes
(`/ships/asset/[itemId]`, `/ships/fit/[fittingId]`). A build failure naming `pg` or `node:*` inside a
client bundle means `AffectedBy` picked up a server-only import — fix that, do not add a polyfill.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ships/sheet.ts src/app/ships/CouldNotCompute.tsx \
        "src/app/ships/asset/[itemId]/page.tsx" "src/app/ships/fit/[fittingId]/page.tsx" \
        tests/db/ships-sheet.test.ts tests/components/fit-sheet.test.tsx
git commit -m "$(cat <<'EOM'
Add the /ships/asset and /ships/fit sheet routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 14: Deploy phase 4 to the VM and record acceptance

This is the acceptance for **all of phase 4** — 4a's engine and 4b's market job and pages. No Ansible or
env changes: the existing `eve` role rsyncs the repo, rebuilds the image, runs `npm run migrate` (which now
applies `market_prices` from `db/schema.sql`) and restarts the app and worker.

**⚠ One thing the deploy does not do by itself.** Phase 4a added two columns to `sde_dogma_attributes`
(`max_attribute_id`, `min_attribute_id`). The importer rebuilds the `sde_*` tables wholesale, but the
`sde-update` job **skips when the build number is unchanged** — so the VM's tables would keep the old
shape, with both columns NULL, until CCP publishes a new build. The engine's `maxAttributeId` capping
would silently do nothing. Step 5 therefore forces a re-import and Step 6 checks it landed.

**Files:**
- Modify: `deploy/README.md` (a short "Market prices" section)

**Interfaces:**
- Consumes: Tasks 1–13 of this plan and Tasks 1–15 of the 4a plan, all committed on `feature/phase4-ships`.
- Produces: `https://eve.plasma66.com/ships` serving live fit sheets, and `ok` rows in `sync_runs` for
  `market-prices`.

- [ ] **Step 1: Confirm the branch is clean and green**

```bash
cd /home/daniel/AI/Plasma/EVE
git status --short
docker compose -f compose.dev.yml up -d
npm test && npm run typecheck && npm run build
```
Expected: no uncommitted changes; every test passes; `tsc --noEmit` clean; `next build` succeeds.

- [ ] **Step 2: Document the market job in `deploy/README.md`**

Insert after the "Static data (SDE)" section:
```markdown
## Market prices

The worker's `market-prices` job runs hourly and fills the `market_prices` table from two sources:

- `GET /markets/prices` (ESI, public, one request, ~1.1 MB) → `adjusted_price` / `average_price` for
  every market type in the game. These are CCP's reference values, not tradeable prices.
- `https://market.fuzzwork.co.uk/aggregates/?region=10000002` (Jita's region) in batches of 500 type
  ids, for the *types of interest* only — everything the characters own, everything in a saved fit and
  everything traded in the last 30 days → `jita_sell_min` / `jita_buy_max`.

Fuzzwork is one person's server with no SLA. If it fails, the run still finishes `ok` and `/settings`
shows the message in amber behind a `warn:` prefix; the ESI reference prices stay in place and the
Ships pages fall back to them (`priceOf = sell ?? adjusted`). An ESI failure is a real error and the
job retries after 10 minutes.

Prices are empty until the first run, so `/ships` shows `0 ISK` and "n items unpriced" on a fresh
deploy for up to an hour.
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
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
ssh daniel@10.5.5.150 'docker logs --tail 60 eve-worker'
curl -sS https://eve.plasma66.com/api/health
```
Expected: `eve-app`, `eve-worker`, `eve-postgres`, `traefik` all `Up`; the worker log says
`[worker] started with 9 jobs`; health returns `{"ok":true,"db":true}`.

- [ ] **Step 5: Force an SDE re-import so the two new dogma columns are populated**

```bash
ssh daniel@10.5.5.150 'cd /opt/eve/src/deploy && docker compose exec -T worker npm run sde:import'
```
Expected: the import logs its table counts and finishes in roughly five minutes — it downloads ~95 MB
and swaps the tables atomically. This is bounded work; if it is still running after ~10 minutes, check
`docker logs --tail 100 eve-worker` before re-running.

- [ ] **Step 6: Check the new columns landed, and restart so the caches reload**

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select count(*) from sde_dogma_attributes where max_attribute_id is not null\""
```
Expected: **29** — the SDE archive has exactly 29 attributes with a `maxAttributeID`. A `0` means the
re-import ran against the old DDL (the deploy did not pick up phase 4a's `src/lib/sde/ddl.ts`); an
error mentioning the column means the migration did not run at all.

The app and worker memoise `DogmaData` per process, and that cache has no invalidation hook, so it must
be dropped by restarting:
```bash
ssh daniel@10.5.5.150 'cd /opt/eve/src/deploy && docker compose restart app worker'
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
```
Expected: both containers `Up` again within a few seconds.

- [ ] **Step 7: Poll until `market-prices` has an `ok` run**

The job is global and due on the worker's first tick, so this is minutes, not hours. **Do not use a
foreground `sleep`** — re-issue this roughly once a minute (the Monitor tool with an until-condition is
the tidy way), for **at most 20 minutes**, until `status` reads `ok`:

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select status, rows, coalesce(error, '-') from sync_runs
  where job = 'market-prices' order by started_at desc limit 1\""
```
Expected eventually: `ok|<n>|-` with `n` in the tens of thousands (every market type from ESI plus the
Jita aggregates). `ok|<n>|warn: Fuzzwork aggregates failed …` is an **acceptable** outcome per spec §3 —
record it, and check `jita_sell_min` in Step 8 is NULL rather than wrong. `error|…` is a failure: read
the message and `docker logs --tail 200 eve-worker`.

- [ ] **Step 8: Check `market_prices` is populated, including a real Jita price for Tritanium**

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select count(*) from market_prices;
  select count(*) from market_prices where jita_sell_min is not null;
  select type_id, adjusted_price, average_price, jita_sell_min, jita_buy_max from market_prices where type_id = 34\""
```
Expected: a total row count in the tens of thousands; a non-zero count of rows with a Jita price (one
per type of interest that has orders); and for **type 34 (Tritanium)** a `jita_sell_min` of a few ISK
(≈ 3–6) together with an `adjusted_price`. Tritanium is in every character's assets, so it is always a
type of interest.

- [ ] **Step 9: Verify the Ships pages (Daniel, in a browser on the tailnet)**

1. `https://eve.plasma66.com/ships` — with TrilliumONE active, the **Fitted ships** section lists the
   ship the character is docked in (and every other assembled hull), each card showing the custom name
   or type, the station or system it is in, CPU and powergrid gauges with real numbers, a missing-skill
   count or "All skills trained", and an ISK value. Cards are ordered most valuable first. No card says
   "Could not compute".
2. The **Saved fits** section lists the ESI fittings with the same card.
3. Click the docked ship's card → `/ships/asset/<itemId>`: the render, the hull's bonuses with the
   character's level, five slot columns with each module's CPU/PG to two decimals and its state, the
   loaded charge beside its launcher/turret, three gauges, slot and hardpoint counters, the Problems
   list, Missing skills as `have → need`, Cargo & drones with quantities, and Estimated value.
4. Click a CPU or PG figure → the **affected by** popover opens listing the skills/modules that changed
   it, and closes on a second click.
5. Click a saved fit's card → `/ships/fit/<fittingId>` renders the same sheet with the subtitle
   "Saved fit".
6. `https://eve.plasma66.com/settings` — Sync status lists `market-prices` as `ok` (or amber `warn:`).

- [ ] **Step 10: Operator check — compare one sheet with the in-game fitting window**

Open the same ship in EVE's fitting window and compare, for the sheet from Step 9.3:

| Sheet | In-game |
|---|---|
| CPU used / output | The CPU bar's two numbers |
| Powergrid used / output | The powergrid bar's two numbers |
| Calibration used / output | The calibration bar |
| Each module's CPU tf and PG MW | The module's tooltip / "show info" attributes |
| Slot and hardpoint counters | The empty/filled slots around the hull |

Expected: exact agreement on CPU and powergrid totals and outputs (the engine rounds those to two
decimals exactly as EVE does). Record any discrepancy — module, attribute, both numbers — in the
acceptance commit message; a mismatch is a phase-4a engine bug, not a UI bug.

- [ ] **Step 11: Commit the acceptance and merge**

```bash
cd /home/daniel/AI/Plasma/EVE
git add deploy/README.md
git commit -m "$(cat <<'EOM'
Deploy phase 4 (dogma engine, market prices, Ships pages) and record acceptance

Acceptance: forced SDE re-import populated max_attribute_id on 29 attributes;
market-prices finished ok with <n> rows and a Jita sell price for Tritanium
(type 34) of <x> ISK; /ships lists TrilliumONE's docked ship with CPU/PG
gauges and <n> saved fits; the asset and saved-fit sheets render slot columns,
problems, missing skills, cargo/drones and an estimated value, and the
affected-by popover opens. Operator comparison against the in-game fitting
window: <exact agreement | the discrepancies>.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
git checkout main && git merge --no-ff feature/phase4-ships
```

---

## Self-review

**1. Spec coverage.**

| Spec | Task |
|---|---|
| §3 `market_prices` table + repo (`upsertEsiPrices`, `upsertJitaPrices`, `getPrices`) | 1 |
| §3 `priceOf(p) = sell ?? adjusted ?? null` | 1 |
| §3 Fuzzwork aggregates: region 10000002, chunks of 500, `ESI_USER_AGENT`, string values, `"0"` → NULL | 2 |
| §3 types of interest (assets, fitting items, fitting hulls, 30-day transactions) | 3 |
| §3 Fuzzwork failure → run `ok` with `warn:` in the error column | 4 (mechanism), 5 (use) |
| §3 global `market-prices` job, 1 h, ESI `/markets/prices` public | 5 |
| §4 `/ships` fitted ships + saved fits, gauges, missing-skill count, value, sorted by value | 9, 10 |
| §4 fit sheet header: render URL, name, type, `sde_type_bonuses` with the character's level | 6, 11, 12, 13 |
| §4 slot columns, per-module CPU/PG 2 dp, charge, state | 11, 12 |
| §4 three gauges (`.gauge` + `.over`), slot/hardpoint counters | 7, 11, 12 |
| §4 Problems, Missing skills (have → need), Cargo & drones, Estimated value + "n items unpriced" | 7, 11, 12 |
| §4 affected-by popover per CPU/PG cell from `explain`, engine on the server | 11, 12 |
| §4 the two routes | 13 |
| §5 schema change | 1 |
| §6 unknown type ids → `Unknown type (id)`, excluded | 11 (`entryViews`), 12 |
| §6 engine exceptions caught per fit → "Could not compute" + `console.error` | 10 (`computeFit`), 13 |
| §6 no skills synced → level 0 + banner | 8 (`skillsSynced`), 10, 11, 12 |
| §7 market job with mocked fetch (chunking, string parsing, `"0"`, warn) | 2, 5 |
| §7 `market_prices` repo upsert on real Postgres | 1 |
| §7 builder integration on hand-written rows against the `rifter` snapshot | 9 |
| §7 component tests: card gauges, sheet problems/missing skills, popover | 9, 12 |
| §7 acceptance on the VM | 14 |

Not in scope here (phase 4a): §2, §7's engine-unit-test and fixture bullets. Out of scope entirely
(spec §8): editing fits, DPS/tank, projected effects, mutated modules.

**2. Placeholder scan.** No "TBD", no "similar to Task N", no "add error handling" — every code step
carries the code. The one deliberately open value is the acceptance commit message's `<n>`/`<x>`
placeholders, which are measurements the operator fills in at Step 11.

**3. Type consistency.** Names used across tasks, checked end to end: `Price`/`priceOf` (1) → `rollUpValue`
(7) → `toShipCard` (9) → `buildFitSheet` (11); `EsiPriceRow`/`JitaPriceRow` (1) → `fetchAggregates` (2) →
`MarketPricesDeps` (5); `JobOutcome`/`WARN_PREFIX`/`isWarning` (4) → `market-prices` (5) → `SyncStatus` (4);
`GaugeView`/`gauge` (7) → `ShipCardView` (9) → `FitSheetView` (11) → `<Gauge>` (9, 12);
`ShipGroup`/`assembledShips`/`shipLocationLabel`/`fitValueEntries` (9) → `assetShipCards` (10) →
`assetSheet` (13); `ComputedFit`/`computeFit` (10) → `sheetFor` (13); `ExplainRowView` (11) →
`<AffectedBy>` (12); `SdeTypeBonus` (6) → `FitSheetInput.bonuses` (11) → `sheetFor` (13);
`FitData`/`loadFitData` (8) → 10 and 13. Every phase-4a symbol consumed is quoted verbatim from that
plan's "Interfaces for phase 4b" section in the Consumes block of the task that uses it.

**4. Phase-4a gaps found.** None: every engine symbol this plan consumes is in 4a's interface section.
The one **new** reader this phase needs is `getTypeBonuses` in `src/lib/sde/repo.ts` (phase 2 imports
`sde_type_bonuses` but never reads it) — Task 6, with a real-Postgres test.
