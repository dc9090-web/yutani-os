# ESI endpoint research — character sync, market prices, combat

Researched 2026-09-01. Sources, in order of authority:

1. **Live ESI OpenAPI spec** fetched at research time:
   - `curl https://esi.evetech.net/meta/openapi.json` → **compatibility date `2020-01-01`** (182 paths). This is
     what `src/lib/esi/types.gen.ts` was generated from — see [§0](#0-compatibility-date-the-most-important-finding).
   - `curl -H 'X-Compatibility-Date: 2026-08-18' https://esi.evetech.net/meta/openapi.json` → **`2026-08-18`**
     (218 paths), the newest published date.
   - The spec carries CCP's own cache/rate-limit metadata as vendor extensions
     (`x-client-cache-ttl`, `x-server-cache-ttl`, `x-cache-mode`, `x-rate-limit`, `x-pagination`,
     `x-required-roles`). **All cache timers below come from these**, not from guesswork.
2. `https://esi.evetech.net/meta/compatibility-dates` and `/meta/changelog`.
3. `https://developers.eveonline.com/docs/services/esi/{overview,rate-limiting,best-practices}/`.
4. Live HTTP probes (headers only) — limited, see [§9](#9-what-could-not-be-verified).
5. `https://zkillboard.com/api/docs/` (the GitHub wiki page is now marked historical and redirects here).
6. `https://market.fuzzwork.co.uk/api` + live probes.

> **Live-probe caveat.** During this research ESI's Tranquility backend was down: every cache-MISS request to a
> TQ-backed route returned `504 {"error":"Timeout contacting tranquility","timeout":10}`. Anything that needed a
> live 200 from a game-data route is marked **UNVERIFIED**. Everything sourced from the spec/docs is solid.

---

## 0. Compatibility date — the most important finding

`ESI_COMPATIBILITY_DATE` is currently `2026-08-28` (per `.env` / `src/lib/config.ts`, sent by
`EsiClient` as `X-Compatibility-Date`).

**Published compatibility dates** (`GET /meta/compatibility-dates`):

```
2026-08-18  2026-08-04  2026-07-21  2026-07-17  2026-06-09  2026-05-19  2025-12-16
2025-11-06  2025-09-30  2025-09-26  2025-08-26  2025-04-02  2025-04-01  2020-01-01
```

`2026-08-28` is **not** in that list. Verified behaviour (probing `/freelance-jobs`, a route that only exists from
`2025-12-16` onwards):

| `X-Compatibility-Date` sent | `/freelance-jobs` | echoed `x-compatibility-date` |
| --- | --- | --- |
| *(none)* | 404 | – |
| `2020-01-01` | 404 | – |
| `2026-08-18` | 200 | `2025-12-16` |
| `2026-08-28` | 200 | `2025-12-16` |
| `2026-09-01` | 200 | `2025-12-16` |
| `badvalue` | **400** | – |

So ESI **rounds an unlisted date down to the nearest published date ≤ it**. `2026-08-28` is therefore *functionally
valid* and resolves to the `2026-08-18` behaviour set. The echoed `x-compatibility-date` response header is the
*route's own* schema version, not the requested date — don't assert on it.

Docs confirm: *"If a request does not set a compatibility date, the oldest available compatibility date is used"*
and *"The API changes date at 11:00 UTC"* (so `now() - 11h` is the safe "today").

### ⚠️ `types.gen.ts` is generated from the WRONG spec

`scripts/esi-types.ts` does `openapiTS(new URL("https://esi.evetech.net/meta/openapi.json"))` with **no
`X-Compatibility-Date` header**, so it received the `2020-01-01` spec. Confirmed:
`grep -c '^    "/' types.gen.ts` → **182 paths**, matching the 2020-01-01 spec, vs 218 in the 2026-08-18 spec.

The 36 missing paths are all new-feature routes (freelance jobs, corp projects, SKINR cosmetics, mercenary dens,
skyhooks, sovereignty hubs, access-lists, military campaigns, …).

**Good news:** I diffed every response schema for all 22 endpoints in this document across the two compat dates —
**they are byte-identical**. So the current types are correct for Phase 3/4/5/7. But the generator should be fixed
before anything touches a newer route:

```ts
const ast = await openapiTS(new URL(SPEC), {
  // openapi-typescript passes fetch options through
  fetch: (url) => fetch(url, { headers: { "X-Compatibility-Date": "2026-08-18" } }),
});
```

**Recommendation:** pin `ESI_COMPATIBILITY_DATE=2026-08-18` (a published date) so the value used at runtime is the
same one the types were generated from, and bump both together.

---

## 1. Cross-cutting: caching, pagination, rate limits, errors

### 1.1 Cache semantics

Every GET returns `Cache-Control`, `ETag`, `Last-Modified` (and `Content-Language` on localisable routes).
`Expires` is present on real 200s. The spec's `x-client-cache-ttl` (seconds) is the authoritative cache timer and
equals `Expires - Last-Modified`; verified live on `/markets/prices` (`Expires 11:52:47` − `Last-Modified
10:52:47` = 3600 s = `x-client-cache-ttl: 3600`).

Two cache modes appear in `x-cache-mode`:

- **`ttl-based`** — plain TTL, `Expires` is when new data is available.
- **`event-based`** — used by `/skills` and `/skillqueue` since compat date `2026-01-27`. The server invalidates
  the cache when the game emits a change event; `x-client-cache-ttl` (60 s) is a *floor*, not a fixed window.
  These two have **no `x-server-cache-ttl`**. In practice: still respect `Expires`, but an ETag revalidation can
  return fresh data sooner than a pure-TTL route would.

**POST routes carry no cache headers at all** (`/universe/names`, `/assets/names`, `/assets/locations`). The docs
say so explicitly: *"typically POST methods have no cache information, even when they still actually have an
internal cache."* → the app must impose its own TTL on name-resolution results.

Docs warning worth heeding: *"Circumventing the ESI caching can get you banned from ESI."*

**Paginated-resource consistency rule** (from docs): `Last-Modified` should be identical across all pages of one
resource. If page N's `Last-Modified` differs from page 1's, the data refreshed mid-walk and the assembled set is
torn — discard and restart. `EsiClient.getAll()` does **not** currently do this check.

### 1.2 Pagination

Two mechanisms exist:

- **Offset/`X-Pages`** — `?page=N` query param, `X-Pages` response header on page 1. This is what all our
  paginated routes use. Page size is conventionally 1000 records (**UNVERIFIED live** — could not get a 200 from
  a paginated route during the outage).
- **`x-pagination: "cursor"`** — cursor pagination, present on exactly 12 routes, **all of them new-feature
  routes** (`/freelance-jobs`, `/corporations/{id}/projects`, `/paragon-hub/skinr`, military campaigns…).
  **None of our endpoints use it.**

`/characters/{id}/wallet/transactions` uses neither — it has a **`from_id` cursor query param and no `X-Pages`**.

### 1.3 Rate limiting (bucket / floating window)

New-style limits, announced per route in the spec as `x-rate-limit` and in responses as headers. Exposed via
`access-control-expose-headers` (observed live):

```
Etag, Retry-After, X-Compatibility-Date, X-Esi-Error-Limit-Remain, X-Esi-Error-Limit-Reset,
X-Pages, X-Ratelimit-Group, X-Ratelimit-Limit, X-Ratelimit-Remaining, X-Ratelimit-Used
```

- `X-Ratelimit-Group` — route group, e.g. `char-detail`, `market-order`.
- `X-Ratelimit-Limit` — `"<tokens>/<window>"`, e.g. `1800/15m`, `12000/15m`. (`EsiClient.parseLimit()` handles
  this format correctly.)
- `X-Ratelimit-Remaining`, `X-Ratelimit-Used`.
- On 429: `Retry-After` in seconds.

**Bucket identity** = `(rate limit group, userID)` where userID is `<applicationID>:<characterID>` for
authenticated routes and `<sourceIP>` (or `<sourceIP>:<applicationID>`) for public ones. **The per-character
budgets are independent.**

**Token cost by response status:** `2XX` = 2, `3XX` = 1 (this is why ETag/304 is cheap and worth doing), `4XX` =
5, `5XX` = 0.

It's a *floating window*: tokens consumed at T are returned at T + window.

Caveats from the docs: rate limiting is not active on all routes yet (routes with no `x-rate-limit` in the spec —
all the `/markets/*` except `/markets/{region_id}/orders`, all `/universe/*`, `/universe/names`); and *"some
routes also have a rate limiter deep in EVE Server code [that] can also cause 429s to be returned, without the
rate limiter headers indicating why."*

### 1.4 Error limit (the old, global limiter — still active everywhere)

- `X-ESI-Error-Limit-Remain` — non-2xx/3xx responses left in this fixed window. Starts at **100**.
- `X-ESI-Error-Limit-Reset` — seconds until the window resets (observed 0–44 ⇒ a **60 s fixed window**).
- Exceeding it → **HTTP 420** on *all* ESI routes, including ones with new-style rate limiting.

**⚠️ Verified empirically: 5xx responses DO consume the error limit.** Three consecutive `504`s decremented
`X-ESI-Error-Limit-Remain` 100 → 99 → 98. This matters a lot: during an ESI outage (like the one in progress
today) a retry-happy sync worker burns its error budget on server-side failures and gets 420'd. The 5xx *token*
cost is 0, but the *error-limit* cost is 1 each.

`EsiClient` currently only reacts to a 420 after the fact (60 s halt). **It should also pre-emptively back off
when `X-ESI-Error-Limit-Remain` drops low, and it should not tight-retry 5xx.**

`Error` response body schema: `{ error: string (REQUIRED), status?: int64, details?: ErrorDetail[] }`.

### 1.5 User-Agent

Required by best practice; can get you banned if absent/uninformative. Should contain an email (strongly
preferred) and/or `AppName/1.2.3`, source URL, discord, or eve character. Browser fallbacks: `X-User-Agent`
header or `user_agent` query param. `EsiClient` already sends `User-Agent` from config — just make sure
`ESI_USER_AGENT` contains `you@example.com` and an app name/version.

---

## 2. Phase 3 — character sync endpoints

Base URL `https://esi.evetech.net`. All paths below are relative. "cache" = `x-client-cache-ttl` in seconds.

### Summary table

| Path | Method | Scope | Cache (s) | Mode | X-Pages | Rate-limit group |
| --- | --- | --- | --- | --- | --- | --- |
| `/characters/{character_id}/skills` | GET | `esi-skills.read_skills.v1` | 60 | event-based | no | `char-detail` 600/15m |
| `/characters/{character_id}/skillqueue` | GET | `esi-skills.read_skillqueue.v1` | 60 | event-based | no | `char-detail` 600/15m |
| `/characters/{character_id}/attributes` | GET | `esi-skills.read_skills.v1` | 120 | ttl | no | `char-detail` 600/15m |
| `/characters/{character_id}/assets` | GET | `esi-assets.read_assets.v1` | 3600 | ttl | **yes** | `char-asset` 1800/15m |
| `/characters/{character_id}/assets/names` | POST | `esi-assets.read_assets.v1` | – | – | no | `char-asset` 1800/15m |
| `/characters/{character_id}/assets/locations` | POST | `esi-assets.read_assets.v1` | – | – | no | `char-asset` 1800/15m |
| `/characters/{character_id}/fittings` | GET | `esi-fittings.read_fittings.v1` | 300 | ttl | no | `fitting` **150/15m** |
| `/characters/{character_id}/clones` | GET | `esi-clones.read_clones.v1` | 120 | ttl | no | `char-location` 1200/15m |
| `/characters/{character_id}/implants` | GET | `esi-clones.read_implants.v1` | 120 | ttl | no | `char-detail` 600/15m |
| `/characters/{character_id}/wallet` | GET | `esi-wallet.read_character_wallet.v1` | 120 | ttl | no | `char-wallet` **150/15m** |
| `/characters/{character_id}/wallet/journal` | GET | `esi-wallet.read_character_wallet.v1` | 3600 | ttl | **yes** | `char-wallet` **150/15m** |
| `/characters/{character_id}/wallet/transactions` | GET | `esi-wallet.read_character_wallet.v1` | 3600 | ttl | no (`from_id`) | `char-wallet` **150/15m** |
| `/characters/{character_id}/location` | GET | `esi-location.read_location.v1` | **5** | ttl | no | `char-location` 1200/15m |
| `/characters/{character_id}/ship` | GET | `esi-location.read_ship_type.v1` | **5** | ttl | no | `char-location` 1200/15m |
| `/characters/{character_id}/online` | GET | **`esi-location.read_online.v1`** | 60 | ttl | no | `char-location` 1200/15m |
| `/characters/{character_id}/killmails/recent` | GET | `esi-killmails.read_killmails.v1` | 300 | ttl | **yes** | `char-killmail` **30/15m** |

Note the three tight buckets: `fitting` and `char-wallet` at 150 tokens/15 min and `char-killmail` at **30
tokens/15 min**. At 2 tokens per 200 response that's **15 killmail-list requests per character per 15 minutes** —
plan the paginated walk accordingly, and let the 300 s cache do its job.

### 2.1 `GET /characters/{character_id}/skills`

Schema `CharactersSkills` (`types.gen.ts` `components["schemas"]["CharactersSkills"]`):

```
total_sp        : int64   REQUIRED   The total Skill Points spent on skills
unallocated_sp  : int64   optional   The amount of unallocated Skill Points
skills          : array   REQUIRED   The trained skills
  skill_id             : int64  REQUIRED  The Type ID of the skill
  trained_skill_level  : int64  REQUIRED  The trained skill level
  active_skill_level   : int64  REQUIRED  The active skill level (can differ from trained due to
                                          alpha status and/or active expert systems)
  skillpoints_in_skill : int64  REQUIRED  The amount of Skill Points in the skill
```

**Gotchas** (CCP's own route description, verbatim):

> Skills returned by this route can be out-of-date if the character hasn't logged in since one or more skills
> completed training. Use the /skillqueue route to check for skills that completed training. **Entries that are in
> the past need to be applied on top of this list** to get an accurate view of the character's current skills.

So the sync worker must merge: take `/skills`, then overlay every `/skillqueue` entry whose `finish_date` is in
the past, setting `trained_skill_level = finished_level` and `skillpoints_in_skill = level_end_sp`. **This is not
optional** — without it a character who trained overnight and hasn't logged in shows stale skills indefinitely.

`unallocated_sp` is optional — absent, not zero, when the character has none.

Changelog `2026-01-27`: `active_skill_level` now reflects Expert Systems levels correctly; event-based cache
invalidation enabled.

### 2.2 `GET /characters/{character_id}/skillqueue`

Response is a **bare array** (no wrapper object):

```
[]                    : object
  skill_id            : int64             REQUIRED
  finished_level      : int64             REQUIRED  The level the skill is training for
  queue_position      : int64             REQUIRED  The position of the skill in the queue
  start_date          : string(date-time) optional  The date the skill training will start/continue
  finish_date         : string(date-time) optional  The date the skill training will finish
  level_start_sp      : int64             optional  The Skill Points at the start of the level
  level_end_sp        : int64             optional  The Skill Points at the end of the level
  training_start_sp   : int64             optional  The Skill Points at the start of training
```

**Gotchas:**

- CCP: *"Entries that have their finish time in the past are completed, but aren't updated in the '/skills' route
  yet. This will happen the next time the character logs in."* (pairs with §2.1)
- All four date/SP fields are **optional**. A **paused queue** omits `start_date`/`finish_date` entirely — do not
  assume they're present. Same for a queue entry that has no defined end.
- An **empty queue returns `[]`**, not 404.
- Changelog `2025-02-18`: *"Skill queues with 151 entries can now be requested safely"* — the old 50-entry cap is
  gone; the planner should handle up to 151 entries.

### 2.3 `GET /characters/{character_id}/attributes`

```
charisma                     : int64             REQUIRED
intelligence                 : int64             REQUIRED
memory                       : int64             REQUIRED
perception                   : int64             REQUIRED
willpower                    : int64             REQUIRED
bonus_remaps                 : int64             optional  Number of available bonus character neural remaps
last_remap_date              : string(date-time) optional  Datetime of last neural remap, including usage of
                                                           bonus remaps
accrued_remap_cooldown_date  : string(date-time) optional  Neural remapping cooldown after a character uses
                                                           remap accrued over time
```

**Gotchas for the skill planner:**

- The five attribute values are the **effective** values *excluding* implants — implants must be added
  separately via `/implants/` (`+1`..`+5` hardwiring type IDs) to compute real SP/hour.
- SP/hour = `(primary + secondary/2) * 60`. Both attribute sets and implants are needed.
- `bonus_remaps` / `last_remap_date` / `accrued_remap_cooldown_date` are all **optional** — a character who has
  never remapped has none of them. Treat absence as "no cooldown, unknown last remap".
- Uses the **`esi-skills.read_skills.v1`** scope (not a clones/characters scope) — already in the app's list. ✅
- Only 120 s cache but it changes at most once a year; cache it hard locally.

### 2.4 `GET /characters/{character_id}/assets` (paginated)

Bare array; `X-Pages` on page 1; `?page=N`.

```
[]                  : object
  item_id           : int64   REQUIRED
  type_id           : int64   REQUIRED
  quantity          : int64   REQUIRED
  location_id       : int64   REQUIRED
  location_type     : string  REQUIRED  enum: station | solar_system | item | other
  location_flag     : string  REQUIRED  enum: see §8
  is_singleton      : bool    REQUIRED
  is_blueprint_copy : bool    optional
```

**Gotchas:**

- `is_blueprint_copy` is **optional and only ever `true`** — absent means "not a BPC" (this is the classic ESI
  "optional boolean" pattern; CCP wrote a devblog about it). Don't `=== false`.
- Assets are a **tree**: an item whose `location_type` is `item` has a `location_id` that is another asset's
  `item_id` (a container, ship, or a fitted module's parent hull). You must build the parent chain and walk up to
  a `station`/`solar_system`/`other` root to know where something physically is. Ships in space and items in
  player structures both surface as `other`/`item`.
- **`location_id` for a player structure is not resolvable** with the app's current scopes — see §5.
- Cache is 3600 s, and the bucket is generous (1800/15m), so a full paginated walk is cheap. Page size is
  conventionally 1000 (**UNVERIFIED**); a large industrial character can be tens of pages.
- Enforce the `Last-Modified`-consistency check across pages (§1.1) — assets change constantly.

### 2.5 `POST /characters/{character_id}/assets/names` and `/assets/locations`

Both take the **same request body**: a JSON array of `item_id` integers.

```
Request body (both):  int64[]   minItems 1, maxItems 1000, uniqueItems true, REQUIRED

/assets/names  → []  : object
                 item_id : int64  REQUIRED
                 name    : string REQUIRED

/assets/locations → []: object
                 item_id  : int64  REQUIRED
                 position : object REQUIRED { x: double, y: double, z: double }
```

**Gotchas:**

- **`maxItems: 1000`, `uniqueItems: true`** — chunk and dedupe before posting, or you get a 400 (5 error-limit
  tokens).
- CCP: names is *"Typically used for items that can customize names, like containers or ships."* Only send
  `item_id`s where `is_singleton === true` — sending a stack of Tritanium wastes budget and returns the type
  name.
- Items that have never been renamed come back with the **type name**, not a custom name (e.g. `"Large Standard
  Container"`).
- `/assets/locations`: *"Coordinates for items in hangars or stations are set to (0,0,0)"* — a `(0,0,0)` position
  is not an error, it means "docked/in hangar". Only useful for anchored/in-space items.
- **No cache headers on POST** → the client must impose its own TTL. Names of containers/ships change rarely;
  cache for hours/days keyed on `item_id`.
- **`EsiClient` has no `post()` method** — it only implements `get()`/`getAll()`. This is a required addition for
  Phase 3.

### 2.6 `GET /characters/{character_id}/fittings`

```
[]                : object
  fitting_id      : int64   REQUIRED
  name            : string  REQUIRED
  description     : string  REQUIRED
  ship_type_id    : int64   REQUIRED
  items           : array   REQUIRED
    type_id       : int64   REQUIRED
    quantity      : int64   REQUIRED
    flag          : string  REQUIRED  enum: see §8 (fitting flag set — DIFFERENT from asset location_flag)
```

**Gotchas:**

- The fitting `flag` enum is a **different, smaller set** than the asset `location_flag` enum — see §8. Notably
  it *has* `ServiceSlot0..7` and `Invalid`, and it is capped at `RigSlot0..2` and `SubSystemSlot0..3` (assets go
  to `RigSlot7`/`SubSystemSlot7`).
- **`Invalid`** is a real enum member — a fitting referencing a removed/unfittable item. Handle it, don't crash.
- All fields are REQUIRED including `description` (often `""`).
- Drones/charges/ammo appear under `DroneBay`/`FighterBay`/`Cargo` with `quantity > 1`; modules are always
  `quantity: 1` with a distinct slot flag per module.
- **Tightest useful bucket: `fitting` = 150 tokens/15 min** ⇒ 75 successful GETs per character per 15 min. Fine
  for a sync worker, fatal for anything per-request.
- `POST /characters/{character_id}/fittings` (create) exists and needs `esi-fittings.write_fittings.v1` — **not
  in the app's scope list** (read-only is presumably intended).

### 2.7 `GET /characters/{character_id}/clones` and `/implants`

`/clones`:

```
home_location             : object            optional
  location_id             : int64             optional
  location_type           : string            optional  enum: station | structure
jump_clones               : array             REQUIRED
  jump_clone_id           : int64             REQUIRED
  location_id             : int64             REQUIRED
  location_type           : string            REQUIRED  enum: station | structure
  name                    : string            optional
  implants                : int64[]           REQUIRED  (type IDs)
last_clone_jump_date      : string(date-time) optional
last_station_change_date  : string(date-time) optional
```

`/implants`: a **bare `int64[]`** of implant type IDs on the *active* clone. Different scope
(`esi-clones.read_implants.v1`), so it's a separate request.

**Gotchas:**

- `home_location` is **optional as a whole**, and its two sub-fields are *also* optional — fully defensive
  parsing required.
- `location_type` here is `station | structure` — a **different enum** from assets' `station | solar_system |
  item | other`.
- A jump clone's `implants` array can be `[]` (empty clone) but is never absent.
- `/clones` gives implants for *jump* clones; `/implants` gives the *active* clone's. To compute current
  attribute bonuses for the skill planner you need `/implants`, not `/clones`.
- Jump clones in **player structures** hit the same name-resolution wall as assets (§5).

### 2.8 Wallet

`GET /wallet` → a bare **`number` (double)**, the ISK balance. Not an object. `types.gen.ts` types this as
`components["schemas"]["CharactersCharacterIdWalletGet"] = number`.

`GET /wallet/journal` (paginated, `X-Pages`) — *"going 30 days back"*:

```
[]                : object
  id              : int64             REQUIRED  Unique journal reference ID
  date            : string(date-time) REQUIRED
  ref_type        : string            REQUIRED  enum of ~180 values (see below)
  description     : string            REQUIRED
  amount          : double            optional  positive = deposit, negative = withdrawal
  balance         : double            optional  Wallet balance after transaction
  reason          : string            optional  User-stated reason; only some ref_types
  context_id      : int64             optional
  context_id_type : string            optional  enum: structure_id | station_id | market_transaction_id |
                                                character_id | corporation_id | alliance_id | eve_system |
                                                industry_job_id | contract_id | planet_id | system_id | type_id
  first_party_id  : int64             optional
  second_party_id : int64             optional
  tax             : double            optional  Only on tax-related ref_types
  tax_receiver_id : int64             optional  Only on tax-related ref_types
```

`GET /wallet/transactions` — **`from_id` cursor, no `X-Pages`**:

```
[]              : object   wallet transaction
  transaction_id: int64             REQUIRED  Unique transaction ID
  date          : string(date-time) REQUIRED
  type_id       : int64             REQUIRED
  quantity      : int64             REQUIRED
  unit_price    : double            REQUIRED  Amount paid per unit
  client_id     : int64             REQUIRED
  location_id   : int64             REQUIRED
  is_buy        : bool              REQUIRED
  is_personal   : bool              REQUIRED
  journal_ref_id: int64             REQUIRED  → joins to wallet/journal .id
```

**Gotchas:**

- **`ref_type` is a huge enum (162 members) and CCP adds to it regularly** (changelog `2024-07-11` and
  `2025-07-21` both added values, both non-breaking). Adding enum values is explicitly a *non-breaking* change
  released under the *existing* compatibility date — so **your parser will see `ref_type` values that aren't in
  `types.gen.ts` without any compat-date bump**. Never use an exhaustive `switch` with no default; store the raw
  string. Same applies to `location_flag` (changelog `2024-07-11` added `InfrastructureHangar` and
  `MoonMaterialBay`).
- `amount` and `balance` are **optional** despite being the point of the record.
- `context_id`'s meaning depends entirely on `ref_type` — CCP: *"Because of legacy reasons the context is
  completely different per ref_type."* Use `context_id_type` to know how to interpret it.
- **Journal is capped at 30 days.** For long-term history the app must accumulate and never re-derive.
  Deduplicate on `id`, which is stable.
- **Transactions use `from_id`, not `page`.** Pagination protocol: fetch with no `from_id`, then repeat with
  `from_id = min(transaction_id)` of the previous batch, until a short/empty batch. `EsiClient.getAll()` cannot
  do this — it needs a separate cursor loop. Batch size is conventionally 2560 (**UNVERIFIED**).
- `journal_ref_id` joins transactions to the journal row (`ref_type: market_transaction`); use it to attribute
  broker fees/taxes to a trade.
- **The `char-wallet` bucket is 150 tokens/15 min.** At 2 tokens per page that's 75 pages per character per 15
  min across *all three* wallet routes combined. A first-time backfill of a busy trader's 30-day journal will
  brush this; stagger it.

### 2.9 Location / ship / online

```
/location  → solar_system_id : int64  REQUIRED
             station_id      : int64  optional
             structure_id    : int64  optional

/ship      → ship_item_id    : int64  REQUIRED
             ship_name       : string REQUIRED   Name of this ship
             ship_type_id    : int64  REQUIRED

/online    → online          : bool             REQUIRED  Whether the character is online
             last_login      : string(date-time) optional
             last_logout     : string(date-time) optional
             logins          : int64             optional  Total logins (all-time)
```

**Gotchas:**

- **`/location` and `/ship` have a 5-second cache.** These are effectively real-time. Do **not** put them in the
  periodic sync job at the same cadence as skills/assets — poll them only when a UI is actually watching, and
  respect the 5 s `Expires` (violating it risks a ban).
- `/location`: exactly one of `station_id` / `structure_id` is present when docked; **neither** when in space.
  `solar_system_id` is always present.
- `/ship`: `ship_item_id` is the `item_id` that joins into the assets tree.
- **`/online` requires `esi-location.read_online.v1`, which is NOT in the app's scope list** — see §5.

---

## 3. Name resolution

| Path | Method | Scope | Cache (s) |
| --- | --- | --- | --- |
| `/universe/names` | POST | none (public) | none (POST) |
| `/universe/stations/{station_id}` | GET | none (public) | *daily at 11:05* |
| `/universe/structures/{structure_id}` | GET | **`esi-universe.read_structures.v1`** | 3600 |
| `/universe/structures` | GET | none (public) | 3600 |

### `POST /universe/names`

```
Request:  int64[]  minItems 1, maxItems 1000, uniqueItems true, REQUIRED

Response: []      : object
            id      : int64  REQUIRED
            name    : string REQUIRED
            category: string REQUIRED  enum: alliance | character | constellation | corporation |
                                             inventory_type | region | solar_system | station | faction
```

**Gotchas:**

- Supported categories are exactly the nine above: *"Characters, Corporations, Alliances, Stations, Solar
  Systems, Constellations, Regions, Types, Factions."* **Player structures (citadels) are NOT resolvable here.**
- **If any single ID in the batch is invalid/unresolvable the whole request 404s** — it is not a partial-success
  API. Validate/chunk defensively and, on failure, bisect the batch. (Long-standing ESI behaviour; **UNVERIFIED**
  live today because TQ was down.)
- `maxItems: 1000`, `uniqueItems: true`.
- No cache headers → impose your own. Names of types/regions/stations are effectively immutable; character and
  corp names change rarely. Cache type/region/station forever-ish, character/corp for days.
- `inventory_type` is the category for item type IDs — this is the cheapest bulk way to name `type_id`s without
  shipping the SDE.

### `GET /universe/stations/{station_id}`

```
station_id                  : int64   REQUIRED
name                        : string  REQUIRED
system_id                   : int64   REQUIRED  The solar system this station is in
type_id                     : int64   REQUIRED
position                    : object  REQUIRED  { x,y,z: double }
services                    : array   REQUIRED  enum[] (bounty-missions, market, repair-facilities,
                                                 fitting, cloning, docking, office-rental, …)
max_dockable_ship_volume    : double  REQUIRED
office_rental_cost          : double  REQUIRED
reprocessing_efficiency     : double  REQUIRED
reprocessing_stations_take  : double  REQUIRED
owner                       : int64   optional  ID of the corporation that controls this station
race_id                     : int64   optional
```

No `x-client-cache-ttl`; the description says *"This route expires daily at 11:05"* — a daily cache, in line with
the SDE refresh. Public, no scope. NPC stations only (IDs in the 60000000 range).

### `GET /universe/structures/{structure_id}` — ⚠️ scope gap

```
name            : string  REQUIRED  The full name of the structure
owner_id        : int64   REQUIRED  The ID of the corporation who owns this particular structure
solar_system_id : int64   REQUIRED
type_id         : int64   optional
position        : object  optional  { x,y,z: double }
```

**Gotchas:**

- Requires **`esi-universe.read_structures.v1`**, which is **not in `SCOPES`** (`src/lib/auth/sso.ts:4-9`).
- Even *with* the scope, CCP: *"Returns information on requested structure if you are on the ACL. Otherwise,
  returns 'Forbidden' for all inputs."* So it only ever resolves structures the authenticated character can dock
  at. There is **no** general citadel-name lookup in ESI.
- `GET /universe/structures` (public, no scope, 3600 s) lists **public** structure IDs only — IDs, not names, and
  only those with a public market/manufacturing service (`?filter=market|manufacturing_basic`). Verified live
  (200, cache HIT) even during the outage.
- The old community fallback `https://stop.hammerti.me.uk/api/structure/{id}` (the "Citadel API") **failed to
  connect** during this research — treat as dead/unavailable. **UNVERIFIED** whether it's permanently gone.
- **Practical recommendation:** add `esi-universe.read_structures.v1` to `SCOPES`, and design the UI to degrade
  to `"Unknown Structure (1035…)"` when a 403 comes back. Cache successful structure names indefinitely — they
  change only on rename.

---

## 4. Phase 4/5 — market prices

### Region and station IDs (verified)

Confirmed via `https://www.fuzzwork.co.uk/api/mapdata.php` (SDE-derived), since ESI was down:

| ID | Name |
| --- | --- |
| `10000002` | **The Forge** (region) |
| `20000020` | Kimotoro (constellation) |
| `30000142` | **Jita** (solar system) |
| `60003760` | **Jita 4 - Moon 4 - Caldari Navy Assembly Plant** ("Jita 4-4", type `Jita Trade Hub` / 52678) |

Other hubs, from fuzzwork's own docs: Amarr VIII `60008494`, Dodixie `60011866`, Rens `60004588`, Hek `60005686`,
Perimeter system `30000144`.

### `GET /markets/prices` — no auth

```
[]              : object
  type_id       : int64  REQUIRED
  adjusted_price: double optional
  average_price : double optional
```

- **Cache 3600 s** (`x-client-cache-ttl: 3600`; verified live: `Expires − Last-Modified = 3600`).
- No `X-Pages`, no rate-limit group, no auth. **Response is ~1.1 MB** (verified `content-length: 1100549`) for
  every market type in the game.
- Both price fields are **optional** — types with no market data have neither.
- ⚠️ **These are not tradeable prices.** `adjusted_price` is CCP's industry/insurance reference value and
  `average_price` is a slow global rolling mean. Neither reflects Jita buy/sell. Use them for
  blueprint/insurance/ESI-job-cost maths, **not** for "what is my hangar worth".

### `GET /markets/{region_id}/orders` — no auth, paginated

Query params: **`order_type` (REQUIRED, enum `buy|sell|all`)**, `page` (optional), `type_id` (optional).

```
[]              : object
  order_id      : int64             REQUIRED
  type_id       : int64             REQUIRED
  location_id   : int64             REQUIRED
  system_id     : int64             REQUIRED  The solar system this order was placed
  is_buy_order  : bool              REQUIRED
  price         : double            REQUIRED
  volume_total  : int64             REQUIRED
  volume_remain : int64             REQUIRED
  min_volume    : int64             REQUIRED
  duration      : int64             REQUIRED
  range         : string            REQUIRED  enum: station | region | solarsystem |
                                              1 | 2 | 3 | 4 | 5 | 10 | 20 | 30 | 40
  issued        : string(date-time) REQUIRED
```

**Gotchas:**

- **`order_type` is a required query param.** `types.gen.ts` types it non-optional (`GetMarketsRegionIdOrders`,
  ~line 15630: `query: { order_type: "buy" | "sell" | "all"; page?: number; type_id?: number }`). `EsiClient.get`
  will happily omit it and earn you a 400 (5 error tokens) — the caller must always pass it.
- **`range` is a string enum whose members include numeric-looking strings** (`"1"`, `"40"`). They are strings in
  JSON, not numbers. Jump range for buy orders.
- Cache **300 s**; rate-limit group **`market-order`, 12000 tokens / 15 min** (verified live in response headers
  even on 504s).
- Adding `type_id` narrows to one type and is *far* cheaper — usually a single page.

#### How expensive is a full-region orders pull?

Measured from fuzzwork's aggregate snapshot (orderset `173097`, `Last-Modified 2026-09-01 10:37 UTC`), summing
`numorders` across all `(type, buy/sell)` rows:

| Region | Active orders | Pages @1000/page |
| --- | --- | --- |
| **10000002 The Forge** | **370,435** | **~371** |
| 10000043 Domain (Amarr) | 137,937 | ~138 |
| 10000032 Sinq Laison (Dodixie) | 89,192 | ~90 |
| 10000042 Metropolis (Hek) | 61,865 | ~62 |
| 10000030 Heimatar (Rens) | 59,180 | ~60 |

So a **full Forge order-book pull is ~371 requests ≈ 742 rate-limit tokens** out of a 12000/15m bucket — it fits
about 16 times per window, so the limiter is not the constraint. The constraints are: **~50–100 MB of JSON per
pull**, and the **300 s cache**, which means at most 12 meaningful pulls per hour. Doing this on every page load
is a non-starter; it's a background job at ≥5 min intervals, or don't do it at all (see fuzzwork below).

Page size of 1000 is the ESI convention — **UNVERIFIED live** (TQ down); if it's different the page counts scale
inversely.

### `GET /markets/{region_id}/history` — no auth

Query params: **`type_id` (REQUIRED)**. Path: `region_id`.

```
[]            : object
  date        : string(date)  REQUIRED  The date of this historical statistic entry
  average     : double        REQUIRED
  highest     : double        REQUIRED
  lowest      : double        REQUIRED
  volume      : int64         REQUIRED  Total
  order_count : int64         REQUIRED  Total number of orders happened that day
```

- **No `x-client-cache-ttl`**; description: *"This route expires daily at 11:05"* → a **daily** cache. Fetch once
  a day per (region, type) and store.
- One type per request, no pagination, ~400 days of history returned.
- No rate-limit group in the spec, but the error limit still applies — 404s on invalid region/type cost 5 tokens
  and 1 error slot each.

### `GET /markets/{region_id}/types` — worth knowing

`x-client-cache-ttl: 600`, paginated (`X-Pages`). *"Return a list of type IDs that have active orders in the
region, for efficient market indexing."* Bare `int64[]`. Use this to drive per-type `history`/`orders` pulls
instead of iterating the whole SDE.

### Fuzzwork market aggregates — the cheap alternative ✅ verified working

`https://market.fuzzwork.co.uk/aggregates/?region={regionOrSystemOrStationId}&types={csv}`

Verified live today (ESI was down; fuzzwork was fine):

```
GET https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=34,35,44992
→ 200, Cache-Control: public, max-age=300

{"34":{"buy" :{"weightedAverage":"2.93…","max":"3.85","min":"0.01","stddev":"1.04…",
               "median":"2.975","volume":"15207338606.0","orderCount":"56",
               "percentile":"3.672968832259853"},
       "sell":{"weightedAverage":"4.08…","max":"38420.0","min":"3.8",…}}, …}
```

- **`region=` also accepts a system ID or a station ID** (fuzzwork: *"you can give a station or a system as a
  region, and it will return correctly. These are all precalculated aggregates"*). `?station=60003760&types=34`
  works too — verified, and returns Jita-4-4-only numbers distinct from region-wide.
- **All numeric values are JSON strings**, not numbers. Parse with care.
- A type with no orders returns a block of **numeric `0`s** (not strings) — verified with `44992` (PLEX) in The
  Forge. Two different shapes for the same field. Handle both.
- **`percentile` is the field you actually want** — it's the 5%-volume-weighted price, the standard "realistic
  buy/sell" figure and what most appraisal tools use.
- **Cache: `max-age=300`** (5 min), same as ESI's order cache. Data lag observed ~35–60 min behind
  (`orderset` timestamps).
- **Batch limit: URI length, not a type count.** Verified: 800 types → 200 (2.2 s), 1300 types (5467-byte URL) →
  200, 2000 types → **`414 Request-URI Too Large`** (nginx). **Use batches of ≤1000 type IDs.**
- **No published rate limit.** Etiquette only, from the author's docs: *"I highly recommend pulling all the
  aggregates into one sheet, and then using vlookup… It's more efficient for both you and me"*, and, about
  polling the order book, *"Please don't do this every 30 minutes. Get the data yourself, direct from CCP. It'll
  be fresher and more reliable."* **UNVERIFIED**: no hard numeric limit is documented anywhere I could find.
- **Bulk alternative:** `https://market.fuzzwork.co.uk/aggregatecsv.csv.gz` — **6.5 MB gzipped, 285,779 rows**,
  covering every `(region|type|isBuy)` aggregate globally. Columns:
  `what,weightedaverage,maxval,minval,stddev,median,volume,numorders,fivepercent,orderSet` where `what` is
  `regionID|typeID|isBuy`. `https://market.fuzzwork.co.uk/api/orderset` returns the current orderset ID
  (`{"orderset":173097}`) — poll that cheaply to know whether the CSV changed. Also `structures.csv.gz`.

**Recommendation for Phase 4/5:** use **fuzzwork aggregates** (or the hourly bulk CSV) for "what is this worth"
pricing across many types — one request replaces ~371 ESI pages. Use **ESI `/markets/{region}/orders?type_id=`**
only when the user drills into a single type and needs the live order book, and **ESI `/markets/prices`** for
industry/insurance reference values. Keep a fuzzwork-down fallback to ESI, since fuzzwork is one person's server
with no SLA.

---

## 5. Scope audit vs. the app's `SCOPES`

`src/lib/auth/sso.ts:4-9` currently requests:

```
esi-skills.read_skills.v1  esi-skills.read_skillqueue.v1  esi-assets.read_assets.v1
esi-fittings.read_fittings.v1  esi-clones.read_clones.v1  esi-clones.read_implants.v1
esi-wallet.read_character_wallet.v1  esi-killmails.read_killmails.v1
esi-location.read_location.v1  esi-location.read_ship_type.v1
```

| Endpoint | Required scope | Covered? |
| --- | --- | --- |
| `/skills`, `/attributes` | `esi-skills.read_skills.v1` | ✅ |
| `/skillqueue` | `esi-skills.read_skillqueue.v1` | ✅ |
| `/assets`, `/assets/names`, `/assets/locations` | `esi-assets.read_assets.v1` | ✅ |
| `/fittings` (GET) | `esi-fittings.read_fittings.v1` | ✅ |
| `/clones` | `esi-clones.read_clones.v1` | ✅ |
| `/implants` | `esi-clones.read_implants.v1` | ✅ |
| `/wallet`, `/wallet/journal`, `/wallet/transactions` | `esi-wallet.read_character_wallet.v1` | ✅ |
| `/killmails/recent` | `esi-killmails.read_killmails.v1` | ✅ |
| `/location` | `esi-location.read_location.v1` | ✅ |
| `/ship` | `esi-location.read_ship_type.v1` | ✅ |
| **`/online`** | **`esi-location.read_online.v1`** | ❌ **MISSING** |
| **`/universe/structures/{id}`** | **`esi-universe.read_structures.v1`** | ❌ **MISSING** |

Two gaps. Both are additive and require re-authorisation of every character (SSO scope grants are immutable per
refresh token), so **add them now, before users onboard**, rather than after.

Note `/universe/names`, `/universe/stations/{id}`, `/markets/*`, and `/killmails/{id}/{hash}` are all **public**
— no scope, no token. `EsiClient.get()` only attaches `Authorization` when `characterId` is passed, so call these
without it and they'll also share the public IP-based rate-limit bucket rather than a character's.

---

## 6. Phase 7 — combat / killmails

### `GET /characters/{character_id}/killmails/recent` (paginated)

Scope `esi-killmails.read_killmails.v1`, cache **300 s**, `X-Pages`, rate-limit group **`char-killmail` = 30
tokens / 15 min** (≈15 requests/15 min — the tightest bucket in the whole app).

```
[]             : object
  killmail_id  : int64  REQUIRED  ID of this killmail
  killmail_hash: string REQUIRED  A hash of this killmail
```

**Gotcha: CCP: *"Return a list of a character's kills and losses going back 90 days."*** That's the hard window —
anything older must come from zKillboard.

### `GET /killmails/{killmail_id}/{killmail_hash}` — public, no scope

Cache **`x-client-cache-ttl: 2592000` = 30 days** (killmails are immutable). Rate-limit group `killmail`, **3600
tokens / 15 min** — generous, ~1800 fetches per window.

```
killmail_id      : int64             REQUIRED
killmail_time    : string(date-time) REQUIRED
solar_system_id  : int64             REQUIRED
moon_id          : int64             optional  Moon if the kill took place at one
war_id           : int64             optional  War if generated in relation to an official war
victim           : object            REQUIRED
  character_id   : int64             optional
  corporation_id : int64             optional
  alliance_id    : int64             optional
  faction_id     : int64             optional
  damage_taken   : int64             REQUIRED
  ship_type_id   : int64             REQUIRED
  position       : object            optional  { x,y,z: double }  Cartesian, relative to the Sun
  items          : array             optional
    item_type_id       : int64  REQUIRED
    flag               : int64  REQUIRED   ⚠️ NUMERIC flag, not the string enum
    singleton          : int64  REQUIRED   ⚠️ integer, not bool
    quantity_destroyed : int64  optional
    quantity_dropped   : int64  optional
    items              : array  optional   ⚠️ ONE level of nesting (container contents)
      item_type_id, flag, singleton, quantity_destroyed, quantity_dropped
attackers        : array             REQUIRED
  character_id   : int64  optional
  corporation_id : int64  optional
  alliance_id    : int64  optional
  faction_id     : int64  optional
  damage_done    : int64  REQUIRED
  final_blow     : bool   REQUIRED
  security_status: double REQUIRED
  ship_type_id   : int64  optional   What ship was the attacker flying
  weapon_type_id : int64  optional   What weapon was used by the attacker for the kill
```

**Gotchas:**

- **`victim.items[].flag` is an `int64`, NOT the string `location_flag` enum.** It's the raw SDE
  `invFlags.flagID`. `HiSlot0..7` = 27–34, `MedSlot0..7` = 19–26, `LoSlot0..7` = 11–18, `RigSlot0..2` = 92–94,
  `SubSystemSlot0..3` = 125–128, `DroneBay` = 87, `Cargo` = 5. (**Numeric values UNVERIFIED against a current SDE
  in this session** — they're the long-standing `invFlags` IDs; validate against the SDE before relying on them.)
  Do not try to reuse the assets/fittings string enum here.
- **`singleton` is an integer, not a boolean** (`0`/`1`, sometimes `2` for a "copy" blueprint).
- **`items` nests exactly one level** — a container's contents. Flatten with that in mind; there is no arbitrary
  recursion in the schema.
- `quantity_destroyed` and `quantity_dropped` are both optional; exactly one is normally present.
- `victim.character_id` is **absent** for structure/POS/NPC losses. Same for attackers (NPC attackers have
  `faction_id` but no `character_id`).
- `attackers[].ship_type_id` and `weapon_type_id` are optional — a pod-less or "no ship" attacker record.
- The `(id, hash)` pair is the only way in; the hash comes from `/characters/.../killmails/recent` or zKB.

### zKillboard — for anything older than 90 days

Base `https://zkillboard.com/api/`. Docs: `https://zkillboard.com/api/docs/` (the GitHub wiki page
`API-(Killmails)` is now explicitly marked *"retained for historical reference"* and points here).

**Etiquette / requirements (from the docs, all confirmed):**

- **Send a descriptive `User-Agent`** with a maintainer contact or project URL. Example format:
  `MyApp/1.0 (you@example.com; +https://eve.example.com)`.
- **Send `Accept-Encoding: gzip`** (use `curl --compressed` / fetch default).
- Cache locally and space repeated requests out. *"Do not hammer the server with API requests. Be polite."*
- **A trailing slash is required**; requests without it silently fail.
- **No hard published rate limit** — etiquette only. **UNVERIFIED**: no numeric req/s figure is documented for
  the main `zkillboard.com/api/` host.

**Killmail query endpoint:** `GET /api/{modifiers}/`

- **Cache: 1-hour client cache.**
- **Up to 200 killmails per page**, `page/{N}/` with **N = 1..100** ⇒ **max ~20,000 killmails per filter**.
  (Verified: `.../kills/characterID/1633218082/` returned exactly 200 records.) Note this contradicts the old
  wiki's "maximum of 1000 killmails per request" — trust the current docs and the observed 200.
- Modifiers are **path segments** in any order; **query strings are not accepted**.
- Relevant modifiers: `kills` / `losses` (omit both for either side), `characterID/{id}`, `corporationID/{id}`,
  `allianceID/{id}`, `shipTypeID/{id}`, `groupID/{id}`, `solarSystemID/{id}` (alias `systemID`),
  `constellationID/{id}`, `regionID/{id}`, `locationID/{id}`, `warID/{id}`, `killID/{id}`,
  `highsec|lowsec|nullsec|w-space|abyssal`, `solo`, `ganked`, `awox/{0|1}`, `npc/{0|1}`, `label/{label}`,
  `finalblow-only`, `iskValue/{n}` (must be a positive multiple of 500,000,000),
  `pastSeconds/{s}` (≤604800, one-hour increments), `year/{YYYY}/month/{M}`, `page/{N}`, `pretty`.
  Entity/`pastSeconds`/`year`/`page` modifiers must come **after** an entity filter.
- **Response shape (verified live):** the **full ESI killmail** plus a `zkb` block — you do **not** need a second
  ESI call for the body:

```json
{ "killmail_id": 100000001, "killmail_time": "2022-04-07T04:27:41Z", "solar_system_id": 30002320,
  "victim": { … ESI victim + items … }, "attackers": [ … ESI attackers … ],
  "zkb": { "locationID": 40147768, "hash": "349571831ca127c015bc34050b4c02b29927827d",
           "fittedValue": 10000, "droppedValue": 0, "destroyedValue": 60633419.79,
           "totalValue": 60633419.79, "totalDroppableValue": 60623419.79, "points": 1,
           "npc": false, "solo": false, "awox": false,
           "labels": ["#:2+","cat:6","loc:nullsec","pvp","tz:usw","isk:under1b"] } }
```

  `zkb.hash` is the ESI killmail hash — so zKB doubles as a hash source for `GET /killmails/{id}/{hash}`.
- **Killmails younger than five minutes are withheld** from this API.
- Legacy modifiers **disabled**: `zkbOnly`, `no-attackers`, `no-items`, `asc`, `desc`, `json`, `xml`, `limit`,
  `orderDirection`, `startTime`/`endTime`, `beforeKillID`/`afterKillID`, and comma-separated multi-entity IDs.
- Wildcard CORS header is set.

**Bulk archive (better than paging for a backfill)** — host `r2z2.zkillboard.com`, all 1-day cache:

- `GET /history/{YYYYMMDD}.json` — **every killmail ID + hash for a UTC date.** This is the right way to rebuild
  history: pull the index, then fetch bodies from ESI's 30-day-cached `/killmails/{id}/{hash}` (public, 3600
  tokens/15m).
- `GET /history/raw/{YYYYMMDD}.json` — full killmail bodies for a UTC date.
- `GET /history/totals.json` — per-date counts, so you can detect changed/missing days.
- Live feed: `GET /ephemeral/sequence.json` → `{"sequence": N}`, then fetch `/ephemeral/{N}.json` and increment
  until 404. **Up to 15 requests/second/IP, non-empty User-Agent required, wait ≥6 s after a 404.** Pointer
  updates every 51 killmails; files live ≥24 h.

**Other zKB endpoints:** `GET /api/stats/{entityType}/{entityID}/{sort}/` (10-min server cache) and
`GET /api/prices/{typeID}/` (10-min cache, daily price history + `currentPrice` used for kill valuation).
Note `/api/stats/...` returned a **302** for me — it may now require a browser/session; **UNVERIFIED**.

**Recommended combat strategy:** ESI `/killmails/recent` (90 days, but only 30 tokens/15m) for the live
character-owned window; zKB `/api/{kills|losses}/characterID/{id}/` for the 20,000-killmail backfill;
`r2z2 /history/{date}.json` if you ever need a complete corp/alliance archive. Store `(killmail_id,
killmail_hash)` as the primary key — it's stable across all three sources.

---

## 7. Notes on the existing `EsiClient` (`src/lib/esi/client.ts`)

Things this research says need attention before Phase 3:

1. **No `post()` method.** `/universe/names`, `/assets/names`, `/assets/locations` are all POST. Required.
2. **No `from_id` cursor support.** `getAll()` only does `?page=` + `X-Pages`;
   `/wallet/transactions` needs a separate cursor loop.
3. **Required query params aren't enforced.** `/markets/{region}/orders` needs `order_type`,
   `/markets/{region}/history` needs `type_id`. Omitting → 400 → 5 rate-limit tokens + 1 error-limit slot.
4. **5xx is not retried and consumes the error limit.** Verified: 504s decrement
   `X-ESI-Error-Limit-Remain`. The client throws `EsiError` on any `!res.ok`, so a sync run during a TQ outage
   hard-fails *and* burns error budget. Add: read `X-ESI-Error-Limit-Remain`, back off when it's low (say <20),
   and treat 502/503/504 as "ESI is down, stop the whole sync" rather than per-request failures.
5. **Rate-limit bookkeeping is global per group, but ESI's buckets are per `(group, app:character)`.** The
   `groupWait` map will throttle character B because character A hit the same group. Key it on
   `(group, characterId)`.
6. `pathGroup` is keyed on the full pathname (which embeds `character_id`), so the group is never known before
   the first request to a given character+route. Keying on the route *template* would let the first request
   benefit from a known group.
7. **No `Last-Modified` consistency check across pages** in `getAll()` (docs recommend it — §1.1).
8. `EsiClient` requires `X-Compatibility-Date` on every request — correct, it's a required header in the spec.
   But see §0 about pinning it to a published date.
9. POST routes return **no cache headers**, so any `post()` added must not rely on `Expires` — it needs an
   explicit app-chosen TTL.

---

## 8. `location_flag` enum values

There are **three different flag vocabularies**. Do not share a type between them.

### 8a. Assets — `location_flag` (`GET /characters/{id}/assets`) — 89 values

Verified identical between the spec and `types.gen.ts:3912`.

```
AssetSafety, AutoFit, BoosterBay, CapsuleerDeliveries, Cargo, CorporationGoalDeliveries, CorpseBay,
Deliveries, DroneBay, ExpeditionHold, FighterBay, FighterTube0, FighterTube1, FighterTube2, FighterTube3,
FighterTube4, FleetHangar, FrigateEscapeBay, Hangar, HangarAll,
HiSlot0..HiSlot7, HiddenModifiers, Implant, InfrastructureHangar,
LoSlot0..LoSlot7, Locked, MedSlot0..MedSlot7,
MobileDepotHold, MoonMaterialBay, QuafeBay,
RigSlot0..RigSlot7, ShipHangar, Skill,
SpecializedAmmoHold, SpecializedAsteroidHold, SpecializedCommandCenterHold, SpecializedFuelBay,
SpecializedGasHold, SpecializedIceHold, SpecializedIndustrialShipHold, SpecializedLargeShipHold,
SpecializedMaterialBay, SpecializedMediumShipHold, SpecializedMineralHold, SpecializedOreHold,
SpecializedPlanetaryCommoditiesHold, SpecializedSalvageHold, SpecializedShipHold, SpecializedSmallShipHold,
StructureDeedBay, SubSystemBay, SubSystemSlot0..SubSystemSlot7, Unlocked, Wardrobe
```

Notes: **`RigSlot0..7`** and **`SubSystemSlot0..7`** here (assets), not 0..2 / 0..3. **No `ServiceSlot*`** in the
asset enum. `InfrastructureHangar` and `MoonMaterialBay` were **added in compat date `2024-07-11` as a
non-breaking change** — proof that this enum grows without a compat-date bump.

### 8b. Fittings — `flag` (`GET /characters/{id}/fittings`) — 43 values

Verified identical between spec and `types.gen.ts:4282`.

```
Cargo, DroneBay, FighterBay,
HiSlot0..HiSlot7, Invalid, LoSlot0..LoSlot7, MedSlot0..MedSlot7,
RigSlot0, RigSlot1, RigSlot2,
ServiceSlot0..ServiceSlot7,
SubSystemSlot0, SubSystemSlot1, SubSystemSlot2, SubSystemSlot3
```

Differences from the asset enum: **has `Invalid` and `ServiceSlot0..7`**; **capped at `RigSlot2` and
`SubSystemSlot3`**; **no** `Hangar`, `AssetSafety`, `Implant`, `Specialized*`, `FighterTube*`, etc.

### 8c. Corporation assets — `location_flag` (`types.gen.ts:5374`)

A third, larger superset (125 values) adding `CorpSAG1..7`, `OfficeFolder`, `Impounded`, `QuantumCoreRoom`,
`StructureFuel`, `StructureActive/Inactive/Offline`, `ServiceSlot0..7`, `Wallet`, `Pilot`, `PlanetSurface`, and
Dust-era leftovers. Not needed for Phase 3 (character-only) but don't accidentally type character assets with it.

### 8d. Killmails — numeric `flag`

See §6 — `victim.items[].flag` is an `int64` SDE `invFlags.flagID`, a completely separate vocabulary.

---

## 9. What could not be verified

Marked honestly, not guessed:

1. **ESI page size (records per page) for `X-Pages` routes.** Believed to be **1000** (long-standing ESI
   convention, and the basis for the ~371-page Forge figure), but I could not get a single 200 from any
   paginated ESI route — Tranquility was returning `504 {"error":"Timeout contacting tranquility"}` on every
   cache MISS throughout this session. **UNVERIFIED.**
2. **Live `X-Pages` for `/markets/10000002/orders`.** Same reason. The ~371 figure is *derived* from fuzzwork's
   real order counts ÷ an assumed 1000/page, not read off a response header.
3. **`/wallet/transactions` batch size.** Historically 2560 entries per `from_id` page; not stated in the spec
   and not testable without a character token. **UNVERIFIED.**
4. **`POST /universe/names` all-or-nothing 404 on any invalid ID.** Long-standing documented ESI behaviour, but
   not re-tested today (TQ down). **UNVERIFIED.**
5. **Live `Expires` for `/markets/{region}/history`, `/universe/stations/{id}`, `/markets/groups*`.** These have
   no `x-client-cache-ttl`; the description says *"This route expires daily at 11:05"*. The exact `Expires`
   header was not observable. Treat as a daily cache.
6. **Numeric `invFlags` IDs for killmail item flags** (27–34 = HiSlot0-7, etc.). These are the well-known SDE
   values but I did not cross-check them against a current SDE in this session. **UNVERIFIED — validate before
   use.**
7. **Hard rate limits for fuzzwork and for `zkillboard.com/api/`.** Neither publishes numeric limits; only
   etiquette guidance. The one numeric limit that *is* published is for `r2z2.zkillboard.com`: 15 req/s/IP.
   **UNVERIFIED** for the others.
8. **`https://stop.hammerti.me.uk/api/structure/{id}`** (the community "Citadel API" structure-name fallback)
   **failed to connect** (curl exit, no HTTP response). Possibly permanently gone, possibly a transient outage.
   **UNVERIFIED.**
9. **`zkillboard.com/api/stats/{type}/{id}/`** returned **302** rather than JSON for me, despite being in the
   current docs. May now need a session or a different host. **UNVERIFIED.**
10. **No token was available**, so no authenticated ESI route in §2 was exercised live. All character-endpoint
    schemas, scopes, cache TTLs and rate-limit groups come from the OpenAPI spec (authoritative) rather than from
    observed responses.
11. **ESI operational state at time of writing:** `GET /status` → `502`; every TQ-backed route → `504`. Only
    already-cached responses (e.g. `/markets/prices`, `/universe/structures`, `/meta/*`) served 200s. Worth
    re-running the live probes in §4 once ESI recovers to confirm page sizes.
