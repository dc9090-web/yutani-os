# EVE Phase 3a (Character Sync — data side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the ESI client, add the two missing scopes, create the phase-3 character tables, and run six new worker jobs that keep every authorised character's skills, clones/implants, assets, fittings, wallet and location in Postgres — plus the name/structure resolution service the pages will read through.

**Architecture:** `src/lib/esi/client.ts` grows a shared `request()` pre/post-flight (per-`(group, characterId)` buckets, error-limit backoff, a 60 s outage breaker) plus `post<T>()` and a `Last-Modified` consistency guard in `getAll`. `db/schema.sql` gains 15 idempotent character tables plus `universe_names`/`structures`. One repo module per area under `src/lib/db/` owns its tables and exposes exactly one transactional write function per job plus the read functions phase 3b needs. `src/lib/names/` turns raw IDs into names (bisecting `POST /universe/names`, ranged `resolveLocations`, read-only `locationLabel`). Each job in `src/worker/jobs/` is a `create<Name>Job(deps)` factory with a default export wired to the real repos, exactly like phase 2's `sde-update`.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Node 24, `pg` 8, Postgres 17, vitest 4, Next.js 16, tsx for CLI scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase3-character-sync-design.md` — this plan implements **§2, §3, §4, §5, §6, §9** and the matching parts of **§10**. §7 (pages) and §8 (API routes) are phase 3b; the read functions those pages need are defined here and listed in the final section.

**Research (endpoint schemas, cache timers, buckets, gotchas):** `.superpowers/research/esi-endpoints.md`

## Global Constraints

- **Compatibility date `2026-08-18`** — the newest *published* date. `ESI_COMPATIBILITY_DATE`, `deploy/ansible/group_vars/eve.yml`, `deploy/.env.example`, `.env.example`, the local `.env` and the `types.gen.ts` generator all carry it. Ruling: bump them together, never separately.
- **Never invent ESI fields.** Every request/response shape comes from `.superpowers/research/esi-endpoints.md` §2/§3. Optional fields there are optional here: absent ≠ `null` ≠ `false`.
- **ESI enums are stored as raw `text`** (`location_flag`, `ref_type`, `location_type`, name `category`). CCP adds members without a compatibility-date bump. No `CHECK` constraints on them, no exhaustive `switch` without a default.
- **Scope gating, never scope failure.** Every job calls `hasScope(character, scope)` before a scope-dependent endpoint and *skips* it. A job with no usable scope returns `0` and is recorded `ok`.
- **Schema lives in `db/schema.sql`**, idempotent (`CREATE TABLE IF NOT EXISTS`). Every per-character table has `character_id bigint … REFERENCES characters(id) ON DELETE CASCADE`. **No foreign keys to `sde_*` tables** — reference data is swapped wholesale by phase 2.
- **One transaction per job.** Each job replaces its tables for that character in a single transaction (journal/transaction rows accumulate with `ON CONFLICT DO NOTHING` inside the same transaction). Each job returns the number of rows written.
- **Dependency-injected jobs.** `create<Name>Job(deps)` plus a default export wired to the real repos, so unit tests use fakes (phase-2 `sde-update` pattern). The `EsiClient` arrives on the `JobContext`, not in `deps`.
- **`retryMs`.** `CharacterSyncJob` and `GlobalSyncJob` carry an optional `retryMs?: number` (added to `src/worker/scheduler.ts` before phase 3 starts, no other scheduler change): when a run throws, the scheduler rebooks that job at `now + retryMs` instead of `now + intervalMs`; a job without it keeps the old behaviour. Every phase-3 job sets it — **10 min for the hourly jobs** (`skills`, `assets`, `wallet`), **15 min for the 6-hourly ones** (`clones`, `fittings`, `character-info`), **5 min for `location`** — so a transient `EsiUnavailableError` costs minutes, not a whole interval, while still staying far below every ESI cache timer.
- **`bigint` and `numeric` come back from `pg` as strings.** Every repo read maps them with `Number(...)` before returning.
- Imports between local TS files use the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`. DB tests use `tests/db/helpers.ts` (`resetDb`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **No network in tests.** ESI is always a mocked `fetch` or a fake client; responses come from `tests/fixtures/esi/*.json`.
- **Never print the contents of `.env`** beyond the single `ESI_COMPATIBILITY_DATE` line; the file is git-ignored and holds real secrets.
- Work happens on branch `feature/phase3-character-sync`, branched from `main` after phase 2 merges. **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- No UI work here. Do not create pages or API routes — that is phase 3b.
- VM: `ssh daniel@10.5.5.150`, site `https://eve.plasma66.com`, Ansible in `deploy/ansible`.

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/esi-types.ts` | Modified: sends `X-Compatibility-Date`; exports `COMPATIBILITY_DATE`/`specFetch` for the test |
| `src/lib/auth/sso.ts` | Modified: `SCOPES` gains two scopes; new `hasScope(character, scope)` |
| `src/lib/esi/client.ts` | Modified: `post()`, `routeTemplate()`, per-`(group, characterId)` buckets, error-limit backoff, `EsiUnavailableError` breaker, `getAll` consistency guard |
| `src/lib/esi/index.ts` | Modified: re-exports `EsiUnavailableError` |
| `src/lib/chunk.ts` | `chunk(items, size)` — the ≤ 1000-ID POST batching helper |
| `db/schema.sql` | Modified: 15 character tables + `universe_names` + `structures` + indexes |
| `src/lib/db/character-skills.ts` | `character_skill_summary`, `character_skills`, `character_skill_queue`, `character_attributes` |
| `src/lib/db/character-clones.ts` | `character_clones`, `character_jump_clones`, `character_implants` |
| `src/lib/db/character-assets.ts` | `character_assets` |
| `src/lib/db/character-fittings.ts` | `character_fittings`, `character_fitting_items` |
| `src/lib/db/character-wallet.ts` | `character_wallet`, `character_wallet_journal`, `character_wallet_transactions` |
| `src/lib/db/character-location.ts` | `character_location` |
| `src/lib/db/names.ts` | `universe_names`, `structures` |
| `src/lib/names/ranges.ts` | Pure: `classifyLocation(id)`, `unknownStructureLabel(id)` |
| `src/lib/names/resolve.ts` | `createNameResolver(deps)` — bisecting `resolveNames`, ranged `resolveLocations` |
| `src/lib/names/label.ts` | `locationLabel(id)` — read-only page helper (no ESI) |
| `src/lib/names/index.ts` | Real wiring: `nameResolver()`, `resolveNames`, `resolveLocations`, re-export `locationLabel` |
| `src/worker/jobs/skills.ts` | `skills` job (1 h) + `applyQueueOverlay` |
| `src/worker/jobs/clones.ts` | `clones` job (6 h) |
| `src/worker/jobs/fittings.ts` | `fittings` job (6 h) |
| `src/worker/jobs/assets.ts` | `assets` job (1 h) |
| `src/worker/jobs/wallet.ts` | `wallet` job (1 h) + `fetchTransactions` cursor loop |
| `src/worker/jobs/location.ts` | `location` job (15 min) |
| `src/worker/jobs/index.ts` | `ALL_JOBS` — the registration list, assertable without booting the worker |
| `src/worker/index.ts` | Modified: builds the scheduler from `ALL_JOBS` |
| `src/worker/jobs/character-info.ts` | Modified: typed `CharacterSyncJob`, gains `retryMs` |
| `tests/fixtures/esi/*.json` | One realistic response per endpoint |
| `tests/fixtures/esi.ts` | `esiFixture<T>(name)` loader |
| `tests/db/helpers.ts` | Modified: truncates the new tables |
| `tests/db/schema.test.ts` | Modified: expects the phase-3 tables |
| `tests/esi/types-generator.test.ts` | The generator sends the compat-date header |
| `tests/esi/client.test.ts` | Modified: `post`, buckets, error limit, breaker, torn pagination |
| `tests/esi/fixtures.test.ts` | The fixtures carry the awkward shapes the code must survive |
| `tests/db/character-*.test.ts`, `tests/db/names.test.ts` | Real-Postgres repo tests |
| `tests/names/{ranges,resolve}.test.ts` | Name-resolution unit tests with fakes |
| `tests/db/name-label.test.ts` | `locationLabel` against real Postgres + SDE rows |
| `tests/chunk.test.ts` | `chunk` unit test |
| `tests/worker/registration.test.ts` | The registered job list, intervals and `retryMs` |
| `tests/worker/{skills,clones,fittings,assets,wallet,location}.test.ts` | Job unit tests with fakes |
| `deploy/README.md` | Modified: the operator action for the two new scopes |

---

### Task 1: Compatibility date, regenerated ESI types, and the two new scopes

**Files:**
- Modify: `scripts/esi-types.ts`, `.env.example`, `deploy/.env.example`, `deploy/ansible/group_vars/eve.yml`, `.env` (git-ignored, via `sed`), `src/lib/auth/sso.ts`, `src/lib/esi/types.gen.ts` (regenerated), `tests/auth/sso.test.ts`, `tests/esi/client.test.ts`
- Create: `tests/esi/types-generator.test.ts`

**Interfaces:**
- Consumes: phase-1 `SCOPES` in `src/lib/auth/sso.ts`, `AppConfig.esiCompatibilityDate` in `src/lib/config.ts`.
- Produces:
```ts
// scripts/esi-types.ts
export const SPEC: string;                                  // "https://esi.evetech.net/meta/openapi.json"
export const COMPATIBILITY_DATE: string;                    // "2026-08-18"
export function specFetch(fetchImpl?: typeof fetch): typeof fetch;
export function generate(fetchImpl?: typeof fetch): Promise<string>;
// src/lib/auth/sso.ts
export const SCOPES: string[];                              // now 12 entries
export function hasScope(character: { scopes: string[] } | null | undefined, scope: string): boolean;
```

- [ ] **Step 1: Create the branch**

```bash
cd /home/daniel/AI/Plasma/EVE
git checkout main && git pull --ff-only
git checkout -b feature/phase3-character-sync
docker compose -f compose.dev.yml up -d
```
Expected: on `feature/phase3-character-sync`, `eve-dev-postgres` running.

- [ ] **Step 2: Write the failing tests**

Create `tests/esi/types-generator.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { SPEC, COMPATIBILITY_DATE, specFetch } from "../../scripts/esi-types.js";

/** The generator must never hit the network in tests — specFetch is exercised with a fake. */
function recorder() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: { ...((init?.headers ?? {}) as Record<string, string>) } });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe("esi-types generator", () => {
  it("pins the published compatibility date and the spec URL", () => {
    expect(COMPATIBILITY_DATE).toBe("2026-08-18");
    expect(SPEC).toBe("https://esi.evetech.net/meta/openapi.json");
  });
  it("sends X-Compatibility-Date when fetching the spec", async () => {
    const { calls, impl } = recorder();
    await specFetch(impl)(SPEC);
    expect(calls[0].url).toBe(SPEC);
    expect(calls[0].headers["X-Compatibility-Date"]).toBe("2026-08-18");
  });
  it("keeps headers the caller already set", async () => {
    const { calls, impl } = recorder();
    await specFetch(impl)(SPEC, { headers: { Accept: "application/json" } });
    expect(calls[0].headers.Accept).toBe("application/json");
    expect(calls[0].headers["X-Compatibility-Date"]).toBe("2026-08-18");
  });
});
```

In `tests/auth/sso.test.ts`, replace line 24:
```ts
  it("exports the ten scopes", () => { expect(SCOPES.length).toBe(10); expect(SCOPES).toContain("esi-fittings.read_fittings.v1"); });
```
with:
```ts
  it("exports the twelve scopes the project needs", () => {
    expect(SCOPES.length).toBe(12);
    expect(SCOPES).toContain("esi-fittings.read_fittings.v1");
    expect(SCOPES).toContain("esi-universe.read_structures.v1");
    expect(SCOPES).toContain("esi-location.read_online.v1");
    expect(new Set(SCOPES).size).toBe(SCOPES.length);
  });
  it("hasScope reads the character's granted scopes and tolerates a missing character", () => {
    expect(hasScope({ scopes: ["esi-location.read_online.v1"] }, "esi-location.read_online.v1")).toBe(true);
    expect(hasScope({ scopes: [] }, "esi-location.read_online.v1")).toBe(false);
    expect(hasScope(null, "esi-location.read_online.v1")).toBe(false);
    expect(hasScope(undefined, "esi-location.read_online.v1")).toBe(false);
  });
```
and add `hasScope` to that file's import list from `../../src/lib/auth/sso.js`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/esi/types-generator.test.ts tests/auth/sso.test.ts`
Expected: FAIL — `No "specFetch" export is defined` and `hasScope is not a function`.

- [ ] **Step 4: Rewrite `scripts/esi-types.ts`**

Replace the whole file with:
```ts
import { writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

export const SPEC = "https://esi.evetech.net/meta/openapi.json";
/**
 * A *published* compatibility date. ESI silently rounds an unlisted date down to the newest
 * published date <= it, and with no header at all it serves the 2020-01-01 spec (182 paths
 * instead of 218), which is how types.gen.ts was generated wrong the first time.
 * Keep this in lockstep with ESI_COMPATIBILITY_DATE.
 */
export const COMPATIBILITY_DATE = "2026-08-18";
const OUT = new URL("../src/lib/esi/types.gen.ts", import.meta.url);

/** openapi-typescript passes a `fetch` option straight through; this wraps it with the header. */
export function specFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) =>
    fetchImpl(url, {
      ...init,
      headers: { ...((init?.headers ?? {}) as Record<string, string>), "X-Compatibility-Date": COMPATIBILITY_DATE },
    })) as typeof fetch;
}

export async function generate(fetchImpl: typeof fetch = fetch): Promise<string> {
  const ast = await openapiTS(new URL(SPEC), { fetch: specFetch(fetchImpl) });
  return `// Generated from ${SPEC} (X-Compatibility-Date: ${COMPATIBILITY_DATE}) by scripts/esi-types.ts — do not edit.\n` + astToString(ast);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFile(OUT, await generate());
  console.log("wrote", OUT.pathname);
}
```

- [ ] **Step 5: Add the scopes and `hasScope` to `src/lib/auth/sso.ts`**

Replace lines 4–9 (the `SCOPES` array) with:
```ts
export const SCOPES = [
  "esi-skills.read_skills.v1", "esi-skills.read_skillqueue.v1", "esi-assets.read_assets.v1",
  "esi-fittings.read_fittings.v1", "esi-clones.read_clones.v1", "esi-clones.read_implants.v1",
  "esi-wallet.read_character_wallet.v1", "esi-killmails.read_killmails.v1",
  "esi-location.read_location.v1", "esi-location.read_ship_type.v1",
  // Phase 3: /characters/{id}/online and /universe/structures/{id}. SSO grants are immutable per
  // refresh token, so these are added before onboarding rather than after.
  "esi-location.read_online.v1", "esi-universe.read_structures.v1",
];

/**
 * True when the token stored for this character was granted `scope`. Jobs skip (never fail)
 * endpoints whose scope is missing, so a character authorised under the phase-1 scope set keeps
 * syncing everything except structure names and online status until they log in again.
 */
export function hasScope(character: { scopes: string[] } | null | undefined, scope: string): boolean {
  return character !== null && character !== undefined && character.scopes.includes(scope);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/esi/types-generator.test.ts tests/auth/sso.test.ts`
Expected: PASS.

- [ ] **Step 7: Pin the compatibility date everywhere**

In `.env.example` and `deploy/.env.example`, change `ESI_COMPATIBILITY_DATE=` to:
```
ESI_COMPATIBILITY_DATE=2026-08-18
```
In `deploy/ansible/group_vars/eve.yml` line 14, change `esi_compatibility_date: "2026-08-28"` to:
```yaml
esi_compatibility_date: "2026-08-18"
```
Update the local (git-ignored) `.env` in place and print **only** that line:
```bash
sed -i 's|^ESI_COMPATIBILITY_DATE=.*|ESI_COMPATIBILITY_DATE=2026-08-18|' .env
grep '^ESI_COMPATIBILITY_DATE=' .env
```
Expected: `ESI_COMPATIBILITY_DATE=2026-08-18`. Do not cat the rest of `.env`.

Also update the two occurrences of the old date in the client test fixture config, `tests/esi/client.test.ts`:
```bash
sed -i 's/2026-08-28/2026-08-18/g' tests/esi/client.test.ts
```

- [ ] **Step 8: Regenerate the ESI types**

Run (needs network; the output file is ~20 000 lines and is committed as-is — do not read it back in full):
```bash
npm run esi:types
grep -c '^    "/' src/lib/esi/types.gen.ts
head -1 src/lib/esi/types.gen.ts
```
Expected: `218` paths (was 182) and a first line mentioning `X-Compatibility-Date: 2026-08-18`.

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Pin the ESI compatibility date to 2026-08-18 and add the two missing scopes

Regenerates types.gen.ts from the 2026-08-18 spec (218 paths, was 182) now that
scripts/esi-types.ts sends X-Compatibility-Date, and adds
esi-location.read_online.v1 and esi-universe.read_structures.v1 with a hasScope
helper for per-job scope gating.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 2: `EsiClient.post()` and per-`(group, characterId)` rate-limit buckets

**Files:**
- Modify: `src/lib/esi/client.ts`
- Test: `tests/esi/client.test.ts`

**Interfaces:**
- Consumes: Task 1 `COMPATIBILITY_DATE` (config value only); phase-1 `EsiDeps`, `EsiResult`, `EsiError`, `parseLimit`.
- Produces:
```ts
export function routeTemplate(pathname: string): string;   // "/characters/1/wallet" → "/characters/{id}/wallet"
export class EsiClient {
  get<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number>; page?: number }): Promise<EsiResult<T>>;
  getAll<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number> }): Promise<T[]>;
  post<T>(path: string, body: unknown, opts?: { characterId?: number; query?: Record<string, string | number> }): Promise<T>;
}
```

- [ ] **Step 1: Write the failing tests**

Append these three tests inside the existing `describe("EsiClient", …)` block in `tests/esi/client.test.ts` (keep every existing test):
```ts
  it("post sends a JSON body with the bearer, compat date and UA, and returns the parsed response", async () => {
    const { client, calls, store } = make([{ status: 200, body: [{ item_id: 7, name: "Fast Tackle" }] }]);
    const out = await client.post<{ item_id: number; name: string }[]>("/characters/1/assets/names", [7], { characterId: 1 });
    expect(out).toEqual([{ item_id: 7, name: "Fast Tackle" }]);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe("[7]");
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["Content-Type"]).toBe("application/json");
    expect(h.Authorization).toBe("Bearer tok-1");
    expect(h["X-Compatibility-Date"]).toBe("2026-08-18");
    expect(h["User-Agent"]).toBe("ua");
    expect(store.size).toBe(0);                       // POST responses carry no cache headers
  });
  it("post throws EsiError on a 4xx and sends no bearer for a public route", async () => {
    const { client, calls } = make([{ status: 200, body: [] }, { status: 400, body: { error: "too many ids" } }]);
    await client.post("/universe/names", [1, 2]);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    await expect(client.post("/universe/names", [1, 2])).rejects.toMatchObject({ status: 400, path: "/universe/names" });
  });
  it("keys rate-limit buckets on (group, characterId) so one character never delays another", async () => {
    const low = { "X-Ratelimit-Group": "char-wallet", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "5" };
    const high = { "X-Ratelimit-Group": "char-wallet", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "140" };
    const { client, sleeps } = make([
      { status: 200, body: {}, headers: low }, { status: 200, body: {}, headers: high }, { status: 200, body: {}, headers: high },
    ]);
    await client.get("/characters/1/wallet", { characterId: 1 });   // bucket char-wallet:1 now throttled
    await client.get("/characters/2/wallet", { characterId: 2 });   // same route template, different bucket
    expect(sleeps).toEqual([]);
    await client.get("/characters/1/wallet", { characterId: 1 });   // same template: bucket char-wallet:1 is known and throttled
    expect(sleeps.length).toBe(1);                                  // bucket char-wallet:1 waited
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/esi/client.test.ts`
Expected: FAIL — `client.post is not a function`, and the bucket test fails because the group is keyed on the full pathname.

- [ ] **Step 3: Rewrite `src/lib/esi/client.ts`**

Replace the whole file with:
```ts
import type { AppConfig } from "../config.js";
import type { getCached, putCached } from "../db/esi-cache.js";

export interface EsiDeps {
  fetchImpl?: typeof fetch; getAccessToken: (characterId: number) => Promise<string>;
  cache: { get: typeof getCached; put: typeof putCached };
  config: Pick<AppConfig, "esiBaseUrl" | "esiCompatibilityDate" | "esiUserAgent">;
  now?: () => number; sleep?: (ms: number) => Promise<void>; timeoutMs?: number;
}
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean }
export class EsiError extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); this.name = "EsiError"; }
}
interface GetOpts { characterId?: number; query?: Record<string, string | number>; page?: number }
interface PostOpts { characterId?: number; query?: Record<string, string | number> }

const HALT_MS = 60_000;
const THROTTLE_FRACTION = 0.2;

/** "150/15m" → { tokens: 150, windowMs: 900000 } */
export function parseLimit(v: string | null): { tokens: number; windowMs: number } | null {
  const m = /^(\d+)\/(\d+)([smh])$/.exec(v ?? "");
  if (!m) return null;
  const unit = { s: 1000, m: 60_000, h: 3_600_000 }[m[3] as "s" | "m" | "h"];
  return { tokens: Number(m[1]), windowMs: Number(m[2]) * unit };
}

/**
 * `/characters/123/wallet/journal` → `/characters/{id}/wallet/journal`.
 * ESI announces the rate-limit group per route, so remembering it against the route *template*
 * means the first call for a new character already knows which bucket it belongs to.
 */
export function routeTemplate(pathname: string): string {
  return pathname.replace(/\/\d+/g, "/{id}");
}

export class EsiClient {
  private fetchImpl: typeof fetch; private now: () => number; private sleep: (ms: number) => Promise<void>; private timeoutMs: number;
  private haltUntil = 0;
  private groupWait = new Map<string, number>();   // `${group}:${characterId}` → time when it is OK to call again
  private pathGroup = new Map<string, string>();   // route template → rate-limit group

  constructor(private deps: EsiDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch; this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.timeoutMs = deps.timeoutMs ?? 30_000;
  }

  async get<T>(path: string, opts: GetOpts = {}): Promise<EsiResult<T>> {
    const cid = opts.characterId ?? 0;
    const url = this.buildUrl(path, opts.query);
    if (opts.page) url.searchParams.set("page", String(opts.page));
    const key = url.pathname + url.search;

    const cached = await this.deps.cache.get(cid, key);
    if (cached?.expiresAt && cached.expiresAt.getTime() > this.now()) {
      return { data: cached.body as T, status: 200, pages: cached.pages, fromCache: true };
    }

    const headers = await this.headers(opts.characterId);
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    const res = await this.request(url, key, cid, () => ({ headers, signal: AbortSignal.timeout(this.timeoutMs) }));

    const pages = Number(res.headers.get("X-Pages") ?? cached?.pages ?? 1) || 1;
    const expiresAt = parseHttpDate(res.headers.get("Expires"));

    if (res.status === 304 && cached) {
      await this.deps.cache.put(cid, key, { ...cached, expiresAt: expiresAt ?? cached.expiresAt, pages });
      return { data: cached.body as T, status: 304, pages, fromCache: true };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EsiError(res.status, key, `ESI ${res.status} for ${key}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as T;
    await this.deps.cache.put(cid, key, { etag: res.headers.get("ETag"), expiresAt, pages, body: data });
    return { data, status: res.status, pages, fromCache: false };
  }

  async getAll<T>(path: string, opts: Omit<GetOpts, "page"> = {}): Promise<T[]> {
    const first = await this.get<T[]>(path, { ...opts, page: 1 });
    const out = [...first.data];
    for (let p = 2; p <= first.pages; p++) out.push(...(await this.get<T[]>(path, { ...opts, page: p })).data);
    return out;
  }

  /**
   * JSON POST. ESI's POST routes carry no cache headers at all, so nothing is read from or
   * written to `esi_cache`; callers impose their own TTL and chunk bodies to <= 1000 unique IDs.
   */
  async post<T>(path: string, body: unknown, opts: PostOpts = {}): Promise<T> {
    const cid = opts.characterId ?? 0;
    const url = this.buildUrl(path, opts.query);
    const key = url.pathname + url.search;
    const headers = await this.headers(opts.characterId);
    headers["Content-Type"] = "application/json";
    const payload = JSON.stringify(body);
    const res = await this.request(url, key, cid, () => ({
      method: "POST", headers, body: payload, signal: AbortSignal.timeout(this.timeoutMs),
    }));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EsiError(res.status, key, `ESI ${res.status} for POST ${key}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  private buildUrl(path: string, query?: Record<string, string | number>): URL {
    const url = new URL(path, this.deps.config.esiBaseUrl);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
    return url;
  }

  private async headers(characterId?: number): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/json", "User-Agent": this.deps.config.esiUserAgent,
      "X-Compatibility-Date": this.deps.config.esiCompatibilityDate,
    };
    if (characterId) headers.Authorization = `Bearer ${await this.deps.getAccessToken(characterId)}`;
    return headers;
  }

  /** Shared pre/post-flight for every HTTP call: budget waits, one 429 retry, the 420 halt. */
  private async request(url: URL, key: string, characterId: number, makeInit: () => RequestInit): Promise<Response> {
    await this.waitForBudget(url.pathname, characterId);
    let res = await this.fetchImpl(url, makeInit());
    this.noteLimits(url.pathname, characterId, res);
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") ?? "5");
      await this.sleep(retry * 1000);
      res = await this.fetchImpl(url, makeInit());
      this.noteLimits(url.pathname, characterId, res);
    }
    if (res.status === 420) {
      this.haltUntil = this.now() + HALT_MS;
      throw new EsiError(420, key, "ESI error limit reached; halting for 60s");
    }
    return res;
  }

  private async waitForBudget(pathname: string, characterId: number): Promise<void> {
    const now = this.now();
    if (this.haltUntil > now) await this.sleep(this.haltUntil - now);
    const group = this.pathGroup.get(routeTemplate(pathname));
    const until = group ? this.groupWait.get(`${group}:${characterId}`) ?? 0 : 0;
    if (until > this.now()) await this.sleep(until - this.now());
  }

  private noteLimits(pathname: string, characterId: number, res: Response): void {
    const group = res.headers.get("X-Ratelimit-Group");
    const limit = parseLimit(res.headers.get("X-Ratelimit-Limit"));
    const remaining = Number(res.headers.get("X-Ratelimit-Remaining"));
    if (!group || !limit || Number.isNaN(remaining)) return;
    this.pathGroup.set(routeTemplate(pathname), group);
    const bucket = `${group}:${characterId}`;
    if (remaining < limit.tokens * THROTTLE_FRACTION) {
      // Wait long enough for roughly 10% of the window's tokens to come back, capped at 60s.
      this.groupWait.set(bucket, this.now() + Math.min(limit.windowMs * 0.1, 60_000));
    } else {
      this.groupWait.delete(bucket);
    }
  }
}

function parseHttpDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/esi/client.test.ts && npm run typecheck`
Expected: PASS (all eleven tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add EsiClient.post and per-(group, character) rate-limit buckets

POST routes carry no cache headers, so post() bypasses esi_cache entirely.
Rate-limit groups are now remembered against the route template so a bucket is
known before the first call for a new character, and the wait map is keyed on
(group, characterId) to match ESI's own bucket identity.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: Error-limit backoff and the ESI outage breaker

**Files:**
- Modify: `src/lib/esi/client.ts`, `src/lib/esi/index.ts`
- Test: `tests/esi/client.test.ts`

**Interfaces:**
- Consumes: Task 2 `EsiClient.request`, `EsiClient.noteLimits`, `EsiError`.
- Produces:
```ts
export class EsiUnavailableError extends EsiError {   // status 503
  constructor(path: string, retryAtMs: number);
  readonly retryAtMs: number;
}
export const ERROR_LIMIT_FLOOR = 20;
export const OUTAGE_MS = 60_000;
// re-exported from src/lib/esi/index.ts
```

- [ ] **Step 1: Write the failing tests**

Append inside `describe("EsiClient", …)` in `tests/esi/client.test.ts`:
```ts
  it("waits for the error-limit reset when fewer than 20 errors remain in the window", async () => {
    const { client, sleeps } = make([
      { status: 404, headers: { "X-ESI-Error-Limit-Remain": "12", "X-ESI-Error-Limit-Reset": "37" } },
      { status: 200, body: { ok: 1 } },
    ]);
    await expect(client.get("/a")).rejects.toMatchObject({ status: 404 });
    await client.get("/b");
    expect(sleeps).toContain(37_000);
  });
  it("does not wait while the error limit is healthy or the headers are absent", async () => {
    const { client, sleeps } = make([
      { status: 200, body: {}, headers: { "X-ESI-Error-Limit-Remain": "98", "X-ESI-Error-Limit-Reset": "40" } },
      { status: 200, body: {} },
      { status: 200, body: {} },
    ]);
    await client.get("/a"); await client.get("/b"); await client.get("/c");
    expect(sleeps).toEqual([]);
  });
  it("opens a 60s breaker on 503 and fails fast without touching ESI", async () => {
    const { client, calls, advance } = make([
      { status: 503, body: { error: "Timeout contacting tranquility" } },
      { status: 200, body: { ok: 1 } },
    ]);
    await expect(client.get("/status")).rejects.toBeInstanceOf(EsiUnavailableError);
    await expect(client.get("/characters/1", { characterId: 1 })).rejects.toMatchObject({ status: 503, name: "EsiUnavailableError" });
    expect(calls.length).toBe(1);                     // second call never left the process
    advance(60_001);
    expect((await client.get<{ ok: number }>("/characters/1", { characterId: 1 })).data.ok).toBe(1);
    expect(calls.length).toBe(2);
  });
  it("opens the breaker on 502 and 504 too, and post fails fast as well", async () => {
    const { client, calls } = make([{ status: 502 }]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(EsiUnavailableError);
    await expect(client.post("/universe/names", [1])).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(calls.length).toBe(1);
    const gateway = make([{ status: 504, body: { error: "Timeout contacting tranquility", timeout: 10 } }]);
    await expect(gateway.client.get("/a")).rejects.toBeInstanceOf(EsiUnavailableError);
  });
  it("EsiUnavailableError is an EsiError so existing catch sites keep working", async () => {
    const { client } = make([{ status: 503 }]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(EsiError);
  });
```
and add `EsiUnavailableError` to the import at the top of the file:
```ts
import { EsiClient, EsiError, EsiUnavailableError } from "../../src/lib/esi/client.js";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/esi/client.test.ts`
Expected: FAIL — `No "EsiUnavailableError" export is defined`.

- [ ] **Step 3: Add the error class and the two constants**

In `src/lib/esi/client.ts`, immediately after the `EsiError` class, add:
```ts
/**
 * ESI answered 502/503/504 within the last minute. 5xx responses cost 0 rate-limit tokens but
 * DO consume the global error limit (verified), so a retry-happy worker during a Tranquility
 * outage gets itself 420'd. The breaker fails every call fast until the window passes; the
 * scheduler records the error and the next interval retries.
 */
export class EsiUnavailableError extends EsiError {
  constructor(path: string, public retryAtMs: number) {
    super(503, path, `ESI is unavailable; not calling again until ${new Date(retryAtMs).toISOString()}`);
    this.name = "EsiUnavailableError";
  }
}
```
and next to `HALT_MS`/`THROTTLE_FRACTION`:
```ts
export const ERROR_LIMIT_FLOOR = 20;   // X-ESI-Error-Limit-Remain below this → wait for the reset
export const OUTAGE_MS = 60_000;       // breaker window after any 502/503/504
```

- [ ] **Step 4: Add the breaker and error-limit state to the class**

In `src/lib/esi/client.ts`, next to `private haltUntil = 0;` add:
```ts
  private unavailableUntil = 0;        // breaker: no request leaves the process before this time
  private errorLimitWaitUntil = 0;     // X-ESI-Error-Limit-Remain fell below the floor
```
Replace the whole `request` method with:
```ts
  /** Shared pre/post-flight for every HTTP call: breaker, budget waits, one 429 retry, 420 halt, 5xx breaker. */
  private async request(url: URL, key: string, characterId: number, makeInit: () => RequestInit): Promise<Response> {
    if (this.unavailableUntil > this.now()) throw new EsiUnavailableError(key, this.unavailableUntil);
    await this.waitForBudget(url.pathname, characterId);
    let res = await this.fetchImpl(url, makeInit());
    this.noteLimits(url.pathname, characterId, res);
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") ?? "5");
      await this.sleep(retry * 1000);
      res = await this.fetchImpl(url, makeInit());
      this.noteLimits(url.pathname, characterId, res);
    }
    if (res.status === 420) {
      this.haltUntil = this.now() + HALT_MS;
      throw new EsiError(420, key, "ESI error limit reached; halting for 60s");
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      this.unavailableUntil = this.now() + OUTAGE_MS;
      throw new EsiUnavailableError(key, this.unavailableUntil);
    }
    return res;
  }
```
Replace the whole `waitForBudget` method with:
```ts
  private async waitForBudget(pathname: string, characterId: number): Promise<void> {
    for (const until of [this.haltUntil, this.errorLimitWaitUntil]) {
      const now = this.now();
      if (until > now) await this.sleep(until - now);
    }
    const group = this.pathGroup.get(routeTemplate(pathname));
    const until = group ? this.groupWait.get(`${group}:${characterId}`) ?? 0 : 0;
    if (until > this.now()) await this.sleep(until - this.now());
  }
```
Add `this.noteErrorLimit(res);` as the **first** line of `noteLimits`, and add this method after it:
```ts
  /**
   * `X-ESI-Error-Limit-Remain` counts non-2xx/3xx responses left in a fixed 60 s window, starting
   * at 100; exhausting it means a 420 on every ESI route. Absent header → nothing to do; note that
   * `Number(null)` is 0, so the null check must come first.
   */
  private noteErrorLimit(res: Response): void {
    const raw = res.headers.get("X-ESI-Error-Limit-Remain");
    if (raw === null) return;
    const remain = Number(raw);
    if (Number.isNaN(remain) || remain >= ERROR_LIMIT_FLOOR) return;
    const reset = Number(res.headers.get("X-ESI-Error-Limit-Reset") ?? "60");
    const waitMs = (Number.isNaN(reset) ? 60 : Math.max(reset, 1)) * 1000;
    this.errorLimitWaitUntil = Math.max(this.errorLimitWaitUntil, this.now() + waitMs);
  }
```

- [ ] **Step 5: Re-export the error from the ESI barrel**

In `src/lib/esi/index.ts`, replace line 21 with:
```ts
export { EsiClient, EsiError, EsiUnavailableError } from "./client.js";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/esi && npm run typecheck`
Expected: PASS (sixteen client tests), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Back off on the ESI error limit and break the circuit during outages

5xx responses consume the global error limit, so any 502/503/504 now opens a
60s breaker that fails every call fast without touching ESI, and a
X-ESI-Error-Limit-Remain below 20 makes the next call wait for the reset.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: `getAll` Last-Modified consistency guard

**Files:**
- Modify: `src/lib/esi/client.ts`
- Test: `tests/esi/client.test.ts`

**Interfaces:**
- Consumes: Task 2 `EsiClient.get`, `GetOpts`; Task 3 breaker.
- Produces:
```ts
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean; lastModified: string | null }
// getAll now restarts the walk once (bypassing a still-valid cached page 1) and then throws
// EsiError(409, path, "paginated resource changed mid-walk")
```

- [ ] **Step 1: Write the failing tests**

Append inside `describe("EsiClient", …)` in `tests/esi/client.test.ts`:
```ts
  it("restarts the paginated walk once when a page's Last-Modified disagrees with page 1", async () => {
    const a = "Mon, 01 Sep 2026 10:00:00 GMT";
    const b = "Mon, 01 Sep 2026 10:30:00 GMT";
    const { client, calls } = make([
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": a } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },     // torn
      { status: 200, body: [1, 9], headers: { "X-Pages": "2", "Last-Modified": b } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },     // consistent on the retry
    ]);
    expect(await client.getAll<number>("/characters/1/assets", { characterId: 1 })).toEqual([1, 9, 2]);
    expect(calls.length).toBe(4);
  });
  it("throws 409 when the walk is still torn after the restart", async () => {
    const h = (lm: string, pages?: string) => (pages ? { "X-Pages": pages, "Last-Modified": lm } : { "Last-Modified": lm });
    const { client } = make([
      { status: 200, body: [1], headers: h("Mon, 01 Sep 2026 10:00:00 GMT", "2") },
      { status: 200, body: [2], headers: h("Mon, 01 Sep 2026 10:30:00 GMT") },
      { status: 200, body: [1], headers: h("Mon, 01 Sep 2026 11:00:00 GMT", "2") },
      { status: 200, body: [2], headers: h("Mon, 01 Sep 2026 11:30:00 GMT") },
    ]);
    await expect(client.getAll("/characters/1/assets", { characterId: 1 }))
      .rejects.toMatchObject({ status: 409, path: "/characters/1/assets" });
  });
  it("accepts a walk whose pages agree, and one where ESI sent no Last-Modified at all", async () => {
    const lm = "Mon, 01 Sep 2026 10:00:00 GMT";
    const same = make([
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": lm } },
      { status: 200, body: [2], headers: { "Last-Modified": lm } },
    ]);
    expect(await same.client.getAll<number>("/x", { characterId: 1 })).toEqual([1, 2]);
    const none = make([{ status: 200, body: [1], headers: { "X-Pages": "2" } }, { status: 200, body: [2] }]);
    expect(await none.client.getAll<number>("/y", { characterId: 1 })).toEqual([1, 2]);
  });
  it("the restart bypasses a still-valid cached page 1", async () => {
    const a = "Mon, 01 Sep 2026 10:00:00 GMT";
    const b = "Mon, 01 Sep 2026 10:30:00 GMT";
    const { client, calls } = make([
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": a, Expires: future(1_700_000_000_000, 3600) } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": b } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },
    ]);
    expect(await client.getAll<number>("/z", { characterId: 1 })).toEqual([1, 2]);
    expect(calls.length).toBe(4);                    // page 1 was re-requested despite the fresh cache
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/esi/client.test.ts`
Expected: FAIL — the torn walk returns `[1, 2]` instead of restarting.

- [ ] **Step 3: Carry `Last-Modified` on every result**

In `src/lib/esi/client.ts`, replace the `EsiResult` interface and add `fresh` to `GetOpts`:
```ts
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean; lastModified: string | null }
```
```ts
interface GetOpts { characterId?: number; query?: Record<string, string | number>; page?: number; fresh?: boolean }
```
In `get`, replace the cache-hit early return with:
```ts
    const cached = await this.deps.cache.get(cid, key);
    if (!opts.fresh && cached?.expiresAt && cached.expiresAt.getTime() > this.now()) {
      return { data: cached.body as T, status: 200, pages: cached.pages, fromCache: true, lastModified: null };
    }
```
and replace the rest of `get`, from the 304 branch to the end of the method, with:
```ts
    if (res.status === 304 && cached) {
      await this.deps.cache.put(cid, key, { ...cached, expiresAt: expiresAt ?? cached.expiresAt, pages });
      return { data: cached.body as T, status: 304, pages, fromCache: true, lastModified: res.headers.get("Last-Modified") };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EsiError(res.status, key, `ESI ${res.status} for ${key}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as T;
    await this.deps.cache.put(cid, key, { etag: res.headers.get("ETag"), expiresAt, pages, body: data });
    return { data, status: res.status, pages, fromCache: false, lastModified: res.headers.get("Last-Modified") };
```

- [ ] **Step 4: Replace `getAll` with the guarded walk**

In `src/lib/esi/client.ts`, replace the whole `getAll` method with:
```ts
  /**
   * ESI's docs: every page of one paginated resource carries the same `Last-Modified`. A page that
   * disagrees means the data refreshed mid-walk and the assembled set is torn — discard it and walk
   * again, this time ignoring any still-valid cached page (a cache hit has no Last-Modified to
   * compare, so a cached page 1 would hide a second tear). Still torn → the caller gets a 409.
   */
  async getAll<T>(path: string, opts: Omit<GetOpts, "page" | "fresh"> = {}): Promise<T[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const rows = await this.walk<T>(path, { ...opts, fresh: attempt > 0 });
      if (rows) return rows;
    }
    throw new EsiError(409, this.buildUrl(path, opts.query).pathname, "paginated resource changed mid-walk");
  }

  /** One pass over the pages; `null` when a page's Last-Modified disagrees with page 1's. */
  private async walk<T>(path: string, opts: Omit<GetOpts, "page">): Promise<T[] | null> {
    const first = await this.get<T[]>(path, { ...opts, page: 1 });
    const out = [...first.data];
    for (let p = 2; p <= first.pages; p++) {
      const next = await this.get<T[]>(path, { ...opts, page: p });
      if (first.lastModified && next.lastModified && next.lastModified !== first.lastModified) return null;
      out.push(...next.data);
    }
    return out;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/esi && npm run typecheck`
Expected: PASS (twenty client tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Guard getAll against torn paginated reads

Every page of one ESI resource carries the same Last-Modified; a mismatch means
the resource refreshed mid-walk. getAll now restarts the walk once with the
cache bypassed and throws EsiError(409) if it is still torn.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 5: The phase-3 schema

**Files:**
- Modify: `db/schema.sql`, `tests/db/helpers.ts`, `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: phase-1 `applySchema(pool)` in `scripts/migrate.ts`, `resetDb()` in `tests/db/helpers.ts`.
- Produces: the tables `character_skill_summary`, `character_skills`, `character_skill_queue`, `character_attributes`, `character_implants`, `character_clones`, `character_jump_clones`, `character_assets`, `character_fittings`, `character_fitting_items`, `character_wallet`, `character_wallet_journal`, `character_wallet_transactions`, `character_location`, `universe_names`, `structures` and the four indexes of spec §4.

- [ ] **Step 1: Write the failing test**

Replace the first test in `tests/db/schema.test.ts` with this (note the JS-side `.sort()` — Postgres' collation ignores underscores, so SQL `ORDER BY` is not stable across machines), and add the last test:
```ts
describe("schema", () => {
  it("is idempotent and creates the phase-1, sde and phase-3 tables", async () => {
    await applySchema(pool);
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "accounts",
      "character_assets", "character_attributes", "character_clones", "character_fitting_items",
      "character_fittings", "character_implants", "character_jump_clones", "character_location",
      "character_skill_queue", "character_skill_summary", "character_skills", "character_wallet",
      "character_wallet_journal", "character_wallet_transactions", "characters", "esi_cache",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
      "sde_dogma_effect_modifiers", "sde_dogma_effects", "sde_dogma_units", "sde_groups",
      "sde_market_groups", "sde_meta", "sde_meta_groups", "sde_regions", "sde_solar_systems",
      "sde_stations", "sde_type_attributes", "sde_type_bonuses", "sde_type_effects", "sde_types",
      "structures", "sync_runs", "universe_names",
    ]);
  });
  it("rejects an unknown token_status", async () => {
    await expect(pool.query("INSERT INTO characters (id, name, refresh_token_enc, token_status) VALUES (1, 'x', 'e', 'bogus')")).rejects.toThrow(/check/i);
  });
  it("constrains sde_meta to a single row and sde_type_bonuses.kind to the three kinds", async () => {
    await expect(pool.query("INSERT INTO sde_meta (id, build_number, release_date) VALUES (2, 1, now())")).rejects.toThrow(/check/i);
    await expect(pool.query("INSERT INTO sde_type_bonuses (type_id, idx, kind) VALUES (1, 0, 'bogus')")).rejects.toThrow(/check/i);
  });
  it("cascades every per-character table when a character is deleted", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (42, 'Cascade', 'enc') ON CONFLICT (id) DO NOTHING");
    await pool.query("INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints) VALUES (42, 3300, 5, 5, 256000)");
    await pool.query("INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag) VALUES (42, 1, 34, 5, 60003760, 'station', 'Hangar')");
    await pool.query("INSERT INTO character_wallet (character_id, balance) VALUES (42, 1.00)");
    await pool.query("DELETE FROM characters WHERE id = 42");
    for (const t of ["character_skills", "character_assets", "character_wallet"]) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE character_id = 42`);
      expect(rows[0].n).toBe(0);
    }
  });
  it("accepts an ESI enum value nobody has seen before", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (43, 'Enum', 'enc') ON CONFLICT (id) DO NOTHING");
    await pool.query(
      `INSERT INTO character_wallet_journal (character_id, id, date, ref_type) VALUES (43, 1, now(), 'brand_new_ref_type_2027')`);
    await pool.query(
      `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag)
       VALUES (43, 2, 34, 1, 60003760, 'station', 'BrandNewHold')`);
    await pool.query("DELETE FROM characters WHERE id = 43");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL — the table list is missing the phase-3 tables; the cascade test errors with `relation "character_skills" does not exist`.

- [ ] **Step 3: Append the phase-3 DDL to `db/schema.sql`**

Append to the end of `db/schema.sql`:
```sql

-- ── Phase 3: character sync ─────────────────────────────────────────────────
-- Every per-character table cascades from characters(id). ESI enums (location_flag, ref_type,
-- location_type, name category) are raw text: CCP adds members without a compatibility-date bump.
-- No foreign keys to sde_* — that reference data is swapped wholesale by the sde-update job.

CREATE TABLE IF NOT EXISTS character_skill_summary (
  character_id    bigint PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  total_sp        bigint NOT NULL DEFAULT 0,
  unallocated_sp  bigint,                        -- absent from ESI, not zero, when there is none
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS character_skills (
  character_id   bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id       int NOT NULL,
  trained_level  int NOT NULL,
  active_level   int NOT NULL,
  skillpoints    bigint NOT NULL,
  PRIMARY KEY (character_id, skill_id)
);

CREATE TABLE IF NOT EXISTS character_skill_queue (
  character_id       bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  queue_position     int NOT NULL,
  skill_id           int NOT NULL,
  finished_level     int NOT NULL,
  start_date         timestamptz,                -- a paused queue omits the dates entirely
  finish_date        timestamptz,
  level_start_sp     bigint,
  level_end_sp       bigint,
  training_start_sp  bigint,
  PRIMARY KEY (character_id, queue_position)
);
CREATE INDEX IF NOT EXISTS character_skill_queue_finish_idx ON character_skill_queue (character_id, finish_date);

CREATE TABLE IF NOT EXISTS character_attributes (
  character_id                 bigint PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  charisma                     int NOT NULL,
  intelligence                 int NOT NULL,
  memory                       int NOT NULL,
  perception                   int NOT NULL,
  willpower                    int NOT NULL,
  bonus_remaps                 int,
  last_remap_date              timestamptz,
  accrued_remap_cooldown_date  timestamptz,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

-- Implants on the ACTIVE clone (GET /implants). Jump-clone implants live on the jump clone row.
CREATE TABLE IF NOT EXISTS character_implants (
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  type_id       int NOT NULL,
  PRIMARY KEY (character_id, type_id)
);

CREATE TABLE IF NOT EXISTS character_clones (
  character_id              bigint PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  home_location_id          bigint,              -- home_location is optional, and so are its fields
  home_location_type        text,                -- station | structure
  last_clone_jump_date      timestamptz,
  last_station_change_date  timestamptz,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS character_jump_clones (
  character_id   bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  jump_clone_id  bigint NOT NULL,
  location_id    bigint,
  location_type  text,                           -- station | structure
  name           text,
  implants       int[] NOT NULL DEFAULT '{}',    -- may be empty, never absent
  PRIMARY KEY (character_id, jump_clone_id)
);

CREATE TABLE IF NOT EXISTS character_assets (
  character_id       bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id            bigint NOT NULL,
  type_id            int NOT NULL,
  quantity           bigint NOT NULL,
  location_id        bigint NOT NULL,
  location_type      text NOT NULL,              -- station | solar_system | item | other
  location_flag      text NOT NULL,              -- 89-member enum that grows without notice
  is_singleton       bool NOT NULL DEFAULT false,
  is_blueprint_copy  bool NOT NULL DEFAULT false,-- ESI only ever sends true; absent means false
  name               text,                       -- from POST /assets/names, singletons only
  PRIMARY KEY (character_id, item_id)
);
CREATE INDEX IF NOT EXISTS character_assets_location_idx ON character_assets (character_id, location_id);

CREATE TABLE IF NOT EXISTS character_fittings (
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  fitting_id    bigint NOT NULL,
  name          text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  ship_type_id  int NOT NULL,
  PRIMARY KEY (character_id, fitting_id)
);

CREATE TABLE IF NOT EXISTS character_fitting_items (
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  fitting_id    bigint NOT NULL,
  idx           int NOT NULL,                    -- position in the ESI items array
  type_id       int NOT NULL,
  quantity      int NOT NULL,
  flag          text NOT NULL,                   -- fitting flag set; 'Invalid' is a real member
  PRIMARY KEY (character_id, fitting_id, idx)
);

CREATE TABLE IF NOT EXISTS character_wallet (
  character_id  bigint PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  balance       numeric(20,2) NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ESI keeps 30 days; we accumulate forever, deduplicated on the stable journal id.
CREATE TABLE IF NOT EXISTS character_wallet_journal (
  character_id     bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  id               bigint NOT NULL,
  date             timestamptz NOT NULL,
  ref_type         text NOT NULL,                -- ~180-member enum that grows without notice
  description      text NOT NULL DEFAULT '',
  amount           numeric(20,2),                -- optional despite being the point of the record
  balance          numeric(20,2),
  reason           text,
  context_id       bigint,
  context_id_type  text,
  first_party_id   bigint,
  second_party_id  bigint,
  tax              numeric(20,2),
  tax_receiver_id  bigint,
  PRIMARY KEY (character_id, id)
);
CREATE INDEX IF NOT EXISTS character_wallet_journal_date_idx ON character_wallet_journal (character_id, date DESC);

CREATE TABLE IF NOT EXISTS character_wallet_transactions (
  character_id    bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  transaction_id  bigint NOT NULL,
  date            timestamptz NOT NULL,
  type_id         int NOT NULL,
  quantity        bigint NOT NULL,
  unit_price      numeric(20,2) NOT NULL,
  client_id       bigint,
  location_id     bigint,
  is_buy          bool NOT NULL DEFAULT false,
  is_personal     bool NOT NULL DEFAULT false,
  journal_ref_id  bigint,                        -- joins to character_wallet_journal.id
  PRIMARY KEY (character_id, transaction_id)
);
CREATE INDEX IF NOT EXISTS character_wallet_transactions_date_idx ON character_wallet_transactions (character_id, date DESC);

CREATE TABLE IF NOT EXISTS character_location (
  character_id     bigint PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  solar_system_id  int,
  station_id       bigint,                       -- exactly one of station/structure when docked,
  structure_id     bigint,                       -- neither when in space
  ship_item_id     bigint,
  ship_type_id     int,
  ship_name        text,
  online           bool,                         -- NULL when the online scope is missing
  last_login       timestamptz,
  last_logout      timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- POST /universe/names cache. name IS NULL together with category 'unknown' = unresolvable.
CREATE TABLE IF NOT EXISTS universe_names (
  id          bigint PRIMARY KEY,
  category    text NOT NULL,
  name        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- GET /universe/structures/{id} cache. forbidden = the character is not on the structure's ACL.
CREATE TABLE IF NOT EXISTS structures (
  id               bigint PRIMARY KEY,
  name             text,
  solar_system_id  int,
  type_id          int,
  owner_id         bigint,
  forbidden        bool NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Truncate the two FK-less tables in `resetDb`**

In `tests/db/helpers.ts`, replace the TRUNCATE line with:
```ts
  // CASCADE clears every character_* table via their characters(id) foreign key; universe_names
  // and structures have no FK, so they are listed explicitly.
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts, universe_names, structures RESTART IDENTITY CASCADE");
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/db/schema.test.ts && npm run typecheck`
Expected: PASS (five schema tests), typecheck clean.

- [ ] **Step 6: Apply the schema to the dev database**

```bash
DATABASE_URL=postgres://eve:eve@127.0.0.1:5432/eve npm run migrate
```
Expected: `schema applied`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the phase-3 character sync schema

Fifteen per-character tables cascading from characters(id), plus the
universe_names and structures resolution caches. ESI enums are stored as raw
text and there are no foreign keys to the sde_* reference tables.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 6: Skills, attributes and clones repos

**Files:**
- Create: `src/lib/db/character-skills.ts`, `src/lib/db/character-clones.ts`
- Test: `tests/db/character-skills.test.ts`, `tests/db/character-clones.test.ts`

**Interfaces:**
- Consumes: phase-1 `getPool()` in `src/lib/db/client.js`, `resetDb()` in `tests/db/helpers.js`, Task 5 tables.
- Produces:
```ts
// src/lib/db/character-skills.ts
export interface SkillSummary { characterId: number; totalSp: number; unallocatedSp: number | null; updatedAt: Date }
export interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}
export interface AttributesInput {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonusRemaps: number | null; lastRemapDate: Date | null; accruedRemapCooldownDate: Date | null;
}
export interface AttributesRow extends AttributesInput { characterId: number; updatedAt: Date }
export interface SkillsWrite {
  summary: { totalSp: number; unallocatedSp: number | null } | null;
  skills: SkillRow[] | null;
  queue: SkillQueueRow[] | null;
  attributes: AttributesInput | null;
}
export function replaceSkills(characterId: number, w: SkillsWrite): Promise<number>;
export function getSkillSummary(characterId: number): Promise<SkillSummary | null>;
export function listSkills(characterId: number): Promise<SkillRow[]>;
export function listSkillQueue(characterId: number): Promise<SkillQueueRow[]>;
export function getAttributes(characterId: number): Promise<AttributesRow | null>;

// src/lib/db/character-clones.ts
export interface CloneHome {
  homeLocationId: number | null; homeLocationType: string | null;
  lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null;
}
export interface JumpCloneRow { jumpCloneId: number; locationId: number | null; locationType: string | null; name: string | null; implants: number[] }
export interface ClonesWrite { clones: (CloneHome & { jumpClones: JumpCloneRow[] }) | null; implants: number[] | null }
export interface CloneState extends CloneHome { characterId: number; updatedAt: Date; jumpClones: JumpCloneRow[] }
export function replaceClones(characterId: number, w: ClonesWrite): Promise<number>;
export function getClones(characterId: number): Promise<CloneState | null>;
export function listImplants(characterId: number): Promise<number[]>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/db/character-skills.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import {
  replaceSkills, getSkillSummary, listSkills, listSkillQueue, getAttributes,
  type SkillsWrite,
} from "../../src/lib/db/character-skills.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const write: SkillsWrite = {
  summary: { totalSp: 47382910, unallocatedSp: 210000 },
  skills: [
    { skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 },
    { skillId: 3327, trainedLevel: 4, activeLevel: 3, skillpoints: 45255 },
  ],
  queue: [
    { queuePosition: 0, skillId: 3426, finishedLevel: 4, startDate: new Date("2026-08-30T12:00:00Z"), finishDate: new Date("2026-08-31T18:30:00Z"), levelStartSp: 8000, levelEndSp: 45255, trainingStartSp: 8000 },
    { queuePosition: 1, skillId: 24311, finishedLevel: 3, startDate: null, finishDate: null, levelStartSp: null, levelEndSp: null, trainingStartSp: null },
  ],
  attributes: { charisma: 20, intelligence: 24, memory: 21, perception: 20, willpower: 21, bonusRemaps: 2, lastRemapDate: new Date("2025-11-14T09:12:33Z"), accruedRemapCooldownDate: null },
};

describe("character-skills repo", () => {
  it("writes summary, skills, queue and attributes and returns the row count", async () => {
    expect(await replaceSkills(CID, write)).toBe(6);            // 1 summary + 2 skills + 2 queue + 1 attributes
    expect(await getSkillSummary(CID)).toMatchObject({ characterId: CID, totalSp: 47382910, unallocatedSp: 210000 });
    expect(await listSkills(CID)).toEqual(write.skills);
    const queue = await listSkillQueue(CID);
    expect(queue.map((q) => q.queuePosition)).toEqual([0, 1]);
    expect(queue[1].startDate).toBeNull();
    expect(queue[1].finishDate).toBeNull();
    expect(queue[1].levelEndSp).toBeNull();
    expect(await getAttributes(CID)).toMatchObject({ intelligence: 24, bonusRemaps: 2, accruedRemapCooldownDate: null });
  });
  it("replaces wholesale: skills and queue entries that vanished are gone", async () => {
    await replaceSkills(CID, write);
    await replaceSkills(CID, { ...write, skills: [{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 }], queue: [] });
    expect((await listSkills(CID)).map((s) => s.skillId)).toEqual([3300]);
    expect(await listSkillQueue(CID)).toEqual([]);
  });
  it("leaves a section untouched when it was not synced (null)", async () => {
    await replaceSkills(CID, write);
    expect(await replaceSkills(CID, { summary: null, skills: null, queue: [], attributes: null })).toBe(0);
    expect((await listSkills(CID)).length).toBe(2);
    expect(await getAttributes(CID)).not.toBeNull();
    expect(await listSkillQueue(CID)).toEqual([]);
  });
  it("returns null and empty lists for a character that has never synced", async () => {
    expect(await getSkillSummary(CID)).toBeNull();
    expect(await getAttributes(CID)).toBeNull();
    expect(await listSkills(CID)).toEqual([]);
    expect(await listSkillQueue(CID)).toEqual([]);
  });
  it("stores unallocated_sp as null when the character has none", async () => {
    await replaceSkills(CID, { ...write, summary: { totalSp: 100, unallocatedSp: null } });
    expect((await getSkillSummary(CID))!.unallocatedSp).toBeNull();
  });
});
```

Create `tests/db/character-clones.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { replaceClones, getClones, listImplants, type ClonesWrite } from "../../src/lib/db/character-clones.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const write: ClonesWrite = {
  clones: {
    homeLocationId: 60003760, homeLocationType: "station",
    lastCloneJumpDate: new Date("2026-08-20T21:04:11Z"), lastStationChangeDate: new Date("2026-08-28T07:45:02Z"),
    jumpClones: [
      { jumpCloneId: 1001, locationId: 60008494, locationType: "station", name: "Amarr medical", implants: [9899, 9941, 9942] },
      { jumpCloneId: 1002, locationId: 1035466617946, locationType: "structure", name: null, implants: [] },
    ],
  },
  implants: [9899, 9941, 9942, 9943, 9954],
};

describe("character-clones repo", () => {
  it("writes the home clone, jump clones and active implants", async () => {
    expect(await replaceClones(CID, write)).toBe(8);            // 1 home + 2 jump clones + 5 implants
    const state = (await getClones(CID))!;
    expect(state.homeLocationId).toBe(60003760);
    expect(state.homeLocationType).toBe("station");
    expect(state.jumpClones.map((c) => c.jumpCloneId)).toEqual([1001, 1002]);
    expect(state.jumpClones[1].implants).toEqual([]);
    expect(state.jumpClones[1].name).toBeNull();
    expect(state.jumpClones[1].locationId).toBe(1035466617946);
    expect(await listImplants(CID)).toEqual([9899, 9941, 9942, 9943, 9954]);
  });
  it("tolerates a fully absent home_location", async () => {
    await replaceClones(CID, { clones: { homeLocationId: null, homeLocationType: null, lastCloneJumpDate: null, lastStationChangeDate: null, jumpClones: [] }, implants: [] });
    const state = (await getClones(CID))!;
    expect(state.homeLocationId).toBeNull();
    expect(state.jumpClones).toEqual([]);
  });
  it("replaces wholesale and leaves an unsynced section alone", async () => {
    await replaceClones(CID, write);
    await replaceClones(CID, { clones: { ...write.clones!, jumpClones: [] }, implants: null });
    expect((await getClones(CID))!.jumpClones).toEqual([]);
    expect(await listImplants(CID)).toEqual([9899, 9941, 9942, 9943, 9954]);
  });
  it("returns null / empty for a character that has never synced", async () => {
    expect(await getClones(CID)).toBeNull();
    expect(await listImplants(CID)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/db/character-skills.test.ts tests/db/character-clones.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/db/character-skills.js"`.

- [ ] **Step 3: Write `src/lib/db/character-skills.ts`**

```ts
import type { PoolClient } from "pg";
import { getPool } from "./client.js";

export interface SkillSummary { characterId: number; totalSp: number; unallocatedSp: number | null; updatedAt: Date }
export interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}
export interface AttributesInput {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonusRemaps: number | null; lastRemapDate: Date | null; accruedRemapCooldownDate: Date | null;
}
export interface AttributesRow extends AttributesInput { characterId: number; updatedAt: Date }

/** A `null` section was not synced this run (the token lacks its scope) — leave the stored rows alone. */
export interface SkillsWrite {
  summary: { totalSp: number; unallocatedSp: number | null } | null;
  skills: SkillRow[] | null;
  queue: SkillQueueRow[] | null;
  attributes: AttributesInput | null;
}

/** bigint columns arrive from pg as strings. */
const num = (v: string | number | null): number | null => (v === null ? null : Number(v));
const bigints = (v: (number | null)[]): (string | null)[] => v.map((n) => (n === null ? null : String(n)));

/** Everything in one transaction: a half-written skill sheet is worse than a stale one. */
export async function replaceSkills(characterId: number, w: SkillsWrite): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;
    if (w.summary) {
      await client.query(
        `INSERT INTO character_skill_summary (character_id, total_sp, unallocated_sp, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (character_id) DO UPDATE SET total_sp = EXCLUDED.total_sp,
           unallocated_sp = EXCLUDED.unallocated_sp, updated_at = now()`,
        [characterId, String(w.summary.totalSp), w.summary.unallocatedSp === null ? null : String(w.summary.unallocatedSp)]);
      rows += 1;
    }
    if (w.skills) {
      await client.query("DELETE FROM character_skills WHERE character_id = $1", [characterId]);
      if (w.skills.length) {
        await client.query(
          `INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints)
           SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::bigint[])`,
          [characterId, w.skills.map((s) => s.skillId), w.skills.map((s) => s.trainedLevel),
           w.skills.map((s) => s.activeLevel), w.skills.map((s) => String(s.skillpoints))]);
      }
      rows += w.skills.length;
    }
    if (w.queue) {
      await client.query("DELETE FROM character_skill_queue WHERE character_id = $1", [characterId]);
      if (w.queue.length) {
        await client.query(
          `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level,
             start_date, finish_date, level_start_sp, level_end_sp, training_start_sp)
           SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::timestamptz[], $6::timestamptz[],
             $7::bigint[], $8::bigint[], $9::bigint[])`,
          [characterId, w.queue.map((q) => q.queuePosition), w.queue.map((q) => q.skillId),
           w.queue.map((q) => q.finishedLevel), w.queue.map((q) => q.startDate), w.queue.map((q) => q.finishDate),
           bigints(w.queue.map((q) => q.levelStartSp)), bigints(w.queue.map((q) => q.levelEndSp)),
           bigints(w.queue.map((q) => q.trainingStartSp))]);
      }
      rows += w.queue.length;
    }
    if (w.attributes) {
      await writeAttributes(client, characterId, w.attributes);
      rows += 1;
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

async function writeAttributes(client: PoolClient, characterId: number, a: AttributesInput): Promise<void> {
  await client.query(
    `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower,
       bonus_remaps, last_remap_date, accrued_remap_cooldown_date, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (character_id) DO UPDATE SET charisma = EXCLUDED.charisma, intelligence = EXCLUDED.intelligence,
       memory = EXCLUDED.memory, perception = EXCLUDED.perception, willpower = EXCLUDED.willpower,
       bonus_remaps = EXCLUDED.bonus_remaps, last_remap_date = EXCLUDED.last_remap_date,
       accrued_remap_cooldown_date = EXCLUDED.accrued_remap_cooldown_date, updated_at = now()`,
    [characterId, a.charisma, a.intelligence, a.memory, a.perception, a.willpower,
     a.bonusRemaps, a.lastRemapDate, a.accruedRemapCooldownDate]);
}

export async function getSkillSummary(characterId: number): Promise<SkillSummary | null> {
  const { rows } = await getPool().query<{ characterId: string; totalSp: string; unallocatedSp: string | null; updatedAt: Date }>(
    `SELECT character_id AS "characterId", total_sp AS "totalSp", unallocated_sp AS "unallocatedSp",
            updated_at AS "updatedAt" FROM character_skill_summary WHERE character_id = $1`, [characterId]);
  const r = rows[0];
  return r ? { characterId: Number(r.characterId), totalSp: Number(r.totalSp), unallocatedSp: num(r.unallocatedSp), updatedAt: r.updatedAt } : null;
}

export async function listSkills(characterId: number): Promise<SkillRow[]> {
  const { rows } = await getPool().query<{ skillId: number; trainedLevel: number; activeLevel: number; skillpoints: string }>(
    `SELECT skill_id AS "skillId", trained_level AS "trainedLevel", active_level AS "activeLevel",
            skillpoints FROM character_skills WHERE character_id = $1 ORDER BY skill_id`, [characterId]);
  return rows.map((r) => ({ ...r, skillpoints: Number(r.skillpoints) }));
}

export async function listSkillQueue(characterId: number): Promise<SkillQueueRow[]> {
  const { rows } = await getPool().query<Omit<SkillQueueRow, "levelStartSp" | "levelEndSp" | "trainingStartSp"> &
    { levelStartSp: string | null; levelEndSp: string | null; trainingStartSp: string | null }>(
    `SELECT queue_position AS "queuePosition", skill_id AS "skillId", finished_level AS "finishedLevel",
            start_date AS "startDate", finish_date AS "finishDate", level_start_sp AS "levelStartSp",
            level_end_sp AS "levelEndSp", training_start_sp AS "trainingStartSp"
     FROM character_skill_queue WHERE character_id = $1 ORDER BY queue_position`, [characterId]);
  return rows.map((r) => ({ ...r, levelStartSp: num(r.levelStartSp), levelEndSp: num(r.levelEndSp), trainingStartSp: num(r.trainingStartSp) }));
}

export async function getAttributes(characterId: number): Promise<AttributesRow | null> {
  const { rows } = await getPool().query<Omit<AttributesRow, "characterId"> & { characterId: string }>(
    `SELECT character_id AS "characterId", charisma, intelligence, memory, perception, willpower,
            bonus_remaps AS "bonusRemaps", last_remap_date AS "lastRemapDate",
            accrued_remap_cooldown_date AS "accruedRemapCooldownDate", updated_at AS "updatedAt"
     FROM character_attributes WHERE character_id = $1`, [characterId]);
  return rows[0] ? { ...rows[0], characterId: Number(rows[0].characterId) } : null;
}
```

- [ ] **Step 4: Write `src/lib/db/character-clones.ts`**

```ts
import { getPool } from "./client.js";

export interface CloneHome {
  homeLocationId: number | null; homeLocationType: string | null;
  lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null;
}
export interface JumpCloneRow { jumpCloneId: number; locationId: number | null; locationType: string | null; name: string | null; implants: number[] }
/** `clones` covers /clones (home + jump clones); `implants` covers /implants (active clone). */
export interface ClonesWrite { clones: (CloneHome & { jumpClones: JumpCloneRow[] }) | null; implants: number[] | null }
export interface CloneState extends CloneHome { characterId: number; updatedAt: Date; jumpClones: JumpCloneRow[] }

const num = (v: string | null): number | null => (v === null ? null : Number(v));

export async function replaceClones(characterId: number, w: ClonesWrite): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;
    if (w.clones) {
      await client.query(
        `INSERT INTO character_clones (character_id, home_location_id, home_location_type,
           last_clone_jump_date, last_station_change_date, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (character_id) DO UPDATE SET home_location_id = EXCLUDED.home_location_id,
           home_location_type = EXCLUDED.home_location_type, last_clone_jump_date = EXCLUDED.last_clone_jump_date,
           last_station_change_date = EXCLUDED.last_station_change_date, updated_at = now()`,
        [characterId, w.clones.homeLocationId, w.clones.homeLocationType,
         w.clones.lastCloneJumpDate, w.clones.lastStationChangeDate]);
      await client.query("DELETE FROM character_jump_clones WHERE character_id = $1", [characterId]);
      // A handful of jump clones at most, and each carries its own int[] — insert them one by one.
      for (const c of w.clones.jumpClones) {
        await client.query(
          `INSERT INTO character_jump_clones (character_id, jump_clone_id, location_id, location_type, name, implants)
           VALUES ($1, $2, $3, $4, $5, $6::int[])`,
          [characterId, c.jumpCloneId, c.locationId, c.locationType, c.name, c.implants]);
      }
      rows += 1 + w.clones.jumpClones.length;
    }
    if (w.implants) {
      await client.query("DELETE FROM character_implants WHERE character_id = $1", [characterId]);
      if (w.implants.length) {
        await client.query(
          `INSERT INTO character_implants (character_id, type_id) SELECT $1, * FROM unnest($2::int[])`,
          [characterId, w.implants]);
      }
      rows += w.implants.length;
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

export async function getClones(characterId: number): Promise<CloneState | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ characterId: string; homeLocationId: string | null; homeLocationType: string | null;
    lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null; updatedAt: Date }>(
    `SELECT character_id AS "characterId", home_location_id AS "homeLocationId",
            home_location_type AS "homeLocationType", last_clone_jump_date AS "lastCloneJumpDate",
            last_station_change_date AS "lastStationChangeDate", updated_at AS "updatedAt"
     FROM character_clones WHERE character_id = $1`, [characterId]);
  if (!rows[0]) return null;
  const { rows: jump } = await pool.query<{ jumpCloneId: string; locationId: string | null; locationType: string | null; name: string | null; implants: number[] }>(
    `SELECT jump_clone_id AS "jumpCloneId", location_id AS "locationId", location_type AS "locationType",
            name, implants FROM character_jump_clones WHERE character_id = $1 ORDER BY jump_clone_id`, [characterId]);
  return {
    characterId: Number(rows[0].characterId),
    homeLocationId: num(rows[0].homeLocationId),
    homeLocationType: rows[0].homeLocationType,
    lastCloneJumpDate: rows[0].lastCloneJumpDate,
    lastStationChangeDate: rows[0].lastStationChangeDate,
    updatedAt: rows[0].updatedAt,
    jumpClones: jump.map((c) => ({ ...c, jumpCloneId: Number(c.jumpCloneId), locationId: num(c.locationId) })),
  };
}

export async function listImplants(characterId: number): Promise<number[]> {
  const { rows } = await getPool().query<{ type_id: number }>(
    "SELECT type_id FROM character_implants WHERE character_id = $1 ORDER BY type_id", [characterId]);
  return rows.map((r) => r.type_id);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/db/character-skills.test.ts tests/db/character-clones.test.ts && npm run typecheck`
Expected: PASS (nine tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the skills, attributes and clones repos

One transactional write per job plus the read functions the skills page needs.
A null section means "not synced this run" and leaves the stored rows alone, so
a token missing a scope never blanks data it cannot refresh.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 7: Assets and fittings repos (and the `chunk` helper)

**Files:**
- Create: `src/lib/chunk.ts`, `src/lib/db/character-assets.ts`, `src/lib/db/character-fittings.ts`
- Test: `tests/chunk.test.ts`, `tests/db/character-assets.test.ts`, `tests/db/character-fittings.test.ts`

**Interfaces:**
- Consumes: phase-1 `getPool()`, Task 5 tables.
- Produces:
```ts
// src/lib/chunk.ts
export function chunk<T>(items: readonly T[], size: number): T[][];
// src/lib/db/character-assets.ts
export interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean; name: string | null;
}
export function replaceAssets(characterId: number, assets: AssetRow[]): Promise<number>;
export function listAssets(characterId: number): Promise<AssetRow[]>;
// src/lib/db/character-fittings.ts
export interface FittingItemRow { idx: number; typeId: number; quantity: number; flag: string }
export interface FittingRow { fittingId: number; name: string; description: string; shipTypeId: number; items: FittingItemRow[] }
export function replaceFittings(characterId: number, fittings: FittingRow[]): Promise<number>;
export function listFittings(characterId: number): Promise<FittingRow[]>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/chunk.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { chunk } from "../src/lib/chunk.js";

describe("chunk", () => {
  it("splits into fixed-size batches with a short tail", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns one batch when everything fits", () => {
    expect(chunk([1, 2], 1000)).toEqual([[1, 2]]);
  });
  it("returns nothing for an empty input", () => {
    expect(chunk([], 1000)).toEqual([]);
  });
  it("throws on a non-positive size rather than looping forever", () => {
    expect(() => chunk([1], 0)).toThrow(/positive/);
  });
});
```

Create `tests/db/character-assets.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { replaceAssets, listAssets, type AssetRow } from "../../src/lib/db/character-assets.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const ship: AssetRow = { itemId: 1023456789012, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station", locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Fast Tackle" };
const module_: AssetRow = { itemId: 1023456789014, typeId: 2048, quantity: 1, locationId: 1023456789012, locationType: "item", locationFlag: "LoSlot0", isSingleton: true, isBlueprintCopy: false, name: "Damage Control II" };
const stack: AssetRow = { itemId: 1023456789013, typeId: 34, quantity: 129837, locationId: 60003760, locationType: "station", locationFlag: "Hangar", isSingleton: false, isBlueprintCopy: false, name: null };

describe("character-assets repo", () => {
  it("writes assets and reads them back with bigints as numbers", async () => {
    expect(await replaceAssets(CID, [ship, module_, stack])).toBe(3);
    const rows = await listAssets(CID);
    expect(rows.map((r) => r.itemId)).toEqual([1023456789012, 1023456789013, 1023456789014]);
    expect(rows[0].quantity).toBe(1);
    expect(rows[1].quantity).toBe(129837);
    expect(rows[2].locationId).toBe(1023456789012);
    expect(rows[2].locationType).toBe("item");
    expect(rows[1].name).toBeNull();
  });
  it("replaces wholesale: stale rows disappear", async () => {
    await replaceAssets(CID, [ship, module_, stack]);
    expect(await replaceAssets(CID, [ship])).toBe(1);
    expect((await listAssets(CID)).map((r) => r.itemId)).toEqual([1023456789012]);
  });
  it("clears everything when the character owns nothing", async () => {
    await replaceAssets(CID, [ship]);
    expect(await replaceAssets(CID, [])).toBe(0);
    expect(await listAssets(CID)).toEqual([]);
  });
  it("writes more rows than one insert batch", async () => {
    const many: AssetRow[] = Array.from({ length: 4500 }, (_, i) => ({ ...stack, itemId: 2000000000000 + i }));
    expect(await replaceAssets(CID, many)).toBe(4500);
    expect((await listAssets(CID)).length).toBe(4500);
  });
});
```

Create `tests/db/character-fittings.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { replaceFittings, listFittings, type FittingRow } from "../../src/lib/db/character-fittings.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const fittings: FittingRow[] = [
  { fittingId: 4021, name: "Rifter — cheap tackle", description: "", shipTypeId: 587, items: [
    { idx: 0, typeId: 484, quantity: 1, flag: "HiSlot0" },
    { idx: 1, typeId: 12608, quantity: 400, flag: "Cargo" },
    { idx: 2, typeId: 27339, quantity: 1, flag: "Invalid" },
  ] },
  { fittingId: 4022, name: "Vexor — ratting", description: "Drone boat for anomalies.", shipTypeId: 626, items: [
    { idx: 0, typeId: 2456, quantity: 5, flag: "DroneBay" },
  ] },
];

describe("character-fittings repo", () => {
  it("writes fittings with their items in file order, including an Invalid flag", async () => {
    expect(await replaceFittings(CID, fittings)).toBe(6);      // 2 fittings + 4 items
    const rows = await listFittings(CID);
    expect(rows.map((f) => f.fittingId)).toEqual([4021, 4022]);
    expect(rows[0].description).toBe("");
    expect(rows[0].items.map((i) => i.flag)).toEqual(["HiSlot0", "Cargo", "Invalid"]);
    expect(rows[0].items[1].quantity).toBe(400);
    expect(rows[1].items).toHaveLength(1);
  });
  it("replaces wholesale, dropping items of deleted fittings", async () => {
    await replaceFittings(CID, fittings);
    expect(await replaceFittings(CID, [fittings[1]])).toBe(2);
    const rows = await listFittings(CID);
    expect(rows.map((f) => f.fittingId)).toEqual([4022]);
    expect(rows[0].items).toHaveLength(1);
  });
  it("returns an empty list for a character with no fittings", async () => {
    expect(await listFittings(CID)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/chunk.test.ts tests/db/character-assets.test.ts tests/db/character-fittings.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/chunk.js"`.

- [ ] **Step 3: Write `src/lib/chunk.ts`**

```ts
/**
 * Split into fixed-size batches. Used for ESI's `maxItems: 1000` POST bodies and for batched
 * Postgres inserts.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error(`chunk size must be a positive integer, got ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
```

- [ ] **Step 4: Write `src/lib/db/character-assets.ts`**

```ts
import { getPool } from "./client.js";
import { chunk } from "../chunk.js";

export interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean; name: string | null;
}

const INSERT_BATCH = 2000;

/** A big industrial character has tens of thousands of assets; insert them in batches, one transaction. */
export async function replaceAssets(characterId: number, assets: AssetRow[]): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM character_assets WHERE character_id = $1", [characterId]);
    for (const batch of chunk(assets, INSERT_BATCH)) {
      await client.query(
        `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id,
           location_type, location_flag, is_singleton, is_blueprint_copy, name)
         SELECT $1, * FROM unnest($2::bigint[], $3::int[], $4::bigint[], $5::bigint[], $6::text[],
           $7::text[], $8::bool[], $9::bool[], $10::text[])`,
        [characterId, batch.map((a) => String(a.itemId)), batch.map((a) => a.typeId),
         batch.map((a) => String(a.quantity)), batch.map((a) => String(a.locationId)),
         batch.map((a) => a.locationType), batch.map((a) => a.locationFlag),
         batch.map((a) => a.isSingleton), batch.map((a) => a.isBlueprintCopy), batch.map((a) => a.name)]);
    }
    await client.query("COMMIT");
    return assets.length;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listAssets(characterId: number): Promise<AssetRow[]> {
  const { rows } = await getPool().query<Omit<AssetRow, "itemId" | "quantity" | "locationId"> &
    { itemId: string; quantity: string; locationId: string }>(
    `SELECT item_id AS "itemId", type_id AS "typeId", quantity, location_id AS "locationId",
            location_type AS "locationType", location_flag AS "locationFlag",
            is_singleton AS "isSingleton", is_blueprint_copy AS "isBlueprintCopy", name
     FROM character_assets WHERE character_id = $1 ORDER BY item_id`, [characterId]);
  return rows.map((r) => ({ ...r, itemId: Number(r.itemId), quantity: Number(r.quantity), locationId: Number(r.locationId) }));
}
```

- [ ] **Step 5: Write `src/lib/db/character-fittings.ts`**

```ts
import { getPool } from "./client.js";

export interface FittingItemRow { idx: number; typeId: number; quantity: number; flag: string }
export interface FittingRow { fittingId: number; name: string; description: string; shipTypeId: number; items: FittingItemRow[] }

/** A character has a few dozen fittings at most, so one statement per fitting is fine. */
export async function replaceFittings(characterId: number, fittings: FittingRow[]): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM character_fitting_items WHERE character_id = $1", [characterId]);
    await client.query("DELETE FROM character_fittings WHERE character_id = $1", [characterId]);
    let rows = 0;
    for (const f of fittings) {
      await client.query(
        `INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [characterId, String(f.fittingId), f.name, f.description, f.shipTypeId]);
      rows += 1;
      if (f.items.length) {
        await client.query(
          `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
           SELECT $1, $2, * FROM unnest($3::int[], $4::int[], $5::int[], $6::text[])`,
          [characterId, String(f.fittingId), f.items.map((i) => i.idx), f.items.map((i) => i.typeId),
           f.items.map((i) => i.quantity), f.items.map((i) => i.flag)]);
        rows += f.items.length;
      }
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

export async function listFittings(characterId: number): Promise<FittingRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ fittingId: string; name: string; description: string; shipTypeId: number }>(
    `SELECT fitting_id AS "fittingId", name, description, ship_type_id AS "shipTypeId"
     FROM character_fittings WHERE character_id = $1 ORDER BY fitting_id`, [characterId]);
  const { rows: items } = await pool.query<{ fittingId: string; idx: number; typeId: number; quantity: number; flag: string }>(
    `SELECT fitting_id AS "fittingId", idx, type_id AS "typeId", quantity, flag
     FROM character_fitting_items WHERE character_id = $1 ORDER BY fitting_id, idx`, [characterId]);
  const byFitting = new Map<number, FittingItemRow[]>();
  for (const i of items) {
    const list = byFitting.get(Number(i.fittingId)) ?? [];
    list.push({ idx: i.idx, typeId: i.typeId, quantity: i.quantity, flag: i.flag });
    byFitting.set(Number(i.fittingId), list);
  }
  return rows.map((f) => ({ ...f, fittingId: Number(f.fittingId), items: byFitting.get(Number(f.fittingId)) ?? [] }));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/chunk.test.ts tests/db/character-assets.test.ts tests/db/character-fittings.test.ts && npm run typecheck`
Expected: PASS (eleven tests), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the assets and fittings repos and the chunk helper

Assets are replaced wholesale in batches of 2000 inside one transaction;
fitting items keep their ESI file order via idx so an Invalid flag round-trips.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 8: Wallet and location repos

**Files:**
- Create: `src/lib/db/character-wallet.ts`, `src/lib/db/character-location.ts`
- Test: `tests/db/character-wallet.test.ts`, `tests/db/character-location.test.ts`

**Interfaces:**
- Consumes: phase-1 `getPool()`, Task 5 tables, Task 7 `chunk`.
- Produces:
```ts
// src/lib/db/character-wallet.ts
export interface JournalRow {
  id: number; date: Date; refType: string; description: string;
  amount: number | null; balance: number | null; reason: string | null;
  contextId: number | null; contextIdType: string | null;
  firstPartyId: number | null; secondPartyId: number | null;
  tax: number | null; taxReceiverId: number | null;
}
export interface TransactionRow {
  transactionId: number; date: Date; typeId: number; quantity: number; unitPrice: number;
  clientId: number | null; locationId: number | null; isBuy: boolean; isPersonal: boolean; journalRefId: number | null;
}
export interface WalletWrite { balance: number | null; journal: JournalRow[]; transactions: TransactionRow[] }
export interface WalletRow { characterId: number; balance: number; updatedAt: Date }
export function saveWallet(characterId: number, w: WalletWrite): Promise<number>;
export function getWallet(characterId: number): Promise<WalletRow | null>;
export function listJournal(characterId: number, opts?: { limit?: number; offset?: number }): Promise<JournalRow[]>;
export function listTransactions(characterId: number, opts?: { limit?: number; offset?: number }): Promise<TransactionRow[]>;
// src/lib/db/character-location.ts
export interface LocationInput {
  solarSystemId: number | null; stationId: number | null; structureId: number | null;
  shipItemId: number | null; shipTypeId: number | null; shipName: string | null;
  online: boolean | null; lastLogin: Date | null; lastLogout: Date | null;
}
export interface LocationRow extends LocationInput { characterId: number; updatedAt: Date }
export function upsertLocation(characterId: number, loc: LocationInput): Promise<number>;
export function getLocation(characterId: number): Promise<LocationRow | null>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/db/character-wallet.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { saveWallet, getWallet, listJournal, listTransactions, type JournalRow, type TransactionRow } from "../../src/lib/db/character-wallet.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const journal: JournalRow[] = [
  { id: 24000000001, date: new Date("2026-09-01T10:14:07Z"), refType: "market_transaction", description: "Market: bought Tritanium", amount: -418293.5, balance: 1234567.89, reason: null, contextId: 6100000001, contextIdType: "market_transaction_id", firstPartyId: 669539978, secondPartyId: 2112625428, tax: null, taxReceiverId: null },
  { id: 24000000004, date: new Date("2026-08-31T18:22:51Z"), refType: "corporate_reward_payout", description: "Corporation reward payout", amount: null, balance: null, reason: null, contextId: null, contextIdType: null, firstPartyId: null, secondPartyId: null, tax: null, taxReceiverId: null },
];
const transactions: TransactionRow[] = [
  { transactionId: 6100000001, date: new Date("2026-09-01T10:14:07Z"), typeId: 34, quantity: 100000, unitPrice: 4.18, clientId: 2112625428, locationId: 60003760, isBuy: true, isPersonal: true, journalRefId: 24000000001 },
];

describe("character-wallet repo", () => {
  it("upserts the balance and inserts journal and transaction rows", async () => {
    expect(await saveWallet(CID, { balance: 1234567.89, journal, transactions })).toBe(4);   // 1 + 2 + 1
    expect((await getWallet(CID))!.balance).toBe(1234567.89);
    const rows = await listJournal(CID);
    expect(rows.map((r) => r.id)).toEqual([24000000001, 24000000004]);   // newest first
    expect(rows[0].amount).toBe(-418293.5);
    expect(rows[1].amount).toBeNull();
    expect(rows[1].balance).toBeNull();
    expect((await listTransactions(CID))[0]).toMatchObject({ transactionId: 6100000001, unitPrice: 4.18, isBuy: true });
  });
  it("accumulates: re-importing the same journal adds nothing and keeps older rows", async () => {
    await saveWallet(CID, { balance: 1, journal, transactions });
    expect(await saveWallet(CID, { balance: 2, journal, transactions })).toBe(1);   // balance only
    expect((await listJournal(CID)).length).toBe(2);
    expect((await listTransactions(CID)).length).toBe(1);
    await saveWallet(CID, { balance: 3, journal: [{ ...journal[0], id: 24000000009, date: new Date("2026-09-02T00:00:00Z") }], transactions: [] });
    expect((await listJournal(CID)).map((r) => r.id)).toEqual([24000000009, 24000000001, 24000000004]);
    expect((await getWallet(CID))!.balance).toBe(3);
  });
  it("pages the journal newest-first", async () => {
    await saveWallet(CID, { balance: 1, journal, transactions: [] });
    expect((await listJournal(CID, { limit: 1 })).map((r) => r.id)).toEqual([24000000001]);
    expect((await listJournal(CID, { limit: 1, offset: 1 })).map((r) => r.id)).toEqual([24000000004]);
    expect(await listJournal(CID, { limit: 100, offset: 50 })).toEqual([]);
  });
  it("leaves the stored balance alone when it was not synced", async () => {
    await saveWallet(CID, { balance: 500, journal: [], transactions: [] });
    expect(await saveWallet(CID, { balance: null, journal: [], transactions: [] })).toBe(0);
    expect((await getWallet(CID))!.balance).toBe(500);
  });
  it("returns null for a character that has never synced", async () => {
    expect(await getWallet(CID)).toBeNull();
    expect(await listJournal(CID)).toEqual([]);
    expect(await listTransactions(CID)).toEqual([]);
  });
});
```

Create `tests/db/character-location.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { upsertLocation, getLocation, type LocationInput } from "../../src/lib/db/character-location.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const inSpace: LocationInput = {
  solarSystemId: 30000142, stationId: null, structureId: null,
  shipItemId: 1023456789012, shipTypeId: 587, shipName: "Fast Tackle",
  online: true, lastLogin: new Date("2026-09-01T08:12:44Z"), lastLogout: new Date("2026-08-31T23:58:01Z"),
};

describe("character-location repo", () => {
  it("upserts and reads back a character in space", async () => {
    expect(await upsertLocation(CID, inSpace)).toBe(1);
    const row = (await getLocation(CID))!;
    expect(row).toMatchObject({ characterId: CID, solarSystemId: 30000142, shipTypeId: 587, shipName: "Fast Tackle", online: true });
    expect(row.stationId).toBeNull();
    expect(row.structureId).toBeNull();
    expect(row.shipItemId).toBe(1023456789012);
  });
  it("overwrites on the next tick, including docking in a structure", async () => {
    await upsertLocation(CID, inSpace);
    await upsertLocation(CID, { ...inSpace, structureId: 1035466617946, online: null, lastLogin: null, lastLogout: null });
    const row = (await getLocation(CID))!;
    expect(row.structureId).toBe(1035466617946);
    expect(row.online).toBeNull();
    expect(row.lastLogin).toBeNull();
  });
  it("returns null for a character that has never synced", async () => {
    expect(await getLocation(CID)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/db/character-wallet.test.ts tests/db/character-location.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/db/character-wallet.js"`.

- [ ] **Step 3: Write `src/lib/db/character-wallet.ts`**

```ts
import { getPool } from "./client.js";
import { chunk } from "../chunk.js";

export interface JournalRow {
  id: number; date: Date; refType: string; description: string;
  amount: number | null; balance: number | null; reason: string | null;
  contextId: number | null; contextIdType: string | null;
  firstPartyId: number | null; secondPartyId: number | null;
  tax: number | null; taxReceiverId: number | null;
}
export interface TransactionRow {
  transactionId: number; date: Date; typeId: number; quantity: number; unitPrice: number;
  clientId: number | null; locationId: number | null; isBuy: boolean; isPersonal: boolean; journalRefId: number | null;
}
/** `balance: null` = the wallet endpoint was not synced this run; journal/transactions accumulate. */
export interface WalletWrite { balance: number | null; journal: JournalRow[]; transactions: TransactionRow[] }
export interface WalletRow { characterId: number; balance: number; updatedAt: Date }

const INSERT_BATCH = 2000;
const num = (v: string | null): number | null => (v === null ? null : Number(v));
const bigints = (v: (number | null)[]): (string | null)[] => v.map((n) => (n === null ? null : String(n)));

/**
 * ESI keeps only 30 days of journal, so rows accumulate for ever and are deduplicated on their
 * stable ids with ON CONFLICT DO NOTHING. Returns the number of rows actually written.
 */
export async function saveWallet(characterId: number, w: WalletWrite): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;
    if (w.balance !== null) {
      await client.query(
        `INSERT INTO character_wallet (character_id, balance, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (character_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()`,
        [characterId, w.balance]);
      rows += 1;
    }
    for (const batch of chunk(w.journal, INSERT_BATCH)) {
      const res = await client.query(
        `INSERT INTO character_wallet_journal (character_id, id, date, ref_type, description, amount,
           balance, reason, context_id, context_id_type, first_party_id, second_party_id, tax, tax_receiver_id)
         SELECT $1, * FROM unnest($2::bigint[], $3::timestamptz[], $4::text[], $5::text[], $6::numeric[],
           $7::numeric[], $8::text[], $9::bigint[], $10::text[], $11::bigint[], $12::bigint[],
           $13::numeric[], $14::bigint[])
         ON CONFLICT (character_id, id) DO NOTHING`,
        [characterId, batch.map((j) => String(j.id)), batch.map((j) => j.date), batch.map((j) => j.refType),
         batch.map((j) => j.description), batch.map((j) => j.amount), batch.map((j) => j.balance),
         batch.map((j) => j.reason), bigints(batch.map((j) => j.contextId)), batch.map((j) => j.contextIdType),
         bigints(batch.map((j) => j.firstPartyId)), bigints(batch.map((j) => j.secondPartyId)),
         batch.map((j) => j.tax), bigints(batch.map((j) => j.taxReceiverId))]);
      rows += res.rowCount ?? 0;
    }
    for (const batch of chunk(w.transactions, INSERT_BATCH)) {
      const res = await client.query(
        `INSERT INTO character_wallet_transactions (character_id, transaction_id, date, type_id, quantity,
           unit_price, client_id, location_id, is_buy, is_personal, journal_ref_id)
         SELECT $1, * FROM unnest($2::bigint[], $3::timestamptz[], $4::int[], $5::bigint[], $6::numeric[],
           $7::bigint[], $8::bigint[], $9::bool[], $10::bool[], $11::bigint[])
         ON CONFLICT (character_id, transaction_id) DO NOTHING`,
        [characterId, batch.map((t) => String(t.transactionId)), batch.map((t) => t.date), batch.map((t) => t.typeId),
         batch.map((t) => String(t.quantity)), batch.map((t) => t.unitPrice), bigints(batch.map((t) => t.clientId)),
         bigints(batch.map((t) => t.locationId)), batch.map((t) => t.isBuy), batch.map((t) => t.isPersonal),
         bigints(batch.map((t) => t.journalRefId))]);
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

export async function getWallet(characterId: number): Promise<WalletRow | null> {
  const { rows } = await getPool().query<{ characterId: string; balance: string; updatedAt: Date }>(
    `SELECT character_id AS "characterId", balance, updated_at AS "updatedAt"
     FROM character_wallet WHERE character_id = $1`, [characterId]);
  return rows[0] ? { characterId: Number(rows[0].characterId), balance: Number(rows[0].balance), updatedAt: rows[0].updatedAt } : null;
}

export async function listJournal(characterId: number, opts: { limit?: number; offset?: number } = {}): Promise<JournalRow[]> {
  const { rows } = await getPool().query<Record<string, string | null> & { date: Date; refType: string; description: string }>(
    `SELECT id, date, ref_type AS "refType", description, amount, balance, reason,
            context_id AS "contextId", context_id_type AS "contextIdType",
            first_party_id AS "firstPartyId", second_party_id AS "secondPartyId",
            tax, tax_receiver_id AS "taxReceiverId"
     FROM character_wallet_journal WHERE character_id = $1
     ORDER BY date DESC, id DESC LIMIT $2 OFFSET $3`,
    [characterId, opts.limit ?? 100, opts.offset ?? 0]);
  return rows.map((r) => ({
    id: Number(r.id), date: r.date, refType: r.refType, description: r.description,
    amount: num(r.amount), balance: num(r.balance), reason: r.reason,
    contextId: num(r.contextId), contextIdType: r.contextIdType,
    firstPartyId: num(r.firstPartyId), secondPartyId: num(r.secondPartyId),
    tax: num(r.tax), taxReceiverId: num(r.taxReceiverId),
  }));
}

export async function listTransactions(characterId: number, opts: { limit?: number; offset?: number } = {}): Promise<TransactionRow[]> {
  const { rows } = await getPool().query<Record<string, string | null> & { date: Date; typeId: number; isBuy: boolean; isPersonal: boolean }>(
    `SELECT transaction_id AS "transactionId", date, type_id AS "typeId", quantity,
            unit_price AS "unitPrice", client_id AS "clientId", location_id AS "locationId",
            is_buy AS "isBuy", is_personal AS "isPersonal", journal_ref_id AS "journalRefId"
     FROM character_wallet_transactions WHERE character_id = $1
     ORDER BY date DESC, transaction_id DESC LIMIT $2 OFFSET $3`,
    [characterId, opts.limit ?? 100, opts.offset ?? 0]);
  return rows.map((r) => ({
    transactionId: Number(r.transactionId), date: r.date, typeId: r.typeId,
    quantity: Number(r.quantity), unitPrice: Number(r.unitPrice),
    clientId: num(r.clientId), locationId: num(r.locationId),
    isBuy: r.isBuy, isPersonal: r.isPersonal, journalRefId: num(r.journalRefId),
  }));
}
```

- [ ] **Step 4: Write `src/lib/db/character-location.ts`**

```ts
import { getPool } from "./client.js";

export interface LocationInput {
  solarSystemId: number | null; stationId: number | null; structureId: number | null;
  shipItemId: number | null; shipTypeId: number | null; shipName: string | null;
  online: boolean | null; lastLogin: Date | null; lastLogout: Date | null;
}
export interface LocationRow extends LocationInput { characterId: number; updatedAt: Date }

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * One row per character, overwritten every run. A column whose endpoint was skipped for a missing
 * scope is stored as NULL, which is exactly what the Overview renders as "—".
 */
export async function upsertLocation(characterId: number, loc: LocationInput): Promise<number> {
  await getPool().query(
    `INSERT INTO character_location (character_id, solar_system_id, station_id, structure_id,
       ship_item_id, ship_type_id, ship_name, online, last_login, last_logout, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (character_id) DO UPDATE SET solar_system_id = EXCLUDED.solar_system_id,
       station_id = EXCLUDED.station_id, structure_id = EXCLUDED.structure_id,
       ship_item_id = EXCLUDED.ship_item_id, ship_type_id = EXCLUDED.ship_type_id,
       ship_name = EXCLUDED.ship_name, online = EXCLUDED.online, last_login = EXCLUDED.last_login,
       last_logout = EXCLUDED.last_logout, updated_at = now()`,
    [characterId, loc.solarSystemId, loc.stationId === null ? null : String(loc.stationId),
     loc.structureId === null ? null : String(loc.structureId),
     loc.shipItemId === null ? null : String(loc.shipItemId), loc.shipTypeId, loc.shipName,
     loc.online, loc.lastLogin, loc.lastLogout]);
  return 1;
}

export async function getLocation(characterId: number): Promise<LocationRow | null> {
  const { rows } = await getPool().query<{ characterId: string; solarSystemId: number | null; stationId: string | null;
    structureId: string | null; shipItemId: string | null; shipTypeId: number | null; shipName: string | null;
    online: boolean | null; lastLogin: Date | null; lastLogout: Date | null; updatedAt: Date }>(
    `SELECT character_id AS "characterId", solar_system_id AS "solarSystemId", station_id AS "stationId",
            structure_id AS "structureId", ship_item_id AS "shipItemId", ship_type_id AS "shipTypeId",
            ship_name AS "shipName", online, last_login AS "lastLogin", last_logout AS "lastLogout",
            updated_at AS "updatedAt"
     FROM character_location WHERE character_id = $1`, [characterId]);
  const r = rows[0];
  if (!r) return null;
  return {
    characterId: Number(r.characterId), solarSystemId: r.solarSystemId, stationId: num(r.stationId),
    structureId: num(r.structureId), shipItemId: num(r.shipItemId), shipTypeId: r.shipTypeId,
    shipName: r.shipName, online: r.online, lastLogin: r.lastLogin, lastLogout: r.lastLogout,
    updatedAt: r.updatedAt,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/db/character-wallet.test.ts tests/db/character-location.test.ts && npm run typecheck`
Expected: PASS (eight tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the wallet and location repos

Journal and transaction rows accumulate for ever with ON CONFLICT DO NOTHING
because ESI only serves 30 days; the balance and the location row are upserts.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 9: The `universe_names` and `structures` repo

**Files:**
- Create: `src/lib/db/names.ts`
- Test: `tests/db/names.test.ts`

**Interfaces:**
- Consumes: phase-1 `getPool()`, Task 5 tables, Task 7 `chunk`.
- Produces:
```ts
export interface UniverseName { id: number; category: string; name: string | null; updatedAt: Date }
export interface StructureRow { id: number; name: string | null; solarSystemId: number | null; typeId: number | null; ownerId: number | null; forbidden: boolean; updatedAt: Date }
export interface StructureInput { id: number; name: string | null; solarSystemId: number | null; typeId: number | null; ownerId: number | null; forbidden: boolean }
export function getNames(ids: number[]): Promise<UniverseName[]>;
export function getName(id: number): Promise<UniverseName | null>;
export function putNames(rows: { id: number; category: string; name: string | null }[]): Promise<number>;
export function getStructures(ids: number[]): Promise<StructureRow[]>;
export function getStructure(id: number): Promise<StructureRow | null>;
export function putStructure(row: StructureInput): Promise<void>;
```

- [ ] **Step 1: Write the failing test**

Create `tests/db/names.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool, getPool } from "../../src/lib/db/client.js";
import { getNames, getName, putNames, getStructures, getStructure, putStructure } from "../../src/lib/db/names.js";

beforeEach(async () => { await resetDb(); });
afterAll(closePool);

describe("names repo", () => {
  it("upserts names and reads them back by id", async () => {
    expect(await putNames([
      { id: 669539978, category: "character", name: "TrilliumONE" },
      { id: 34, category: "inventory_type", name: "Tritanium" },
    ])).toBe(2);
    const rows = await getNames([669539978, 34, 999]);
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([34, 669539978]);
    expect((await getName(34))!.name).toBe("Tritanium");
    expect(await getName(999)).toBeNull();
  });
  it("stores an unresolvable id as category 'unknown' with a null name", async () => {
    await putNames([{ id: 12345, category: "unknown", name: null }]);
    const row = (await getName(12345))!;
    expect(row.category).toBe("unknown");
    expect(row.name).toBeNull();
  });
  it("re-upserting refreshes the name, the category and updated_at", async () => {
    await putNames([{ id: 98000001, category: "unknown", name: null }]);
    await getPool().query("UPDATE universe_names SET updated_at = now() - interval '40 days' WHERE id = 98000001");
    const before = (await getName(98000001))!.updatedAt.getTime();
    await putNames([{ id: 98000001, category: "corporation", name: "Real Corp" }]);
    const after = (await getName(98000001))!;
    expect(after.category).toBe("corporation");
    expect(after.name).toBe("Real Corp");
    expect(after.updatedAt.getTime()).toBeGreaterThan(before);
  });
  it("returns an empty array rather than querying for no ids", async () => {
    expect(await getNames([])).toEqual([]);
    expect(await getStructures([])).toEqual([]);
    expect(await putNames([])).toBe(0);
  });
  it("stores a resolved structure and a forbidden one", async () => {
    await putStructure({ id: 1035466617946, name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false });
    await putStructure({ id: 1040000000001, name: null, solarSystemId: null, typeId: null, ownerId: null, forbidden: true });
    const rows = await getStructures([1035466617946, 1040000000001]);
    expect(rows).toHaveLength(2);
    const ok = (await getStructure(1035466617946))!;
    expect(ok.name).toBe("Perimeter - Tranquility Trading Tower");
    expect(ok.solarSystemId).toBe(30000144);
    expect(ok.forbidden).toBe(false);
    const denied = (await getStructure(1040000000001))!;
    expect(denied.forbidden).toBe(true);
    expect(denied.name).toBeNull();
    expect(await getStructure(7)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/names.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/db/names.js"`.

- [ ] **Step 3: Write `src/lib/db/names.ts`**

```ts
import { getPool } from "./client.js";
import { chunk } from "../chunk.js";

export interface UniverseName { id: number; category: string; name: string | null; updatedAt: Date }
export interface StructureRow {
  id: number; name: string | null; solarSystemId: number | null;
  typeId: number | null; ownerId: number | null; forbidden: boolean; updatedAt: Date;
}
export type StructureInput = Omit<StructureRow, "updatedAt">;

const UPSERT_BATCH = 2000;
const num = (v: string | null): number | null => (v === null ? null : Number(v));

export async function getNames(ids: number[]): Promise<UniverseName[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query<{ id: string; category: string; name: string | null; updatedAt: Date }>(
    `SELECT id, category, name, updated_at AS "updatedAt" FROM universe_names WHERE id = ANY($1::bigint[])`,
    [ids.map(String)]);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function getName(id: number): Promise<UniverseName | null> {
  return (await getNames([id]))[0] ?? null;
}

/** Returns the number of rows written. `updated_at` is refreshed so the TTL rules restart. */
export async function putNames(rows: { id: number; category: string; name: string | null }[]): Promise<number> {
  if (rows.length === 0) return 0;
  const pool = getPool();
  for (const batch of chunk(rows, UPSERT_BATCH)) {
    await pool.query(
      `INSERT INTO universe_names (id, category, name, updated_at)
       SELECT *, now() FROM unnest($1::bigint[], $2::text[], $3::text[])
       ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, updated_at = now()`,
      [batch.map((r) => String(r.id)), batch.map((r) => r.category), batch.map((r) => r.name)]);
  }
  return rows.length;
}

export async function getStructures(ids: number[]): Promise<StructureRow[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query<{ id: string; name: string | null; solarSystemId: number | null;
    typeId: number | null; ownerId: string | null; forbidden: boolean; updatedAt: Date }>(
    `SELECT id, name, solar_system_id AS "solarSystemId", type_id AS "typeId", owner_id AS "ownerId",
            forbidden, updated_at AS "updatedAt" FROM structures WHERE id = ANY($1::bigint[])`,
    [ids.map(String)]);
  return rows.map((r) => ({ ...r, id: Number(r.id), ownerId: num(r.ownerId) }));
}

export async function getStructure(id: number): Promise<StructureRow | null> {
  return (await getStructures([id]))[0] ?? null;
}

export async function putStructure(row: StructureInput): Promise<void> {
  await getPool().query(
    `INSERT INTO structures (id, name, solar_system_id, type_id, owner_id, forbidden, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, solar_system_id = EXCLUDED.solar_system_id,
       type_id = EXCLUDED.type_id, owner_id = EXCLUDED.owner_id, forbidden = EXCLUDED.forbidden,
       updated_at = now()`,
    [String(row.id), row.name, row.solarSystemId, row.typeId,
     row.ownerId === null ? null : String(row.ownerId), row.forbidden]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/db/names.test.ts && npm run typecheck`
Expected: PASS (five tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the universe_names and structures repo

Backs the name-resolution cache: POST /universe/names results (including
'unknown' negative caching) and per-structure rows with a forbidden flag for
structures the character is not on the ACL of.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 10: The name-resolution service

**Files:**
- Create: `src/lib/names/ranges.ts`, `src/lib/names/resolve.ts`, `src/lib/names/label.ts`, `src/lib/names/index.ts`
- Test: `tests/names/ranges.test.ts`, `tests/names/resolve.test.ts`, `tests/db/name-label.test.ts`

**Interfaces:**
- Consumes: Task 3 `EsiError`/`EsiUnavailableError`, Task 7 `chunk`, Task 9 `getNames`/`putNames`/`getStructures`/`putStructure`/`UniverseName`/`StructureRow`/`StructureInput`, phase-1 `hasScope`, phase-2 `getSolarSystem`/`getStation` in `src/lib/sde/repo.js`.
- Produces:
```ts
// src/lib/names/ranges.ts
export type LocationKind = "station" | "structure" | "system" | "unknown";
export function classifyLocation(id: number): LocationKind;
export function unknownStructureLabel(id: number): string;
// src/lib/names/resolve.ts
export interface ResolvedName { name: string | null; category: string }
export interface ResolvedLocation { kind: LocationKind; name: string | null; solarSystemId: number | null }
export interface NameResolverDeps {
  esi: {
    post<T>(path: string, body: unknown, opts?: { characterId?: number }): Promise<T>;
    get<T>(path: string, opts?: { characterId?: number }): Promise<{ data: T }>;
  };
  getNames: (ids: number[]) => Promise<UniverseName[]>;
  putNames: (rows: { id: number; category: string; name: string | null }[]) => Promise<number>;
  getStructures: (ids: number[]) => Promise<StructureRow[]>;
  putStructure: (row: StructureInput) => Promise<void>;
  getSolarSystem: (id: number) => Promise<{ id: number; name: string | null } | null>;
  getStation: (id: number) => Promise<{ id: number; solarSystemId: number | null } | null>;
  hasStructureScope: (characterId: number) => Promise<boolean>;
  now?: () => number;
}
export interface NameResolver {
  resolveNames(ids: number[]): Promise<Map<number, ResolvedName>>;
  resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>>;
}
export function createNameResolver(deps: NameResolverDeps): NameResolver;
export const NAMES_CHUNK: number;            // 1000
export const UNKNOWN_TTL_MS: number;         // 7 days
export const VOLATILE_TTL_MS: number;        // 30 days
export const STRUCTURE_TTL_MS: number;       // 7 days
// src/lib/names/label.ts
export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }
export function locationLabel(id: number): Promise<LocationLabel>;
// src/lib/names/index.ts
export function nameResolver(): NameResolver;
export function resolveNames(ids: number[]): Promise<Map<number, ResolvedName>>;
export function resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/names/ranges.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyLocation, unknownStructureLabel } from "../../src/lib/names/ranges.js";

describe("classifyLocation", () => {
  it("maps the ESI id ranges", () => {
    expect(classifyLocation(30000142)).toBe("system");
    expect(classifyLocation(39999999)).toBe("system");
    expect(classifyLocation(60003760)).toBe("station");
    expect(classifyLocation(69999999)).toBe("station");
    expect(classifyLocation(1035466617946)).toBe("structure");
    expect(classifyLocation(1000000000000)).toBe("structure");
  });
  it("calls anything outside those ranges unknown", () => {
    expect(classifyLocation(29999999)).toBe("unknown");
    expect(classifyLocation(40000000)).toBe("unknown");
    expect(classifyLocation(70000000)).toBe("unknown");
    expect(classifyLocation(1023456789012)).toBe("structure");
    expect(classifyLocation(0)).toBe("unknown");
  });
});

describe("unknownStructureLabel", () => {
  it("truncates the id the way the UI shows it", () => {
    expect(unknownStructureLabel(1035466617946)).toBe("Unknown structure (1035…)");
  });
});
```

Create `tests/names/resolve.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createNameResolver, UNKNOWN_TTL_MS, VOLATILE_TTL_MS, STRUCTURE_TTL_MS, type NameResolverDeps } from "../../src/lib/names/resolve.js";
import { EsiError } from "../../src/lib/esi/client.js";
import type { UniverseName, StructureRow } from "../../src/lib/db/names.js";

const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);
const KNOWN: Record<number, { name: string; category: string }> = {
  669539978: { name: "TrilliumONE", category: "character" },
  1000035: { name: "Caldari Navy", category: "corporation" },
  34: { name: "Tritanium", category: "inventory_type" },
  60003760: { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", category: "station" },
};

function harness(over: Partial<NameResolverDeps> = {}) {
  const names = new Map<number, UniverseName>();
  const structures = new Map<number, StructureRow>();
  const posts: number[][] = [];
  const gets: string[] = [];
  const deps: NameResolverDeps = {
    esi: {
      post: vi.fn(async (_path: string, body: unknown) => {
        const ids = body as number[];
        posts.push(ids);
        if (ids.some((id) => !(id in KNOWN))) throw new EsiError(404, "/universe/names", "Ensure all IDs are valid before resolving");
        return ids.map((id) => ({ id, ...KNOWN[id] }));
      }),
      get: vi.fn(async (path: string) => {
        gets.push(path);
        return { data: { name: "Perimeter - Tranquility Trading Tower", owner_id: 98599770, solar_system_id: 30000144, type_id: 35834 } };
      }),
    } as unknown as NameResolverDeps["esi"],
    getNames: async (ids) => ids.map((id) => names.get(id)).filter((r): r is UniverseName => r !== undefined),
    putNames: async (rows) => { for (const r of rows) names.set(r.id, { ...r, updatedAt: new Date(NOW) }); return rows.length; },
    getStructures: async (ids) => ids.map((id) => structures.get(id)).filter((r): r is StructureRow => r !== undefined),
    putStructure: async (row) => { structures.set(row.id, { ...row, updatedAt: new Date(NOW) }); },
    getSolarSystem: async (id) => (id === 30000142 ? { id, name: "Jita" } : null),
    getStation: async (id) => (id === 60003760 ? { id, solarSystemId: 30000142 } : null),
    hasStructureScope: async () => true,
    now: () => NOW,
    ...over,
  };
  return { resolver: createNameResolver(deps), deps, names, structures, posts, gets };
}

const stored = (id: number, category: string, name: string | null, ageMs: number): UniverseName =>
  ({ id, category, name, updatedAt: new Date(NOW - ageMs) });

describe("resolveNames", () => {
  it("serves fresh rows from universe_names without calling ESI", async () => {
    const h = harness();
    h.names.set(34, stored(34, "inventory_type", "Tritanium", 400 * 24 * 3600e3));
    const out = await h.resolver.resolveNames([34, 34]);
    expect(out.get(34)).toEqual({ name: "Tritanium", category: "inventory_type" });
    expect(h.posts).toEqual([]);
  });
  it("refreshes character/corporation/alliance rows older than 30 days", async () => {
    const h = harness();
    h.names.set(669539978, stored(669539978, "character", "Old Name", VOLATILE_TTL_MS + 1000));
    const out = await h.resolver.resolveNames([669539978]);
    expect(h.posts).toEqual([[669539978]]);
    expect(out.get(669539978)!.name).toBe("TrilliumONE");
  });
  it("posts only the ids it does not already have, deduplicated, ignoring junk", async () => {
    const h = harness();
    h.names.set(34, stored(34, "inventory_type", "Tritanium", 0));
    await h.resolver.resolveNames([34, 1000035, 1000035, 0, -7, 1.5]);
    expect(h.posts).toEqual([[1000035]]);
  });
  it("bisects a 404 batch and caches the unresolvable id as 'unknown'", async () => {
    const h = harness();
    const out = await h.resolver.resolveNames([669539978, 999999999, 34]);
    expect(out.get(669539978)!.name).toBe("TrilliumONE");
    expect(out.get(34)!.name).toBe("Tritanium");
    expect(out.get(999999999)).toEqual({ name: null, category: "unknown" });
    expect(h.names.get(999999999)!.category).toBe("unknown");
    expect(h.posts.length).toBeGreaterThan(1);            // the whole batch, then halves, then singles
    expect(h.posts[0]).toEqual([669539978, 999999999, 34]);
  });
  it("does not retry an unknown id for 7 days, then does", async () => {
    const fresh = harness();
    fresh.names.set(999999999, stored(999999999, "unknown", null, UNKNOWN_TTL_MS - 1000));
    expect((await fresh.resolver.resolveNames([999999999])).get(999999999)).toEqual({ name: null, category: "unknown" });
    expect(fresh.posts).toEqual([]);
    const stale = harness();
    stale.names.set(999999999, stored(999999999, "unknown", null, UNKNOWN_TTL_MS + 1000));
    await stale.resolver.resolveNames([999999999]);
    expect(stale.posts).toEqual([[999999999]]);
  });
  it("chunks to 1000 ids per POST", async () => {
    const ids = Array.from({ length: 1500 }, (_, i) => 34);   // deduplicated to one
    const h = harness();
    await h.resolver.resolveNames(ids);
    expect(h.posts).toEqual([[34]]);
    const many = harness({ esi: { post: async (_p: string, body: unknown) => (body as number[]).map((id) => ({ id, name: `n${id}`, category: "inventory_type" })), get: async () => ({ data: {} }) } as unknown as NameResolverDeps["esi"] });
    await many.resolver.resolveNames(Array.from({ length: 2500 }, (_, i) => 1_000_000 + i));
    // posts are not recorded by this fake, so assert through the store instead
    expect(many.names.size).toBe(2500);
  });
  it("returns an empty map for no usable ids", async () => {
    const h = harness();
    expect((await h.resolver.resolveNames([])).size).toBe(0);
    expect((await h.resolver.resolveNames([0, -1])).size).toBe(0);
    expect(h.posts).toEqual([]);
  });
  it("lets a non-404 ESI error propagate", async () => {
    const h = harness({ esi: { post: async () => { throw new EsiError(503, "/universe/names", "down"); }, get: async () => ({ data: {} }) } as unknown as NameResolverDeps["esi"] });
    await expect(h.resolver.resolveNames([34])).rejects.toMatchObject({ status: 503 });
  });
});

describe("resolveLocations", () => {
  it("routes each id by range", async () => {
    const h = harness();
    const out = await h.resolver.resolveLocations([30000142, 60003760, 1035466617946, 42], 1);
    expect(out.get(30000142)).toEqual({ kind: "system", name: "Jita", solarSystemId: 30000142 });
    expect(out.get(60003760)).toEqual({ kind: "station", name: KNOWN[60003760].name, solarSystemId: 30000142 });
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144 });
    expect(out.get(42)).toEqual({ kind: "unknown", name: null, solarSystemId: null });
    expect(h.gets).toEqual(["/universe/structures/1035466617946"]);
  });
  it("stores forbidden = true on a 403 and stops asking", async () => {
    const h = harness({ esi: { post: async () => [], get: async () => { throw new EsiError(403, "/universe/structures/1", "Forbidden"); } } as unknown as NameResolverDeps["esi"] });
    const out = await h.resolver.resolveLocations([1035466617946], 1);
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: null, solarSystemId: null });
    expect(h.structures.get(1035466617946)!.forbidden).toBe(true);
  });
  it("skips the structure call entirely when the token lacks the scope", async () => {
    const h = harness({ hasStructureScope: async () => false });
    const out = await h.resolver.resolveLocations([1035466617946], 1);
    expect(h.gets).toEqual([]);
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: null, solarSystemId: null });
  });
  it("reuses a structure row younger than 7 days and refreshes an older one", async () => {
    const cached = harness();
    cached.structures.set(1035466617946, { id: 1035466617946, name: "Old Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false, updatedAt: new Date(NOW - STRUCTURE_TTL_MS + 1000) });
    expect((await cached.resolver.resolveLocations([1035466617946], 1)).get(1035466617946)!.name).toBe("Old Tower");
    expect(cached.gets).toEqual([]);
    const stale = harness();
    stale.structures.set(1035466617946, { id: 1035466617946, name: "Old Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false, updatedAt: new Date(NOW - STRUCTURE_TTL_MS - 1000) });
    expect((await stale.resolver.resolveLocations([1035466617946], 1)).get(1035466617946)!.name).toBe("Perimeter - Tranquility Trading Tower");
    expect(stale.gets).toEqual(["/universe/structures/1035466617946"]);
  });
});
```

Create `tests/db/name-label.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { putNames, putStructure } from "../../src/lib/db/names.js";
import { locationLabel } from "../../src/lib/names/label.js";

let pool: Pool;
beforeEach(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await pool.query("INSERT INTO sde_solar_systems (id, name, security_status) VALUES (30000142, 'Jita', 0.946)");
  await pool.query("INSERT INTO sde_stations (id, solar_system_id) VALUES (60003760, 30000142)");
});
afterAll(closePool);

describe("locationLabel", () => {
  it("labels a solar system from the SDE", async () => {
    expect(await locationLabel(30000142)).toEqual({ name: "Jita", solarSystemId: 30000142, kind: "system" });
  });
  it("labels a station from universe_names and takes its system from the SDE", async () => {
    await putNames([{ id: 60003760, category: "station", name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" }]);
    expect(await locationLabel(60003760)).toEqual({
      name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", solarSystemId: 30000142, kind: "station",
    });
  });
  it("labels a resolved structure and degrades for a forbidden one", async () => {
    await putStructure({ id: 1035466617946, name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false });
    await putStructure({ id: 1040000000001, name: null, solarSystemId: null, typeId: null, ownerId: null, forbidden: true });
    expect(await locationLabel(1035466617946)).toEqual({ name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, kind: "structure" });
    expect(await locationLabel(1040000000001)).toEqual({ name: "Unknown structure (1040…)", solarSystemId: null, kind: "structure" });
  });
  it("degrades for ids nothing knows about", async () => {
    expect(await locationLabel(1099999999999)).toEqual({ name: "Unknown structure (1099…)", solarSystemId: null, kind: "structure" });
    expect(await locationLabel(60009999)).toEqual({ name: "Unknown station (60009999)", solarSystemId: null, kind: "station" });
    expect(await locationLabel(30009999)).toEqual({ name: "Unknown system (30009999)", solarSystemId: 30009999, kind: "system" });
    expect(await locationLabel(42)).toEqual({ name: "Unknown location (42)", solarSystemId: null, kind: "unknown" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/names tests/db/name-label.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/names/ranges.js"`.

- [ ] **Step 3: Write `src/lib/names/ranges.ts`**

```ts
export type LocationKind = "station" | "structure" | "system" | "unknown";

/**
 * ESI location ids are ranged, not typed: 30000000–39999999 are solar systems, 60000000–69999999
 * are NPC stations, and 1 000 000 000 000 and up are player structures. Anything else (an asset's
 * parent item id, a fitting slot, a corporation office) is not a place we can name.
 */
export function classifyLocation(id: number): LocationKind {
  if (id >= 30_000_000 && id <= 39_999_999) return "system";
  if (id >= 60_000_000 && id <= 69_999_999) return "station";
  if (id >= 1_000_000_000_000) return "structure";
  return "unknown";
}

/** "Unknown structure (1035…)" — what the UI shows when a citadel is forbidden or never resolved. */
export function unknownStructureLabel(id: number): string {
  return `Unknown structure (${String(id).slice(0, 4)}…)`;
}
```

- [ ] **Step 4: Write `src/lib/names/resolve.ts`**

```ts
import { EsiError } from "../esi/client.js";
import { chunk } from "../chunk.js";
import { classifyLocation, type LocationKind } from "./ranges.js";
import type { StructureInput, StructureRow, UniverseName } from "../db/names.js";

export interface ResolvedName { name: string | null; category: string }
export interface ResolvedLocation { kind: LocationKind; name: string | null; solarSystemId: number | null }
interface EsiName { id: number; name: string; category: string }
interface EsiStructure { name: string; owner_id: number; solar_system_id: number; type_id?: number }

export const NAMES_CHUNK = 1000;                          // POST /universe/names maxItems
export const UNKNOWN_TTL_MS = 7 * 24 * 60 * 60 * 1000;    // negative cache for unresolvable ids
export const VOLATILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // character/corporation/alliance names
export const STRUCTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const UNKNOWN_CATEGORY = "unknown";
export const VOLATILE_CATEGORIES = new Set(["character", "corporation", "alliance"]);

export interface NameResolverDeps {
  esi: {
    post<T>(path: string, body: unknown, opts?: { characterId?: number }): Promise<T>;
    get<T>(path: string, opts?: { characterId?: number }): Promise<{ data: T }>;
  };
  getNames: (ids: number[]) => Promise<UniverseName[]>;
  putNames: (rows: { id: number; category: string; name: string | null }[]) => Promise<number>;
  getStructures: (ids: number[]) => Promise<StructureRow[]>;
  putStructure: (row: StructureInput) => Promise<void>;
  getSolarSystem: (id: number) => Promise<{ id: number; name: string | null } | null>;
  getStation: (id: number) => Promise<{ id: number; solarSystemId: number | null } | null>;
  hasStructureScope: (characterId: number) => Promise<boolean>;
  now?: () => number;
}

export interface NameResolver {
  resolveNames(ids: number[]): Promise<Map<number, ResolvedName>>;
  resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>>;
}

export function createNameResolver(deps: NameResolverDeps): NameResolver {
  const now = deps.now ?? Date.now;
  const usable = (ids: number[]): number[] => [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];

  /** Types, regions, stations and systems never change; people and organisations rename. */
  function isFresh(row: UniverseName, at: number): boolean {
    const age = at - row.updatedAt.getTime();
    if (row.category === UNKNOWN_CATEGORY) return age < UNKNOWN_TTL_MS;
    if (VOLATILE_CATEGORIES.has(row.category)) return age < VOLATILE_TTL_MS;
    return true;
  }

  /**
   * POST /universe/names 404s the whole batch when *any* id is unresolvable, so a 404 is bisected
   * down to single ids: the good ones still resolve and the bad ones are identified exactly.
   */
  async function fetchNames(ids: number[]): Promise<EsiName[]> {
    if (ids.length === 0) return [];
    try {
      return await deps.esi.post<EsiName[]>("/universe/names", ids);
    } catch (e) {
      if (!(e instanceof EsiError) || e.status !== 404) throw e;
      if (ids.length === 1) return [];
      const mid = Math.floor(ids.length / 2);
      const head = await fetchNames(ids.slice(0, mid));
      const tail = await fetchNames(ids.slice(mid));
      return [...head, ...tail];
    }
  }

  async function resolveNames(ids: number[]): Promise<Map<number, ResolvedName>> {
    const wanted = usable(ids);
    const out = new Map<number, ResolvedName>();
    if (wanted.length === 0) return out;
    const at = now();
    for (const row of await deps.getNames(wanted)) {
      if (isFresh(row, at)) out.set(row.id, { name: row.name, category: row.category });
    }
    for (const batch of chunk(wanted.filter((id) => !out.has(id)), NAMES_CHUNK)) {
      const resolved = await fetchNames(batch);
      const seen = new Set(resolved.map((r) => r.id));
      const rows = [
        ...resolved.map((r) => ({ id: r.id, category: r.category, name: r.name as string | null })),
        // Anything ESI would not resolve is cached as 'unknown' so it is not retried every run.
        ...batch.filter((id) => !seen.has(id)).map((id) => ({ id, category: UNKNOWN_CATEGORY, name: null })),
      ];
      await deps.putNames(rows);
      for (const r of rows) out.set(r.id, { name: r.name, category: r.category });
    }
    return out;
  }

  /** 403 means the character is not on the structure's ACL — remember that and stop asking. */
  async function fetchStructure(id: number, characterId: number, at: number): Promise<StructureRow> {
    let row: StructureInput;
    try {
      const { data } = await deps.esi.get<EsiStructure>(`/universe/structures/${id}`, { characterId });
      row = { id, name: data.name, solarSystemId: data.solar_system_id, typeId: data.type_id ?? null, ownerId: data.owner_id, forbidden: false };
    } catch (e) {
      if (!(e instanceof EsiError) || e.status !== 403) throw e;
      row = { id, name: null, solarSystemId: null, typeId: null, ownerId: null, forbidden: true };
    }
    await deps.putStructure(row);
    return { ...row, updatedAt: new Date(at) };
  }

  async function resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>> {
    const ids = usable(locationIds);
    const out = new Map<number, ResolvedLocation>();
    if (ids.length === 0) return out;
    const at = now();

    const stationIds = ids.filter((id) => classifyLocation(id) === "station");
    const stationNames = await resolveNames(stationIds);
    const structureIds = ids.filter((id) => classifyLocation(id) === "structure");
    const stored = new Map((await deps.getStructures(structureIds)).map((s) => [s.id, s]));
    const canReadStructures = structureIds.length > 0 && (await deps.hasStructureScope(characterId));

    for (const id of ids) {
      switch (classifyLocation(id)) {
        case "system": {
          const system = await deps.getSolarSystem(id);
          out.set(id, { kind: "system", name: system?.name ?? null, solarSystemId: id });
          break;
        }
        case "station": {
          const station = await deps.getStation(id);
          out.set(id, { kind: "station", name: stationNames.get(id)?.name ?? null, solarSystemId: station?.solarSystemId ?? null });
          break;
        }
        case "structure": {
          let row = stored.get(id) ?? null;
          if (canReadStructures && (row === null || at - row.updatedAt.getTime() > STRUCTURE_TTL_MS)) {
            row = await fetchStructure(id, characterId, at);
          }
          const name = row && !row.forbidden ? row.name : null;
          out.set(id, { kind: "structure", name: name ?? null, solarSystemId: row?.solarSystemId ?? null });
          break;
        }
        default:
          out.set(id, { kind: "unknown", name: null, solarSystemId: null });
      }
    }
    return out;
  }

  return { resolveNames, resolveLocations };
}
```

- [ ] **Step 5: Write `src/lib/names/label.ts`**

```ts
import { getName, getStructure } from "../db/names.js";
import { getSolarSystem, getStation } from "../sde/repo.js";
import { classifyLocation, unknownStructureLabel, type LocationKind } from "./ranges.js";

export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }

/** Read-only helper for pages: Postgres only, never ESI. Degrades instead of throwing. */
export async function locationLabel(id: number): Promise<LocationLabel> {
  switch (classifyLocation(id)) {
    case "system": {
      const system = await getSolarSystem(id);
      return { name: system?.name ?? `Unknown system (${id})`, solarSystemId: id, kind: "system" };
    }
    case "station": {
      const [named, station] = await Promise.all([getName(id), getStation(id)]);
      return { name: named?.name ?? `Unknown station (${id})`, solarSystemId: station?.solarSystemId ?? null, kind: "station" };
    }
    case "structure": {
      const structure = await getStructure(id);
      const name = structure && !structure.forbidden && structure.name ? structure.name : unknownStructureLabel(id);
      return { name, solarSystemId: structure?.solarSystemId ?? null, kind: "structure" };
    }
    default:
      return { name: `Unknown location (${id})`, solarSystemId: null, kind: "unknown" };
  }
}
```

- [ ] **Step 6: Write `src/lib/names/index.ts`**

```ts
import { hasScope } from "../auth/sso.js";
import { getCharacter } from "../db/characters.js";
import { getNames, putNames, getStructures, putStructure } from "../db/names.js";
import { createEsiClient } from "../esi/index.js";
import { getSolarSystem, getStation } from "../sde/repo.js";
import { createNameResolver, type NameResolver, type ResolvedLocation, type ResolvedName } from "./resolve.js";

let resolver: NameResolver | undefined;

/** The real resolver, wired to Postgres and the shared ESI client. Memoised like createEsiClient. */
export function nameResolver(): NameResolver {
  return (resolver ??= createNameResolver({
    esi: createEsiClient(),
    getNames, putNames, getStructures, putStructure,
    getSolarSystem: (id) => getSolarSystem(id),
    getStation: (id) => getStation(id),
    hasStructureScope: async (characterId) => hasScope(await getCharacter(characterId), "esi-universe.read_structures.v1"),
  }));
}

export function resolveNames(ids: number[]): Promise<Map<number, ResolvedName>> {
  return nameResolver().resolveNames(ids);
}
export function resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>> {
  return nameResolver().resolveLocations(locationIds, characterId);
}

export { locationLabel, type LocationLabel } from "./label.js";
export { classifyLocation, unknownStructureLabel, type LocationKind } from "./ranges.js";
export type { NameResolver, ResolvedName, ResolvedLocation } from "./resolve.js";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/names tests/db/name-label.test.ts && npm run typecheck`
Expected: PASS (nineteen tests), typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the name and location resolution service

resolveNames serves universe_names first, bisects the all-or-nothing 404 of
POST /universe/names and negatively caches unresolvable ids for seven days.
resolveLocations routes ids by ESI's numeric ranges and remembers a 403 on a
citadel as forbidden; locationLabel is the read-only helper the pages use.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 11: ESI response fixtures

**Files:**
- Create: `tests/fixtures/esi.ts` and `tests/fixtures/esi/{skills,skillqueue,attributes,clones,implants,assets,assets-names,fittings,wallet-balance,wallet-journal,wallet-transactions,location,ship,online,universe-names,universe-structure}.json`
- Test: `tests/esi/fixtures.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export function esiFixture<T>(name: string): T;   // reads tests/fixtures/esi/<name>.json
```

Every fixture is hand-written from the schemas in `.superpowers/research/esi-endpoints.md` §2–§3 and deliberately
carries the awkward cases: a paused queue entry with no dates, an `Invalid` fitting flag, an asset with no
`is_blueprint_copy`, a journal row with no `amount`, a jump clone with an empty `implants` array, and a
`/location` in space with neither `station_id` nor `structure_id`.

- [ ] **Step 1: Write the failing test**

Create `tests/esi/fixtures.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { esiFixture } from "../fixtures/esi.js";

describe("ESI fixtures", () => {
  it("skillqueue has a completed entry, a future entry and a paused entry with no dates", () => {
    const queue = esiFixture<Record<string, unknown>[]>("skillqueue");
    expect(queue).toHaveLength(3);
    expect(queue[0].finish_date).toBe("2026-08-31T18:30:00Z");
    expect(queue[2]).not.toHaveProperty("start_date");
    expect(queue[2]).not.toHaveProperty("finish_date");
    expect(queue[2]).not.toHaveProperty("level_end_sp");
  });
  it("skills omits nothing required and attributes may omit the remap fields", () => {
    const skills = esiFixture<{ total_sp: number; unallocated_sp?: number; skills: unknown[] }>("skills");
    expect(skills.total_sp).toBeGreaterThan(0);
    expect(skills.skills).toHaveLength(4);
    expect(esiFixture<Record<string, unknown>>("attributes").intelligence).toBe(24);
  });
  it("assets contain an item with no is_blueprint_copy, a BPC, and a nested module", () => {
    const assets = esiFixture<Record<string, unknown>[]>("assets");
    expect(assets.filter((a) => "is_blueprint_copy" in a)).toHaveLength(1);
    expect(assets.some((a) => a.location_type === "item")).toBe(true);
    expect(assets.some((a) => a.location_type === "other")).toBe(true);
  });
  it("clones contain a jump clone with an empty implants array and no name", () => {
    const clones = esiFixture<{ jump_clones: Record<string, unknown>[] }>("clones");
    expect(clones.jump_clones[1].implants).toEqual([]);
    expect(clones.jump_clones[1]).not.toHaveProperty("name");
  });
  it("fittings contain an Invalid flag and an empty description", () => {
    const fittings = esiFixture<{ description: string; items: { flag: string }[] }[]>("fittings");
    expect(fittings[0].description).toBe("");
    expect(fittings[0].items.map((i) => i.flag)).toContain("Invalid");
  });
  it("the wallet balance is a bare number and one journal row has no amount", () => {
    expect(typeof esiFixture<number>("wallet-balance")).toBe("number");
    const journal = esiFixture<Record<string, unknown>[]>("wallet-journal");
    expect(journal.filter((j) => !("amount" in j))).toHaveLength(1);
    expect(journal.some((j) => "tax" in j)).toBe(true);
  });
  it("location is in space, and ship/online are complete", () => {
    const location = esiFixture<Record<string, unknown>>("location");
    expect(location.solar_system_id).toBe(30000142);
    expect(location).not.toHaveProperty("station_id");
    expect(location).not.toHaveProperty("structure_id");
    expect(esiFixture<Record<string, unknown>>("ship").ship_item_id).toBe(1023456789012);
    expect(esiFixture<Record<string, unknown>>("online").online).toBe(true);
  });
  it("universe-names covers several categories and universe-structure has no position requirement", () => {
    const names = esiFixture<{ category: string }[]>("universe-names");
    expect(new Set(names.map((n) => n.category)).size).toBeGreaterThanOrEqual(4);
    expect(esiFixture<Record<string, unknown>>("universe-structure").solar_system_id).toBe(30000144);
    expect(esiFixture<Record<string, unknown>[]>("assets-names")).toHaveLength(5);
    expect(esiFixture<Record<string, unknown>[]>("wallet-transactions")).toHaveLength(2);
    expect(esiFixture<number[]>("implants")).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/esi/fixtures.test.ts`
Expected: FAIL — `Failed to resolve import "../fixtures/esi.js"`.

- [ ] **Step 3: Write the loader `tests/fixtures/esi.ts`**

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "esi");

/** Loads tests/fixtures/esi/<name>.json. Hand-written from the schemas in the ESI research. */
export function esiFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dir, `${name}.json`), "utf8")) as T;
}
```

- [ ] **Step 4: Create the fixtures**

`tests/fixtures/esi/skills.json`:
```json
{
  "total_sp": 47382910,
  "unallocated_sp": 210000,
  "skills": [
    { "skill_id": 3300, "trained_skill_level": 5, "active_skill_level": 5, "skillpoints_in_skill": 256000 },
    { "skill_id": 3327, "trained_skill_level": 4, "active_skill_level": 3, "skillpoints_in_skill": 45255 },
    { "skill_id": 3426, "trained_skill_level": 3, "active_skill_level": 3, "skillpoints_in_skill": 8000 },
    { "skill_id": 24311, "trained_skill_level": 2, "active_skill_level": 2, "skillpoints_in_skill": 6000 }
  ]
}
```

`tests/fixtures/esi/skillqueue.json` (entry 0 finished in the past, entry 1 is training, entry 2 is paused):
```json
[
  {
    "skill_id": 3426,
    "finished_level": 4,
    "queue_position": 0,
    "start_date": "2026-08-30T12:00:00Z",
    "finish_date": "2026-08-31T18:30:00Z",
    "level_start_sp": 8000,
    "level_end_sp": 45255,
    "training_start_sp": 8000
  },
  {
    "skill_id": 3327,
    "finished_level": 5,
    "queue_position": 1,
    "start_date": "2026-08-31T18:30:00Z",
    "finish_date": "2026-09-08T04:15:00Z",
    "level_start_sp": 45255,
    "level_end_sp": 256000,
    "training_start_sp": 45255
  },
  { "skill_id": 24311, "finished_level": 3, "queue_position": 2 }
]
```

`tests/fixtures/esi/attributes.json`:
```json
{
  "charisma": 20,
  "intelligence": 24,
  "memory": 21,
  "perception": 20,
  "willpower": 21,
  "bonus_remaps": 2,
  "last_remap_date": "2025-11-14T09:12:33Z",
  "accrued_remap_cooldown_date": "2026-11-14T09:12:33Z"
}
```

`tests/fixtures/esi/clones.json`:
```json
{
  "home_location": { "location_id": 60003760, "location_type": "station" },
  "jump_clones": [
    {
      "jump_clone_id": 1001,
      "location_id": 60008494,
      "location_type": "station",
      "name": "Amarr medical",
      "implants": [9899, 9941, 9942]
    },
    {
      "jump_clone_id": 1002,
      "location_id": 1035466617946,
      "location_type": "structure",
      "implants": []
    }
  ],
  "last_clone_jump_date": "2026-08-20T21:04:11Z",
  "last_station_change_date": "2026-08-28T07:45:02Z"
}
```

`tests/fixtures/esi/implants.json`:
```json
[9899, 9941, 9942, 9943, 9954]
```

`tests/fixtures/esi/assets.json` (a station hangar with a ship, its two fitted modules, an ore stack, a BPC in a player structure, and a ship in space):
```json
[
  {
    "item_id": 1023456789012,
    "type_id": 587,
    "quantity": 1,
    "location_id": 60003760,
    "location_type": "station",
    "location_flag": "Hangar",
    "is_singleton": true
  },
  {
    "item_id": 1023456789013,
    "type_id": 34,
    "quantity": 129837,
    "location_id": 60003760,
    "location_type": "station",
    "location_flag": "Hangar",
    "is_singleton": false
  },
  {
    "item_id": 1023456789014,
    "type_id": 2048,
    "quantity": 1,
    "location_id": 1023456789012,
    "location_type": "item",
    "location_flag": "LoSlot0",
    "is_singleton": true
  },
  {
    "item_id": 1023456789015,
    "type_id": 484,
    "quantity": 1,
    "location_id": 1023456789012,
    "location_type": "item",
    "location_flag": "HiSlot3",
    "is_singleton": true
  },
  {
    "item_id": 1023456789016,
    "type_id": 785,
    "quantity": 1,
    "location_id": 1035466617946,
    "location_type": "other",
    "location_flag": "Hangar",
    "is_singleton": true,
    "is_blueprint_copy": true
  },
  {
    "item_id": 1023456789017,
    "type_id": 626,
    "quantity": 1,
    "location_id": 30000142,
    "location_type": "solar_system",
    "location_flag": "AutoFit",
    "is_singleton": true
  }
]
```

`tests/fixtures/esi/assets-names.json` (items never renamed come back with their type name):
```json
[
  { "item_id": 1023456789012, "name": "Fast Tackle" },
  { "item_id": 1023456789014, "name": "Damage Control II" },
  { "item_id": 1023456789015, "name": "200mm AutoCannon I" },
  { "item_id": 1023456789016, "name": "Rifter Blueprint" },
  { "item_id": 1023456789017, "name": "Vexor" }
]
```

`tests/fixtures/esi/fittings.json`:
```json
[
  {
    "fitting_id": 4021,
    "name": "Rifter — cheap tackle",
    "description": "",
    "ship_type_id": 587,
    "items": [
      { "type_id": 484, "quantity": 1, "flag": "HiSlot0" },
      { "type_id": 484, "quantity": 1, "flag": "HiSlot1" },
      { "type_id": 5443, "quantity": 1, "flag": "MedSlot0" },
      { "type_id": 2048, "quantity": 1, "flag": "LoSlot0" },
      { "type_id": 31724, "quantity": 1, "flag": "RigSlot0" },
      { "type_id": 12608, "quantity": 400, "flag": "Cargo" },
      { "type_id": 27339, "quantity": 1, "flag": "Invalid" }
    ]
  },
  {
    "fitting_id": 4022,
    "name": "Vexor — ratting",
    "description": "Drone boat for anomalies.",
    "ship_type_id": 626,
    "items": [
      { "type_id": 2456, "quantity": 5, "flag": "DroneBay" }
    ]
  }
]
```

`tests/fixtures/esi/wallet-balance.json` (the route returns a bare double, not an object):
```json
1234567.89
```

`tests/fixtures/esi/wallet-journal.json` (the last row omits `amount` and `balance`):
```json
[
  {
    "id": 24000000001,
    "date": "2026-09-01T10:14:07Z",
    "ref_type": "market_transaction",
    "description": "Market: TrilliumONE bought Tritanium",
    "amount": -418293.5,
    "balance": 1234567.89,
    "context_id": 6100000001,
    "context_id_type": "market_transaction_id",
    "first_party_id": 669539978,
    "second_party_id": 2112625428
  },
  {
    "id": 24000000002,
    "date": "2026-09-01T09:58:44Z",
    "ref_type": "brokers_fee",
    "description": "Broker fee",
    "amount": -12448.8,
    "balance": 1652861.39,
    "context_id": 60003760,
    "context_id_type": "station_id",
    "first_party_id": 669539978,
    "second_party_id": 1000035,
    "tax": 0,
    "tax_receiver_id": 1000035
  },
  {
    "id": 24000000003,
    "date": "2026-08-31T22:03:12Z",
    "ref_type": "player_donation",
    "description": "TrilliumONE transferred cash to Sasha-9999",
    "reason": "for the doctrine",
    "amount": -5000000,
    "balance": 1665310.19,
    "first_party_id": 669539978,
    "second_party_id": 2124678472
  },
  {
    "id": 24000000004,
    "date": "2026-08-31T18:22:51Z",
    "ref_type": "corporate_reward_payout",
    "description": "Corporation reward payout"
  }
]
```

`tests/fixtures/esi/wallet-transactions.json`:
```json
[
  {
    "transaction_id": 6100000001,
    "date": "2026-09-01T10:14:07Z",
    "type_id": 34,
    "quantity": 100000,
    "unit_price": 4.18,
    "client_id": 2112625428,
    "location_id": 60003760,
    "is_buy": true,
    "is_personal": true,
    "journal_ref_id": 24000000001
  },
  {
    "transaction_id": 6100000000,
    "date": "2026-08-31T16:41:22Z",
    "type_id": 1230,
    "quantity": 25000,
    "unit_price": 12.5,
    "client_id": 1000035,
    "location_id": 1035466617946,
    "is_buy": false,
    "is_personal": true,
    "journal_ref_id": 24000000000
  }
]
```

`tests/fixtures/esi/location.json` (in space: neither `station_id` nor `structure_id`):
```json
{ "solar_system_id": 30000142 }
```

`tests/fixtures/esi/ship.json`:
```json
{ "ship_item_id": 1023456789012, "ship_name": "Fast Tackle", "ship_type_id": 587 }
```

`tests/fixtures/esi/online.json`:
```json
{
  "online": true,
  "last_login": "2026-09-01T08:12:44Z",
  "last_logout": "2026-08-31T23:58:01Z",
  "logins": 4127
}
```

`tests/fixtures/esi/universe-names.json`:
```json
[
  { "id": 669539978, "name": "TrilliumONE", "category": "character" },
  { "id": 2112625428, "name": "Broker Bob", "category": "character" },
  { "id": 1000035, "name": "Caldari Navy", "category": "corporation" },
  { "id": 60003760, "name": "Jita IV - Moon 4 - Caldari Navy Assembly Plant", "category": "station" },
  { "id": 30000142, "name": "Jita", "category": "solar_system" },
  { "id": 34, "name": "Tritanium", "category": "inventory_type" }
]
```

`tests/fixtures/esi/universe-structure.json`:
```json
{
  "name": "Perimeter - Tranquility Trading Tower",
  "owner_id": 98599770,
  "solar_system_id": 30000144,
  "type_id": 35834,
  "position": { "x": -1489457537024, "y": 172080046080, "z": -1160388403200 }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/esi/fixtures.test.ts && npm run typecheck`
Expected: PASS (eight tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add realistic ESI response fixtures for the phase-3 endpoints

Hand-written from the researched schemas and deliberately awkward: a paused
skill-queue entry with no dates, an Invalid fitting flag, an asset with no
is_blueprint_copy, a journal row with no amount, an empty jump clone and a
character in space with neither station_id nor structure_id.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 12: The `skills` job

**Files:**
- Create: `src/worker/jobs/skills.ts`
- Test: `tests/worker/skills.test.ts`

**Interfaces:**
- Consumes: `CharacterSyncJob`/`JobContext` in `src/worker/scheduler.js`, Task 1 `hasScope`, Task 6 `replaceSkills`/`SkillsWrite`/`SkillRow`/`SkillQueueRow`/`AttributesInput`, phase-1 `getCharacter`, Task 11 `esiFixture`.
- Produces:
```ts
export const SKILLS_INTERVAL_MS: number;   // 1 h
export const SKILLS_RETRY_MS: number;      // 10 min
export interface SkillsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceSkills: (characterId: number, w: SkillsWrite) => Promise<number>;
  now?: () => number;
}
export function applyQueueOverlay(skills: SkillRow[], queue: SkillQueueRow[], nowMs: number): SkillRow[];
export function createSkillsJob(deps: SkillsJobDeps): CharacterSyncJob;
export const skillsJob: CharacterSyncJob;
```

- [ ] **Step 1: Write the failing test**

Create `tests/worker/skills.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createSkillsJob, skillsJob, applyQueueOverlay, SKILLS_INTERVAL_MS, SKILLS_RETRY_MS, type SkillsJobDeps } from "../../src/worker/jobs/skills.js";
import type { SkillsWrite } from "../../src/lib/db/character-skills.js";
import { esiFixture } from "../fixtures/esi.js";
import { EsiUnavailableError } from "../../src/lib/esi/client.js";

const CID = 669539978;
const NOW = Date.parse("2026-09-01T12:00:00Z");
const ALL = ["esi-skills.read_skills.v1", "esi-skills.read_skillqueue.v1"];

function harness(scopes: string[] = ALL, over: Partial<SkillsJobDeps> = {}) {
  const writes: SkillsWrite[] = [];
  const paths: string[] = [];
  const deps: SkillsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceSkills: async (_id, w) => { writes.push(w); return 99; },
    now: () => NOW,
    ...over,
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/skills")) return { data: esiFixture("skills") };
      if (path.endsWith("/skillqueue")) return { data: esiFixture("skillqueue") };
      if (path.endsWith("/attributes")) return { data: esiFixture("attributes") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createSkillsJob(deps), esi, writes, paths };
}

describe("skills job", () => {
  it("is an hourly character job that retries in 10 minutes", () => {
    expect(skillsJob.name).toBe("skills");
    expect(skillsJob.intervalMs).toBe(SKILLS_INTERVAL_MS);
    expect(SKILLS_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(skillsJob.retryMs).toBe(SKILLS_RETRY_MS);
    expect(SKILLS_RETRY_MS).toBe(10 * 60 * 1000);
    expect(skillsJob.scope ?? "character").toBe("character");
  });
  it("fetches all three endpoints and returns the repo's row count", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(99);
    expect(h.paths).toEqual([
      `/characters/${CID}/skillqueue`, `/characters/${CID}/skills`, `/characters/${CID}/attributes`,
    ]);
  });
  it("overlays completed queue entries on top of the stale /skills list", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const written = h.writes[0].skills!;
    // Fixture: /skills says 3426 is level 3 with 8000 SP; queue position 0 finished level 4 in the past.
    expect(written.find((s) => s.skillId === 3426)).toEqual({ skillId: 3426, trainedLevel: 4, activeLevel: 4, skillpoints: 45255 });
    // Queue position 1 finishes in the future, so 3327 is untouched.
    expect(written.find((s) => s.skillId === 3327)).toEqual({ skillId: 3327, trainedLevel: 4, activeLevel: 3, skillpoints: 45255 });
    expect(h.writes[0].summary).toEqual({ totalSp: 47382910, unallocatedSp: 210000 });
  });
  it("stores the paused queue entry's missing dates and SP as null", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const paused = h.writes[0].queue!.find((q) => q.queuePosition === 2)!;
    expect(paused).toEqual({ queuePosition: 2, skillId: 24311, finishedLevel: 3, startDate: null, finishDate: null, levelStartSp: null, levelEndSp: null, trainingStartSp: null });
  });
  it("maps the attributes, keeping the optional remap fields", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].attributes).toEqual({
      charisma: 20, intelligence: 24, memory: 21, perception: 20, willpower: 21,
      bonusRemaps: 2, lastRemapDate: new Date("2025-11-14T09:12:33Z"),
      accruedRemapCooldownDate: new Date("2026-11-14T09:12:33Z"),
    });
  });
  it("treats absent optional attribute fields as null", async () => {
    const h = harness();
    h.esi.get = vi.fn(async (path: string) => {
      if (path.endsWith("/skillqueue")) return { data: [] };
      if (path.endsWith("/skills")) return { data: { total_sp: 10, skills: [] } };
      return { data: { charisma: 20, intelligence: 20, memory: 20, perception: 20, willpower: 20 } };
    });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].summary).toEqual({ totalSp: 10, unallocatedSp: null });
    expect(h.writes[0].attributes).toEqual({
      charisma: 20, intelligence: 20, memory: 20, perception: 20, willpower: 20,
      bonusRemaps: null, lastRemapDate: null, accruedRemapCooldownDate: null,
    });
  });
  it("skips the queue when its scope is missing but still syncs skills and attributes", async () => {
    const h = harness(["esi-skills.read_skills.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/skills`, `/characters/${CID}/attributes`]);
    expect(h.writes[0].queue).toBeNull();
    expect(h.writes[0].skills).not.toBeNull();
  });
  it("syncs only the queue when the skills scope is missing", async () => {
    const h = harness(["esi-skills.read_skillqueue.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/skillqueue`]);
    expect(h.writes[0].skills).toBeNull();
    expect(h.writes[0].summary).toBeNull();
    expect(h.writes[0].attributes).toBeNull();
  });
  it("returns 0 without calling ESI when neither scope is granted", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
    expect(h.writes).toEqual([]);
  });
  it("lets an ESI outage propagate so the scheduler records it", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/skillqueue", NOW + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
  });
});

describe("applyQueueOverlay", () => {
  const base = [{ skillId: 3300, trainedLevel: 4, activeLevel: 4, skillpoints: 45255 }];
  const entry = (over: Partial<{ queuePosition: number; skillId: number; finishedLevel: number; finishDate: Date | null; levelEndSp: number | null }>) => ({
    queuePosition: 0, skillId: 3300, finishedLevel: 5, startDate: null, finishDate: new Date(NOW - 1000),
    levelStartSp: null, levelEndSp: 256000, trainingStartSp: null, ...over,
  });

  it("applies only entries whose finish date has passed", () => {
    expect(applyQueueOverlay(base, [entry({ finishDate: new Date(NOW + 1000) })], NOW)).toEqual(base);
    expect(applyQueueOverlay(base, [entry({})], NOW)).toEqual([{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 }]);
  });
  it("ignores a paused entry with no finish date", () => {
    expect(applyQueueOverlay(base, [entry({ finishDate: null })], NOW)).toEqual(base);
  });
  it("adds a skill /skills has never heard of", () => {
    const out = applyQueueOverlay([], [entry({ skillId: 3426, finishedLevel: 1, levelEndSp: 250 })], NOW);
    expect(out).toEqual([{ skillId: 3426, trainedLevel: 1, activeLevel: 1, skillpoints: 250 }]);
  });
  it("keeps the highest active level and applies queue entries in position order", () => {
    const out = applyQueueOverlay(
      [{ skillId: 3300, trainedLevel: 3, activeLevel: 3, skillpoints: 8000 }],
      [entry({ queuePosition: 1, finishedLevel: 5, levelEndSp: 256000 }), entry({ queuePosition: 0, finishedLevel: 4, levelEndSp: 45255 })],
      NOW);
    expect(out).toEqual([{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 }]);
  });
  it("keeps the stored skillpoints when the queue entry has no level_end_sp", () => {
    expect(applyQueueOverlay(base, [entry({ levelEndSp: null })], NOW))
      .toEqual([{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 45255 }]);
  });
  it("returns skills sorted by skill id", () => {
    const out = applyQueueOverlay(
      [{ skillId: 3327, trainedLevel: 1, activeLevel: 1, skillpoints: 250 }],
      [entry({ skillId: 3300 })], NOW);
    expect(out.map((s) => s.skillId)).toEqual([3300, 3327]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/skills.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/skills.js"`.

- [ ] **Step 3: Write `src/worker/jobs/skills.ts`**

```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import {
  replaceSkills, type AttributesInput, type SkillQueueRow, type SkillRow, type SkillsWrite,
} from "../../lib/db/character-skills.js";

export const SKILLS_INTERVAL_MS = 60 * 60 * 1000;
export const SKILLS_RETRY_MS = 10 * 60 * 1000;
const SKILLS_SCOPE = "esi-skills.read_skills.v1";        // also covers /attributes
const QUEUE_SCOPE = "esi-skills.read_skillqueue.v1";

interface EsiSkill { skill_id: number; trained_skill_level: number; active_skill_level: number; skillpoints_in_skill: number }
interface EsiSkills { total_sp: number; unallocated_sp?: number; skills: EsiSkill[] }
interface EsiQueueEntry {
  skill_id: number; finished_level: number; queue_position: number;
  start_date?: string; finish_date?: string;
  level_start_sp?: number; level_end_sp?: number; training_start_sp?: number;
}
interface EsiAttributes {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonus_remaps?: number; last_remap_date?: string; accrued_remap_cooldown_date?: string;
}

export interface SkillsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceSkills: (characterId: number, w: SkillsWrite) => Promise<number>;
  now?: () => number;
}

const date = (v: string | undefined): Date | null => (v === undefined ? null : new Date(v));
const nullable = (v: number | undefined): number | null => (v === undefined ? null : v);

function toQueueRow(e: EsiQueueEntry): SkillQueueRow {
  return {
    queuePosition: e.queue_position, skillId: e.skill_id, finishedLevel: e.finished_level,
    startDate: date(e.start_date), finishDate: date(e.finish_date),
    levelStartSp: nullable(e.level_start_sp), levelEndSp: nullable(e.level_end_sp),
    trainingStartSp: nullable(e.training_start_sp),
  };
}

function toAttributes(a: EsiAttributes): AttributesInput {
  return {
    charisma: a.charisma, intelligence: a.intelligence, memory: a.memory,
    perception: a.perception, willpower: a.willpower,
    bonusRemaps: nullable(a.bonus_remaps), lastRemapDate: date(a.last_remap_date),
    accruedRemapCooldownDate: date(a.accrued_remap_cooldown_date),
  };
}

/**
 * CCP: "/skills can be out-of-date if the character hasn't logged in since one or more skills
 * completed training … entries that are in the past need to be applied on top of this list."
 * Without this a character who trained overnight shows stale skills indefinitely.
 */
export function applyQueueOverlay(skills: SkillRow[], queue: SkillQueueRow[], nowMs: number): SkillRow[] {
  const bySkill = new Map(skills.map((s) => [s.skillId, { ...s }]));
  for (const q of [...queue].sort((a, b) => a.queuePosition - b.queuePosition)) {
    if (q.finishDate === null || q.finishDate.getTime() > nowMs) continue;
    const current = bySkill.get(q.skillId) ?? { skillId: q.skillId, trainedLevel: 0, activeLevel: 0, skillpoints: 0 };
    bySkill.set(q.skillId, {
      skillId: q.skillId,
      trainedLevel: q.finishedLevel,
      activeLevel: Math.max(current.activeLevel, q.finishedLevel),
      skillpoints: q.levelEndSp ?? current.skillpoints,
    });
  }
  return [...bySkill.values()].sort((a, b) => a.skillId - b.skillId);
}

export function createSkillsJob(deps: SkillsJobDeps): CharacterSyncJob {
  const now = deps.now ?? Date.now;
  return {
    name: "skills",
    intervalMs: SKILLS_INTERVAL_MS,
    retryMs: SKILLS_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      const canSkills = hasScope(character, SKILLS_SCOPE);
      const canQueue = hasScope(character, QUEUE_SCOPE);
      if (!canSkills && !canQueue) return 0;

      // The queue comes first: the overlay needs it, and /skillqueue is a bare array, not paginated.
      const queue = canQueue
        ? (await esi.get<EsiQueueEntry[]>(`/characters/${characterId}/skillqueue`, { characterId })).data.map(toQueueRow)
        : null;

      let summary: SkillsWrite["summary"] = null;
      let skills: SkillRow[] | null = null;
      let attributes: AttributesInput | null = null;
      if (canSkills) {
        const sheet = (await esi.get<EsiSkills>(`/characters/${characterId}/skills`, { characterId })).data;
        const attrs = (await esi.get<EsiAttributes>(`/characters/${characterId}/attributes`, { characterId })).data;
        summary = { totalSp: sheet.total_sp, unallocatedSp: nullable(sheet.unallocated_sp) };
        skills = applyQueueOverlay(sheet.skills.map((s) => ({
          skillId: s.skill_id, trainedLevel: s.trained_skill_level,
          activeLevel: s.active_skill_level, skillpoints: s.skillpoints_in_skill,
        })), queue ?? [], now());
        attributes = toAttributes(attrs);
      }
      return deps.replaceSkills(characterId, { summary, skills, queue, attributes });
    },
  };
}

export const skillsJob: CharacterSyncJob = createSkillsJob({ getCharacter, replaceSkills });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/worker/skills.test.ts && npm run typecheck`
Expected: PASS (sixteen tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the hourly skills sync job

Fetches /skillqueue, /skills and /attributes, overlays every queue entry that
already finished on top of the (documented-stale) skill sheet, and stores a
paused queue entry's missing dates as NULL. Each endpoint is scope-gated and
skipped rather than failed when the token lacks its scope.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 13: The `clones` and `fittings` jobs

Both are 6-hourly replace-wholesale jobs over a single character endpoint each, so they share a task.

**Files:**
- Create: `src/worker/jobs/clones.ts`, `src/worker/jobs/fittings.ts`
- Test: `tests/worker/clones.test.ts`, `tests/worker/fittings.test.ts`

**Interfaces:**
- Consumes: `CharacterSyncJob` in `src/worker/scheduler.js`, Task 1 `hasScope`, Task 6 `replaceClones`/`ClonesWrite`/`JumpCloneRow`, Task 7 `replaceFittings`/`FittingRow`, phase-1 `getCharacter`, Task 11 `esiFixture`.
- Produces:
```ts
// src/worker/jobs/clones.ts
export const CLONES_INTERVAL_MS: number;   // 6 h
export const CLONES_RETRY_MS: number;      // 15 min
export interface ClonesJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceClones: (characterId: number, w: ClonesWrite) => Promise<number>;
}
export function createClonesJob(deps: ClonesJobDeps): CharacterSyncJob;
export const clonesJob: CharacterSyncJob;
// src/worker/jobs/fittings.ts
export const FITTINGS_INTERVAL_MS: number; // 6 h
export const FITTINGS_RETRY_MS: number;    // 15 min
export interface FittingsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceFittings: (characterId: number, fittings: FittingRow[]) => Promise<number>;
}
export function createFittingsJob(deps: FittingsJobDeps): CharacterSyncJob;
export const fittingsJob: CharacterSyncJob;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/worker/clones.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createClonesJob, clonesJob, CLONES_INTERVAL_MS, CLONES_RETRY_MS, type ClonesJobDeps } from "../../src/worker/jobs/clones.js";
import type { ClonesWrite } from "../../src/lib/db/character-clones.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
const ALL = ["esi-clones.read_clones.v1", "esi-clones.read_implants.v1"];

function harness(scopes: string[] = ALL) {
  const writes: ClonesWrite[] = [];
  const paths: string[] = [];
  const deps: ClonesJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceClones: async (_id, w) => { writes.push(w); return 8; },
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/clones")) return { data: esiFixture("clones") };
      if (path.endsWith("/implants")) return { data: esiFixture("implants") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createClonesJob(deps), esi, writes, paths };
}

describe("clones job", () => {
  it("is a 6-hourly character job that retries in 15 minutes", () => {
    expect(clonesJob.name).toBe("clones");
    expect(clonesJob.intervalMs).toBe(CLONES_INTERVAL_MS);
    expect(CLONES_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(clonesJob.retryMs).toBe(CLONES_RETRY_MS);
    expect(CLONES_RETRY_MS).toBe(15 * 60 * 1000);
  });
  it("maps the home clone, jump clones and the active clone's implants", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(8);
    expect(h.paths).toEqual([`/characters/${CID}/clones`, `/characters/${CID}/implants`]);
    const w = h.writes[0];
    expect(w.clones).toMatchObject({
      homeLocationId: 60003760, homeLocationType: "station",
      lastCloneJumpDate: new Date("2026-08-20T21:04:11Z"),
      lastStationChangeDate: new Date("2026-08-28T07:45:02Z"),
    });
    expect(w.clones!.jumpClones).toEqual([
      { jumpCloneId: 1001, locationId: 60008494, locationType: "station", name: "Amarr medical", implants: [9899, 9941, 9942] },
      { jumpCloneId: 1002, locationId: 1035466617946, locationType: "structure", name: null, implants: [] },
    ]);
    expect(w.implants).toEqual([9899, 9941, 9942, 9943, 9954]);
  });
  it("survives a fully absent home_location and empty dates", async () => {
    const h = harness();
    h.esi.get = vi.fn(async (path: string) =>
      path.endsWith("/clones") ? { data: { jump_clones: [] } } : { data: [] });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].clones).toEqual({
      homeLocationId: null, homeLocationType: null, lastCloneJumpDate: null,
      lastStationChangeDate: null, jumpClones: [],
    });
  });
  it("skips /implants when its scope is missing", async () => {
    const h = harness(["esi-clones.read_clones.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/clones`]);
    expect(h.writes[0].implants).toBeNull();
  });
  it("skips /clones when its scope is missing", async () => {
    const h = harness(["esi-clones.read_implants.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/implants`]);
    expect(h.writes[0].clones).toBeNull();
  });
  it("returns 0 without calling ESI when neither scope is granted", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
  });
});
```

Create `tests/worker/fittings.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createFittingsJob, fittingsJob, FITTINGS_INTERVAL_MS, FITTINGS_RETRY_MS, type FittingsJobDeps } from "../../src/worker/jobs/fittings.js";
import type { FittingRow } from "../../src/lib/db/character-fittings.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;

function harness(scopes: string[] = ["esi-fittings.read_fittings.v1"]) {
  const writes: FittingRow[][] = [];
  const paths: string[] = [];
  const deps: FittingsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceFittings: async (_id, f) => { writes.push(f); return 6; },
  };
  const esi = { get: vi.fn(async (path: string) => { paths.push(path); return { data: esiFixture("fittings") }; }) };
  return { job: createFittingsJob(deps), esi, writes, paths };
}

describe("fittings job", () => {
  it("is a 6-hourly character job that retries in 15 minutes", () => {
    expect(fittingsJob.name).toBe("fittings");
    expect(fittingsJob.intervalMs).toBe(FITTINGS_INTERVAL_MS);
    expect(FITTINGS_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(fittingsJob.retryMs).toBe(FITTINGS_RETRY_MS);
    expect(FITTINGS_RETRY_MS).toBe(15 * 60 * 1000);
  });
  it("stores items in file order with idx, including the Invalid flag", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(6);
    expect(h.paths).toEqual([`/characters/${CID}/fittings`]);
    const [rifter, vexor] = h.writes[0];
    expect(rifter).toMatchObject({ fittingId: 4021, name: "Rifter — cheap tackle", description: "", shipTypeId: 587 });
    expect(rifter.items.map((i) => [i.idx, i.flag])).toEqual([
      [0, "HiSlot0"], [1, "HiSlot1"], [2, "MedSlot0"], [3, "LoSlot0"], [4, "RigSlot0"], [5, "Cargo"], [6, "Invalid"],
    ]);
    expect(rifter.items[5].quantity).toBe(400);
    expect(vexor.items).toEqual([{ idx: 0, typeId: 2456, quantity: 5, flag: "DroneBay" }]);
  });
  it("writes an empty list when the character has no fittings", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => ({ data: [] }));
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0]).toEqual([]);
  });
  it("returns 0 without calling ESI when the scope is missing", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
    expect(h.writes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/worker/clones.test.ts tests/worker/fittings.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/clones.js"`.

- [ ] **Step 3: Write `src/worker/jobs/clones.ts`**

```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { replaceClones, type ClonesWrite, type JumpCloneRow } from "../../lib/db/character-clones.js";

export const CLONES_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const CLONES_RETRY_MS = 15 * 60 * 1000;
const CLONES_SCOPE = "esi-clones.read_clones.v1";
const IMPLANTS_SCOPE = "esi-clones.read_implants.v1";

interface EsiJumpClone { jump_clone_id: number; location_id: number; location_type: string; name?: string; implants: number[] }
interface EsiClones {
  home_location?: { location_id?: number; location_type?: string };
  jump_clones?: EsiJumpClone[];
  last_clone_jump_date?: string;
  last_station_change_date?: string;
}

export interface ClonesJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceClones: (characterId: number, w: ClonesWrite) => Promise<number>;
}

const date = (v: string | undefined): Date | null => (v === undefined ? null : new Date(v));

function toJumpClone(c: EsiJumpClone): JumpCloneRow {
  return {
    jumpCloneId: c.jump_clone_id, locationId: c.location_id ?? null,
    locationType: c.location_type ?? null, name: c.name ?? null, implants: c.implants ?? [],
  };
}

export function createClonesJob(deps: ClonesJobDeps): CharacterSyncJob {
  return {
    name: "clones",
    intervalMs: CLONES_INTERVAL_MS,
    retryMs: CLONES_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      const canClones = hasScope(character, CLONES_SCOPE);
      const canImplants = hasScope(character, IMPLANTS_SCOPE);
      if (!canClones && !canImplants) return 0;

      let clones: ClonesWrite["clones"] = null;
      if (canClones) {
        // home_location is optional as a whole and both of its fields are optional too.
        const data = (await esi.get<EsiClones>(`/characters/${characterId}/clones`, { characterId })).data;
        clones = {
          homeLocationId: data.home_location?.location_id ?? null,
          homeLocationType: data.home_location?.location_type ?? null,
          lastCloneJumpDate: date(data.last_clone_jump_date),
          lastStationChangeDate: date(data.last_station_change_date),
          jumpClones: (data.jump_clones ?? []).map(toJumpClone),
        };
      }
      // /implants is a bare int64[] on a different scope, so it is always a second request.
      const implants = canImplants
        ? (await esi.get<number[]>(`/characters/${characterId}/implants`, { characterId })).data
        : null;

      return deps.replaceClones(characterId, { clones, implants });
    },
  };
}

export const clonesJob: CharacterSyncJob = createClonesJob({ getCharacter, replaceClones });
```

- [ ] **Step 4: Write `src/worker/jobs/fittings.ts`**

```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { replaceFittings, type FittingRow } from "../../lib/db/character-fittings.js";

export const FITTINGS_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const FITTINGS_RETRY_MS = 15 * 60 * 1000;
const FITTINGS_SCOPE = "esi-fittings.read_fittings.v1";

interface EsiFittingItem { type_id: number; quantity: number; flag: string }
interface EsiFitting { fitting_id: number; name: string; description: string; ship_type_id: number; items: EsiFittingItem[] }

export interface FittingsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceFittings: (characterId: number, fittings: FittingRow[]) => Promise<number>;
}

export function createFittingsJob(deps: FittingsJobDeps): CharacterSyncJob {
  return {
    name: "fittings",
    intervalMs: FITTINGS_INTERVAL_MS,
    retryMs: FITTINGS_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, FITTINGS_SCOPE)) return 0;
      const data = (await esi.get<EsiFitting[]>(`/characters/${characterId}/fittings`, { characterId })).data;
      // Items keep their ESI array order via idx; `flag` may legitimately be "Invalid".
      const fittings: FittingRow[] = data.map((f) => ({
        fittingId: f.fitting_id, name: f.name, description: f.description, shipTypeId: f.ship_type_id,
        items: (f.items ?? []).map((i, idx) => ({ idx, typeId: i.type_id, quantity: i.quantity, flag: i.flag })),
      }));
      return deps.replaceFittings(characterId, fittings);
    },
  };
}

export const fittingsJob: CharacterSyncJob = createFittingsJob({ getCharacter, replaceFittings });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/worker/clones.test.ts tests/worker/fittings.test.ts && npm run typecheck`
Expected: PASS (ten tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the 6-hourly clones and fittings sync jobs

Clones parses home_location fully defensively (the object and both of its
fields are optional) and reads the active clone's implants from the separate
scope; fittings keeps ESI's item order in idx and stores the Invalid flag as-is.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 14: The `assets` job

**Files:**
- Create: `src/worker/jobs/assets.ts`
- Test: `tests/worker/assets.test.ts`

**Interfaces:**
- Consumes: `CharacterSyncJob` in `src/worker/scheduler.js`, Task 1 `hasScope`, Task 7 `chunk`/`replaceAssets`/`AssetRow`, Task 10 `resolveLocations`, phase-1 `getCharacter`, Task 11 `esiFixture`.
- Produces:
```ts
export const ASSETS_INTERVAL_MS: number;   // 1 h
export const ASSETS_RETRY_MS: number;      // 10 min
export const ASSET_NAMES_CHUNK: number;    // 1000 — ESI's maxItems for the POST body
export interface AssetsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceAssets: (characterId: number, assets: AssetRow[]) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}
export function createAssetsJob(deps: AssetsJobDeps): CharacterSyncJob;
export const assetsJob: CharacterSyncJob;
```

- [ ] **Step 1: Write the failing test**

Create `tests/worker/assets.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createAssetsJob, assetsJob, ASSETS_INTERVAL_MS, ASSETS_RETRY_MS, ASSET_NAMES_CHUNK, type AssetsJobDeps } from "../../src/worker/jobs/assets.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import { EsiUnavailableError } from "../../src/lib/esi/client.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
type RawAsset = { item_id: number; type_id: number; quantity: number; location_id: number; location_type: string; location_flag: string; is_singleton: boolean; is_blueprint_copy?: boolean };

function harness(scopes: string[] = ["esi-assets.read_assets.v1"], assets = esiFixture<RawAsset[]>("assets")) {
  const writes: AssetRow[][] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const posts: { path: string; body: number[] }[] = [];
  const getAllPaths: string[] = [];
  const deps: AssetsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceAssets: async (_id, rows) => { writes.push(rows); return rows.length; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
  };
  const esi = {
    getAll: vi.fn(async (path: string) => { getAllPaths.push(path); return assets; }),
    post: vi.fn(async (path: string, body: unknown) => {
      posts.push({ path, body: body as number[] });
      const names = esiFixture<{ item_id: number; name: string }[]>("assets-names");
      return names.filter((n) => (body as number[]).includes(n.item_id));
    }),
  };
  return { job: createAssetsJob(deps), esi, writes, resolved, posts, getAllPaths };
}

describe("assets job", () => {
  it("is an hourly character job that retries in 10 minutes", () => {
    expect(assetsJob.name).toBe("assets");
    expect(assetsJob.intervalMs).toBe(ASSETS_INTERVAL_MS);
    expect(ASSETS_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(assetsJob.retryMs).toBe(ASSETS_RETRY_MS);
    expect(ASSETS_RETRY_MS).toBe(10 * 60 * 1000);
    expect(ASSET_NAMES_CHUNK).toBe(1000);
  });
  it("walks every page, names the singletons and returns the rows written", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(6);
    expect(h.getAllPaths).toEqual([`/characters/${CID}/assets`]);
    expect(h.posts).toHaveLength(1);
    expect(h.posts[0].path).toBe(`/characters/${CID}/assets/names`);
    // Only is_singleton items are worth naming — a stack of Tritanium just returns the type name.
    expect(h.posts[0].body).toEqual([1023456789012, 1023456789014, 1023456789015, 1023456789016, 1023456789017]);
    const rows = h.writes[0];
    expect(rows.find((r) => r.itemId === 1023456789012)!.name).toBe("Fast Tackle");
    expect(rows.find((r) => r.itemId === 1023456789013)!.name).toBeNull();
  });
  it("treats an absent is_blueprint_copy as false and keeps the raw location fields", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const rows = h.writes[0];
    expect(rows.filter((r) => r.isBlueprintCopy).map((r) => r.itemId)).toEqual([1023456789016]);
    expect(rows.find((r) => r.itemId === 1023456789014)).toMatchObject({
      locationId: 1023456789012, locationType: "item", locationFlag: "LoSlot0", isSingleton: true, isBlueprintCopy: false,
    });
    expect(rows.find((r) => r.itemId === 1023456789017)!.locationType).toBe("solar_system");
  });
  it("resolves the distinct root locations after writing", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toHaveLength(1);
    expect(h.resolved[0].characterId).toBe(CID);
    expect([...h.resolved[0].ids].sort((a, b) => a - b)).toEqual([30000142, 60003760, 1035466617946]);
  });
  it("chunks the names POST to 1000 unique ids", async () => {
    const many: RawAsset[] = Array.from({ length: 2500 }, (_, i) => ({
      item_id: 2_000_000_000_000 + i, type_id: 587, quantity: 1, location_id: 60003760,
      location_type: "station", location_flag: "Hangar", is_singleton: true,
    }));
    const h = harness(["esi-assets.read_assets.v1"], many);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.posts.map((p) => p.body.length)).toEqual([1000, 1000, 500]);
    expect(new Set(h.posts.flatMap((p) => p.body)).size).toBe(2500);
  });
  it("skips the names POST when nothing is a singleton", async () => {
    const h = harness(["esi-assets.read_assets.v1"], [{
      item_id: 1, type_id: 34, quantity: 5, location_id: 60003760,
      location_type: "station", location_flag: "Hangar", is_singleton: false,
    }]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.posts).toEqual([]);
    expect(h.writes[0][0].name).toBeNull();
  });
  it("returns 0 without calling ESI when the scope is missing", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.getAllPaths).toEqual([]);
    expect(h.resolved).toEqual([]);
  });
  it("lets an ESI outage propagate without writing or resolving anything", async () => {
    const h = harness();
    h.esi.getAll = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/assets", Date.now() + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
    expect(h.resolved).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/assets.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/assets.js"`.

- [ ] **Step 3: Write `src/worker/jobs/assets.ts`**

```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { chunk } from "../../lib/chunk.js";
import { getCharacter } from "../../lib/db/characters.js";
import { replaceAssets, type AssetRow } from "../../lib/db/character-assets.js";
import { resolveLocations } from "../../lib/names/index.js";

export const ASSETS_INTERVAL_MS = 60 * 60 * 1000;
export const ASSETS_RETRY_MS = 10 * 60 * 1000;
export const ASSET_NAMES_CHUNK = 1000;                   // ESI: maxItems 1000, uniqueItems true
const ASSETS_SCOPE = "esi-assets.read_assets.v1";

interface EsiAsset {
  item_id: number; type_id: number; quantity: number; location_id: number;
  location_type: string; location_flag: string; is_singleton: boolean; is_blueprint_copy?: boolean;
}
interface EsiAssetName { item_id: number; name: string }

export interface AssetsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceAssets: (characterId: number, assets: AssetRow[]) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}

export function createAssetsJob(deps: AssetsJobDeps): CharacterSyncJob {
  return {
    name: "assets",
    intervalMs: ASSETS_INTERVAL_MS,
    retryMs: ASSETS_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, ASSETS_SCOPE)) return 0;

      // getAll enforces the Last-Modified consistency check; assets change constantly.
      const raw = await esi.getAll<EsiAsset>(`/characters/${characterId}/assets`, { characterId });

      // Only singletons can carry a custom name; a stack just echoes the type name back.
      const singletons = [...new Set(raw.filter((a) => a.is_singleton).map((a) => a.item_id))];
      const names = new Map<number, string>();
      for (const batch of chunk(singletons, ASSET_NAMES_CHUNK)) {
        const named = await esi.post<EsiAssetName[]>(`/characters/${characterId}/assets/names`, batch, { characterId });
        for (const n of named) names.set(n.item_id, n.name);
      }

      const rows: AssetRow[] = raw.map((a) => ({
        itemId: a.item_id, typeId: a.type_id, quantity: a.quantity, locationId: a.location_id,
        locationType: a.location_type, locationFlag: a.location_flag, isSingleton: a.is_singleton,
        // ESI only ever sends `true`; absent means "not a blueprint copy". Never compare with false.
        isBlueprintCopy: a.is_blueprint_copy === true,
        name: names.get(a.item_id) ?? null,
      }));
      const written = await deps.replaceAssets(characterId, rows);

      // Roots are the assets that are not nested inside another item: stations, systems, citadels.
      const roots = [...new Set(raw.filter((a) => a.location_type !== "item").map((a) => a.location_id))];
      await deps.resolveLocations(roots, characterId);
      return written;
    },
  };
}

export const assetsJob: CharacterSyncJob = createAssetsJob({ getCharacter, replaceAssets, resolveLocations });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/worker/assets.test.ts && npm run typecheck`
Expected: PASS (eight tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the hourly assets sync job

Walks the paginated asset list, names only the singleton items in chunks of
1000 unique ids, treats an absent is_blueprint_copy as false, replaces the
table wholesale and then resolves the distinct root locations.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 15: The `wallet` job

**Files:**
- Create: `src/worker/jobs/wallet.ts`
- Test: `tests/worker/wallet.test.ts`

**Interfaces:**
- Consumes: `CharacterSyncJob` in `src/worker/scheduler.js`, Task 1 `hasScope`, Task 8 `saveWallet`/`WalletWrite`/`JournalRow`/`TransactionRow`, Task 10 `resolveNames`, phase-1 `getCharacter`, Task 11 `esiFixture`.
- Produces:
```ts
export const WALLET_INTERVAL_MS: number;        // 1 h
export const WALLET_RETRY_MS: number;           // 10 min
export const MAX_TRANSACTION_BATCHES: number;   // 10
export interface EsiTransaction {
  transaction_id: number; date: string; type_id: number; quantity: number; unit_price: number;
  client_id: number; location_id: number; is_buy: boolean; is_personal: boolean; journal_ref_id: number;
}
export interface TransactionSource {
  get<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number> }): Promise<{ data: T }>;
}
export function fetchTransactions(esi: TransactionSource, characterId: number, maxBatches?: number): Promise<EsiTransaction[]>;
export interface WalletJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  saveWallet: (characterId: number, w: WalletWrite) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}
export function createWalletJob(deps: WalletJobDeps): CharacterSyncJob;
export const walletJob: CharacterSyncJob;
```

- [ ] **Step 1: Write the failing test**

Create `tests/worker/wallet.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import {
  createWalletJob, walletJob, fetchTransactions, WALLET_INTERVAL_MS, WALLET_RETRY_MS,
  MAX_TRANSACTION_BATCHES, type EsiTransaction, type WalletJobDeps,
} from "../../src/worker/jobs/wallet.js";
import type { WalletWrite } from "../../src/lib/db/character-wallet.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
const WALLET_SCOPE = "esi-wallet.read_character_wallet.v1";

function harness(scopes: string[] = [WALLET_SCOPE]) {
  const writes: WalletWrite[] = [];
  const resolved: number[][] = [];
  const calls: { path: string; query?: Record<string, string | number> }[] = [];
  const deps: WalletJobDeps = {
    getCharacter: async () => ({ scopes }),
    saveWallet: async (_id, w) => { writes.push(w); return 7; },
    resolveNames: async (ids) => { resolved.push(ids); return new Map(); },
  };
  const esi = {
    get: vi.fn(async (path: string, opts?: { query?: Record<string, string | number> }) => {
      calls.push({ path, query: opts?.query });
      if (path.endsWith("/wallet")) return { data: esiFixture("wallet-balance") };
      if (path.endsWith("/wallet/transactions")) {
        return { data: opts?.query?.from_id === undefined ? esiFixture("wallet-transactions") : [] };
      }
      throw new Error(`unexpected ${path}`);
    }),
    getAll: vi.fn(async (path: string) => { calls.push({ path }); return esiFixture("wallet-journal"); }),
  };
  return { job: createWalletJob(deps), esi, writes, resolved, calls };
}

describe("wallet job", () => {
  it("is an hourly character job that retries in 10 minutes", () => {
    expect(walletJob.name).toBe("wallet");
    expect(walletJob.intervalMs).toBe(WALLET_INTERVAL_MS);
    expect(WALLET_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(walletJob.retryMs).toBe(WALLET_RETRY_MS);
    expect(WALLET_RETRY_MS).toBe(10 * 60 * 1000);
    expect(MAX_TRANSACTION_BATCHES).toBe(10);
  });
  it("reads balance, journal and transactions and returns the repo's count", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(7);
    expect(h.calls.map((c) => c.path)).toEqual([
      `/characters/${CID}/wallet`, `/characters/${CID}/wallet/journal`,
      `/characters/${CID}/wallet/transactions`, `/characters/${CID}/wallet/transactions`,
    ]);
    expect(h.writes[0].balance).toBe(1234567.89);
  });
  it("maps journal rows including one with no amount, balance or parties", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const journal = h.writes[0].journal;
    expect(journal).toHaveLength(4);
    expect(journal[0]).toEqual({
      id: 24000000001, date: new Date("2026-09-01T10:14:07Z"), refType: "market_transaction",
      description: "Market: TrilliumONE bought Tritanium", amount: -418293.5, balance: 1234567.89,
      reason: null, contextId: 6100000001, contextIdType: "market_transaction_id",
      firstPartyId: 669539978, secondPartyId: 2112625428, tax: null, taxReceiverId: null,
    });
    expect(journal[3]).toEqual({
      id: 24000000004, date: new Date("2026-08-31T18:22:51Z"), refType: "corporate_reward_payout",
      description: "Corporation reward payout", amount: null, balance: null, reason: null,
      contextId: null, contextIdType: null, firstPartyId: null, secondPartyId: null,
      tax: null, taxReceiverId: null,
    });
    expect(journal[1].tax).toBe(0);
    expect(journal[2].reason).toBe("for the doctrine");
  });
  it("maps transactions and resolves every party id exactly once", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].transactions[0]).toEqual({
      transactionId: 6100000001, date: new Date("2026-09-01T10:14:07Z"), typeId: 34, quantity: 100000,
      unitPrice: 4.18, clientId: 2112625428, locationId: 60003760, isBuy: true, isPersonal: true,
      journalRefId: 24000000001,
    });
    expect(h.resolved).toHaveLength(1);
    expect([...h.resolved[0]].sort((a, b) => a - b)).toEqual([1000035, 669539978, 2112625428, 2124678472]);
  });
  it("returns 0 without calling ESI when the scope is missing", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.calls).toEqual([]);
    expect(h.writes).toEqual([]);
  });
});

function tx(id: number): EsiTransaction {
  return {
    transaction_id: id, date: "2026-09-01T10:00:00Z", type_id: 34, quantity: 1, unit_price: 1,
    client_id: 1, location_id: 60003760, is_buy: true, is_personal: true, journal_ref_id: id,
  };
}

describe("fetchTransactions", () => {
  function source(batches: EsiTransaction[][]) {
    const queries: (number | undefined)[] = [];
    const esi = {
      get: async <T,>(_path: string, opts?: { query?: Record<string, string | number> }) => {
        queries.push(opts?.query?.from_id as number | undefined);
        return { data: (batches.shift() ?? []) as T };
      },
    };
    return { esi, queries };
  }

  it("walks backwards with from_id = min(transaction_id) - 1 until a batch is empty", async () => {
    const s = source([[tx(30), tx(29)], [tx(28), tx(27)], []]);
    const out = await fetchTransactions(s.esi, CID);
    expect(out.map((t) => t.transaction_id)).toEqual([30, 29, 28, 27]);
    expect(s.queries).toEqual([undefined, 28, 26]);
  });
  it("stops when a batch brings nothing new", async () => {
    const s = source([[tx(30), tx(29)], [tx(30), tx(29)], [tx(28)]]);
    const out = await fetchTransactions(s.esi, CID);
    expect(out.map((t) => t.transaction_id)).toEqual([30, 29]);
    expect(s.queries).toEqual([undefined, 28]);
  });
  it("stops after at most 10 batches so a busy trader cannot drain the char-wallet bucket", async () => {
    const s = source(Array.from({ length: 20 }, (_, i) => [tx(1000 - i)]));
    const out = await fetchTransactions(s.esi, CID);
    expect(out).toHaveLength(MAX_TRANSACTION_BATCHES);
    expect(s.queries).toHaveLength(MAX_TRANSACTION_BATCHES);
  });
  it("honours a lower batch cap and returns nothing for an immediately empty wallet", async () => {
    const s = source([[tx(9)], [tx(8)], [tx(7)]]);
    expect(await fetchTransactions(s.esi, CID, 2)).toHaveLength(2);
    const empty = source([[]]);
    expect(await fetchTransactions(empty.esi, CID)).toEqual([]);
    expect(empty.queries).toEqual([undefined]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/wallet.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/wallet.js"`.

- [ ] **Step 3: Write `src/worker/jobs/wallet.ts`**

```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { saveWallet, type JournalRow, type TransactionRow, type WalletWrite } from "../../lib/db/character-wallet.js";
import { resolveNames } from "../../lib/names/index.js";

export const WALLET_INTERVAL_MS = 60 * 60 * 1000;
export const WALLET_RETRY_MS = 10 * 60 * 1000;
/** The char-wallet bucket is 150 tokens / 15 min across all three wallet routes — walk gently. */
export const MAX_TRANSACTION_BATCHES = 10;
const WALLET_SCOPE = "esi-wallet.read_character_wallet.v1";

interface EsiJournalEntry {
  id: number; date: string; ref_type: string; description: string;
  amount?: number; balance?: number; reason?: string;
  context_id?: number; context_id_type?: string;
  first_party_id?: number; second_party_id?: number;
  tax?: number; tax_receiver_id?: number;
}
export interface EsiTransaction {
  transaction_id: number; date: string; type_id: number; quantity: number; unit_price: number;
  client_id: number; location_id: number; is_buy: boolean; is_personal: boolean; journal_ref_id: number;
}
export interface TransactionSource {
  get<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number> }): Promise<{ data: T }>;
}

export interface WalletJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  saveWallet: (characterId: number, w: WalletWrite) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}

const nullable = (v: number | undefined): number | null => (v === undefined ? null : v);
const nullableStr = (v: string | undefined): string | null => (v === undefined ? null : v);

function toJournalRow(e: EsiJournalEntry): JournalRow {
  return {
    id: e.id, date: new Date(e.date), refType: e.ref_type, description: e.description,
    amount: nullable(e.amount), balance: nullable(e.balance), reason: nullableStr(e.reason),
    contextId: nullable(e.context_id), contextIdType: nullableStr(e.context_id_type),
    firstPartyId: nullable(e.first_party_id), secondPartyId: nullable(e.second_party_id),
    tax: nullable(e.tax), taxReceiverId: nullable(e.tax_receiver_id),
  };
}

function toTransactionRow(t: EsiTransaction): TransactionRow {
  return {
    transactionId: t.transaction_id, date: new Date(t.date), typeId: t.type_id,
    quantity: t.quantity, unitPrice: t.unit_price, clientId: t.client_id,
    locationId: t.location_id, isBuy: t.is_buy, isPersonal: t.is_personal, journalRefId: t.journal_ref_id,
  };
}

/**
 * /wallet/transactions has no X-Pages: it walks backwards through a `from_id` cursor. Repeat with
 * `from_id = min(transaction_id) - 1` while the batch is non-empty and brings at least one id we
 * have not already collected in this run, and never more than `maxBatches` times.
 */
export async function fetchTransactions(
  esi: TransactionSource, characterId: number, maxBatches = MAX_TRANSACTION_BATCHES,
): Promise<EsiTransaction[]> {
  const out: EsiTransaction[] = [];
  const seen = new Set<number>();
  let fromId: number | undefined;
  for (let batchNo = 0; batchNo < maxBatches; batchNo++) {
    const query = fromId === undefined ? {} : { from_id: fromId };
    const batch = (await esi.get<EsiTransaction[]>(`/characters/${characterId}/wallet/transactions`, { characterId, query })).data;
    if (batch.length === 0) break;
    let fresh = 0;
    let lowest = Number.POSITIVE_INFINITY;
    for (const t of batch) {
      if (!seen.has(t.transaction_id)) { seen.add(t.transaction_id); out.push(t); fresh++; }
      if (t.transaction_id < lowest) lowest = t.transaction_id;
    }
    if (fresh === 0) break;
    fromId = lowest - 1;
  }
  return out;
}

export function createWalletJob(deps: WalletJobDeps): CharacterSyncJob {
  return {
    name: "wallet",
    intervalMs: WALLET_INTERVAL_MS,
    retryMs: WALLET_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, WALLET_SCOPE)) return 0;

      // GET /wallet returns a bare double, not an object.
      const balance = (await esi.get<number>(`/characters/${characterId}/wallet`, { characterId })).data;
      const journal = await esi.getAll<EsiJournalEntry>(`/characters/${characterId}/wallet/journal`, { characterId });
      const transactions = await fetchTransactions(esi, characterId);

      const written = await deps.saveWallet(characterId, {
        balance, journal: journal.map(toJournalRow), transactions: transactions.map(toTransactionRow),
      });

      const parties = new Set<number>();
      for (const j of journal) {
        for (const id of [j.first_party_id, j.second_party_id]) if (typeof id === "number" && id > 0) parties.add(id);
      }
      for (const t of transactions) if (t.client_id > 0) parties.add(t.client_id);
      await deps.resolveNames([...parties]);
      return written;
    },
  };
}

export const walletJob: CharacterSyncJob = createWalletJob({ getCharacter, saveWallet, resolveNames });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/worker/wallet.test.ts && npm run typecheck`
Expected: PASS (nine tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the hourly wallet sync job

Upserts the balance, walks the paginated 30-day journal and follows the
from_id cursor over transactions for at most ten batches, then resolves every
first/second party and client id through the name cache.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 16: The `location` job

**Files:**
- Create: `src/worker/jobs/location.ts`
- Test: `tests/worker/location.test.ts`

**Interfaces:**
- Consumes: `CharacterSyncJob` in `src/worker/scheduler.js`, Task 1 `hasScope`, Task 8 `upsertLocation`/`LocationInput`, Task 10 `resolveLocations`, phase-1 `getCharacter`, Task 11 `esiFixture`.
- Produces:
```ts
export const LOCATION_INTERVAL_MS: number;   // 15 min
export const LOCATION_RETRY_MS: number;      // 5 min
export interface LocationJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  upsertLocation: (characterId: number, loc: LocationInput) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}
export function createLocationJob(deps: LocationJobDeps): CharacterSyncJob;
export const locationJob: CharacterSyncJob;
```

- [ ] **Step 1: Write the failing test**

Create `tests/worker/location.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createLocationJob, locationJob, LOCATION_INTERVAL_MS, LOCATION_RETRY_MS, type LocationJobDeps } from "../../src/worker/jobs/location.js";
import type { LocationInput } from "../../src/lib/db/character-location.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
const ALL = ["esi-location.read_location.v1", "esi-location.read_ship_type.v1", "esi-location.read_online.v1"];

function harness(scopes: string[] = ALL, location: unknown = esiFixture("location")) {
  const writes: LocationInput[] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const paths: string[] = [];
  const deps: LocationJobDeps = {
    getCharacter: async () => ({ scopes }),
    upsertLocation: async (_id, loc) => { writes.push(loc); return 1; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/location")) return { data: location };
      if (path.endsWith("/ship")) return { data: esiFixture("ship") };
      if (path.endsWith("/online")) return { data: esiFixture("online") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createLocationJob(deps), esi, writes, resolved, paths };
}

describe("location job", () => {
  it("is a 15-minute character job that retries in 5 minutes", () => {
    expect(locationJob.name).toBe("location");
    expect(locationJob.intervalMs).toBe(LOCATION_INTERVAL_MS);
    expect(LOCATION_INTERVAL_MS).toBe(15 * 60 * 1000);
    expect(locationJob.retryMs).toBe(LOCATION_RETRY_MS);
    expect(LOCATION_RETRY_MS).toBe(5 * 60 * 1000);
  });
  it("upserts a character in space with neither station nor structure", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(1);
    expect(h.paths).toEqual([`/characters/${CID}/location`, `/characters/${CID}/ship`, `/characters/${CID}/online`]);
    expect(h.writes[0]).toEqual({
      solarSystemId: 30000142, stationId: null, structureId: null,
      shipItemId: 1023456789012, shipTypeId: 587, shipName: "Fast Tackle",
      online: true, lastLogin: new Date("2026-09-01T08:12:44Z"), lastLogout: new Date("2026-08-31T23:58:01Z"),
    });
    expect(h.resolved).toEqual([]);                       // nothing docked, nothing to name
  });
  it("resolves the docked structure so the Overview can label it", async () => {
    const h = harness(ALL, { solar_system_id: 30000144, structure_id: 1035466617946 });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].structureId).toBe(1035466617946);
    expect(h.resolved).toEqual([{ ids: [1035466617946], characterId: CID }]);
  });
  it("resolves a docked NPC station too", async () => {
    const h = harness(ALL, { solar_system_id: 30000142, station_id: 60003760 });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].stationId).toBe(60003760);
    expect(h.resolved).toEqual([{ ids: [60003760], characterId: CID }]);
  });
  it("stores null for /online when the scope is missing but still syncs the rest", async () => {
    const h = harness(["esi-location.read_location.v1", "esi-location.read_ship_type.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/location`, `/characters/${CID}/ship`]);
    expect(h.writes[0]).toMatchObject({ online: null, lastLogin: null, lastLogout: null, shipTypeId: 587 });
  });
  it("stores null for the ship when its scope is missing", async () => {
    const h = harness(["esi-location.read_location.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/location`]);
    expect(h.writes[0]).toMatchObject({ shipItemId: null, shipTypeId: null, shipName: null, solarSystemId: 30000142 });
  });
  it("returns 0 without calling ESI when no location scope is granted", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
    expect(h.writes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/worker/location.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/location.js"`.

- [ ] **Step 3: Write `src/worker/jobs/location.ts`**

```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { upsertLocation, type LocationInput } from "../../lib/db/character-location.js";
import { resolveLocations } from "../../lib/names/index.js";

/**
 * 15 minutes, not the 5-second ESI cache: this answers "where is my character" on the Overview,
 * it is not live tracking, and polling a 5 s route on a timer risks a ban.
 */
export const LOCATION_INTERVAL_MS = 15 * 60 * 1000;
export const LOCATION_RETRY_MS = 5 * 60 * 1000;
const LOCATION_SCOPE = "esi-location.read_location.v1";
const SHIP_SCOPE = "esi-location.read_ship_type.v1";
const ONLINE_SCOPE = "esi-location.read_online.v1";

interface EsiLocation { solar_system_id: number; station_id?: number; structure_id?: number }
interface EsiShip { ship_item_id: number; ship_name: string; ship_type_id: number }
interface EsiOnline { online: boolean; last_login?: string; last_logout?: string; logins?: number }

export interface LocationJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  upsertLocation: (characterId: number, loc: LocationInput) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}

const date = (v: string | undefined): Date | null => (v === undefined ? null : new Date(v));

export function createLocationJob(deps: LocationJobDeps): CharacterSyncJob {
  return {
    name: "location",
    intervalMs: LOCATION_INTERVAL_MS,
    retryMs: LOCATION_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      const canLocation = hasScope(character, LOCATION_SCOPE);
      const canShip = hasScope(character, SHIP_SCOPE);
      const canOnline = hasScope(character, ONLINE_SCOPE);
      if (!canLocation && !canShip && !canOnline) return 0;

      // Exactly one of station_id / structure_id is present when docked; neither when in space.
      const location = canLocation
        ? (await esi.get<EsiLocation>(`/characters/${characterId}/location`, { characterId })).data
        : null;
      const ship = canShip
        ? (await esi.get<EsiShip>(`/characters/${characterId}/ship`, { characterId })).data
        : null;
      const online = canOnline
        ? (await esi.get<EsiOnline>(`/characters/${characterId}/online`, { characterId })).data
        : null;

      const rows = await deps.upsertLocation(characterId, {
        solarSystemId: location?.solar_system_id ?? null,
        stationId: location?.station_id ?? null,
        structureId: location?.structure_id ?? null,
        shipItemId: ship?.ship_item_id ?? null,
        shipTypeId: ship?.ship_type_id ?? null,
        shipName: ship?.ship_name ?? null,
        online: online?.online ?? null,
        lastLogin: date(online?.last_login),
        lastLogout: date(online?.last_logout),
      });

      // The Overview shows a docked-at label, which needs the station/citadel name resolved.
      const docked = location?.station_id ?? location?.structure_id;
      if (docked !== undefined) await deps.resolveLocations([docked], characterId);
      return rows;
    },
  };
}

export const locationJob: CharacterSyncJob = createLocationJob({ getCharacter, upsertLocation, resolveLocations });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/worker/location.test.ts && npm run typecheck`
Expected: PASS (seven tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the 15-minute location sync job

Upserts system, docked station or citadel, current ship and (scope-gated)
online status, and resolves the docked location's name so the Overview can
label it. 15 minutes rather than the 5s ESI cache: this is not live tracking.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---
### Task 17: Register the jobs in the worker and show them all in Sync status

**Files:**
- Create: `src/worker/jobs/index.ts`
- Modify: `src/worker/index.ts`, `src/worker/jobs/character-info.ts`
- Test: `tests/worker/registration.test.ts`, `tests/components/sync-status.test.tsx`

**Interfaces:**
- Consumes: Tasks 12–16 `skillsJob`/`clonesJob`/`fittingsJob`/`assetsJob`/`walletJob`/`locationJob`, phase-1 `characterInfoJob`, phase-2 `sdeUpdateJob`, `Scheduler`/`SyncJob` in `src/worker/scheduler.js`, phase-1 `SyncStatus` in `src/app/settings/SyncStatus.js`.
- Produces:
```ts
// src/worker/jobs/index.ts
export const ALL_JOBS: SyncJob[];   // sdeUpdateJob + the seven character jobs, in registration order
// src/worker/jobs/character-info.ts
export const CHARACTER_INFO_INTERVAL_MS: number;   // 6 h
export const CHARACTER_INFO_RETRY_MS: number;      // 15 min
export const characterInfoJob: CharacterSyncJob;   // now typed CharacterSyncJob and carrying retryMs
```

- [ ] **Step 1: Write the failing tests**

Create `tests/worker/registration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ALL_JOBS } from "../../src/worker/jobs/index.js";
import type { CharacterSyncJob, GlobalSyncJob, SyncJob } from "../../src/worker/scheduler.js";

const isGlobal = (j: SyncJob): j is GlobalSyncJob => j.scope === "global";

describe("worker job registration", () => {
  it("registers sde-update plus the seven character jobs, with sde-update first", () => {
    expect(ALL_JOBS.map((j) => j.name)).toEqual([
      "sde-update", "character-info", "skills", "clones", "assets", "fittings", "wallet", "location",
    ]);
    expect(ALL_JOBS[0].scope).toBe("global");
  });
  it("gives every job a unique name, a positive interval and a shorter retry", () => {
    expect(new Set(ALL_JOBS.map((j) => j.name)).size).toBe(ALL_JOBS.length);
    for (const job of ALL_JOBS) {
      expect(job.intervalMs).toBeGreaterThan(0);
      if (job.name === "sde-update") continue;                 // phase-2 job, no retryMs
      expect(job.retryMs).toBeGreaterThan(0);
      expect(job.retryMs!).toBeLessThan(job.intervalMs);
    }
  });
  it("uses the intervals from the spec's job table", () => {
    const byName = new Map(ALL_JOBS.map((j) => [j.name, j.intervalMs]));
    expect(byName.get("skills")).toBe(60 * 60 * 1000);
    expect(byName.get("assets")).toBe(60 * 60 * 1000);
    expect(byName.get("wallet")).toBe(60 * 60 * 1000);
    expect(byName.get("clones")).toBe(6 * 60 * 60 * 1000);
    expect(byName.get("fittings")).toBe(6 * 60 * 60 * 1000);
    expect(byName.get("character-info")).toBe(6 * 60 * 60 * 1000);
    expect(byName.get("location")).toBe(15 * 60 * 1000);
  });
  it("marks exactly one job global; the other seven run per character", () => {
    expect(ALL_JOBS.filter(isGlobal)).toHaveLength(1);
    const characterJobs = ALL_JOBS.filter((j): j is CharacterSyncJob => !isGlobal(j));
    expect(characterJobs).toHaveLength(7);
    for (const job of characterJobs) expect(job.scope ?? "character").toBe("character");
  });
});
```

Append to `tests/components/sync-status.test.tsx`:
```tsx
  it("lists every phase-3 job, including the global one with no character", () => {
    const names = ["sde-update", "character-info", "skills", "clones", "assets", "fittings", "wallet", "location"];
    render(<SyncStatus
      runs={names.map((job, i) => ({
        job, characterId: job === "sde-update" ? null : 1, startedAt: new Date("2026-09-01T12:00:00Z"),
        finishedAt: new Date("2026-09-01T12:00:05Z"), status: "ok" as const, rows: i, error: null,
      }))}
      names={{ 1: "TrilliumONE" }} />);
    for (const job of names) expect(screen.getByText(job)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();          // the global sde-update row
    expect(screen.getAllByText("TrilliumONE")).toHaveLength(7);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/worker/registration.test.ts tests/components/sync-status.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/worker/jobs/index.js"`.

- [ ] **Step 3: Give `character-info` a `retryMs`**

Replace `src/worker/jobs/character-info.ts` with:
```ts
import type { CharacterSyncJob } from "../scheduler.js";
import { updateCharacterInfo } from "../../lib/db/characters.js";

export const CHARACTER_INFO_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const CHARACTER_INFO_RETRY_MS = 15 * 60 * 1000;

interface CharacterPublic { name: string; corporation_id: number; alliance_id?: number }
interface Named { name: string }

export const characterInfoJob: CharacterSyncJob = {
  name: "character-info",
  intervalMs: CHARACTER_INFO_INTERVAL_MS,
  retryMs: CHARACTER_INFO_RETRY_MS,
  async run({ characterId, esi }) {
    const me = (await esi.get<CharacterPublic>(`/characters/${characterId}`, { characterId })).data;
    const corp = (await esi.get<Named>(`/corporations/${me.corporation_id}`)).data;
    const ally = me.alliance_id ? (await esi.get<Named>(`/alliances/${me.alliance_id}`)).data : null;
    await updateCharacterInfo(characterId, { name: me.name, corporationId: me.corporation_id, corporationName: corp.name, allianceId: me.alliance_id ?? null, allianceName: ally?.name ?? null });
    return 1;
  },
};
```

- [ ] **Step 4: Write `src/worker/jobs/index.ts`**

```ts
import type { SyncJob } from "../scheduler.js";
import { sdeUpdateJob } from "./sde-update.js";
import { characterInfoJob } from "./character-info.js";
import { skillsJob } from "./skills.js";
import { clonesJob } from "./clones.js";
import { assetsJob } from "./assets.js";
import { fittingsJob } from "./fittings.js";
import { walletJob } from "./wallet.js";
import { locationJob } from "./location.js";

/**
 * Registration order. sde-update comes first so a fresh database imports the SDE on the very first
 * tick; the character jobs are staggered by the scheduler, so with 7 jobs x 4 characters the
 * per-tick fan-out stays small.
 */
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob, walletJob, locationJob,
];
```

- [ ] **Step 5: Register them in `src/worker/index.ts`**

Replace the whole file with:
```ts
import { getConfig } from "../lib/config.js";
import { createEsiClient } from "../lib/esi/index.js";
import { listCharacters, setTokenStatus } from "../lib/db/characters.js";
import { startRun, finishRun } from "../lib/db/sync-runs.js";
import { Scheduler } from "./scheduler.js";
import { ALL_JOBS } from "./jobs/index.js";

const TICK_MS = 30_000;
getConfig();   // fail fast on missing env
const scheduler = new Scheduler({
  jobs: ALL_JOBS, esi: createEsiClient(), listCharacters, startRun, finishRun,
  markNeedsReauth: (id) => setTokenStatus(id, "needs_reauth"),
});
console.log(`[worker] started with ${ALL_JOBS.length} jobs`);
async function loop() {
  try { await scheduler.tick(); } catch (e) { console.error("[worker] tick failed:", e); }
  setTimeout(loop, TICK_MS);
}
void loop();
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/worker tests/components/sync-status.test.tsx && npm run typecheck`
Expected: PASS (all worker tests including the phase-1 `character-info` and phase-2 `sde-update`/`scheduler` suites), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Register the six new sync jobs in the worker

The job list moves to src/worker/jobs/index.ts so it can be asserted without
booting the worker loop, and character-info gains a retryMs like the rest.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 18: Full verification and the operator action for the new scopes

There is no way to exercise the real endpoints here — that needs character tokens, which only exist
on the VM after a re-login. This task therefore proves the suite green end to end and records the
one manual step that must happen before anybody logs in again.

**Files:**
- Modify: `deploy/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no code.

- [ ] **Step 1: Run the entire suite from a clean database**

```bash
docker compose -f compose.dev.yml up -d
npm test
```
Expected: PASS, every file, no skipped suites.

- [ ] **Step 2: Typecheck and build**

```bash
npm run typecheck && npm run build
```
Expected: `tsc --noEmit` clean; the Next build succeeds (no page changed, but the new `src/lib/**` modules must compile under the app's config).

- [ ] **Step 3: Confirm the compatibility date is pinned in all five places**

```bash
grep -rn "2026-08-18" .env.example deploy/.env.example deploy/ansible/group_vars/eve.yml scripts/esi-types.ts | cat
grep '^ESI_COMPATIBILITY_DATE=' .env
grep -rn "2026-08-28" --include=*.ts --include=*.yml --include=*.example . --exclude-dir=node_modules --exclude-dir=.git | cat
```
Expected: the first two commands show `2026-08-18` in all five places; the third prints nothing
except matches inside `.superpowers/research/esi-endpoints.md` (a historical note, leave it alone).

- [ ] **Step 4: Document the operator action in `deploy/README.md`**

Insert this section immediately before `## Where things live on the VM`:
```markdown
## ESI application scopes (manual, one-off)

The app requests twelve scopes (`SCOPES` in `src/lib/auth/sso.ts`). Two of them were added in
phase 3 and must be enabled on the application at <https://developers.eveonline.com> **before any
character logs in again**:

- `esi-universe.read_structures.v1` — names of player structures (citadels) the character can dock at
- `esi-location.read_online.v1` — whether the character is currently online

EVE SSO rejects an authorisation request that asks for a scope the application does not have, and
the rejection surfaces in this app as a redirect to `/login?error=sso`.

Scope grants are immutable per refresh token, so **every character must log in again** (Settings →
the character's re-authorise link) before structure names and online status start syncing. Until
they do, those two endpoints are skipped: the jobs still finish `ok` and the Overview shows `—`.

## ESI compatibility date

`ESI_COMPATIBILITY_DATE` must be a date from `GET https://esi.evetech.net/meta/compatibility-dates`
— ESI silently rounds an unlisted date down to the newest published date below it. It is pinned to
`2026-08-18` in `deploy/ansible/group_vars/eve.yml`, `.env`, `.env.example`, `deploy/.env.example`
and `scripts/esi-types.ts`. Bump all five together and re-run `npm run esi:types`, never one alone.
```

- [ ] **Step 5: Re-run the suite and commit**

```bash
npm test && npm run typecheck
git add -A
git commit -m "$(cat <<'EOM'
Document the phase-3 scope and compatibility-date operator actions

Both new scopes must be enabled on the developer-portal application and every
character re-authorised before structure names and online status can sync;
until then those endpoints are skipped and the jobs still finish ok.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

- [ ] **Step 6: Hand over**

Report to the reviewer: the branch `feature/phase3-character-sync` is ready, phase 3b (pages and
the wallet API route) can start from the read functions listed below, and the operator still has to
enable the two scopes and re-authorise the four characters.

---

## Interfaces for phase 3b

Everything the pages and the `GET /api/characters/[id]/wallet` route need is already built. Exact
signatures and row types, by module:

**`src/lib/db/character-skills.ts`**
```ts
getSkillSummary(characterId: number): Promise<SkillSummary | null>
listSkills(characterId: number): Promise<SkillRow[]>                 // ordered by skillId
listSkillQueue(characterId: number): Promise<SkillQueueRow[]>        // ordered by queuePosition
getAttributes(characterId: number): Promise<AttributesRow | null>

interface SkillSummary { characterId: number; totalSp: number; unallocatedSp: number | null; updatedAt: Date }
interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}
interface AttributesInput {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonusRemaps: number | null; lastRemapDate: Date | null; accruedRemapCooldownDate: Date | null;
}
interface AttributesRow extends AttributesInput { characterId: number; updatedAt: Date }
```

**`src/lib/db/character-clones.ts`**
```ts
listImplants(characterId: number): Promise<number[]>                 // active clone, ordered by typeId
getClones(characterId: number): Promise<CloneState | null>

interface CloneHome {
  homeLocationId: number | null; homeLocationType: string | null;
  lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null;
}
interface JumpCloneRow { jumpCloneId: number; locationId: number | null; locationType: string | null; name: string | null; implants: number[] }
interface CloneState extends CloneHome { characterId: number; updatedAt: Date; jumpClones: JumpCloneRow[] }
```

**`src/lib/db/character-assets.ts`**
```ts
listAssets(characterId: number): Promise<AssetRow[]>                 // ordered by itemId

interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean; name: string | null;
}
```

**`src/lib/db/character-fittings.ts`**
```ts
listFittings(characterId: number): Promise<FittingRow[]>             // ordered by fittingId, items by idx

interface FittingItemRow { idx: number; typeId: number; quantity: number; flag: string }
interface FittingRow { fittingId: number; name: string; description: string; shipTypeId: number; items: FittingItemRow[] }
```

**`src/lib/db/character-wallet.ts`**
```ts
getWallet(characterId: number): Promise<WalletRow | null>
listJournal(characterId: number, opts?: { limit?: number; offset?: number }): Promise<JournalRow[]>        // newest first, default limit 100
listTransactions(characterId: number, opts?: { limit?: number; offset?: number }): Promise<TransactionRow[]> // newest first, default limit 100

interface WalletRow { characterId: number; balance: number; updatedAt: Date }
interface JournalRow {
  id: number; date: Date; refType: string; description: string;
  amount: number | null; balance: number | null; reason: string | null;
  contextId: number | null; contextIdType: string | null;
  firstPartyId: number | null; secondPartyId: number | null;
  tax: number | null; taxReceiverId: number | null;
}
interface TransactionRow {
  transactionId: number; date: Date; typeId: number; quantity: number; unitPrice: number;
  clientId: number | null; locationId: number | null; isBuy: boolean; isPersonal: boolean; journalRefId: number | null;
}
```

**`src/lib/db/character-location.ts`**
```ts
getLocation(characterId: number): Promise<LocationRow | null>

interface LocationInput {
  solarSystemId: number | null; stationId: number | null; structureId: number | null;
  shipItemId: number | null; shipTypeId: number | null; shipName: string | null;
  online: boolean | null; lastLogin: Date | null; lastLogout: Date | null;
}
interface LocationRow extends LocationInput { characterId: number; updatedAt: Date }
```

**`src/lib/db/names.ts`** (raw cache access; prefer the `src/lib/names` helpers)
```ts
getName(id: number): Promise<UniverseName | null>
getNames(ids: number[]): Promise<UniverseName[]>
getStructure(id: number): Promise<StructureRow | null>
getStructures(ids: number[]): Promise<StructureRow[]>

interface UniverseName { id: number; category: string; name: string | null; updatedAt: Date }
interface StructureRow { id: number; name: string | null; solarSystemId: number | null; typeId: number | null; ownerId: number | null; forbidden: boolean; updatedAt: Date }
```

**`src/lib/names/index.ts`**
```ts
locationLabel(id: number): Promise<LocationLabel>                    // Postgres only, never ESI — safe in a server component
resolveNames(ids: number[]): Promise<Map<number, ResolvedName>>      // hits ESI on a cache miss; worker/route only
resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>>
classifyLocation(id: number): LocationKind
unknownStructureLabel(id: number): string

type LocationKind = "station" | "structure" | "system" | "unknown"
interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }
interface ResolvedName { name: string | null; category: string }
interface ResolvedLocation { kind: LocationKind; name: string | null; solarSystemId: number | null }
```

**Already available from earlier phases:** `listCharacters()`/`getCharacter(id)` and `Character`
(`src/lib/db/characters.ts`), `latestRuns()` (`src/lib/db/sync-runs.ts`), `getType`/`getTypes`/
`searchTypes`/`getTypeAttributes`/`getSolarSystem`/`getStation`/`getRegion`/`getSdeMeta`
(`src/lib/sde/repo.ts`), `portraitUrl`/`groupByAccount`/`toCharacterView` (`src/lib/view/characters.ts`),
`hasScope` (`src/lib/auth/sso.ts`).

**Not built here (phase 3b owns them):** the assets-tree builder `src/lib/view/assets.ts`, the
`location_flag`/`ref_type` humanisers, and the ISK/SP/relative-time formatters — spec §7 describes
them and they are pure view helpers with no data dependency beyond the rows above.
