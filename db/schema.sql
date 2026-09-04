-- EVE schema. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS accounts (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id                bigint PRIMARY KEY,                 -- EVE character_id
  name              text NOT NULL,
  account_id        int REFERENCES accounts(id) ON DELETE SET NULL,
  corporation_id    int,
  corporation_name  text,
  alliance_id       int,
  alliance_name     text,
  race_id           int,                                -- ESI race_id; joins sde_races for the name
  refresh_token_enc text NOT NULL,
  scopes            text[] NOT NULL DEFAULT '{}',
  token_status      text NOT NULL DEFAULT 'ok' CHECK (token_status IN ('ok', 'needs_reauth')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz
);

-- character_id 0 = public (unauthenticated) routes.
CREATE TABLE IF NOT EXISTS esi_cache (
  character_id  bigint NOT NULL DEFAULT 0,
  path          text NOT NULL,
  etag          text,
  expires_at    timestamptz,
  pages         int NOT NULL DEFAULT 1,
  body          jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, path)
);
ALTER TABLE esi_cache ADD COLUMN IF NOT EXISTS last_modified text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS race_id int;

CREATE TABLE IF NOT EXISTS sync_runs (
  id            bigserial PRIMARY KEY,
  job           text NOT NULL,
  character_id  bigint REFERENCES characters(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error')),
  rows          int,
  error         text
);
CREATE INDEX IF NOT EXISTS sync_runs_latest_idx ON sync_runs (job, character_id, started_at DESC);

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
-- `typesOfInterest` (src/lib/market/interest.ts) scans this table by `date` alone, across every
-- character, to find recently-traded types; the index above is useless there because it leads on
-- `character_id`. A covering index on `date` alone (with `type_id` along for the ride) lets that
-- scan stay index-only.
CREATE INDEX IF NOT EXISTS character_wallet_transactions_interest_idx
  ON character_wallet_transactions (date) INCLUDE (type_id);

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

-- ── Phase 5: the fitting designer ───────────────────────────────────────────
-- Our own fits. They are never pushed to ESI (spec §2 ruling); export is by EFT text.
-- character_id chooses WHOSE SKILLS the numbers use; NULL means the "All skills V" pilot, which is
-- also what a deleted character degrades to.
CREATE TABLE IF NOT EXISTS fits (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  ship_type_id  int NOT NULL,
  description   text NOT NULL DEFAULT '',
  character_id  bigint REFERENCES characters(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- idx is the position in the document, so the editor's order survives a round trip.
CREATE TABLE IF NOT EXISTS fit_items (
  fit_id          int NOT NULL REFERENCES fits(id) ON DELETE CASCADE,
  idx             int NOT NULL,
  type_id         int NOT NULL,
  quantity        int NOT NULL DEFAULT 1,
  flag            text NOT NULL,
  charge_type_id  int,
  state           text NOT NULL DEFAULT 'active' CHECK (state IN ('offline','online','active','overload')),
  PRIMARY KEY (fit_id, idx)
);
CREATE INDEX IF NOT EXISTS fits_updated_idx ON fits (updated_at DESC);

-- ── Phase 6: the skill planner ──────────────────────────────────────────────
-- EVEMon-style plans. A plan belongs to exactly one character and dies with it: without a pilot
-- there are no attributes, no implants and no queue, so there is nothing left to compute.
-- remap is NULL, or the five BASE attribute values the plan assumes (each 17..27, summing to 99).
CREATE TABLE IF NOT EXISTS skill_plans (
  id            serial PRIMARY KEY,
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name          text NOT NULL,
  remap         jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_plans_character_idx ON skill_plans (character_id, updated_at DESC);

-- position is the training order, dense from 0; a PUT replaces the whole list.
CREATE TABLE IF NOT EXISTS skill_plan_entries (
  plan_id   int NOT NULL REFERENCES skill_plans(id) ON DELETE CASCADE,
  position  int NOT NULL,
  skill_id  int NOT NULL,
  level     int NOT NULL CHECK (level BETWEEN 1 AND 5),
  note      text,
  PRIMARY KEY (plan_id, position)
);

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

-- User-managed character tags (e.g. "Miner", "Scanner") — Daniel creates the categories himself.
CREATE TABLE IF NOT EXISTS character_tags (
  id    serial PRIMARY KEY,
  name  text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS character_tag_map (
  character_id  bigint NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  tag_id        int NOT NULL REFERENCES character_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (character_id, tag_id)
);
