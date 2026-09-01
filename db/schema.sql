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
