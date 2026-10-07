# Deploying Yutani OS

One Ansible playbook installs everything on a Debian or Ubuntu host: Docker, Traefik (TLS through a
Cloudflare DNS-01 challenge, so a LAN-only host gets a real certificate), then the app, the worker and
Postgres from `deploy/docker-compose.yml`. It installs on the machine you run it from, or on a host over
SSH; the host's own LAN, Tailscale and loopback are the only networks allowed in unless you add more.

## 1. Answer the questions

```
./deploy/setup.sh
```

It asks for the subdomain, a contact email, which characters may sign in, your EVE SSO application and a
Cloudflare DNS token, generates the session secret and the Postgres password, and writes three git-ignored
files: `ansible/inventory.ini` (where), `ansible/vars/site.yml` (what) and `ansible/vars/secrets.yml`
(0600). Re-running keeps your answers as defaults and never regenerates a secret. Every prompt can be
pre-seeded from an environment variable of the same name (`DOMAIN=eve.example.com ./deploy/setup.sh`).

You need, before you start:

- A subdomain whose DNS zone is on Cloudflare, with an **A record pointing at the host** (DNS-only, grey
  cloud; a private LAN address is fine). `setup.sh` prints the address it detected.
- A Cloudflare API token with *Zone → DNS → Edit* on that zone.
- An EVE developer application (<https://developers.eveonline.com>) with the callback
  `https://<your domain>/auth/callback` and the twelve scopes listed in `src/lib/auth/sso.ts`.
- The character IDs you want to allow in.

## 2. Install

```
cd deploy/ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook -K site.yml
```

`-K` asks for the sudo password; drop it if the user has passwordless sudo. The playbook refuses to run
while `site.yml` or `secrets.yml` still hold placeholders. The four roles run in order: `common` (base
packages, swap), `docker` (engine + compose plugin), `traefik` (reverse proxy and certificate), `eve`
(syncs this repository to `/opt/eve/src`, builds the image, starts the stack, applies the schema).

## Redeploying app changes

```
ansible-playbook -K site.yml --tags eve
```

Only re-syncs the repository, rebuilds the image, restarts the stack and re-applies the schema; skips the
idempotent but slower `common`/`docker`/`traefik` roles. Changed a setting in `vars/site.yml`? Same command.

## Running Ansible from a non-interactive shell

A shell without a pseudo-tty breaks Ansible's progress output. Wrap the command in `script`:

```
script -qc "ansible-playbook site.yml --tags eve" /dev/null
```

## ESI application scopes (manual, one-off)

The app now requests twelve scopes (`SCOPES` in `src/lib/auth/sso.ts`). The developer-portal
application at <https://developers.eveonline.com> already has all twelve enabled — no portal
change is needed. Two of them were added in phase 3:

- `esi-universe.read_structures.v1` — names of player structures (citadels) the character can dock at
- `esi-location.read_online.v1` — whether the character is currently online

Tokens issued before this deploy were granted under the old ten-scope set, and scope grants are
immutable per refresh token. So **every character must log in once more after the deploy** (menu →
Add character, or the "Log in with EVE Online" button, then `/auth/start`) to pick up the new
scopes. Until a character does that, those two features degrade gracefully rather than failing:
structures show `Unknown structure (id)` and online status is blank, while everything else
(skills, assets, fittings, clones, wallet, location) keeps syncing normally.

## ESI compatibility date

`ESI_COMPATIBILITY_DATE` must be a date from `GET https://esi.evetech.net/meta/compatibility-dates`
— ESI silently rounds an unlisted date down to the newest published date below it. It is pinned to
`2026-08-18` in `deploy/ansible/group_vars/eve.yml`, `.env`, `.env.example`, `deploy/.env.example`
and `scripts/esi-types.ts`. Bump all five together and re-run `npm run esi:types`, never one alone.

## Where things live on the VM

- `/opt/eve/traefik` — Traefik config, dynamic routes, ACME certificate storage.
- `/opt/eve/src` — the synced repository (`base_dir` in `group_vars/eve.yml`); `/opt/eve/src/deploy` is the Compose project directory
  (`docker-compose.yml`, the templated `.env`) that `docker compose` commands run from.

## Static data (SDE)

The worker polls CCP's Static Data Export on a schedule; there is nothing to provision for it.

- On an empty database, the worker's first tick downloads the current SDE (~95 MB) and imports it
  — a few minutes, mostly the download. `/settings` shows "Not imported yet" until that completes.
- Once imported, the `sde-update` job re-checks the published build every 6 hours and only
  downloads/re-imports when it changed. A failed check (network blip, CCP endpoint down) retries
  after 10 minutes rather than waiting for the next 6-hour slot.
- The `/settings` page's "Static data" card shows the imported build number, release date, import
  timestamp and a few table counts (types, dogma attributes, dogma effects, solar systems) once an
  import has completed.
- To force a re-import without waiting for the schedule:

  ```
  ssh <user>@<host> 'cd /opt/eve/src/deploy && docker compose exec -T worker npm run sde:import'
  ```

- **A release that adds new `sde_*` tables needs a forced import.** The `sde-update` job only
  downloads when the published build number differs from `sde_meta.build_number`, so tables added by
  a migration stay empty until `npm run sde:import` is run by hand (the command above). Phase 6's
  `sde_alpha_skills` and `sde_skill_plans` were filled that way.
```
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

## Fitting designer

`/fitting` runs the dogma engine **in the browser**. Three routes feed it:

- `GET /api/dogma/meta` — the attribute/effect/group half of `DogmaData`, ~1.25 MB of JSON, with
  `Cache-Control: public, max-age=86400` and `ETag: "sde-<build>"`. A browser revalidates once a
  day and gets a 304 unless the SDE was re-imported.
- `GET /api/dogma/types?ids=` — up to 200 type ids plus their `requiredSkillN` closure, memoised
  per id in the tab.
- `GET /api/market/prices?ids=` — serves `market_prices` and, for ids with no row or a row older
  than 24 h, fetches Jita aggregates from Fuzzwork **synchronously** (one chunk of ≤ 500) before
  answering, so a freshly browsed module is priced immediately instead of waiting for the hourly
  job. A Fuzzwork failure is logged and the stored (ESI) prices are served.

Fits live in our own `fits` / `fit_items` tables and are **never pushed to ESI** — the
`esi-fittings.write_fittings.v1` scope is not requested. Export is EFT text.

Everything is behind the session cookie: `src/proxy.ts` guards every path except `/login`,
`/api/health`, `/auth/*` and `/_next/*`.

## Skill planner

`/skills` lists each character's plans; `/skills/plans/<id>` is the editor. All the training maths
lives in `src/lib/skills/**`, which is pure and isomorphic — the server computes the timeline for
the page and the API, and the editor recomputes it locally on every keystroke with the same code,
so the two cannot disagree.

- SP for a level is `ceil(250 * rank * 2^(2.5 * (level - 1)))`, cumulative. Training rate is
  `primary + secondary / 2` SP per minute at the Omega rate; primary/secondary come from dogma
  attributes 180/181 and the values are attribute ids 164–168.
- Effective attributes are `character_attributes` (base, implants excluded) plus the 175–179 bonuses
  on `character_implants`. If the stored five values are not each 17–27 and totalling 99, the
  attributes panel says so rather than guessing.
- `POST /api/skill-plans/<id>/optimise` brute-forces all 2,885 legal remaps and returns the fastest
  plus the time it saves. It writes nothing; the editor decides whether to store it.
- `GET /api/skill-plans/<id>/export?format=evemon|ingame` returns `text/plain`, one line per skill
  level: `Gunnery V` for EVEMon, `Gunnery 5` for the in-game skill-plan importer.
- Two reference tables come from the SDE: `sde_alpha_skills` (175 rows — clone grade 1) badges
  Alpha-trainable levels, and `sde_skill_plans` (40 rows) is CCP's certified career plans, offered
  as templates.

Everything is behind the session cookie: `src/proxy.ts` guards every path except `/login`,
`/api/health`, `/auth/*` and `/_next/*`.

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

## Logs and troubleshooting

```
ssh <user>@<host> 'docker ps --format "{{.Names}} {{.Status}}"'
ssh <user>@<host> 'docker logs --tail 50 eve-app'
ssh <user>@<host> 'docker logs --tail 50 eve-worker'
```

On a local install, drop the `ssh` and run the commands directly.

Health check: `curl -sS https://<your domain>/api/health` should return `{"ok":true,"db":true}`.
