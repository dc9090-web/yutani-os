# EVE — Project Overview & Phase 1 (Foundation) Design

**Date:** 2026-09-01
**Status:** Approved in brainstorming; awaiting implementation plan

## 1. What EVE is

A private website (`https://eve.example.com`) for managing Daniel's EVE Online characters:
skills and training, ships and fittings (with CPU/powergrid computed against the character's
actual skills), a fitting designer, assets, clones/implants, wallet, and killmails/PvP stats.

Single user. Two EVE accounts, two characters each (four characters). EVE SSO is the only
login; a character allow-list decides who gets in.

Design follows the **Midnight** design system used by Animal and ESS.

## 2. Roadmap (each phase = its own spec → plan → build)

| Phase | Deliverable |
|---|---|
| 1 | **Foundation** — Midnight shell, EVE SSO (multi-character), ESI client, Postgres, worker skeleton, Traefik/Docker on the VM. *This document.* |
| 2 | **SDE** — every item, group, category, dogma attribute/effect imported from CCP's Static Data Export |
| 3 | **Character sync** — skills, skill queue, assets, saved fittings, clones & implants, wallet |
| 4 | **Ships & fittings viewer** — actual fitted ships + saved fits; per-module and total CPU/PG with skills and fitting mods applied; missing-skill list |
| 5 | **Fitting designer** — build/edit fits, live CPU/PG/slot validation, market-priced |
| 6 | **Skill planner** — EVEMon-style plans, remaps, implants, import/export; respects one-trainer-per-account |
| 7 | **Combat** — killmails + PvP stats |

Market prices are a cross-cutting service introduced in phase 4.

### Architecture decisions that span all phases

1. **One Next.js app + one sync worker** (Animal's shape). Next.js serves UI and API routes;
   a separate `tsx` worker runs scheduled ESI syncs. Both share one Postgres. Web pages read
   only from Postgres — they never call ESI inline.
2. **Static data is imported from CCP's official SDE** (JSON Lines) by our own importer into
   `sde_*` tables we own. Fuzzwork's dump is the fallback if CCP's format proves painful.
3. **Dogma engine is a pure TypeScript library** (`src/lib/dogma`) modelled on Pyfa: fit tree
   (ship → modules/rigs/charges + character skills/implants), SDE effects with modifier info,
   generic attribute computation with stacking penalties. Phase 4 uses only fitting
   attributes; later phases add DPS/tank without rewriting.

## 3. Phase 1 — Foundation

### 3.1 Repo & stack

```
EVE/
├── src/app/              Next.js 16 app router (Midnight shell, pages, API routes)
├── src/lib/esi/          ESI client: typed fetch, token refresh, ETag/Expires caching, rate-limit backoff
├── src/lib/auth/         EVE SSO (PKCE), session cookie, character allow-list
├── src/lib/db/           pg pool + query helpers
├── src/lib/dogma/        (phase 4) pure engine
├── src/worker/           sync scheduler + jobs
├── scripts/              migrate.ts, esi-types.ts, (phase 2) sde-import.ts
├── db/schema.sql         single migration file, like Animal
├── tests/                vitest
├── deploy/               docker-compose.yml, Traefik config, Ansible playbook
└── docs/superpowers/     specs + plans
```

- **Stack:** Next.js 16 (webpack, port 3000), React 19, Mantine 9, `@tabler/icons-react`,
  `pg`, vitest + happy-dom, `tsx`, TypeScript strict. Same major versions as Animal so the
  theme files port verbatim.
- **Theme:** copy `theme.ts`, `fonts.ts`, and the token block of `globals.css` from
  `Animal/src/app/`. Replace Animal's logo/crow with an "EVE" wordmark (Space Grotesk, aurora
  gradient) and Animal's nav with ours.
- **Config (`.env`):** `EVE_CLIENT_ID`, `EVE_CLIENT_SECRET`, `EVE_CALLBACK_URL`,
  `DATABASE_URL`, `SESSION_SECRET`, `ALLOWED_CHARACTER_IDS` (comma-separated),
  `ESI_COMPATIBILITY_DATE`, `ESI_USER_AGENT`.

### 3.2 Auth & characters

**EVE SSO (OAuth2 authorization code + PKCE):**
- Endpoints are read from `https://login.eveonline.com/.well-known/oauth-authorization-server`
  (authorize, token, jwks) and cached in memory.
- `/login` renders a Midnight card with CCP's "Log in with EVE Online" button.
  `/auth/start` redirects to the authorize endpoint with the **full scope set** the project
  will ever need, so no phase requires re-authorisation:
  `esi-skills.read_skills.v1 esi-skills.read_skillqueue.v1 esi-assets.read_assets.v1
  esi-fittings.read_fittings.v1 esi-clones.read_clones.v1 esi-clones.read_implants.v1
  esi-wallet.read_character_wallet.v1 esi-killmails.read_killmails.v1
  esi-location.read_location.v1 esi-location.read_ship_type.v1`
- `/auth/callback` verifies `state`, exchanges the code (client secret + PKCE verifier),
  verifies the JWT against JWKS (`iss` = `https://login.eveonline.com/` or
  `login.eveonline.com`; `aud` contains our client ID and `EVE Online`; `exp` valid), and
  extracts `character_id` and name.
- Character not in `ALLOWED_CHARACTER_IDS` → `/login?error=not-allowed`, nothing persisted.
- The refresh token is stored encrypted (AES-256-GCM, key derived from `SESSION_SECRET`) in
  `characters.refresh_token_enc`. Access tokens live only in memory in the ESI client.

**Session:** a signed, HttpOnly, Secure cookie (`eve_session`) meaning "this browser is the
owner"; any allow-listed character's successful SSO sets it. It also carries the *active*
character ID. "Add character" runs SSO again while logged in and upserts the character row.
Logout clears the cookie only; tokens stay so the worker keeps syncing.

**Data model (phase-1 tables):**

```
accounts     id serial, name text                                -- "Main", "Alt"; user-created
characters   id bigint (EVE character_id) PK, name, account_id → accounts (nullable),
             corporation_id, corporation_name, alliance_id, alliance_name,
             refresh_token_enc, scopes text[], token_status ('ok'|'needs_reauth'),
             created_at, updated_at, last_login_at
esi_cache    character_id (0 for public routes — part of the PK, so not nullable), path, etag, expires_at, pages, body jsonb,
             PK (character_id, path)
sync_runs    id, job text, character_id, started_at, finished_at, status ('ok'|'error'|'running'),
             rows int, error text
```

**UI:** header character switcher (portraits from `https://images.evetech.net/characters/{id}/portrait`),
grouped by account, active character remembered in the cookie. `/settings` manages accounts
and characters (create/rename accounts, assign characters, re-authorise, remove).

**Bootstrap:** empty DB + allow-list env var; the first SSO of any listed character creates
its row. Nobody else can ever get in.

### 3.3 ESI client

`esiFetch<T>(path, { characterId?, query?, page? })` in `src/lib/esi`:
- Base `https://esi.evetech.net`; headers `X-Compatibility-Date: <ESI_COMPATIBILITY_DATE>`
  (pinned, bumped deliberately) and `User-Agent: <ESI_USER_AGENT>` (app name + contact email
  per CCP guidance); `Authorization: Bearer` when `characterId` is given, refreshed
  automatically when within 60 s of expiry via the stored refresh token.
- **Conditional requests:** persists `ETag` + `Expires` per `(character_id, path)` in
  `esi_cache`; never re-fetches before `Expires`; sends `If-None-Match`; on 304 returns the
  cached body.
- **Rate limiting:** reads `X-Ratelimit-Limit/Remaining`; when remaining < 20 % of the limit,
  waits before the next call in that group — ESI's bucket refills continuously, so the wait is
  10 % of the window capped at 60 s rather than a full window (amended 2026-09-01); honours `Retry-After` on
  429; on 420 (legacy error limit) halts all ESI calls for 60 s.
- **Pagination:** `X-Pages` handled inside the wrapper (`esiFetchAll`).
- **Token refresh failure (invalid_grant):** sets `characters.token_status = 'needs_reauth'`;
  header shows a warning badge on that character.
- **Types:** `scripts/esi-types.ts` generates `src/lib/esi/types.gen.ts` from
  `https://esi.evetech.net/meta/openapi.json` so responses are typed.

### 3.4 Database & worker

- Postgres 17 in Compose. `db/schema.sql` + `scripts/migrate.ts` (idempotent, like Animal).
- `src/worker/index.ts`: job registry `{ name, interval, run(characterId) }`; loops over all
  characters with `token_status = 'ok'`; staggers start times across characters; records
  every run in `sync_runs`; a failing job logs its error and retries next interval — it never
  crashes the process.
- Phase 1 ships one job, `character-info` (every 6 h): refreshes name, corporation,
  alliance via `/characters/{id}` — called **with** the character's bearer token even though the
  route is public — (+ `/corporations/{id}`, `/alliances/{id}` for names). Its purpose is to
  prove token refresh, the ESI wrapper, and `sync_runs` end-to-end.

### 3.5 UI shell & pages

- **Shell** ported from Animal: sticky frosted 80px header, aurora "EVE" wordmark, centre nav,
  character switcher right; 1123px column; footer; ≤760px bottom tab bar.
- **Nav** (fixed from day one): `Overview · Skills · Ships · Fitting · Assets · Wallet · Combat`.
  Unbuilt destinations render a Midnight "coming soon" card.
- **Pages:**
  - `/login` — SSO button; shows `error` query messages.
  - `/` **Overview** — one card per character: portrait, name, corp/alliance, wallet
    placeholder, "last synced" from `sync_runs`.
  - `/settings` — accounts & characters management; **Sync status** table (job, character,
    last run, status, error).
- **Conventions:** Mantine components styled via CSS-variable tokens (`--card`, `--border`,
  `--accent`…), never inline colours; Tabler icons.

### 3.6 Deployment

- **VM** (Daniel is building it; Ubuntu, Docker). `deploy/docker-compose.yml`: `traefik`
  (v3.6, Let's Encrypt via Cloudflare DNS-01, Tailscale-only IP allowlist — cloned from
  `Prometheus/app-01`), `app` (`next start`), `worker` (`tsx src/worker/index.ts`),
  `postgres:17` (named volume). Only Traefik binds host ports 80/443.
- **Ansible** in `deploy/ansible` following the app-01 layout: `site.yml`, `group_vars`,
  `vars/secrets.yml` (Cloudflare DNS token, EVE client secret, DB password, session secret).
- **DNS:** Cloudflare grey-cloud `A eve.example.com → <VM Tailscale IP>`.
- **EVE developer portal app:** callback `https://eve.example.com/auth/callback`; the scopes
  in §3.2 assigned to the app.
- **Dev loop:** code is synced to the VM and run with `docker compose up --build`; unit tests
  run locally and in the VM.

### 3.7 Error handling

- ESI errors are recorded per job run in `sync_runs`; the worker retries on the next interval.
- `invalid_grant` on refresh, or a 401 on an authenticated ESI call, → `needs_reauth` (a 403
  means a missing role, not a bad token, and stays a plain error — amended 2026-09-01); the UI flags it; the worker
  skips that character until re-authorised.
- SSO failures (bad state, JWT invalid, not allow-listed) → `/login?error=…`; nothing persisted.
- Pages never call ESI inline, so a CCP outage shows stale data, not errors.

### 3.8 Testing

- **Unit (vitest):** PKCE + JWT verification against a mocked JWKS; ESI wrapper — ETag/304,
  `Expires` respect, rate-limit backoff, 420 halt, pagination, token refresh, `needs_reauth`
  transition (mocked `fetch`); job registry scheduling and staggering; allow-list; session
  cookie sign/verify; refresh-token encrypt/decrypt round-trip.
- **DB (vitest against real Postgres via Compose):** migrations idempotent; accounts/characters
  CRUD; `esi_cache` upsert; `sync_runs` recording.
- **Component (happy-dom):** login page, character switcher grouping/active state, sync
  status table.
- **Acceptance on the VM:** log in all four characters, assign to two accounts, see all four
  on Overview with a fresh `character-info` sync and correct corp/alliance; remove and
  re-add one character.

### 3.9 Out of scope for phase 1

SDE import, any skill/asset/fitting/wallet/killmail data, the dogma engine, market prices,
multi-user support, corporation data.
