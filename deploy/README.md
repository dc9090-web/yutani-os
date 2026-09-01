# Deploying EVE

Ansible provisions and updates the VM at `10.5.5.150` (inventory group `eve`), which runs Traefik
plus the app/worker/postgres stack via Docker Compose.

## Prerequisites

```
cd deploy/ansible
ansible-galaxy collection install -r requirements.yml
cp vars/secrets.yml.example vars/secrets.yml
```

Fill in `vars/secrets.yml` with real values (Cloudflare DNS API token, EVE SSO client secret,
session secret, Postgres password). `site.yml` refuses to run while any value is still
`CHANGEME`. Never commit `vars/secrets.yml`.

## First deploy

```
ansible-playbook site.yml
```

This runs all four roles in order: `common` (base packages, users), `docker` (engine + compose
plugin), `traefik` (reverse proxy, TLS via Cloudflare DNS challenge), `eve` (syncs the repo to the
VM, builds the app image, starts the stack, applies the DB schema).

## Redeploying app changes

```
ansible-playbook site.yml --tags eve
```

Only re-syncs the repo, rebuilds the image, restarts the stack and re-applies the schema — skips
the (idempotent but slower) `common`/`docker`/`traefik` roles.

## Running Ansible from Claude's shell

The Bash tool's non-interactive shell breaks Ansible's progress/callback output. Wrap the command
in `script` to give it a pseudo-tty:

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
- `/opt/eve/src` — the synced repository; `/opt/eve/src/deploy` is the Compose project directory
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
  ssh daniel@10.5.5.150 'cd /opt/eve/src/deploy && docker compose exec -T worker npm run sde:import'
  ```

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

## Logs and troubleshooting

```
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-app'
ssh daniel@10.5.5.150 'docker logs --tail 50 eve-worker'
```

Health check: `curl -sS https://eve.plasma66.com/api/health` should return `{"ok":true,"db":true}`.
