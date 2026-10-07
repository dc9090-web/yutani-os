# EVE Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed Midnight-themed Next.js site at `https://eve.plasma66.com` where Daniel logs in with EVE SSO for each of four characters, sees them on an Overview page, manages accounts/characters in Settings, and a worker keeps their corp/alliance info fresh via ESI.

**Architecture:** One Next.js 16 app (UI + route handlers) and one `tsx` worker process share a Postgres 17 database. All EVE traffic goes through one ESI client that handles token refresh, ETag/Expires caching and rate limits. Pages read only from Postgres. Traefik terminates TLS (Cloudflare DNS-01) on the VM; Ansible provisions the VM and deploys via Docker Compose.

**Tech Stack:** Next.js 16.3, React 19, Mantine 9.6, @tabler/icons-react, pg 8, jose 6 (JWT/JWKS), openapi-typescript 7 (ESI types), vitest 4 + happy-dom + Testing Library, tsx, TypeScript 6 strict, Docker Compose, Traefik v3.6, Ansible.

**Spec:** `docs/superpowers/specs/2026-09-01-eve-foundation-design.md`

## Global Constraints

- Ports of Animal's Midnight theme: `theme.ts`, `fonts.ts`, and the `:root` token block of `globals.css` are copied **verbatim** from `/home/daniel/AI/Plasma/Animal/src/app/`; accent `#4d8dff`, page bg `#070d1c`, card `#0e1830`, column `1123px`, header `80px`, mobile breakpoint `760px`.
- Never inline colours in components — use the CSS variables (`--card`, `--border`, `--accent`, …).
- `.env` is git-ignored and already exists locally with real values; never commit it, never print `EVE_CLIENT_SECRET`, `SESSION_SECRET`, or `POSTGRES_PASSWORD`.
- Allow-listed character IDs: `90000101,90000102,90000103,90000104`.
- ESI base `https://esi.evetech.net`; header `X-Compatibility-Date` from env `ESI_COMPATIBILITY_DATE` (`2026-08-28`); `User-Agent` from env `ESI_USER_AGENT`.
- SSO scopes (exact string, space-separated): `esi-skills.read_skills.v1 esi-skills.read_skillqueue.v1 esi-assets.read_assets.v1 esi-fittings.read_fittings.v1 esi-clones.read_clones.v1 esi-clones.read_implants.v1 esi-wallet.read_character_wallet.v1 esi-killmails.read_killmails.v1 esi-location.read_location.v1 esi-location.read_ship_type.v1`
- Route guard is `src/proxy.ts` (`export function proxy`) — Next 16 naming, not `middleware.ts`.
- Imports between local TS files use the `.js` extension (Animal convention; `extensionAlias` in `next.config.ts`).
- Every task ends with a commit on `main` (single-developer repo, no branches needed). Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Tests: `npm test` (vitest). DB tests need the local Postgres from `compose.dev.yml` and `DATABASE_URL` pointing at the `eve_test` database.
- VM: `ssh daniel@10.5.5.150` (key auth, passwordless sudo). Tailscale IP `100.114.208.10`. Domain `eve.plasma66.com` already resolves to it.

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` | Toolchain, mirrors Animal |
| `src/app/theme.ts`, `src/app/fonts.ts`, `src/app/globals.css` | Midnight design system |
| `src/app/layout.tsx` | Root layout: fonts, Mantine provider, loads session + characters, renders `Shell` |
| `src/config/nav.ts` | Nav model (7 destinations) + `isNavActive` |
| `src/app/components/Shell.tsx`, `AppHeader.tsx`, `TopNav.tsx`, `BottomBar.tsx`, `AppFooter.tsx`, `CharacterSwitcher.tsx`, `ComingSoon.tsx` | Shell chrome |
| `src/app/page.tsx` | Overview |
| `src/app/login/page.tsx` | Login card |
| `src/app/settings/page.tsx` + `settings/*.tsx` | Accounts, characters, sync status |
| `src/app/{skills,ships,fitting,assets,wallet,combat}/page.tsx` | Placeholders |
| `src/app/auth/{start,callback,logout,switch}/route.ts` | SSO + session route handlers |
| `src/app/api/accounts/route.ts`, `api/accounts/[id]/route.ts`, `api/characters/[id]/route.ts`, `api/health/route.ts` | JSON API |
| `src/proxy.ts` | Redirects unauthenticated requests to `/login` |
| `src/lib/config.ts` | Typed env loading |
| `src/lib/db/client.ts` | pg pool |
| `src/lib/db/accounts.ts`, `characters.ts`, `esi-cache.ts`, `sync-runs.ts` | One repo module per table |
| `src/lib/auth/crypto.ts` | AES-256-GCM for refresh tokens |
| `src/lib/auth/session.ts` | Signed session + OAuth-state cookies |
| `src/lib/auth/sso.ts` | SSO metadata, PKCE, authorize URL, code exchange, refresh, JWT verify |
| `src/lib/auth/flow.ts` | `startLogin` / `completeLogin` (pure, testable) |
| `src/lib/esi/client.ts` | `EsiClient` — cache, rate limits, pagination |
| `src/lib/esi/tokens.ts` | `TokenStore` — access-token cache + refresh + `needs_reauth` |
| `src/lib/esi/types.gen.ts` | Generated from the OpenAPI spec |
| `src/worker/scheduler.ts`, `src/worker/index.ts`, `src/worker/jobs/character-info.ts` | Sync worker |
| `scripts/migrate.ts`, `scripts/esi-types.ts` | CLI scripts |
| `db/schema.sql`, `db/init/01-test-db.sql` | Schema; creates `eve_test` DB in the dev container |
| `compose.dev.yml` | Local Postgres for tests/dev |
| `Dockerfile`, `.dockerignore`, `deploy/docker-compose.yml` | Production image + stack |
| `deploy/ansible/**` | VM provisioning (common, docker, traefik, eve roles) |

---

### Task 1: Project scaffold with Midnight theme

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `tests/setup.ts`, `next-env.d.ts` (generated), `src/app/theme.ts`, `src/app/fonts.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/config/nav.ts`, `tests/nav.test.ts`, `public/eve-mark.svg`
- Modify: `.gitignore` (add `tsconfig.tsbuildinfo`, `next-env.d.ts`)

**Interfaces:**
- Produces: `NAV_ITEMS: NavItem[]`, `isNavActive(item: NavItem, pathname: string): boolean`, `type NavKey = "overview"|"skills"|"ships"|"fitting"|"assets"|"wallet"|"combat"`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "eve",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --webpack -p 3000",
    "build": "next build --webpack",
    "start": "next start -p 3000",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "migrate": "tsx scripts/migrate.ts",
    "esi:types": "tsx scripts/esi-types.ts",
    "worker": "tsx src/worker/index.ts"
  },
  "dependencies": {
    "@mantine/core": "^9.6.0",
    "@mantine/hooks": "^9.6.0",
    "@tabler/icons-react": "^3.46.0",
    "jose": "^6.2.10",
    "next": "^16.3.4",
    "pg": "^8.23.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^24.0.0",
    "@types/pg": "^8.20.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "happy-dom": "^20.12.0",
    "openapi-typescript": "^7.13.0",
    "tsx": "^4.23.13",
    "typescript": "^6.0.3",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `tests/setup.ts`**

`tsconfig.json` — copy `/home/daniel/AI/Plasma/Animal/tsconfig.json` verbatim (ES2022, `moduleResolution: Bundler`, strict, `paths: {"@/*": ["./src/*"]}`, next plugin).

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    extensionAlias: { ".js": [".ts", ".tsx", ".js", ".jsx"], ".mjs": [".mts", ".mjs"] },
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "happy-dom", setupFiles: ["./tests/setup.ts"], globals: true, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

`tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Install and verify toolchain**

Run: `npm install && npx tsc --version`
Expected: installs cleanly; prints a 6.x TypeScript version.

- [ ] **Step 4: Copy the Midnight theme**

Copy `/home/daniel/AI/Plasma/Animal/src/app/theme.ts` and `fonts.ts` verbatim to `src/app/`. Create `src/app/globals.css` with the `:root` token block, the `*`/`html`/`body` reset, the `.app-header`, `.app-bar-inner`, `.logo-lockup`, `.logo-divider`, `.wordmark`, `.top-nav`, `.nav-link*`, `.user-menu`, `.user-avatar`, `.user-name`, `.user-caret`, `.app-main`, `.app-footer*`, `.bottom-bar` block (including the `@media (max-width: 760px)` rules), `@keyframes gradFlow`, the `.login-*` rules (lines 535–545 of Animal's file), and the `@media (prefers-reduced-motion)` rule — all copied verbatim from Animal's `globals.css`. Then append EVE-specific rules:

```css
/* ---------- EVE additions ---------- */
.logo-text { font-family: var(--font-poppins), sans-serif; font-weight: 700; font-size: 20px; letter-spacing: 1px; color: var(--text); }
.char-avatar { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--divider); object-fit: cover; background: var(--raised); }
.char-avatar.warn { border-color: var(--neg); }
.char-group-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--faint); padding: 6px 12px 2px; }
.page-title { font-family: var(--font-poppins), sans-serif; font-weight: 600; font-size: 32px; line-height: 1.1; margin: 0 0 8px; color: var(--text); }
.page-sub { margin: 0 0 24px; font-size: 13px; color: var(--faint); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px; }
.card-title { font-family: var(--font-poppins), sans-serif; font-weight: 600; font-size: 16px; color: var(--text); margin: 0 0 14px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
.muted { color: var(--muted); } .faint { color: var(--faint); } .pos { color: var(--pos); } .neg { color: var(--neg); }
.char-card { display: flex; gap: 16px; align-items: center; }
.char-card img { width: 64px; height: 64px; border-radius: 12px; border: 1px solid var(--divider); }
.char-card h3 { margin: 0; font-family: var(--font-poppins), sans-serif; font-size: 18px; font-weight: 600; }
.char-card p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
.coming-soon { text-align: center; padding: 64px 24px; color: var(--faint); }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th { text-align: left; font-weight: 500; color: var(--faint); padding: 8px 10px; border-bottom: 1px solid var(--border); }
.table td { padding: 10px; border-bottom: 1px solid var(--hairline); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
.badge.ok { background: rgba(52,211,153,.14); color: var(--pos); }
.badge.error, .badge.needs_reauth { background: rgba(247,109,122,.14); color: var(--neg); }
.badge.running { background: rgba(77,141,255,.14); color: var(--accent); }
.sso-btn { display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; text-decoration: none; }
.sso-btn:hover { background: var(--accent-2); }
```

Create `public/eve-mark.svg` (a simple 32×32 ring mark in the accent colour):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#4d8dff" stroke-width="3"/><circle cx="16" cy="16" r="4" fill="#4d8dff"/></svg>
```

- [ ] **Step 5: Write the failing nav test**

`tests/nav.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NAV_ITEMS, isNavActive } from "../src/config/nav.js";

describe("nav", () => {
  it("has the seven fixed destinations in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["overview", "skills", "ships", "fitting", "assets", "wallet", "combat"]);
  });
  it("overview is active only on /", () => {
    const overview = NAV_ITEMS[0];
    expect(isNavActive(overview, "/")).toBe(true);
    expect(isNavActive(overview, "/ships")).toBe(false);
  });
  it("section items are active on their prefix", () => {
    const ships = NAV_ITEMS.find((i) => i.key === "ships")!;
    expect(isNavActive(ships, "/ships")).toBe(true);
    expect(isNavActive(ships, "/ships/123")).toBe(true);
    expect(isNavActive(ships, "/skills")).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/nav.test.ts`
Expected: FAIL — cannot resolve `../src/config/nav.js`.

- [ ] **Step 7: Implement `src/config/nav.ts`**

```ts
export type NavKey = "overview" | "skills" | "ships" | "fitting" | "assets" | "wallet" | "combat";
export interface NavItem { key: NavKey; label: string; shortLabel: string; href: string }

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", shortLabel: "Home", href: "/" },
  { key: "skills", label: "Skills", shortLabel: "Skills", href: "/skills" },
  { key: "ships", label: "Ships", shortLabel: "Ships", href: "/ships" },
  { key: "fitting", label: "Fitting", shortLabel: "Fit", href: "/fitting" },
  { key: "assets", label: "Assets", shortLabel: "Assets", href: "/assets" },
  { key: "wallet", label: "Wallet", shortLabel: "Wallet", href: "/wallet" },
  { key: "combat", label: "Combat", shortLabel: "Combat", href: "/combat" },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}
```

- [ ] **Step 8: Minimal layout and page so `next build` passes**

`src/app/layout.tsx`:
```tsx
import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { inter, poppins, spaceGrotesk } from "./fonts.js";
import { theme } from "./theme.js";

export const metadata = { title: "EVE", description: "EVE Online command centre" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`} {...mantineHtmlProps}>
      <head><ColorSchemeScript forceColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">{children}</MantineProvider>
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Overview() {
  return <main className="app-main"><h1 className="page-title">Overview</h1></main>;
}
```

- [ ] **Step 9: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build`
Expected: nav tests PASS; typecheck clean; build succeeds (Google Fonts are fetched at build — needs internet).

- [ ] **Step 10: Commit**

```bash
printf 'tsconfig.tsbuildinfo\nnext-env.d.ts\n' >> .gitignore
git add -A && git commit -m "Scaffold Next.js app with Midnight theme and nav model"
```

---

### Task 2: Typed config

**Files:**
- Create: `src/lib/config.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces:
```ts
export interface AppConfig {
  eveClientId: string; eveClientSecret: string; eveCallbackUrl: string;
  allowedCharacterIds: Set<number>;
  esiBaseUrl: string; esiCompatibilityDate: string; esiUserAgent: string;
  sessionSecret: string; databaseUrl: string;
}
export function parseAllowedCharacterIds(raw: string | undefined): Set<number>
export function loadConfig(env?: NodeJS.ProcessEnv): AppConfig   // throws Error("Missing env: X, Y")
export function getConfig(): AppConfig                            // memoised loadConfig(process.env)
```

- [ ] **Step 1: Write the failing test**

`tests/config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadConfig, parseAllowedCharacterIds } from "../src/lib/config.js";

const full = {
  EVE_CLIENT_ID: "id", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://x/auth/callback",
  ALLOWED_CHARACTER_IDS: "1, 2,3", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua",
  SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x",
};

describe("config", () => {
  it("parses allow-list with spaces and ignores junk", () => {
    expect([...parseAllowedCharacterIds("1, 2,3,abc,")]).toEqual([1, 2, 3]);
    expect(parseAllowedCharacterIds(undefined).size).toBe(0);
  });
  it("loads a full env", () => {
    const c = loadConfig(full);
    expect(c.allowedCharacterIds.has(2)).toBe(true);
    expect(c.esiBaseUrl).toBe("https://esi.evetech.net");
  });
  it("names every missing variable", () => {
    const { EVE_CLIENT_SECRET: _a, DATABASE_URL: _b, ...rest } = full;
    expect(() => loadConfig(rest)).toThrow(/EVE_CLIENT_SECRET, DATABASE_URL/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/config.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/config.ts`**

```ts
export interface AppConfig {
  eveClientId: string; eveClientSecret: string; eveCallbackUrl: string;
  allowedCharacterIds: Set<number>;
  esiBaseUrl: string; esiCompatibilityDate: string; esiUserAgent: string;
  sessionSecret: string; databaseUrl: string;
}

const REQUIRED = ["EVE_CLIENT_ID", "EVE_CLIENT_SECRET", "EVE_CALLBACK_URL", "ALLOWED_CHARACTER_IDS",
  "ESI_COMPATIBILITY_DATE", "ESI_USER_AGENT", "SESSION_SECRET", "DATABASE_URL"] as const;

export function parseAllowedCharacterIds(raw: string | undefined): Set<number> {
  const out = new Set<number>();
  for (const part of (raw ?? "").split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return out;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
  return {
    eveClientId: env.EVE_CLIENT_ID!, eveClientSecret: env.EVE_CLIENT_SECRET!, eveCallbackUrl: env.EVE_CALLBACK_URL!,
    allowedCharacterIds: parseAllowedCharacterIds(env.ALLOWED_CHARACTER_IDS),
    esiBaseUrl: env.ESI_BASE_URL ?? "https://esi.evetech.net",
    esiCompatibilityDate: env.ESI_COMPATIBILITY_DATE!, esiUserAgent: env.ESI_USER_AGENT!,
    sessionSecret: env.SESSION_SECRET!, databaseUrl: env.DATABASE_URL!,
  };
}

let cached: AppConfig | undefined;
export function getConfig(): AppConfig { return (cached ??= loadConfig()); }
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/config.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add typed env config"`

---

### Task 3: Database schema, pool, migrate script, local Postgres

**Files:**
- Create: `db/schema.sql`, `db/init/01-test-db.sql`, `compose.dev.yml`, `src/lib/db/client.ts`, `scripts/migrate.ts`, `tests/db/helpers.ts`, `tests/db/schema.test.ts`

**Interfaces:**
- Produces: `getPool(): Pool` (reads `DATABASE_URL`), `applySchema(pool): Promise<void>` (idempotent), test helper `resetDb(): Promise<Pool>` that applies the schema and truncates all tables.

- [ ] **Step 1: Create `compose.dev.yml` and the test-DB init script**

`compose.dev.yml`:
```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: eve-dev-postgres
    environment:
      POSTGRES_USER: eve
      POSTGRES_PASSWORD: eve
      POSTGRES_DB: eve
    ports: ["127.0.0.1:5432:5432"]
    volumes:
      - eve_dev_pg:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
volumes:
  eve_dev_pg:
```

`db/init/01-test-db.sql`:
```sql
CREATE DATABASE eve_test OWNER eve;
```

Run: `docker compose -f compose.dev.yml up -d && sleep 4 && docker exec eve-dev-postgres psql -U eve -c '\l' | grep eve_test`
Expected: `eve_test` listed.

Note: the local `.env` `DATABASE_URL` uses a generated password; for local dev point it at this container instead: edit `.env` so `DATABASE_URL=postgres://eve:eve@127.0.0.1:5432/eve`. (The VM gets its own password from Ansible secrets.)

- [ ] **Step 2: Write `db/schema.sql`**

```sql
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
```

- [ ] **Step 3: Write `src/lib/db/client.ts` and `scripts/migrate.ts`**

`src/lib/db/client.ts`:
```ts
import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  }
  return pool;
}

/** Test-only: drop the memoised pool so the next getPool() reads a fresh DATABASE_URL. */
export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
```

`scripts/migrate.ts`:
```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Pool } from "pg";
import { getPool } from "../src/lib/db/client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const schemaPath = path.join(here, "..", "db", "schema.sql");

export async function applySchema(pool: Pool): Promise<void> {
  await pool.query(await readFile(schemaPath, "utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = getPool();
  applySchema(pool)
    .then(() => console.log("schema applied"))
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => pool.end());
}
```

- [ ] **Step 4: Write the DB test helper and failing schema test**

`tests/db/helpers.ts`:
```ts
import type { Pool } from "pg";
import { getPool, closePool } from "../../src/lib/db/client.js";
import { applySchema } from "../../scripts/migrate.js";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://eve:eve@127.0.0.1:5432/eve_test";

/** Points DATABASE_URL at eve_test, applies the schema, truncates every table. */
export async function resetDb(): Promise<Pool> {
  await closePool();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const pool = getPool();
  await applySchema(pool);
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts RESTART IDENTITY CASCADE");
  return pool;
}
```

`tests/db/schema.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { applySchema } from "../../scripts/migrate.js";
import { closePool } from "../../src/lib/db/client.js";
import type { Pool } from "pg";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(closePool);

describe("schema", () => {
  it("is idempotent", async () => {
    await applySchema(pool);
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
    expect(rows.map((r) => r.table_name)).toEqual(["accounts", "characters", "esi_cache", "sync_runs"]);
  });
  it("rejects an unknown token_status", async () => {
    await expect(pool.query("INSERT INTO characters (id, name, refresh_token_enc, token_status) VALUES (1, 'x', 'e', 'bogus')")).rejects.toThrow(/check/i);
  });
});
```

- [ ] **Step 5: Run** — `npx vitest run tests/db/schema.test.ts` — Expected: PASS (both tests; the first run creates the tables).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add Postgres schema, pool, migrate script and dev compose"`

---

### Task 4: Repository modules (accounts, characters, esi_cache, sync_runs)

**Files:**
- Create: `src/lib/db/accounts.ts`, `src/lib/db/characters.ts`, `src/lib/db/esi-cache.ts`, `src/lib/db/sync-runs.ts`, `tests/db/repos.test.ts`

**Interfaces:**
- Produces:
```ts
// accounts.ts
export interface Account { id: number; name: string }
export function listAccounts(): Promise<Account[]>
export function createAccount(name: string): Promise<Account>
export function renameAccount(id: number, name: string): Promise<void>
export function deleteAccount(id: number): Promise<void>

// characters.ts
export type TokenStatus = "ok" | "needs_reauth";
export interface Character { id: number; name: string; accountId: number | null; corporationId: number | null;
  corporationName: string | null; allianceId: number | null; allianceName: string | null;
  refreshTokenEnc: string; scopes: string[]; tokenStatus: TokenStatus; lastLoginAt: Date | null }
export function upsertCharacter(input: { id: number; name: string; refreshTokenEnc: string; scopes: string[] }): Promise<Character>
export function listCharacters(): Promise<Character[]>          // ordered by account_id NULLS LAST, name
export function getCharacter(id: number): Promise<Character | null>
export function setCharacterAccount(id: number, accountId: number | null): Promise<void>
export function updateCharacterInfo(id: number, info: { name: string; corporationId: number; corporationName: string; allianceId: number | null; allianceName: string | null }): Promise<void>
export function setTokenStatus(id: number, status: TokenStatus): Promise<void>
export function deleteCharacter(id: number): Promise<void>

// esi-cache.ts
export interface CacheEntry { etag: string | null; expiresAt: Date | null; pages: number; body: unknown }
export function getCached(characterId: number, path: string): Promise<CacheEntry | null>
export function putCached(characterId: number, path: string, entry: CacheEntry): Promise<void>

// sync-runs.ts
export interface SyncRunSummary { job: string; characterId: number | null; startedAt: Date; finishedAt: Date | null; status: "running"|"ok"|"error"; rows: number | null; error: string | null }
export function startRun(job: string, characterId: number | null): Promise<number>
export function finishRun(id: number, result: { status: "ok"|"error"; rows?: number; error?: string }): Promise<void>
export function latestRuns(): Promise<SyncRunSummary[]>          // latest row per (job, character_id)
```

- [ ] **Step 1: Write the failing tests**

`tests/db/repos.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createAccount, listAccounts, renameAccount, deleteAccount } from "../../src/lib/db/accounts.js";
import { upsertCharacter, listCharacters, getCharacter, setCharacterAccount, updateCharacterInfo, setTokenStatus, deleteCharacter } from "../../src/lib/db/characters.js";
import { getCached, putCached } from "../../src/lib/db/esi-cache.js";
import { startRun, finishRun, latestRuns } from "../../src/lib/db/sync-runs.js";

beforeEach(async () => { await resetDb(); });
afterAll(closePool);

const tril = { id: 90000101, name: "Mara Vexley", refreshTokenEnc: "enc1", scopes: ["esi-skills.read_skills.v1"] };

describe("accounts", () => {
  it("creates, lists, renames, deletes", async () => {
    const a = await createAccount("Main");
    await createAccount("Alt");
    expect((await listAccounts()).map((x) => x.name)).toEqual(["Alt", "Main"]);
    await renameAccount(a.id, "Primary");
    expect((await listAccounts()).find((x) => x.id === a.id)?.name).toBe("Primary");
    await deleteAccount(a.id);
    expect((await listAccounts()).length).toBe(1);
  });
});

describe("characters", () => {
  it("upsert is idempotent on id and refreshes token/scopes/name", async () => {
    await upsertCharacter(tril);
    const again = await upsertCharacter({ ...tril, name: "Trillium ONE", refreshTokenEnc: "enc2" });
    expect(again.name).toBe("Trillium ONE");
    expect(again.refreshTokenEnc).toBe("enc2");
    expect(again.tokenStatus).toBe("ok");
    expect((await listCharacters()).length).toBe(1);
  });
  it("re-login resets needs_reauth to ok", async () => {
    await upsertCharacter(tril);
    await setTokenStatus(tril.id, "needs_reauth");
    expect((await getCharacter(tril.id))!.tokenStatus).toBe("needs_reauth");
    await upsertCharacter(tril);
    expect((await getCharacter(tril.id))!.tokenStatus).toBe("ok");
  });
  it("assigns to an account and unassigns when the account is deleted", async () => {
    const a = await createAccount("Main");
    await upsertCharacter(tril);
    await setCharacterAccount(tril.id, a.id);
    expect((await getCharacter(tril.id))!.accountId).toBe(a.id);
    await deleteAccount(a.id);
    expect((await getCharacter(tril.id))!.accountId).toBeNull();
  });
  it("updates public info and deletes", async () => {
    await upsertCharacter(tril);
    await updateCharacterInfo(tril.id, { name: "Mara Vexley", corporationId: 98000001, corporationName: "Corp", allianceId: null, allianceName: null });
    expect((await getCharacter(tril.id))!.corporationName).toBe("Corp");
    await deleteCharacter(tril.id);
    expect(await getCharacter(tril.id)).toBeNull();
  });
});

describe("esi_cache", () => {
  it("round-trips and upserts", async () => {
    expect(await getCached(0, "/markets/prices")).toBeNull();
    await putCached(0, "/markets/prices", { etag: "a", expiresAt: new Date("2030-01-01"), pages: 1, body: [1] });
    await putCached(0, "/markets/prices", { etag: "b", expiresAt: null, pages: 2, body: [2] });
    const e = await getCached(0, "/markets/prices");
    expect(e).toMatchObject({ etag: "b", expiresAt: null, pages: 2, body: [2] });
  });
});

describe("sync_runs", () => {
  it("records runs and reports the latest per job/character", async () => {
    await upsertCharacter(tril);
    const r1 = await startRun("character-info", tril.id);
    await finishRun(r1, { status: "error", error: "boom" });
    const r2 = await startRun("character-info", tril.id);
    await finishRun(r2, { status: "ok", rows: 1 });
    const r3 = await startRun("prices", null);
    const latest = await latestRuns();
    expect(latest.length).toBe(2);
    const ci = latest.find((r) => r.job === "character-info")!;
    expect(ci.status).toBe("ok");
    expect(ci.rows).toBe(1);
    expect(latest.find((r) => r.job === "prices")!.status).toBe("running");
    expect(r3).toBeGreaterThan(r2);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/db/repos.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the four modules**

`src/lib/db/accounts.ts`:
```ts
import { getPool } from "./client.js";
export interface Account { id: number; name: string }

export async function listAccounts(): Promise<Account[]> {
  const { rows } = await getPool().query<Account>("SELECT id, name FROM accounts ORDER BY name");
  return rows;
}
export async function createAccount(name: string): Promise<Account> {
  const { rows } = await getPool().query<Account>("INSERT INTO accounts (name) VALUES ($1) RETURNING id, name", [name]);
  return rows[0];
}
export async function renameAccount(id: number, name: string): Promise<void> {
  await getPool().query("UPDATE accounts SET name = $2 WHERE id = $1", [id, name]);
}
export async function deleteAccount(id: number): Promise<void> {
  await getPool().query("DELETE FROM accounts WHERE id = $1", [id]);
}
```

`src/lib/db/characters.ts`:
```ts
import { getPool } from "./client.js";

export type TokenStatus = "ok" | "needs_reauth";
export interface Character {
  id: number; name: string; accountId: number | null;
  corporationId: number | null; corporationName: string | null;
  allianceId: number | null; allianceName: string | null;
  refreshTokenEnc: string; scopes: string[]; tokenStatus: TokenStatus; lastLoginAt: Date | null;
}

const COLS = `id, name, account_id AS "accountId", corporation_id AS "corporationId", corporation_name AS "corporationName",
  alliance_id AS "allianceId", alliance_name AS "allianceName", refresh_token_enc AS "refreshTokenEnc",
  scopes, token_status AS "tokenStatus", last_login_at AS "lastLoginAt"`;

function fix(r: Character): Character { return { ...r, id: Number(r.id) }; } // bigint comes back as string

export async function upsertCharacter(input: { id: number; name: string; refreshTokenEnc: string; scopes: string[] }): Promise<Character> {
  const { rows } = await getPool().query<Character>(
    `INSERT INTO characters (id, name, refresh_token_enc, scopes, last_login_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, refresh_token_enc = EXCLUDED.refresh_token_enc,
       scopes = EXCLUDED.scopes, token_status = 'ok', last_login_at = now(), updated_at = now()
     RETURNING ${COLS}`, [input.id, input.name, input.refreshTokenEnc, input.scopes]);
  return fix(rows[0]);
}
export async function listCharacters(): Promise<Character[]> {
  const { rows } = await getPool().query<Character>(`SELECT ${COLS} FROM characters ORDER BY account_id NULLS LAST, name`);
  return rows.map(fix);
}
export async function getCharacter(id: number): Promise<Character | null> {
  const { rows } = await getPool().query<Character>(`SELECT ${COLS} FROM characters WHERE id = $1`, [id]);
  return rows[0] ? fix(rows[0]) : null;
}
export async function setCharacterAccount(id: number, accountId: number | null): Promise<void> {
  await getPool().query("UPDATE characters SET account_id = $2, updated_at = now() WHERE id = $1", [id, accountId]);
}
export async function updateCharacterInfo(id: number, info: { name: string; corporationId: number; corporationName: string; allianceId: number | null; allianceName: string | null }): Promise<void> {
  await getPool().query(
    `UPDATE characters SET name = $2, corporation_id = $3, corporation_name = $4, alliance_id = $5, alliance_name = $6, updated_at = now() WHERE id = $1`,
    [id, info.name, info.corporationId, info.corporationName, info.allianceId, info.allianceName]);
}
export async function setTokenStatus(id: number, status: TokenStatus): Promise<void> {
  await getPool().query("UPDATE characters SET token_status = $2, updated_at = now() WHERE id = $1", [id, status]);
}
export async function deleteCharacter(id: number): Promise<void> {
  await getPool().query("DELETE FROM characters WHERE id = $1", [id]);
}
```

`src/lib/db/esi-cache.ts`:
```ts
import { getPool } from "./client.js";
export interface CacheEntry { etag: string | null; expiresAt: Date | null; pages: number; body: unknown }

export async function getCached(characterId: number, path: string): Promise<CacheEntry | null> {
  const { rows } = await getPool().query(
    `SELECT etag, expires_at AS "expiresAt", pages, body FROM esi_cache WHERE character_id = $1 AND path = $2`, [characterId, path]);
  return rows[0] ?? null;
}
export async function putCached(characterId: number, path: string, e: CacheEntry): Promise<void> {
  await getPool().query(
    `INSERT INTO esi_cache (character_id, path, etag, expires_at, pages, body, updated_at) VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (character_id, path) DO UPDATE SET etag = EXCLUDED.etag, expires_at = EXCLUDED.expires_at, pages = EXCLUDED.pages, body = EXCLUDED.body, updated_at = now()`,
    [characterId, path, e.etag, e.expiresAt, e.pages, JSON.stringify(e.body)]);
}
```

`src/lib/db/sync-runs.ts`:
```ts
import { getPool } from "./client.js";
export interface SyncRunSummary { job: string; characterId: number | null; startedAt: Date; finishedAt: Date | null; status: "running" | "ok" | "error"; rows: number | null; error: string | null }

export async function startRun(job: string, characterId: number | null): Promise<number> {
  const { rows } = await getPool().query<{ id: string }>("INSERT INTO sync_runs (job, character_id) VALUES ($1, $2) RETURNING id", [job, characterId]);
  return Number(rows[0].id);
}
export async function finishRun(id: number, r: { status: "ok" | "error"; rows?: number; error?: string }): Promise<void> {
  await getPool().query("UPDATE sync_runs SET finished_at = now(), status = $2, rows = $3, error = $4 WHERE id = $1", [id, r.status, r.rows ?? null, r.error ?? null]);
}
export async function latestRuns(): Promise<SyncRunSummary[]> {
  const { rows } = await getPool().query<SyncRunSummary>(
    `SELECT DISTINCT ON (job, character_id) job, character_id AS "characterId", started_at AS "startedAt", finished_at AS "finishedAt", status, rows, error
     FROM sync_runs ORDER BY job, character_id, started_at DESC`);
  return rows.map((r) => ({ ...r, characterId: r.characterId === null ? null : Number(r.characterId) }));
}
```

- [ ] **Step 4: Run** — `npx vitest run tests/db` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add repository modules for accounts, characters, esi_cache, sync_runs"`

---

### Task 5: Refresh-token encryption

**Files:**
- Create: `src/lib/auth/crypto.ts`, `tests/auth/crypto.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plain: string, secret: string): string` (format `v1.<iv b64url>.<tag b64url>.<ciphertext b64url>`), `decryptSecret(token: string, secret: string): string` (throws on tamper/wrong key).

- [ ] **Step 1: Failing test** — `tests/auth/crypto.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "../../src/lib/auth/crypto.js";

describe("crypto", () => {
  const key = "session-secret-at-least-32-chars-long!!";
  it("round-trips and randomises IV", () => {
    const a = encryptSecret("refresh-token", key);
    const b = encryptSecret("refresh-token", key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe("refresh-token");
  });
  it("rejects a wrong key and tampering", () => {
    const t = encryptSecret("x", key);
    expect(() => decryptSecret(t, "other-key-other-key-other-key-000")).toThrow();
    const parts = t.split(".");
    parts[3] = parts[3].slice(0, -2) + "AA";
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });
});
```
- [ ] **Step 2: Run** — `npx vitest run tests/auth/crypto.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — `src/lib/auth/crypto.ts`:
```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const key = (secret: string) => createHash("sha256").update(secret).digest();
const b64 = (b: Buffer) => b.toString("base64url");

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${b64(iv)}.${b64(c.getAuthTag())}.${b64(ct)}`;
}

export function decryptSecret(token: string, secret: string): string {
  const [v, iv, tag, ct] = token.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("bad ciphertext format");
  const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
```
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add AES-256-GCM helpers for refresh tokens"`

---

### Task 6: Signed session and OAuth-state cookies

**Files:**
- Create: `src/lib/auth/session.ts`, `tests/auth/session.test.ts`

**Interfaces:**
- Produces:
```ts
export const SESSION_COOKIE = "eve_session";
export const OAUTH_COOKIE = "eve_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;   // seconds
export const OAUTH_MAX_AGE = 600;
export interface SessionPayload { activeCharacterId: number | null; iat: number }
export interface OauthPayload { state: string; verifier: string; iat: number }
export function signPayload(payload: object, secret: string): string            // base64url(json).base64url(hmac)
export function verifyPayload<T>(token: string | undefined, secret: string, maxAgeSec: number, now?: number): T | null
export function cookieOptions(maxAge: number): { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/"; maxAge: number }
export async function readSession(): Promise<SessionPayload | null>            // uses next/headers cookies()
```

- [ ] **Step 1: Failing test** — `tests/auth/session.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { signPayload, verifyPayload } from "../../src/lib/auth/session.js";

describe("session tokens", () => {
  const s = "secret".repeat(6);
  it("signs and verifies", () => {
    const t = signPayload({ activeCharacterId: 5, iat: 1000 }, s);
    expect(verifyPayload<{ activeCharacterId: number }>(t, s, 3600, 2000)).toEqual({ activeCharacterId: 5, iat: 1000 });
  });
  it("rejects tamper, wrong secret, expiry, garbage", () => {
    const t = signPayload({ activeCharacterId: 5, iat: 1000 }, s);
    expect(verifyPayload(t + "x", s, 3600, 2000)).toBeNull();
    expect(verifyPayload(t, "nope".repeat(8), 3600, 2000)).toBeNull();
    expect(verifyPayload(t, s, 10, 2000)).toBeNull();
    expect(verifyPayload(undefined, s, 10, 2000)).toBeNull();
    expect(verifyPayload("a.b.c", s, 10, 2000)).toBeNull();
  });
});
```
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** — `src/lib/auth/session.ts`:
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "eve_session";
export const OAUTH_COOKIE = "eve_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const OAUTH_MAX_AGE = 600;
export interface SessionPayload { activeCharacterId: number | null; iat: number }
export interface OauthPayload { state: string; verifier: string; iat: number }

const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function verifyPayload<T>(token: string | undefined, secret: string, maxAgeSec: number, now = Math.floor(Date.now() / 1000)): T | null {
  if (!token) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = mac(body, secret);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { iat?: number };
    if (typeof payload.iat !== "number" || now - payload.iat > maxAgeSec) return null;
    return payload;
  } catch { return null; }
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true as const, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" as const, maxAge };
}

export async function readSession(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const { getConfig } = await import("../config.js");
  const jar = await cookies();
  return verifyPayload<SessionPayload>(jar.get(SESSION_COOKIE)?.value, getConfig().sessionSecret, SESSION_MAX_AGE);
}
```
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add signed session and OAuth-state cookie helpers"`

---

### Task 7: EVE SSO — metadata, PKCE, authorize URL, token exchange, JWT verify

**Files:**
- Create: `src/lib/auth/sso.ts`, `tests/auth/sso.test.ts`

**Interfaces:**
- Produces:
```ts
export const SCOPES: string[]   // the ten scopes from Global Constraints
export interface SsoMetadata { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
export interface TokenResponse { access_token: string; refresh_token: string; expires_in: number }
export interface VerifiedToken { characterId: number; name: string; scopes: string[]; owner: string }
export class SsoError extends Error { constructor(public code: "invalid_grant" | "token_http" | "jwt", message: string) }
export function getSsoMetadata(fetchImpl?: typeof fetch): Promise<SsoMetadata>   // memoised
export function generatePkce(): { verifier: string; challenge: string }
export function buildAuthorizeUrl(a: { metadata: SsoMetadata; clientId: string; callbackUrl: string; state: string; challenge: string; scopes?: string[] }): string
export function exchangeCode(a: { metadata: SsoMetadata; clientId: string; clientSecret: string; code: string; verifier: string; fetchImpl?: typeof fetch }): Promise<TokenResponse>
export function refreshAccessToken(a: { metadata: SsoMetadata; clientId: string; clientSecret: string; refreshToken: string; fetchImpl?: typeof fetch }): Promise<TokenResponse>
export function verifyEveJwt(token: string, a: { jwks: JWTVerifyGetKey; clientId: string }): Promise<VerifiedToken>
export function remoteJwks(metadata: SsoMetadata): JWTVerifyGetKey   // memoised createRemoteJWKSet
```

- [ ] **Step 1: Failing test** — `tests/auth/sso.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from "jose";
import { SCOPES, generatePkce, buildAuthorizeUrl, exchangeCode, refreshAccessToken, verifyEveJwt, SsoError, type SsoMetadata } from "../../src/lib/auth/sso.js";
import { createHash } from "node:crypto";

const metadata: SsoMetadata = {
  issuer: "https://login.eveonline.com/",
  authorization_endpoint: "https://login.eveonline.com/v2/oauth/authorize",
  token_endpoint: "https://login.eveonline.com/v2/oauth/token",
  jwks_uri: "https://login.eveonline.com/oauth/jwks",
};

async function signedJwt(claims: Record<string, unknown>, opts: { aud?: string[]; iss?: string; sub?: string } = {}) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? "https://login.eveonline.com/").setAudience(opts.aud ?? ["cid", "EVE Online"])
    .setSubject(opts.sub ?? "CHARACTER:EVE:90000101").setIssuedAt().setExpirationTime("20m").sign(privateKey);
  return { token, jwks };
}

describe("sso", () => {
  it("exports the ten scopes", () => { expect(SCOPES.length).toBe(10); expect(SCOPES).toContain("esi-fittings.read_fittings.v1"); });

  it("PKCE challenge is S256 of the verifier", () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("builds the authorize URL", () => {
    const url = new URL(buildAuthorizeUrl({ metadata, clientId: "cid", callbackUrl: "https://eve.plasma66.com/auth/callback", state: "st", challenge: "ch" }));
    expect(url.origin + url.pathname).toBe(metadata.authorization_endpoint);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://eve.plasma66.com/auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toBe(SCOPES.join(" "));
  });

  it("exchanges a code with basic auth + verifier", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("c0de");
      expect(body.get("code_verifier")).toBe("ver");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("cid:sec").toString("base64"));
      return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 1199, token_type: "Bearer" }), { status: 200 });
    }) as unknown as typeof fetch;
    const t = await exchangeCode({ metadata, clientId: "cid", clientSecret: "sec", code: "c0de", verifier: "ver", fetchImpl });
    expect(t).toMatchObject({ access_token: "at", refresh_token: "rt", expires_in: 1199 });
  });

  it("maps invalid_grant on refresh to SsoError('invalid_grant')", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) as unknown as typeof fetch;
    await expect(refreshAccessToken({ metadata, clientId: "cid", clientSecret: "sec", refreshToken: "rt", fetchImpl }))
      .rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("verifies a good JWT", async () => {
    const { token, jwks } = await signedJwt({ name: "Mara Vexley", scp: ["esi-skills.read_skills.v1", "esi-assets.read_assets.v1"], owner: "own" });
    const v = await verifyEveJwt(token, { jwks, clientId: "cid" });
    expect(v).toEqual({ characterId: 90000101, name: "Mara Vexley", scopes: ["esi-skills.read_skills.v1", "esi-assets.read_assets.v1"], owner: "own" });
  });

  it("accepts a single-string scp and rejects wrong aud/iss", async () => {
    const one = await signedJwt({ name: "n", scp: "esi-skills.read_skills.v1", owner: "o" });
    expect((await verifyEveJwt(one.token, { jwks: one.jwks, clientId: "cid" })).scopes).toEqual(["esi-skills.read_skills.v1"]);
    const badAud = await signedJwt({ name: "n", scp: [], owner: "o" }, { aud: ["other", "EVE Online"] });
    await expect(verifyEveJwt(badAud.token, { jwks: badAud.jwks, clientId: "cid" })).rejects.toBeInstanceOf(SsoError);
    const badIss = await signedJwt({ name: "n", scp: [], owner: "o" }, { iss: "https://evil.example/" });
    await expect(verifyEveJwt(badIss.token, { jwks: badIss.jwks, clientId: "cid" })).rejects.toBeInstanceOf(SsoError);
  });
});
```
- [ ] **Step 2: Run** — `npx vitest run tests/auth/sso.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — `src/lib/auth/sso.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

export const SCOPES = [
  "esi-skills.read_skills.v1", "esi-skills.read_skillqueue.v1", "esi-assets.read_assets.v1",
  "esi-fittings.read_fittings.v1", "esi-clones.read_clones.v1", "esi-clones.read_implants.v1",
  "esi-wallet.read_character_wallet.v1", "esi-killmails.read_killmails.v1",
  "esi-location.read_location.v1", "esi-location.read_ship_type.v1",
];
export const SSO_METADATA_URL = "https://login.eveonline.com/.well-known/oauth-authorization-server";

export interface SsoMetadata { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
export interface TokenResponse { access_token: string; refresh_token: string; expires_in: number }
export interface VerifiedToken { characterId: number; name: string; scopes: string[]; owner: string }

export class SsoError extends Error {
  constructor(public code: "invalid_grant" | "token_http" | "jwt", message: string) { super(message); this.name = "SsoError"; }
}

let metadataPromise: Promise<SsoMetadata> | undefined;
export function getSsoMetadata(fetchImpl: typeof fetch = fetch): Promise<SsoMetadata> {
  metadataPromise ??= fetchImpl(SSO_METADATA_URL).then(async (r) => {
    if (!r.ok) { metadataPromise = undefined; throw new SsoError("token_http", `SSO metadata HTTP ${r.status}`); }
    return (await r.json()) as SsoMetadata;
  });
  return metadataPromise;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function buildAuthorizeUrl(a: { metadata: SsoMetadata; clientId: string; callbackUrl: string; state: string; challenge: string; scopes?: string[] }): string {
  const url = new URL(a.metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", a.callbackUrl);
  url.searchParams.set("client_id", a.clientId);
  url.searchParams.set("scope", (a.scopes ?? SCOPES).join(" "));
  url.searchParams.set("code_challenge", a.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", a.state);
  return url.toString();
}

async function tokenRequest(metadata: SsoMetadata, clientId: string, clientSecret: string, form: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenResponse> {
  const r = await fetchImpl(metadata.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      Host: "login.eveonline.com",
    },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await r.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (r.status === 400 && json.error === "invalid_grant") throw new SsoError("invalid_grant", "refresh token revoked or invalid");
  if (!r.ok) throw new SsoError("token_http", `SSO token endpoint HTTP ${r.status}: ${json.error ?? ""}`);
  return { access_token: json.access_token!, refresh_token: json.refresh_token!, expires_in: json.expires_in! };
}

export function exchangeCode(a: { metadata: SsoMetadata; clientId: string; clientSecret: string; code: string; verifier: string; fetchImpl?: typeof fetch }) {
  return tokenRequest(a.metadata, a.clientId, a.clientSecret, { grant_type: "authorization_code", code: a.code, code_verifier: a.verifier }, a.fetchImpl ?? fetch);
}

export function refreshAccessToken(a: { metadata: SsoMetadata; clientId: string; clientSecret: string; refreshToken: string; fetchImpl?: typeof fetch }) {
  return tokenRequest(a.metadata, a.clientId, a.clientSecret, { grant_type: "refresh_token", refresh_token: a.refreshToken }, a.fetchImpl ?? fetch);
}

export async function verifyEveJwt(token: string, a: { jwks: JWTVerifyGetKey; clientId: string }): Promise<VerifiedToken> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, a.jwks, { issuer: ["https://login.eveonline.com/", "login.eveonline.com"], audience: "EVE Online" }));
  } catch (e) { throw new SsoError("jwt", `JWT verification failed: ${(e as Error).message}`); }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(a.clientId)) throw new SsoError("jwt", "JWT audience does not include our client id");
  const m = /^CHARACTER:EVE:(\d+)$/.exec(payload.sub ?? "");
  if (!m) throw new SsoError("jwt", `unexpected sub ${payload.sub}`);
  const scp = payload.scp as string | string[] | undefined;
  return { characterId: Number(m[1]), name: String(payload.name ?? ""), scopes: Array.isArray(scp) ? scp : scp ? [scp] : [], owner: String(payload.owner ?? "") };
}

let jwks: JWTVerifyGetKey | undefined;
export function remoteJwks(metadata: SsoMetadata): JWTVerifyGetKey {
  return (jwks ??= createRemoteJWKSet(new URL(metadata.jwks_uri)));
}
```
- [ ] **Step 4: Run** — Expected: PASS (7 tests).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add EVE SSO client: PKCE, token exchange, JWT verification"`

---

### Task 8: Login flow, auth route handlers, route guard

**Files:**
- Create: `src/lib/auth/flow.ts`, `tests/auth/flow.test.ts`, `src/app/auth/start/route.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/logout/route.ts`, `src/app/auth/switch/route.ts`, `src/proxy.ts`, `tests/proxy.test.ts`

**Interfaces:**
- Consumes: Task 2 `getConfig`, Task 4 `upsertCharacter`, Task 5 `encryptSecret`, Task 6 session helpers, Task 7 SSO functions.
- Produces:
```ts
// flow.ts
export class AuthError extends Error { constructor(public code: "state" | "not-allowed" | "token" | "jwt", message: string) }
export interface FlowDeps {   // all injectable for tests; defaults use real SSO + DB
  metadata: () => Promise<SsoMetadata>; jwks: (m: SsoMetadata) => JWTVerifyGetKey;
  exchange: typeof exchangeCode; verify: typeof verifyEveJwt; upsert: typeof upsertCharacter;
}
export function startLogin(config: AppConfig, deps?: Pick<FlowDeps, "metadata">): Promise<{ url: string; oauthCookie: string }>
export function completeLogin(a: { code: string | null; state: string | null; oauthCookie: string | undefined }, config: AppConfig, deps?: FlowDeps): Promise<{ characterId: number; name: string }>
// proxy.ts
export function isPublicPath(pathname: string): boolean   // /login, /auth/*, /api/health, /_next/*, /favicon.ico, /eve-mark.svg
```

- [ ] **Step 1: Failing tests** — `tests/auth/flow.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { startLogin, completeLogin, AuthError } from "../../src/lib/auth/flow.js";
import { signPayload, verifyPayload, OAUTH_MAX_AGE, type OauthPayload } from "../../src/lib/auth/session.js";
import { loadConfig } from "../../src/lib/config.js";
import type { SsoMetadata } from "../../src/lib/auth/sso.js";

const config = loadConfig({
  EVE_CLIENT_ID: "cid", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://eve.plasma66.com/auth/callback",
  ALLOWED_CHARACTER_IDS: "90000101", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua",
  SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x",
});
const metadata: SsoMetadata = { issuer: "https://login.eveonline.com/", authorization_endpoint: "https://login.eveonline.com/v2/oauth/authorize", token_endpoint: "https://login.eveonline.com/v2/oauth/token", jwks_uri: "https://login.eveonline.com/oauth/jwks" };

function deps(over: Partial<Parameters<typeof completeLogin>[2]> = {}) {
  return {
    metadata: async () => metadata,
    jwks: () => (async () => { throw new Error("unused"); }) as never,
    exchange: vi.fn(async () => ({ access_token: "at", refresh_token: "rt", expires_in: 1199 })),
    verify: vi.fn(async () => ({ characterId: 90000101, name: "Mara Vexley", scopes: ["a"], owner: "o" })),
    upsert: vi.fn(async (input: { id: number; name: string; refreshTokenEnc: string; scopes: string[] }) => ({ ...input, accountId: null, corporationId: null, corporationName: null, allianceId: null, allianceName: null, tokenStatus: "ok" as const, lastLoginAt: null })),
    ...over,
  };
}

describe("startLogin", () => {
  it("returns an authorize URL and a signed oauth cookie holding state+verifier", async () => {
    const { url, oauthCookie } = await startLogin(config, { metadata: async () => metadata });
    const p = verifyPayload<OauthPayload>(oauthCookie, config.sessionSecret, OAUTH_MAX_AGE)!;
    expect(new URL(url).searchParams.get("state")).toBe(p.state);
    expect(p.verifier.length).toBeGreaterThan(40);
  });
});

describe("completeLogin", () => {
  const cookie = signPayload({ state: "st", verifier: "ver", iat: Math.floor(Date.now() / 1000) }, config.sessionSecret);

  it("stores the encrypted refresh token and returns the character", async () => {
    const d = deps();
    const out = await completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d);
    expect(out).toEqual({ characterId: 90000101, name: "Mara Vexley" });
    const arg = d.upsert.mock.calls[0][0];
    expect(arg.refreshTokenEnc).toMatch(/^v1\./);
    expect(arg.refreshTokenEnc).not.toContain("rt");
    expect(arg.scopes).toEqual(["a"]);
  });
  it("rejects state mismatch / missing cookie", async () => {
    await expect(completeLogin({ code: "c", state: "other", oauthCookie: cookie }, config, deps())).rejects.toMatchObject({ code: "state" });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: undefined }, config, deps())).rejects.toMatchObject({ code: "state" });
  });
  it("rejects a character that is not allow-listed and does not persist it", async () => {
    const d = deps({ verify: vi.fn(async () => ({ characterId: 42, name: "Stranger", scopes: [], owner: "o" })) });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d)).rejects.toMatchObject({ code: "not-allowed" });
    expect(d.upsert).not.toHaveBeenCalled();
  });
  it("maps token and jwt failures", async () => {
    const d1 = deps({ exchange: vi.fn(async () => { throw new Error("http 500"); }) });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d1)).rejects.toBeInstanceOf(AuthError);
    const d2 = deps({ verify: vi.fn(async () => { throw new Error("bad sig"); }) });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d2)).rejects.toMatchObject({ code: "jwt" });
  });
});
```

`tests/proxy.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isPublicPath } from "../src/proxy.js";
describe("isPublicPath", () => {
  it("allows login, auth, health, static", () => {
    for (const p of ["/login", "/auth/start", "/auth/callback?code=1", "/api/health", "/_next/static/x.js", "/favicon.ico", "/eve-mark.svg"]) expect(isPublicPath(p)).toBe(true);
  });
  it("guards everything else", () => {
    for (const p of ["/", "/settings", "/api/accounts", "/ships/1"]) expect(isPublicPath(p)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/auth/flow.test.ts tests/proxy.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/auth/flow.ts`**
```ts
import { randomBytes } from "node:crypto";
import type { JWTVerifyGetKey } from "jose";
import type { AppConfig } from "../config.js";
import { upsertCharacter } from "../db/characters.js";
import { encryptSecret } from "./crypto.js";
import { OAUTH_MAX_AGE, signPayload, verifyPayload, type OauthPayload } from "./session.js";
import { buildAuthorizeUrl, exchangeCode, generatePkce, getSsoMetadata, remoteJwks, verifyEveJwt, type SsoMetadata } from "./sso.js";

export class AuthError extends Error {
  constructor(public code: "state" | "not-allowed" | "token" | "jwt", message: string) { super(message); this.name = "AuthError"; }
}

export interface FlowDeps {
  metadata: () => Promise<SsoMetadata>;
  jwks: (m: SsoMetadata) => JWTVerifyGetKey;
  exchange: typeof exchangeCode;
  verify: typeof verifyEveJwt;
  upsert: typeof upsertCharacter;
}
const realDeps: FlowDeps = { metadata: () => getSsoMetadata(), jwks: remoteJwks, exchange: exchangeCode, verify: verifyEveJwt, upsert: upsertCharacter };

export async function startLogin(config: AppConfig, deps: Pick<FlowDeps, "metadata"> = realDeps): Promise<{ url: string; oauthCookie: string }> {
  const metadata = await deps.metadata();
  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("base64url");
  const url = buildAuthorizeUrl({ metadata, clientId: config.eveClientId, callbackUrl: config.eveCallbackUrl, state, challenge });
  const payload: OauthPayload = { state, verifier, iat: Math.floor(Date.now() / 1000) };
  return { url, oauthCookie: signPayload(payload, config.sessionSecret) };
}

export async function completeLogin(
  a: { code: string | null; state: string | null; oauthCookie: string | undefined },
  config: AppConfig, deps: FlowDeps = realDeps,
): Promise<{ characterId: number; name: string }> {
  const saved = verifyPayload<OauthPayload>(a.oauthCookie, config.sessionSecret, OAUTH_MAX_AGE);
  if (!saved || !a.state || !a.code || saved.state !== a.state) throw new AuthError("state", "OAuth state mismatch or expired");
  const metadata = await deps.metadata();
  let tokens;
  try {
    tokens = await deps.exchange({ metadata, clientId: config.eveClientId, clientSecret: config.eveClientSecret, code: a.code, verifier: saved.verifier });
  } catch (e) { throw new AuthError("token", (e as Error).message); }
  let verified;
  try { verified = await deps.verify(tokens.access_token, { jwks: deps.jwks(metadata), clientId: config.eveClientId }); }
  catch (e) { throw new AuthError("jwt", (e as Error).message); }
  if (!config.allowedCharacterIds.has(verified.characterId)) throw new AuthError("not-allowed", `character ${verified.characterId} is not allow-listed`);
  await deps.upsert({ id: verified.characterId, name: verified.name, refreshTokenEnc: encryptSecret(tokens.refresh_token, config.sessionSecret), scopes: verified.scopes });
  return { characterId: verified.characterId, name: verified.name };
}
```

- [ ] **Step 4: Implement the route handlers**

`src/app/auth/start/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { startLogin } from "../../../lib/auth/flow.js";
import { OAUTH_COOKIE, OAUTH_MAX_AGE, cookieOptions } from "../../../lib/auth/session.js";

export async function GET() {
  const { url, oauthCookie } = await startLogin(getConfig());
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, oauthCookie, cookieOptions(OAUTH_MAX_AGE));
  return res;
}
```

`src/app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { completeLogin, AuthError } from "../../../lib/auth/flow.js";
import { OAUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, readSession, signPayload, type SessionPayload } from "../../../lib/auth/session.js";

export async function GET(req: NextRequest) {
  const config = getConfig();
  const url = req.nextUrl;
  try {
    const { characterId } = await completeLogin(
      { code: url.searchParams.get("code"), state: url.searchParams.get("state"), oauthCookie: req.cookies.get(OAUTH_COOKIE)?.value }, config);
    const existing = await readSession();
    const payload: SessionPayload = { activeCharacterId: existing?.activeCharacterId ?? characterId, iat: Math.floor(Date.now() / 1000) };
    const res = NextResponse.redirect(new URL(existing ? "/settings" : "/", url.origin));
    res.cookies.set(SESSION_COOKIE, signPayload(payload, config.sessionSecret), cookieOptions(SESSION_MAX_AGE));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "unknown";
    console.error("[auth] callback failed:", code, (e as Error).message);
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, url.origin));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  }
}
```

`src/app/auth/logout/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../lib/auth/session.js";
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

`src/app/auth/switch/route.ts` (POST form field `characterId`, optional `next`):
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { getCharacter } from "../../../lib/db/characters.js";
import { SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, readSession, signPayload } from "../../../lib/auth/session.js";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = Number(form.get("characterId"));
  const next = String(form.get("next") ?? "/");
  const session = await readSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  const character = await getCharacter(id);
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.nextUrl.origin), 303);
  if (character) {
    res.cookies.set(SESSION_COOKIE, signPayload({ activeCharacterId: id, iat: Math.floor(Date.now() / 1000) }, getConfig().sessionSecret), cookieOptions(SESSION_MAX_AGE));
  }
  return res;
}
```

`src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, verifyPayload } from "./lib/auth/session.js";

const PUBLIC_PREFIXES = ["/login", "/auth/", "/api/health", "/_next/"];
const PUBLIC_FILES = new Set(["/favicon.ico", "/eve-mark.svg"]);

export function isPublicPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return PUBLIC_FILES.has(path) || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export function proxy(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();
  const ok = verifyPayload(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? "", SESSION_MAX_AGE);
  if (ok) return NextResponse.next();
  const login = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
```

- [ ] **Step 5: Run** — `npx vitest run tests/auth tests/proxy.test.ts && npm run typecheck` — Expected: PASS, typecheck clean.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add SSO login flow, auth routes and session route guard"`

---

### Task 9: ESI client with token refresh, caching, rate limits, pagination; generated types

**Files:**
- Create: `src/lib/esi/tokens.ts`, `src/lib/esi/client.ts`, `src/lib/esi/index.ts`, `scripts/esi-types.ts`, `src/lib/esi/types.gen.ts` (generated), `tests/esi/tokens.test.ts`, `tests/esi/client.test.ts`

**Interfaces:**
- Consumes: Task 4 `getCharacter`, `setTokenStatus`, `getCached`, `putCached`; Task 5 `decryptSecret`; Task 7 `refreshAccessToken`, `getSsoMetadata`.
- Produces:
```ts
// tokens.ts
export class NeedsReauthError extends Error { constructor(public characterId: number) }
export interface TokenStoreDeps { config: AppConfig; getCharacter: typeof getCharacter; setTokenStatus: typeof setTokenStatus; refresh: typeof refreshAccessToken; metadata: () => Promise<SsoMetadata>; now?: () => number }
export class TokenStore { constructor(deps: TokenStoreDeps); getAccessToken(characterId: number): Promise<string> }

// client.ts
export interface EsiDeps { fetchImpl?: typeof fetch; getAccessToken: (characterId: number) => Promise<string>; cache: { get: typeof getCached; put: typeof putCached }; config: Pick<AppConfig, "esiBaseUrl" | "esiCompatibilityDate" | "esiUserAgent">; now?: () => number; sleep?: (ms: number) => Promise<void> }
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean }
export class EsiError extends Error { constructor(public status: number, public path: string, message: string) }
export class EsiClient {
  constructor(deps: EsiDeps);
  get<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number>; page?: number }): Promise<EsiResult<T>>;
  getAll<T>(path: string, opts?: { characterId?: number; query?: Record<string, string | number> }): Promise<T[]>;   // follows X-Pages
}
export function createEsiClient(): EsiClient   // index.ts: wires TokenStore + DB cache + getConfig()
```

- [ ] **Step 1: Failing token-store test** — `tests/esi/tokens.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { TokenStore, NeedsReauthError } from "../../src/lib/esi/tokens.js";
import { encryptSecret } from "../../src/lib/auth/crypto.js";
import { SsoError } from "../../src/lib/auth/sso.js";
import { loadConfig } from "../../src/lib/config.js";

const config = loadConfig({ EVE_CLIENT_ID: "cid", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://x/cb", ALLOWED_CHARACTER_IDS: "1", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua", SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x" });
const metadata = { issuer: "i", authorization_endpoint: "a", token_endpoint: "t", jwks_uri: "j" };
const character = { id: 1, name: "n", accountId: null, corporationId: null, corporationName: null, allianceId: null, allianceName: null, refreshTokenEnc: encryptSecret("rt-plain", config.sessionSecret), scopes: [], tokenStatus: "ok" as const, lastLoginAt: null };

function make(refresh = vi.fn(async () => ({ access_token: "at1", refresh_token: "rt-plain", expires_in: 1199 }))) {
  let t = 1_000_000;
  const store = new TokenStore({ config, getCharacter: vi.fn(async () => character), setTokenStatus: vi.fn(async () => {}), refresh, metadata: async () => metadata, now: () => t });
  return { store, refresh, advance: (ms: number) => { t += ms; } };
}

describe("TokenStore", () => {
  it("decrypts the stored refresh token, refreshes once, then caches until 60s before expiry", async () => {
    const { store, refresh, advance } = make();
    expect(await store.getAccessToken(1)).toBe("at1");
    expect(refresh.mock.calls[0][0].refreshToken).toBe("rt-plain");
    advance(1000 * 1000);
    expect(await store.getAccessToken(1)).toBe("at1");
    expect(refresh).toHaveBeenCalledTimes(1);
    advance(1000 * 140);  // now within 60s of the 1199s expiry
    await store.getAccessToken(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("marks needs_reauth on invalid_grant", async () => {
    const refresh = vi.fn(async () => { throw new SsoError("invalid_grant", "revoked"); });
    const setTokenStatus = vi.fn(async () => {});
    const store = new TokenStore({ config, getCharacter: vi.fn(async () => character), setTokenStatus, refresh, metadata: async () => metadata });
    await expect(store.getAccessToken(1)).rejects.toBeInstanceOf(NeedsReauthError);
    expect(setTokenStatus).toHaveBeenCalledWith(1, "needs_reauth");
  });
  it("refuses characters already flagged needs_reauth without calling SSO", async () => {
    const refresh = vi.fn();
    const store = new TokenStore({ config, getCharacter: vi.fn(async () => ({ ...character, tokenStatus: "needs_reauth" as const })), setTokenStatus: vi.fn(async () => {}), refresh, metadata: async () => metadata });
    await expect(store.getAccessToken(1)).rejects.toBeInstanceOf(NeedsReauthError);
    expect(refresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Failing client test** — `tests/esi/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EsiClient, EsiError } from "../../src/lib/esi/client.js";
import type { CacheEntry } from "../../src/lib/db/esi-cache.js";

type Resp = { status: number; body?: unknown; headers?: Record<string, string> };
function make(responses: Resp[]) {
  const store = new Map<string, CacheEntry>();
  const calls: { url: string; init: RequestInit }[] = [];
  let t = 1_700_000_000_000;
  const sleeps: number[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = responses.shift() ?? { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers ?? {} });
  }) as unknown as typeof fetch;
  const client = new EsiClient({
    fetchImpl, getAccessToken: async (cid) => `tok-${cid}`,
    cache: { get: async (cid, p) => store.get(`${cid}${p}`) ?? null, put: async (cid, p, e) => { store.set(`${cid}${p}`, e); } },
    config: { esiBaseUrl: "https://esi.test", esiCompatibilityDate: "2026-08-28", esiUserAgent: "ua" },
    now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; },
  });
  return { client, calls, store, sleeps, advance: (ms: number) => { t += ms; } };
}
const future = (t: number, s: number) => new Date(t + s * 1000).toUTCString();

describe("EsiClient", () => {
  it("sends compat date, UA, bearer and stores etag/expires", async () => {
    const { client, calls, store } = make([{ status: 200, body: { name: "T" }, headers: { ETag: '"e1"', Expires: future(1_700_000_000_000, 300), "X-Pages": "1" } }]);
    const r = await client.get<{ name: string }>("/characters/1", { characterId: 1 });
    expect(r.data.name).toBe("T"); expect(r.fromCache).toBe(false);
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["X-Compatibility-Date"]).toBe("2026-08-28"); expect(h["User-Agent"]).toBe("ua"); expect(h.Authorization).toBe("Bearer tok-1");
    expect(calls[0].url).toBe("https://esi.test/characters/1");
    expect(store.get("1/characters/1")?.etag).toBe('"e1"');
  });
  it("serves from cache before Expires without fetching, then sends If-None-Match and accepts 304", async () => {
    const { client, calls, advance } = make([
      { status: 200, body: [1], headers: { ETag: '"e1"', Expires: future(1_700_000_000_000, 60) } },
      { status: 304, headers: { Expires: future(1_700_000_000_000, 200) } },
    ]);
    await client.get("/x", { characterId: 0 });
    const cached = await client.get("/x", { characterId: 0 });
    expect(cached.fromCache).toBe(true); expect(calls.length).toBe(1);
    advance(61_000);
    const revalidated = await client.get<number[]>("/x", { characterId: 0 });
    expect(calls.length).toBe(2);
    expect((calls[1].init.headers as Record<string, string>)["If-None-Match"]).toBe('"e1"');
    expect(revalidated.data).toEqual([1]); expect(revalidated.status).toBe(304);
  });
  it("public routes use cache key character 0 and no bearer", async () => {
    const { client, calls, store } = make([{ status: 200, body: {} }]);
    await client.get("/markets/prices");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(store.has("0/markets/prices")).toBe(true);
  });
  it("throttles when the bucket is nearly empty and honours Retry-After on 429", async () => {
    const { client, sleeps } = make([
      { status: 200, body: {}, headers: { "X-Ratelimit-Group": "g", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "10" } },
      { status: 200, body: {}, headers: { "X-Ratelimit-Group": "g", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "100" } },
      { status: 429, headers: { "Retry-After": "7" } },
      { status: 200, body: { ok: 1 } },
    ]);
    await client.get("/a"); await client.get("/a?b=1");
    expect(sleeps[0]).toBeGreaterThan(0);            // remaining 10 < 20% of 150 → waited before 2nd call
    const r = await client.get<{ ok: number }>("/c");
    expect(sleeps).toContain(7000); expect(r.data.ok).toBe(1);
  });
  it("halts all calls for 60s after a 420", async () => {
    const { client, sleeps } = make([{ status: 420 }, { status: 200, body: {} }, { status: 200, body: {} }]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(EsiError);
    await client.get("/b");
    expect(sleeps).toContain(60_000);
  });
  it("throws EsiError with status for other errors", async () => {
    const { client } = make([{ status: 403, body: { error: "forbidden" } }]);
    await expect(client.get("/a", { characterId: 1 })).rejects.toMatchObject({ status: 403, path: "/a" });
  });
  it("getAll follows X-Pages", async () => {
    const { client, calls } = make([
      { status: 200, body: [1, 2], headers: { "X-Pages": "3" } }, { status: 200, body: [3] }, { status: 200, body: [4] },
    ]);
    expect(await client.getAll<number>("/characters/1/assets", { characterId: 1 })).toEqual([1, 2, 3, 4]);
    expect(calls.map((c) => new URL(c.url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
  });
});
```

- [ ] **Step 3: Run** — `npx vitest run tests/esi` — Expected: FAIL.

- [ ] **Step 4: Implement `src/lib/esi/tokens.ts`**
```ts
import type { AppConfig } from "../config.js";
import type { getCharacter, setTokenStatus } from "../db/characters.js";
import { decryptSecret } from "../auth/crypto.js";
import { SsoError, type refreshAccessToken, type SsoMetadata } from "../auth/sso.js";

export class NeedsReauthError extends Error {
  constructor(public characterId: number) { super(`character ${characterId} needs re-authorisation`); this.name = "NeedsReauthError"; }
}
export interface TokenStoreDeps {
  config: AppConfig; getCharacter: typeof getCharacter; setTokenStatus: typeof setTokenStatus;
  refresh: typeof refreshAccessToken; metadata: () => Promise<SsoMetadata>; now?: () => number;
}
const EARLY_MS = 60_000;

export class TokenStore {
  private cache = new Map<number, { token: string; expiresAt: number }>();
  private inflight = new Map<number, Promise<string>>();
  constructor(private deps: TokenStoreDeps) {}

  getAccessToken(characterId: number): Promise<string> {
    const now = (this.deps.now ?? Date.now)();
    const hit = this.cache.get(characterId);
    if (hit && hit.expiresAt - EARLY_MS > now) return Promise.resolve(hit.token);
    let p = this.inflight.get(characterId);
    if (!p) {
      p = this.refresh(characterId).finally(() => this.inflight.delete(characterId));
      this.inflight.set(characterId, p);
    }
    return p;
  }

  private async refresh(characterId: number): Promise<string> {
    const c = await this.deps.getCharacter(characterId);
    if (!c) throw new Error(`unknown character ${characterId}`);
    if (c.tokenStatus !== "ok") throw new NeedsReauthError(characterId);
    const refreshToken = decryptSecret(c.refreshTokenEnc, this.deps.config.sessionSecret);
    try {
      const t = await this.deps.refresh({ metadata: await this.deps.metadata(), clientId: this.deps.config.eveClientId, clientSecret: this.deps.config.eveClientSecret, refreshToken });
      const now = (this.deps.now ?? Date.now)();
      this.cache.set(characterId, { token: t.access_token, expiresAt: now + t.expires_in * 1000 });
      return t.access_token;
    } catch (e) {
      if (e instanceof SsoError && e.code === "invalid_grant") {
        await this.deps.setTokenStatus(characterId, "needs_reauth");
        this.cache.delete(characterId);
        throw new NeedsReauthError(characterId);
      }
      throw e;
    }
  }
}
```

- [ ] **Step 5: Implement `src/lib/esi/client.ts`**
```ts
import type { AppConfig } from "../config.js";
import type { getCached, putCached } from "../db/esi-cache.js";

export interface EsiDeps {
  fetchImpl?: typeof fetch; getAccessToken: (characterId: number) => Promise<string>;
  cache: { get: typeof getCached; put: typeof putCached };
  config: Pick<AppConfig, "esiBaseUrl" | "esiCompatibilityDate" | "esiUserAgent">;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean }
export class EsiError extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); this.name = "EsiError"; }
}
interface GetOpts { characterId?: number; query?: Record<string, string | number>; page?: number }

const HALT_MS = 60_000;
const THROTTLE_FRACTION = 0.2;

/** "150/15m" → { tokens: 150, windowMs: 900000 } */
export function parseLimit(v: string | null): { tokens: number; windowMs: number } | null {
  const m = /^(\d+)\/(\d+)([smh])$/.exec(v ?? "");
  if (!m) return null;
  const unit = { s: 1000, m: 60_000, h: 3_600_000 }[m[3] as "s" | "m" | "h"];
  return { tokens: Number(m[1]), windowMs: Number(m[2]) * unit };
}

export class EsiClient {
  private fetchImpl: typeof fetch; private now: () => number; private sleep: (ms: number) => Promise<void>;
  private haltUntil = 0;
  private groupWait = new Map<string, number>();   // group → time when it is OK to call again
  private pathGroup = new Map<string, string>();   // path (no query) → rate-limit group

  constructor(private deps: EsiDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch; this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async get<T>(path: string, opts: GetOpts = {}): Promise<EsiResult<T>> {
    const cid = opts.characterId ?? 0;
    const url = new URL(path, this.deps.config.esiBaseUrl);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
    if (opts.page) url.searchParams.set("page", String(opts.page));
    const key = url.pathname + url.search;

    const cached = await this.deps.cache.get(cid, key);
    if (cached?.expiresAt && cached.expiresAt.getTime() > this.now()) {
      return { data: cached.body as T, status: 200, pages: cached.pages, fromCache: true };
    }
    await this.waitForBudget(url.pathname);

    const headers: Record<string, string> = {
      Accept: "application/json", "User-Agent": this.deps.config.esiUserAgent, "X-Compatibility-Date": this.deps.config.esiCompatibilityDate,
    };
    if (opts.characterId) headers.Authorization = `Bearer ${await this.deps.getAccessToken(opts.characterId)}`;
    if (cached?.etag) headers["If-None-Match"] = cached.etag;

    let res = await this.fetchImpl(url, { headers });
    this.noteRateLimit(url.pathname, res);
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") ?? "5");
      await this.sleep(retry * 1000);
      res = await this.fetchImpl(url, { headers });
      this.noteRateLimit(url.pathname, res);
    }
    if (res.status === 420) { this.haltUntil = this.now() + HALT_MS; throw new EsiError(420, key, "ESI error limit reached; halting for 60s"); }

    const pages = Number(res.headers.get("X-Pages") ?? cached?.pages ?? 1) || 1;
    const expiresHeader = res.headers.get("Expires");
    const expiresAt = expiresHeader ? new Date(expiresHeader) : null;

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

  private async waitForBudget(pathname: string): Promise<void> {
    const now = this.now();
    if (this.haltUntil > now) await this.sleep(this.haltUntil - now);
    const group = this.pathGroup.get(pathname);
    const until = group ? this.groupWait.get(group) ?? 0 : 0;
    if (until > this.now()) await this.sleep(until - this.now());
  }

  private noteRateLimit(pathname: string, res: Response): void {
    const group = res.headers.get("X-Ratelimit-Group");
    const limit = parseLimit(res.headers.get("X-Ratelimit-Limit"));
    const remaining = Number(res.headers.get("X-Ratelimit-Remaining"));
    if (!group || !limit || Number.isNaN(remaining)) return;
    this.pathGroup.set(pathname, group);
    if (remaining < limit.tokens * THROTTLE_FRACTION) {
      // Wait long enough for roughly 10% of the window's tokens to come back, capped at 60s.
      const wait = Math.min(limit.windowMs * 0.1, 60_000);
      this.groupWait.set(group, this.now() + wait);
    } else {
      this.groupWait.delete(group);
    }
  }
}
```

- [ ] **Step 6: Implement `src/lib/esi/index.ts` (production wiring)**
```ts
import { getConfig } from "../config.js";
import { getCharacter, setTokenStatus } from "../db/characters.js";
import { getCached, putCached } from "../db/esi-cache.js";
import { getSsoMetadata, refreshAccessToken } from "../auth/sso.js";
import { TokenStore } from "./tokens.js";
import { EsiClient } from "./client.js";

let client: EsiClient | undefined;
export function createEsiClient(): EsiClient {
  if (!client) {
    const config = getConfig();
    const tokens = new TokenStore({ config, getCharacter, setTokenStatus, refresh: refreshAccessToken, metadata: () => getSsoMetadata() });
    client = new EsiClient({ getAccessToken: (id) => tokens.getAccessToken(id), cache: { get: getCached, put: putCached }, config });
  }
  return client;
}
export { EsiClient, EsiError } from "./client.js";
export { NeedsReauthError } from "./tokens.js";
```

- [ ] **Step 7: Run** — `npx vitest run tests/esi` — Expected: PASS (10 tests).

- [ ] **Step 8: Generate ESI types** — `scripts/esi-types.ts`:
```ts
import { writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const SPEC = "https://esi.evetech.net/meta/openapi.json";
const OUT = new URL("../src/lib/esi/types.gen.ts", import.meta.url);

const ast = await openapiTS(new URL(SPEC));
await writeFile(OUT, `// Generated from ${SPEC} by scripts/esi-types.ts — do not edit.\n` + astToString(ast));
console.log("wrote", OUT.pathname);
```
Run: `npm run esi:types && grep -c '"/characters/{character_id}/skills"' src/lib/esi/types.gen.ts`
Expected: file written; grep prints ≥ 1.

- [ ] **Step 9: Typecheck and commit** — `npm run typecheck && git add -A && git commit -m "Add ESI client with token refresh, caching, rate limiting; generate ESI types"`

---

### Task 10: Worker scheduler and the character-info job

**Files:**
- Create: `src/worker/scheduler.ts`, `src/worker/jobs/character-info.ts`, `src/worker/index.ts`, `tests/worker/scheduler.test.ts`, `tests/worker/character-info.test.ts`

**Interfaces:**
- Consumes: Task 4 `listCharacters`, `updateCharacterInfo`, `startRun`, `finishRun`; Task 9 `EsiClient`, `NeedsReauthError`.
- Produces:
```ts
export interface JobContext { characterId: number; esi: EsiClient }
export interface SyncJob { name: string; intervalMs: number; run(ctx: JobContext): Promise<number> }   // returns rows touched
export interface SchedulerDeps { jobs: SyncJob[]; esi: EsiClient; listCharacters: () => Promise<{ id: number; tokenStatus: string }[]>; startRun: typeof startRun; finishRun: typeof finishRun; now?: () => number; staggerMs?: number; log?: (msg: string) => void }
export class Scheduler { constructor(deps: SchedulerDeps); tick(): Promise<number>; /* runs everything due; returns count run */ }
export const characterInfoJob: SyncJob   // name "character-info", interval 6h
```

- [ ] **Step 1: Failing scheduler test** — `tests/worker/scheduler.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { Scheduler, type SyncJob } from "../../src/worker/scheduler.js";
import { NeedsReauthError } from "../../src/lib/esi/tokens.js";

function make(jobs: SyncJob[], chars = [{ id: 1, tokenStatus: "ok" }, { id: 2, tokenStatus: "ok" }]) {
  let t = 0;
  const runs: { job: string; cid: number | null }[] = [];
  const finished: { id: number; status: string; error?: string; rows?: number }[] = [];
  const s = new Scheduler({
    jobs, esi: {} as never, listCharacters: async () => chars,
    startRun: async (job, cid) => { runs.push({ job, cid }); return runs.length; },
    finishRun: async (id, r) => { finished.push({ id, ...r }); },
    now: () => t, staggerMs: 5000, log: () => {},
  });
  return { s, runs, finished, advance: (ms: number) => { t += ms; } };
}

describe("Scheduler", () => {
  it("staggers first runs and repeats on the interval", async () => {
    const run = vi.fn(async () => 1);
    const { s, runs, advance } = make([{ name: "j", intervalMs: 60_000, run }]);
    expect(await s.tick()).toBe(1);                 // t=0: character 1 due, character 2 due at 5s
    advance(5000); expect(await s.tick()).toBe(1);   // character 2
    advance(1000); expect(await s.tick()).toBe(0);
    advance(54_000); expect(await s.tick()).toBe(1); // t=60s: character 1 again
    expect(runs.map((r) => r.cid)).toEqual([1, 2, 1]);
  });
  it("records errors, keeps going, and skips needs_reauth characters", async () => {
    const run = vi.fn(async ({ characterId }: { characterId: number }) => { if (characterId === 1) throw new Error("boom"); return 3; });
    const { s, finished, advance } = make([{ name: "j", intervalMs: 60_000, run }], [{ id: 1, tokenStatus: "ok" }, { id: 2, tokenStatus: "ok" }, { id: 3, tokenStatus: "needs_reauth" }]);
    await s.tick(); advance(5000); await s.tick(); advance(5000); await s.tick();
    expect(finished).toEqual([{ id: 1, status: "error", error: "boom" }, { id: 2, status: "ok", rows: 3 }]);
  });
  it("treats NeedsReauthError as a quiet error", async () => {
    const run = vi.fn(async () => { throw new NeedsReauthError(1); });
    const { s, finished } = make([{ name: "j", intervalMs: 60_000, run }], [{ id: 1, tokenStatus: "ok" }]);
    await s.tick();
    expect(finished[0].status).toBe("error"); expect(finished[0].error).toMatch(/re-authorisation/);
  });
});
```

- [ ] **Step 2: Failing job test** — `tests/worker/character-info.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { characterInfoJob } from "../../src/worker/jobs/character-info.js";

vi.mock("../../src/lib/db/characters.js", () => ({ updateCharacterInfo: vi.fn(async () => {}) }));
import { updateCharacterInfo } from "../../src/lib/db/characters.js";

describe("character-info job", () => {
  it("fetches character, corporation and alliance names", async () => {
    const get = vi.fn(async (path: string) => {
      if (path === "/characters/1") return { data: { name: "T", corporation_id: 98, alliance_id: 99 } };
      if (path === "/corporations/98") return { data: { name: "Corp" } };
      if (path === "/alliances/99") return { data: { name: "Ally" } };
      throw new Error(path);
    });
    const rows = await characterInfoJob.run({ characterId: 1, esi: { get } as never });
    expect(rows).toBe(1);
    expect(updateCharacterInfo).toHaveBeenCalledWith(1, { name: "T", corporationId: 98, corporationName: "Corp", allianceId: 99, allianceName: "Ally" });
    expect(characterInfoJob.intervalMs).toBe(6 * 60 * 60 * 1000);
  });
  it("handles no alliance", async () => {
    const get = vi.fn(async (path: string) => path === "/characters/1" ? { data: { name: "T", corporation_id: 98 } } : { data: { name: "Corp" } });
    await characterInfoJob.run({ characterId: 1, esi: { get } as never });
    expect(updateCharacterInfo).toHaveBeenLastCalledWith(1, { name: "T", corporationId: 98, corporationName: "Corp", allianceId: null, allianceName: null });
  });
});
```

- [ ] **Step 3: Run** — `npx vitest run tests/worker` — Expected: FAIL.

- [ ] **Step 4: Implement `src/worker/scheduler.ts`**
```ts
import type { EsiClient } from "../lib/esi/client.js";
import { NeedsReauthError } from "../lib/esi/tokens.js";
import type { startRun, finishRun } from "../lib/db/sync-runs.js";

export interface JobContext { characterId: number; esi: EsiClient }
export interface SyncJob { name: string; intervalMs: number; run(ctx: JobContext): Promise<number> }
export interface SchedulerDeps {
  jobs: SyncJob[]; esi: EsiClient; listCharacters: () => Promise<{ id: number; tokenStatus: string }[]>;
  startRun: typeof startRun; finishRun: typeof finishRun; now?: () => number; staggerMs?: number; log?: (msg: string) => void;
}

export class Scheduler {
  private due = new Map<string, number>();   // `${job}:${cid}` → next due time
  private now: () => number; private stagger: number; private log: (m: string) => void;
  constructor(private deps: SchedulerDeps) {
    this.now = deps.now ?? Date.now; this.stagger = deps.staggerMs ?? 5000; this.log = deps.log ?? ((m) => console.log(`[worker] ${m}`));
  }

  async tick(): Promise<number> {
    const chars = (await this.deps.listCharacters()).filter((c) => c.tokenStatus === "ok");
    let ran = 0, slot = 0;
    for (const job of this.deps.jobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (!this.due.has(key)) this.due.set(key, this.now() + slot * this.stagger);
        slot++;
      }
    }
    for (const job of this.deps.jobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (this.due.get(key)! > this.now()) continue;
        await this.runOne(job, c.id);
        this.due.set(key, this.now() + job.intervalMs);
        ran++;
      }
    }
    return ran;
  }

  private async runOne(job: SyncJob, characterId: number): Promise<void> {
    const id = await this.deps.startRun(job.name, characterId);
    try {
      const rows = await job.run({ characterId, esi: this.deps.esi });
      await this.deps.finishRun(id, { status: "ok", rows });
      this.log(`${job.name} character=${characterId} ok rows=${rows}`);
    } catch (e) {
      const error = e instanceof NeedsReauthError ? e.message : (e as Error).message ?? String(e);
      await this.deps.finishRun(id, { status: "error", error });
      this.log(`${job.name} character=${characterId} error: ${error}`);
    }
  }
}
```

- [ ] **Step 5: Implement the job and entrypoint**

`src/worker/jobs/character-info.ts`:
```ts
import type { SyncJob } from "../scheduler.js";
import { updateCharacterInfo } from "../../lib/db/characters.js";

interface CharacterPublic { name: string; corporation_id: number; alliance_id?: number }
interface Named { name: string }

export const characterInfoJob: SyncJob = {
  name: "character-info",
  intervalMs: 6 * 60 * 60 * 1000,
  async run({ characterId, esi }) {
    const me = (await esi.get<CharacterPublic>(`/characters/${characterId}`)).data;
    const corp = (await esi.get<Named>(`/corporations/${me.corporation_id}`)).data;
    const ally = me.alliance_id ? (await esi.get<Named>(`/alliances/${me.alliance_id}`)).data : null;
    await updateCharacterInfo(characterId, { name: me.name, corporationId: me.corporation_id, corporationName: corp.name, allianceId: me.alliance_id ?? null, allianceName: ally?.name ?? null });
    return 1;
  },
};
```

`src/worker/index.ts`:
```ts
import { getConfig } from "../lib/config.js";
import { createEsiClient } from "../lib/esi/index.js";
import { listCharacters } from "../lib/db/characters.js";
import { startRun, finishRun } from "../lib/db/sync-runs.js";
import { Scheduler } from "./scheduler.js";
import { characterInfoJob } from "./jobs/character-info.js";

const TICK_MS = 30_000;
getConfig();   // fail fast on missing env
const scheduler = new Scheduler({ jobs: [characterInfoJob], esi: createEsiClient(), listCharacters, startRun, finishRun });
console.log("[worker] started");
async function loop() {
  try { await scheduler.tick(); } catch (e) { console.error("[worker] tick failed:", e); }
  setTimeout(loop, TICK_MS);
}
void loop();
```

- [ ] **Step 6: Run** — `npx vitest run tests/worker && npm run typecheck` — Expected: PASS.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "Add sync worker scheduler and character-info job"`

---

### Task 11: Shell, character switcher, login, overview, placeholders

**Files:**
- Create: `src/app/components/Shell.tsx`, `AppHeader.tsx`, `TopNav.tsx`, `BottomBar.tsx`, `AppFooter.tsx`, `CharacterSwitcher.tsx`, `ComingSoon.tsx`, `shell-routes.ts`, `src/lib/view/characters.ts`, `src/app/login/page.tsx`, `src/app/{skills,ships,fitting,assets,wallet,combat}/page.tsx`, `tests/components/character-switcher.test.tsx`, `tests/components/login.test.tsx`, `tests/view/characters.test.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: Task 4 `listCharacters`, `listAccounts`, `latestRuns`; Task 6 `readSession`; Task 1 nav.
- Produces:
```ts
// src/lib/view/characters.ts — pure, testable
export interface CharacterView { id: number; name: string; accountId: number | null; corporationName: string | null; allianceName: string | null; tokenStatus: "ok" | "needs_reauth" }
export interface CharacterGroup { label: string; characters: CharacterView[] }
export function groupByAccount(characters: CharacterView[], accounts: { id: number; name: string }[]): CharacterGroup[]  // account order, then "Unassigned" last
export function portraitUrl(id: number, size?: 64 | 128 | 256): string   // https://images.evetech.net/characters/{id}/portrait?size=
// CharacterSwitcher props
{ groups: CharacterGroup[]; activeId: number | null; pathname: string }
```

- [ ] **Step 1: Failing tests**

`tests/view/characters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { groupByAccount, portraitUrl } from "../../src/lib/view/characters.js";
const c = (id: number, accountId: number | null) => ({ id, name: `c${id}`, accountId, corporationName: null, allianceName: null, tokenStatus: "ok" as const });
describe("groupByAccount", () => {
  it("groups in account order with Unassigned last and drops empty accounts", () => {
    const g = groupByAccount([c(1, 2), c(2, 1), c(3, null)], [{ id: 1, name: "Main" }, { id: 2, name: "Alt" }, { id: 3, name: "Empty" }]);
    expect(g.map((x) => [x.label, x.characters.map((y) => y.id)])).toEqual([["Main", [2]], ["Alt", [1]], ["Unassigned", [3]]]);
  });
  it("portrait url", () => { expect(portraitUrl(5)).toBe("https://images.evetech.net/characters/5/portrait?size=64"); });
});
```

`tests/components/character-switcher.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { CharacterSwitcher } from "../../src/app/components/CharacterSwitcher.js";

const groups = [
  { label: "Main", characters: [{ id: 1, name: "Mara Vexley", accountId: 1, corporationName: null, allianceName: null, tokenStatus: "ok" as const }, { id: 2, name: "Jorin Hale", accountId: 1, corporationName: null, allianceName: null, tokenStatus: "needs_reauth" as const }] },
  { label: "Alt", characters: [{ id: 3, name: "Nyx Calder", accountId: 2, corporationName: null, allianceName: null, tokenStatus: "ok" as const }] },
];
const ui = (activeId: number | null) => render(<MantineProvider><CharacterSwitcher groups={groups} activeId={activeId} pathname="/ships" /></MantineProvider>);

describe("CharacterSwitcher", () => {
  it("shows the active character in the trigger", () => {
    ui(3);
    expect(screen.getByRole("button", { name: /character menu/i })).toHaveTextContent("Nyx Calder");
  });
  it("lists groups, marks re-auth, and posts a switch form to /auth/switch with the current path", () => {
    ui(1);
    fireEvent.click(screen.getByRole("button", { name: /character menu/i }));
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Alt")).toBeInTheDocument();
    expect(screen.getByText(/re-authorise/i)).toBeInTheDocument();
    const form = screen.getByText("Jorin Hale").closest("form")!;
    expect(form.getAttribute("action")).toBe("/auth/switch");
    expect((form.querySelector('input[name="characterId"]') as HTMLInputElement).value).toBe("2");
    expect((form.querySelector('input[name="next"]') as HTMLInputElement).value).toBe("/ships");
    expect(screen.getByRole("link", { name: /add character/i })).toHaveAttribute("href", "/auth/start");
  });
  it("falls back to 'Add character' when nothing is active", () => {
    ui(null);
    expect(screen.getByRole("button", { name: /character menu/i })).toHaveTextContent(/add character/i);
  });
});
```

`tests/components/login.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginCard } from "../../src/app/login/LoginCard.js";

describe("LoginCard", () => {
  it("links to /auth/start and explains errors", () => {
    render(<LoginCard error="not-allowed" />);
    expect(screen.getByRole("link", { name: /log in with eve online/i })).toHaveAttribute("href", "/auth/start");
    expect(screen.getByText(/not on the allow-list/i)).toBeInTheDocument();
  });
  it("shows no error by default", () => {
    render(<LoginCard error={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/view tests/components` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/view/characters.ts`**
```ts
export interface CharacterView { id: number; name: string; accountId: number | null; corporationName: string | null; allianceName: string | null; tokenStatus: "ok" | "needs_reauth" }
export interface CharacterGroup { label: string; characters: CharacterView[] }

export function groupByAccount(characters: CharacterView[], accounts: { id: number; name: string }[]): CharacterGroup[] {
  const groups: CharacterGroup[] = [];
  for (const a of accounts) {
    const cs = characters.filter((c) => c.accountId === a.id);
    if (cs.length) groups.push({ label: a.name, characters: cs });
  }
  const known = new Set(accounts.map((a) => a.id));
  const rest = characters.filter((c) => c.accountId === null || !known.has(c.accountId));
  if (rest.length) groups.push({ label: "Unassigned", characters: rest });
  return groups;
}

export function portraitUrl(id: number, size: 64 | 128 | 256 = 64): string {
  return `https://images.evetech.net/characters/${id}/portrait?size=${size}`;
}
```

- [ ] **Step 4: Implement the shell components**

`src/app/components/shell-routes.ts`:
```ts
const BARE_PREFIXES = ["/login"];
export function isBareRoute(pathname: string | null): boolean { return !!pathname && BARE_PREFIXES.some((p) => pathname.startsWith(p)); }
```

`src/app/components/TopNav.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "../../config/nav.js";
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => { const active = isNavActive(item, pathname);
        return <Link key={item.key} href={item.href} className="nav-link" data-active={active || undefined} aria-current={active ? "page" : undefined}>{item.label}</Link>; })}
    </nav>
  );
}
```

`src/app/components/BottomBar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconBrain, IconRocket, IconTool, IconBox, IconWallet, IconSwords, type IconProps } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { NAV_ITEMS, isNavActive, type NavKey } from "../../config/nav.js";
const ICONS: Record<NavKey, ComponentType<IconProps>> = { overview: IconHome, skills: IconBrain, ships: IconRocket, fitting: IconTool, assets: IconBox, wallet: IconWallet, combat: IconSwords };
export function BottomBar() {
  const pathname = usePathname();
  return (
    <nav className="bottom-bar" aria-label="Primary (mobile)">
      {NAV_ITEMS.map((item) => { const Icon = ICONS[item.key]; const active = isNavActive(item, pathname);
        return <Link key={item.key} href={item.href} className="bottom-item" data-active={active || undefined}><Icon size={20} stroke={1.8} /><span>{item.shortLabel}</span></Link>; })}
    </nav>
  );
}
```

`src/app/components/AppFooter.tsx`:
```tsx
export function AppFooter() {
  return (<footer className="app-footer">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/eve-mark.svg" alt="" className="footer-mark" />
    <span className="footer-copy">EVE Online and the EVE logo are trademarks of CCP hf. This is a personal tool.</span>
  </footer>);
}
```

`src/app/components/CharacterSwitcher.tsx`:
```tsx
"use client";
import { Menu } from "@mantine/core";
import { IconPlus, IconSettings, IconLogout, IconAlertTriangle } from "@tabler/icons-react";
import { portraitUrl, type CharacterGroup } from "../../lib/view/characters.js";

export function CharacterSwitcher({ groups, activeId, pathname }: { groups: CharacterGroup[]; activeId: number | null; pathname: string }) {
  const active = groups.flatMap((g) => g.characters).find((c) => c.id === activeId) ?? null;
  return (
    <Menu position="bottom-end" width={260} withinPortal shadow="md">
      <Menu.Target>
        <button type="button" className="user-menu" aria-label="Character menu">
          {active
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={portraitUrl(active.id)} alt="" className={`char-avatar${active.tokenStatus === "needs_reauth" ? " warn" : ""}`} />
            : <span className="user-avatar"><IconPlus size={16} /></span>}
          <span className="user-name">{active ? active.name : "Add character"}</span>
          <span className="user-caret" aria-hidden="true" />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {groups.map((g) => (
          <div key={g.label}>
            <div className="char-group-label">{g.label}</div>
            {g.characters.map((c) => (
              <form key={c.id} method="post" action="/auth/switch">
                <input type="hidden" name="characterId" value={c.id} />
                <input type="hidden" name="next" value={pathname} />
                <Menu.Item component="button" type="submit"
                  // eslint-disable-next-line @next/next/no-img-element
                  leftSection={<img src={portraitUrl(c.id)} alt="" className="char-avatar" style={{ width: 24, height: 24 }} />}
                  rightSection={c.tokenStatus === "needs_reauth" ? <span className="neg" title="Re-authorise in Settings"><IconAlertTriangle size={14} /> re-authorise</span> : null}
                  data-active={c.id === activeId || undefined}>
                  {c.name}
                </Menu.Item>
              </form>
            ))}
          </div>
        ))}
        <Menu.Divider />
        <Menu.Item component="a" href="/auth/start" leftSection={<IconPlus size={16} />}>Add character</Menu.Item>
        <Menu.Item component="a" href="/settings" leftSection={<IconSettings size={16} />}>Settings</Menu.Item>
        <form method="post" action="/auth/logout">
          <Menu.Item component="button" type="submit" color="red" leftSection={<IconLogout size={16} />}>Logout</Menu.Item>
        </form>
      </Menu.Dropdown>
    </Menu>
  );
}
```

`src/app/components/AppHeader.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopNav } from "./TopNav.js";
import { CharacterSwitcher } from "./CharacterSwitcher.js";
import type { CharacterGroup } from "../../lib/view/characters.js";

export function AppHeader({ groups, activeId }: { groups: CharacterGroup[]; activeId: number | null }) {
  const pathname = usePathname();
  return (
    <header className="app-header">
      <div className="app-bar-inner">
        <Link href="/" className="logo-lockup" aria-label="EVE — home">
          <span className="logo-text">EVE</span>
          <span className="logo-divider" aria-hidden="true" />
          <span className="wordmark">Plasma</span>
        </Link>
        <TopNav />
        <CharacterSwitcher groups={groups} activeId={activeId} pathname={pathname} />
      </div>
    </header>
  );
}
```

`src/app/components/Shell.tsx`:
```tsx
"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader.js";
import { AppFooter } from "./AppFooter.js";
import { BottomBar } from "./BottomBar.js";
import { isBareRoute } from "./shell-routes.js";
import type { CharacterGroup } from "../../lib/view/characters.js";

export function Shell({ children, groups, activeId }: { children: ReactNode; groups: CharacterGroup[]; activeId: number | null }) {
  const pathname = usePathname();
  if (isBareRoute(pathname)) return <>{children}</>;
  return (<>
    <AppHeader groups={groups} activeId={activeId} />
    <main className="app-main">{children}</main>
    <AppFooter />
    <BottomBar />
  </>);
}
```

`src/app/components/ComingSoon.tsx`:
```tsx
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (<>
    <h1 className="page-title">{title}</h1>
    <div className="card coming-soon">Coming in {phase}.</div>
  </>);
}
```

- [ ] **Step 5: Root layout loads session + characters**

Replace `src/app/layout.tsx` body with:
```tsx
import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { inter, poppins, spaceGrotesk } from "./fonts.js";
import { theme } from "./theme.js";
import { Shell } from "./components/Shell.js";
import { readSession } from "../lib/auth/session.js";
import { listCharacters } from "../lib/db/characters.js";
import { listAccounts } from "../lib/db/accounts.js";
import { groupByAccount, type CharacterGroup } from "../lib/view/characters.js";

export const metadata = { title: "EVE", description: "EVE Online command centre" };
export const dynamic = "force-dynamic";

async function loadShellData(): Promise<{ groups: CharacterGroup[]; activeId: number | null }> {
  try {
    const [session, characters, accounts] = await Promise.all([readSession(), listCharacters(), listAccounts()]);
    return { groups: groupByAccount(characters, accounts), activeId: session?.activeCharacterId ?? null };
  } catch (e) {
    console.error("[layout] shell data unavailable:", (e as Error).message);
    return { groups: [], activeId: null };
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { groups, activeId } = await loadShellData();
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`} {...mantineHtmlProps}>
      <head><ColorSchemeScript forceColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <Shell groups={groups} activeId={activeId}>{children}</Shell>
        </MantineProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Login page**

`src/app/login/LoginCard.tsx`:
```tsx
const MESSAGES: Record<string, string> = {
  "not-allowed": "That character is not on the allow-list for this site.",
  state: "The login attempt expired or was tampered with. Please try again.",
  token: "EVE SSO did not accept the login. Please try again.",
  jwt: "EVE SSO returned a token we could not verify.",
  unknown: "Login failed. Please try again.",
};
export function LoginCard({ error }: { error: string | null }) {
  return (
    <div className="login-page">
      <div className="login-logo"><span className="logo-text">EVE</span><span className="login-wordmark">Plasma</span></div>
      <div className="login-card">
        <h1 className="login-h1">Sign in</h1>
        <p className="login-sub">Authorise one of your characters with EVE Online SSO.</p>
        {error ? <p className="login-msg" role="alert">{MESSAGES[error] ?? MESSAGES.unknown}</p> : null}
        <a className="sso-btn" href="/auth/start">Log in with EVE Online</a>
      </div>
      <p className="login-copy">Private tool · only allow-listed characters can sign in.</p>
    </div>
  );
}
```

`src/app/login/page.tsx`:
```tsx
import { LoginCard } from "./LoginCard.js";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginCard error={error ?? null} />;
}
```

- [ ] **Step 7: Overview page and placeholders**

`src/app/page.tsx`:
```tsx
import { listCharacters } from "../lib/db/characters.js";
import { latestRuns } from "../lib/db/sync-runs.js";
import { portraitUrl } from "../lib/view/characters.js";

function ago(d: Date | null): string {
  if (!d) return "never";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default async function Overview() {
  const [characters, runs] = await Promise.all([listCharacters(), latestRuns()]);
  return (<>
    <h1 className="page-title">Overview</h1>
    <p className="page-sub">{characters.length} character{characters.length === 1 ? "" : "s"} authorised</p>
    <div className="card-grid">
      {characters.map((c) => {
        const last = runs.filter((r) => r.characterId === c.id).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
        return (
          <div key={c.id} className="card char-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portraitUrl(c.id, 128)} alt="" />
            <div>
              <h3>{c.name}</h3>
              <p>{c.corporationName ?? "—"}{c.allianceName ? ` · ${c.allianceName}` : ""}</p>
              <p>Wallet: <span className="faint">not synced yet</span></p>
              <p className="faint">Last sync: {ago(last?.startedAt ?? null)}{c.tokenStatus === "needs_reauth" ? <span className="badge needs_reauth" style={{ marginLeft: 8 }}>re-authorise</span> : null}</p>
            </div>
          </div>
        );
      })}
    </div>
    {characters.length === 0 ? <div className="card coming-soon">No characters yet — use the menu top-right to add one.</div> : null}
  </>);
}
```

Placeholder pages — create each of `src/app/skills/page.tsx`, `ships`, `fitting`, `assets`, `wallet`, `combat` with the matching title/phase:
```tsx
import { ComingSoon } from "../components/ComingSoon.js";
export default function Page() { return <ComingSoon title="Skills" phase="phase 3 (character sync) and phase 6 (skill planner)" />; }
```
Titles/phases: Skills → "phase 3 (character sync) and phase 6 (skill planner)"; Ships → "phase 4 (ships & fittings viewer)"; Fitting → "phase 5 (fitting designer)"; Assets → "phase 3 (character sync)"; Wallet → "phase 3 (character sync)"; Combat → "phase 7 (killmails & PvP stats)".

- [ ] **Step 8: Run tests, typecheck, build, and eyeball**

Run: `npm test && npm run typecheck && npm run build`
Then: `npm run dev` (with the dev Postgres up and `npm run migrate` applied), open `http://localhost:3000/` → redirected to `/login`; the login card renders in Midnight styling. Stop the dev server.
Expected: all PASS; visual check OK.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "Add Midnight shell, character switcher, login and overview pages"`

---

### Task 12: Settings page, JSON API, health endpoint

**Files:**
- Create: `src/app/api/health/route.ts`, `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`, `src/app/api/characters/[id]/route.ts`, `src/app/settings/page.tsx`, `src/app/settings/AccountsPanel.tsx`, `src/app/settings/CharactersPanel.tsx`, `src/app/settings/SyncStatus.tsx`, `src/lib/api/json.ts`, `tests/api/json.test.ts`, `tests/components/sync-status.test.tsx`

**Interfaces:**
- Consumes: Task 4 repos.
- Produces:
```ts
// src/lib/api/json.ts
export function parseName(body: unknown): string | null                 // trimmed 1..40 chars else null
export function parseAccountId(body: unknown): number | null | undefined // undefined = invalid; null = unassign
// HTTP
GET  /api/health                → 200 {"ok":true,"db":true} or 503 {"ok":false}
POST /api/accounts {name}       → 201 Account | 400
PATCH /api/accounts/:id {name}  → 204 | 400
DELETE /api/accounts/:id        → 204
PATCH /api/characters/:id {accountId: number|null} → 204 | 400
DELETE /api/characters/:id      → 204
```

- [ ] **Step 1: Failing tests**

`tests/api/json.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseName, parseAccountId } from "../../src/lib/api/json.js";
describe("api parsing", () => {
  it("parseName trims and bounds", () => {
    expect(parseName({ name: "  Main " })).toBe("Main");
    expect(parseName({ name: "" })).toBeNull();
    expect(parseName({ name: "x".repeat(41) })).toBeNull();
    expect(parseName(null)).toBeNull();
  });
  it("parseAccountId accepts null, positive ints; rejects others", () => {
    expect(parseAccountId({ accountId: null })).toBeNull();
    expect(parseAccountId({ accountId: 3 })).toBe(3);
    expect(parseAccountId({ accountId: "3" })).toBeUndefined();
    expect(parseAccountId({})).toBeUndefined();
  });
});
```

`tests/components/sync-status.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SyncStatus } from "../../src/app/settings/SyncStatus.js";
describe("SyncStatus", () => {
  it("renders a row per run with status badge and character name", () => {
    render(<SyncStatus runs={[{ job: "character-info", characterId: 1, startedAt: new Date(), finishedAt: new Date(), status: "error", rows: null, error: "boom" }]} names={{ 1: "Mara Vexley" }} />);
    expect(screen.getByText("character-info")).toBeInTheDocument();
    expect(screen.getByText("Mara Vexley")).toBeInTheDocument();
    expect(screen.getByText("error")).toHaveClass("badge");
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
  it("shows an empty state", () => {
    render(<SyncStatus runs={[]} names={{}} />);
    expect(screen.getByText(/no sync runs yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run tests/api tests/components/sync-status.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement parsing + routes**

`src/lib/api/json.ts`:
```ts
export function parseName(body: unknown): string | null {
  const raw = (body as { name?: unknown } | null)?.name;
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= 40 ? name : null;
}
export function parseAccountId(body: unknown): number | null | undefined {
  if (!body || typeof body !== "object" || !("accountId" in body)) return undefined;
  const v = (body as { accountId: unknown }).accountId;
  if (v === null) return null;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;
}
```

`src/app/api/health/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db/client.js";
export async function GET() {
  try { await getPool().query("SELECT 1"); return NextResponse.json({ ok: true, db: true }); }
  catch { return NextResponse.json({ ok: false, db: false }, { status: 503 }); }
}
```

`src/app/api/accounts/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createAccount, listAccounts } from "../../../lib/db/accounts.js";
import { parseName } from "../../../lib/api/json.js";
export async function GET() { return NextResponse.json(await listAccounts()); }
export async function POST(req: NextRequest) {
  const name = parseName(await req.json().catch(() => null));
  if (!name) return NextResponse.json({ error: "name required (1-40 chars)" }, { status: 400 });
  try { return NextResponse.json(await createAccount(name), { status: 201 }); }
  catch { return NextResponse.json({ error: "an account with that name exists" }, { status: 409 }); }
}
```

`src/app/api/accounts/[id]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { renameAccount, deleteAccount } from "../../../../lib/db/accounts.js";
import { parseName } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  const name = parseName(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !name) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await renameAccount(id, name);
  return new NextResponse(null, { status: 204 });
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await deleteAccount(Number((await params).id));
  return new NextResponse(null, { status: 204 });
}
```

`src/app/api/characters/[id]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { setCharacterAccount, deleteCharacter } from "../../../../lib/db/characters.js";
import { parseAccountId } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  const accountId = parseAccountId(await req.json().catch(() => null));
  if (!Number.isInteger(id) || accountId === undefined) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await setCharacterAccount(id, accountId);
  return new NextResponse(null, { status: 204 });
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await deleteCharacter(Number((await params).id));
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Settings UI**

`src/app/settings/SyncStatus.tsx`:
```tsx
import type { SyncRunSummary } from "../../lib/db/sync-runs.js";
export function SyncStatus({ runs, names }: { runs: SyncRunSummary[]; names: Record<number, string> }) {
  if (runs.length === 0) return <p className="faint">No sync runs yet — the worker runs the first job within a minute of a character being added.</p>;
  return (
    <table className="table">
      <thead><tr><th>Job</th><th>Character</th><th>Started</th><th>Status</th><th>Rows</th><th>Error</th></tr></thead>
      <tbody>
        {runs.map((r, i) => (
          <tr key={i}>
            <td>{r.job}</td>
            <td>{r.characterId === null ? "—" : names[r.characterId] ?? r.characterId}</td>
            <td className="muted">{r.startedAt.toISOString().replace("T", " ").slice(0, 16)}</td>
            <td><span className={`badge ${r.status}`}>{r.status}</span></td>
            <td>{r.rows ?? "—"}</td>
            <td className="neg">{r.error ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`src/app/settings/AccountsPanel.tsx` (client):
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextInput, Group } from "@mantine/core";
import type { Account } from "../../lib/db/accounts.js";

export function AccountsPanel({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false); router.refresh();
  }
  return (
    <div className="card">
      <h2 className="card-title">Accounts</h2>
      {accounts.map((a) => (
        <Group key={a.id} justify="space-between" mb="xs">
          <span>{a.name}</span>
          <Group gap="xs">
            <Button size="xs" variant="subtle" disabled={busy} onClick={() => { const n = window.prompt("Rename account", a.name); if (n) void call(`/api/accounts/${a.id}`, "PATCH", { name: n }); }}>Rename</Button>
            <Button size="xs" variant="subtle" color="red" disabled={busy} onClick={() => { if (window.confirm(`Delete account "${a.name}"? Characters are kept and become unassigned.`)) void call(`/api/accounts/${a.id}`, "DELETE"); }}>Delete</Button>
          </Group>
        </Group>
      ))}
      <Group mt="md">
        <TextInput placeholder="New account name (e.g. Main)" value={name} onChange={(e) => setName(e.currentTarget.value)} size="sm" />
        <Button size="sm" disabled={busy || !name.trim()} onClick={async () => { await call("/api/accounts", "POST", { name }); setName(""); }}>Add</Button>
      </Group>
    </div>
  );
}
```

`src/app/settings/CharactersPanel.tsx` (client):
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, NativeSelect } from "@mantine/core";
import { portraitUrl, type CharacterView } from "../../lib/view/characters.js";
import type { Account } from "../../lib/db/accounts.js";

export function CharactersPanel({ characters, accounts }: { characters: CharacterView[]; accounts: Account[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false); router.refresh();
  }
  return (
    <div className="card">
      <h2 className="card-title">Characters</h2>
      {characters.length === 0 ? <p className="faint">No characters yet.</p> : null}
      {characters.map((c) => (
        <Group key={c.id} justify="space-between" mb="sm" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portraitUrl(c.id)} alt="" className={`char-avatar${c.tokenStatus === "needs_reauth" ? " warn" : ""}`} />
            <div><div>{c.name}</div><div className="faint" style={{ fontSize: 12 }}>{c.corporationName ?? "—"}{c.tokenStatus === "needs_reauth" ? <span className="badge needs_reauth" style={{ marginLeft: 8 }}>needs re-authorisation</span> : null}</div></div>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <NativeSelect size="xs" value={c.accountId ?? ""} disabled={busy}
              data={[{ value: "", label: "Unassigned" }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]}
              onChange={(e) => void call(`/api/characters/${c.id}`, "PATCH", { accountId: e.currentTarget.value ? Number(e.currentTarget.value) : null })} />
            <Button size="xs" variant="subtle" component="a" href="/auth/start">Re-authorise</Button>
            <Button size="xs" variant="subtle" color="red" disabled={busy} onClick={() => { if (window.confirm(`Remove ${c.name} and all its synced data?`)) void call(`/api/characters/${c.id}`, "DELETE"); }}>Remove</Button>
          </Group>
        </Group>
      ))}
      <Button mt="md" size="sm" component="a" href="/auth/start">Add character</Button>
    </div>
  );
}
```

`src/app/settings/page.tsx`:
```tsx
import { listAccounts } from "../../lib/db/accounts.js";
import { listCharacters } from "../../lib/db/characters.js";
import { latestRuns } from "../../lib/db/sync-runs.js";
import { AccountsPanel } from "./AccountsPanel.js";
import { CharactersPanel } from "./CharactersPanel.js";
import { SyncStatus } from "./SyncStatus.js";

export default async function SettingsPage() {
  const [accounts, characters, runs] = await Promise.all([listAccounts(), listCharacters(), latestRuns()]);
  const names = Object.fromEntries(characters.map((c) => [c.id, c.name]));
  return (<>
    <h1 className="page-title">Settings</h1>
    <p className="page-sub">Accounts, characters and sync status.</p>
    <div className="card-grid" style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 20 }}>
      <AccountsPanel accounts={accounts} />
      <CharactersPanel characters={characters} accounts={accounts} />
    </div>
    <div className="card"><h2 className="card-title">Sync status</h2><SyncStatus runs={runs} names={names} /></div>
  </>);
}
```

- [ ] **Step 5: Run** — `npm test && npm run typecheck && npm run build` — Expected: PASS, clean, builds.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add settings page, accounts/characters API and health endpoint"`

---

### Task 13: Production image and Compose stack

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `deploy/docker-compose.yml`, `deploy/.env.example`

**Interfaces:**
- Produces: image `eve:latest` running `npm run start` (app) or `npm run worker` (worker); compose services `app`, `worker`, `postgres` on networks `proxy` (external, shared with Traefik) and `internal`.

- [ ] **Step 1: `Dockerfile`**
```dockerfile
# EVE app image. One image serves the web app (`npm run start`) and the worker (`npm run worker`).
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The VM has ~3.3 GB RAM: cap the build heap so `next build` doesn't get OOM-killed.
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 2: `.dockerignore`**
```
node_modules
.next
.git
deploy
docs
tests
compose.dev.yml
.env
.env.*
tsconfig.tsbuildinfo
```

- [ ] **Step 3: `deploy/docker-compose.yml`** (runs on the VM from `/opt/eve/src/deploy`; the build context is the synced repo one level up)
```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: eve-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: eve
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: eve
    volumes:
      - eve_pg:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U eve -d eve"]
      interval: 10s
      timeout: 5s
      retries: 10

  app:
    build: ..
    image: eve:latest
    container_name: eve-app
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
    networks: [proxy, internal]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=proxy"
      - "traefik.http.services.eve.loadbalancer.server.port=3000"
      - "traefik.http.routers.eve.rule=Host(`${APP_DOMAIN}`)"
      - "traefik.http.routers.eve.entrypoints=websecure"
      - "traefik.http.routers.eve.tls.certresolver=cloudflare"
      - "traefik.http.routers.eve.middlewares=lan-only@file,secure-headers@file"

  worker:
    image: eve:latest
    container_name: eve-worker
    restart: unless-stopped
    env_file: .env
    command: ["npm", "run", "worker"]
    depends_on:
      postgres: { condition: service_healthy }
      app: { condition: service_started }   # app is built first; worker reuses the image
    networks: [internal]

volumes:
  eve_pg:

networks:
  proxy:
    external: true
  internal:
```

- [ ] **Step 4: `deploy/.env.example`** — same keys as the root `.env.example` plus `APP_DOMAIN=eve.plasma66.com`; `DATABASE_URL=postgres://eve:<POSTGRES_PASSWORD>@postgres:5432/eve`.

- [ ] **Step 5: Local build check** — `docker build -t eve:latest .` on the dev machine — Expected: image builds (this also validates `.dockerignore` keeps `.env` out: `docker run --rm eve:latest ls -a /app | grep -c '^.env$'` prints `0`).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add production Dockerfile and Compose stack"`

---

### Task 14: Ansible provisioning, deploy to the VM, acceptance

**Files:**
- Create: `deploy/ansible/ansible.cfg`, `inventory.ini`, `requirements.yml`, `site.yml`, `group_vars/eve.yml`, `vars/secrets.yml.example`, `vars/secrets.yml` (git-ignored, filled from local `.env`), `roles/common/tasks/main.yml`, `roles/docker/tasks/main.yml`, `roles/traefik/{tasks/main.yml,handlers/main.yml,templates/traefik.yml.j2,templates/dynamic.yml.j2,templates/env.j2,templates/docker-compose.yml.j2}`, `roles/eve/{tasks/main.yml,templates/env.j2}`

**Interfaces:**
- Consumes: Task 13 compose stack; the Prometheus `app-01` roles as the source to copy.
- Produces: a running site at `https://eve.plasma66.com`.

- [ ] **Step 1: Ansible skeleton**

`deploy/ansible/ansible.cfg` — copy `/home/daniel/AI/Plasma/Prometheus/app-01/ansible.cfg` verbatim.
`deploy/ansible/requirements.yml` — copy from app-01 verbatim (`community.docker >=3.10.0`, `ansible.posix >=1.5.0`), then run `ansible-galaxy collection install -r deploy/ansible/requirements.yml`.

`deploy/ansible/inventory.ini`:
```ini
[eve]
eve ansible_host=10.5.5.150

[eve:vars]
ansible_user=daniel
ansible_python_interpreter=/usr/bin/python3
```

`deploy/ansible/group_vars/eve.yml`:
```yaml
---
timezone: "Etc/UTC"
base_dir: /opt/eve
domain: eve.plasma66.com
acme_email: "dac9dc@gmail.com"
swap_size_mb: 4096
# Tailscale CGNAT range + the VM's LAN + loopback. Cloudflare record is grey-cloud, so Traefik sees real client IPs.
lan_allowed_cidrs:
  - "100.64.0.0/10"
  - "10.5.5.0/24"
  - "127.0.0.1/32"
images:
  traefik: "traefik:v3.6"
esi_compatibility_date: "2026-08-28"
esi_user_agent: "EVE-Plasma/0.1 (dac9dc@gmail.com)"
allowed_character_ids: "90000101,90000102,90000103,90000104"
```

`deploy/ansible/vars/secrets.yml.example`:
```yaml
---
cloudflare_dns_api_token: "CHANGEME"   # Zone:DNS:Edit on plasma66.com
eve_client_id: "CHANGEME"
eve_client_secret: "CHANGEME"
session_secret: "CHANGEME"             # openssl rand -hex 32
postgres_password: "CHANGEME"          # openssl rand -hex 16
```
Create `deploy/ansible/vars/secrets.yml` from it, filling: the Cloudflare token from `/home/daniel/AI/Plasma/Prometheus/app-01/vars/secrets.yml` (`cloudflare_dns_api_token`), `EVE_CLIENT_ID` / `EVE_CLIENT_SECRET` / `SESSION_SECRET` / `POSTGRES_PASSWORD` from the local `.env`. Confirm `git status` does not list it (`.gitignore` already has `deploy/ansible/vars/secrets.yml`).

`deploy/ansible/site.yml`:
```yaml
---
- name: Configure the EVE VM
  hosts: eve
  become: true
  gather_facts: true
  vars_files: [vars/secrets.yml]
  pre_tasks:
    - name: Fail early on placeholder secrets
      ansible.builtin.assert:
        that:
          - cloudflare_dns_api_token != "CHANGEME"
          - eve_client_secret != "CHANGEME"
          - session_secret != "CHANGEME"
          - postgres_password != "CHANGEME"
        quiet: true
  roles:
    - { role: common,  tags: [common] }
    - { role: docker,  tags: [docker] }
    - { role: traefik, tags: [traefik] }
    - { role: eve,     tags: [eve, app] }
```

- [ ] **Step 2: Roles copied from Prometheus app-01, adapted**

`roles/docker/tasks/main.yml` — copy `/home/daniel/AI/Plasma/Prometheus/app-01/roles/docker/tasks/main.yml` verbatim (installs Docker CE + compose plugin, adds `ansible_user` to `docker`, creates the `proxy` network).

`roles/common/tasks/main.yml` — copy app-01's, drop `nfs-common`, add `rsync`, and append a swapfile block:
```yaml
- name: Create swapfile (build headroom on a 3.3 GB VM)
  ansible.builtin.command:
    cmd: "fallocate -l {{ swap_size_mb }}M /swapfile"
    creates: /swapfile
- name: Secure and format swapfile
  ansible.builtin.shell: "chmod 600 /swapfile && mkswap /swapfile"
  args: { creates: /swapfile.formatted }
  register: mkswap
- name: Mark swapfile formatted
  ansible.builtin.file: { path: /swapfile.formatted, state: touch, mode: "0600" }
  when: mkswap.changed
- name: Enable swap in fstab
  ansible.posix.mount: { src: /swapfile, path: none, fstype: swap, opts: sw, state: present }
- name: Activate swap now
  ansible.builtin.command: swapon -a
  changed_when: false
```

`roles/traefik/*` — copy all four templates, `tasks/main.yml`, and `handlers/main.yml` from app-01's `roles/traefik/`, then:
- `templates/traefik.yml.j2`: unchanged.
- `templates/dynamic.yml.j2`: keep only the `middlewares` block (`lan-only`, `secure-headers`); delete the cross-VM routers/services/serversTransports section.
- `templates/docker-compose.yml.j2`: delete the dashboard `labels:` block (no `traefik.` subdomain exists); keep everything else.
- `templates/env.j2`: unchanged (`CF_DNS_API_TOKEN`).

`roles/eve/templates/env.j2`:
```
# Managed by Ansible.
APP_DOMAIN={{ domain }}
EVE_CLIENT_ID={{ eve_client_id }}
EVE_CLIENT_SECRET={{ eve_client_secret }}
EVE_CALLBACK_URL=https://{{ domain }}/auth/callback
ALLOWED_CHARACTER_IDS={{ allowed_character_ids }}
ESI_COMPATIBILITY_DATE={{ esi_compatibility_date }}
ESI_USER_AGENT={{ esi_user_agent }}
SESSION_SECRET={{ session_secret }}
POSTGRES_PASSWORD={{ postgres_password }}
DATABASE_URL=postgres://eve:{{ postgres_password }}@postgres:5432/eve
NODE_ENV=production
```

`roles/eve/tasks/main.yml`:
```yaml
---
- name: Create app directories
  ansible.builtin.file:
    path: "{{ base_dir }}/{{ item }}"
    state: directory
    owner: "{{ ansible_user }}"
    group: "{{ ansible_user }}"
    mode: "0755"
  loop: ["", "src"]

- name: Sync repository to the VM (excluding secrets, deps, build output)
  ansible.posix.synchronize:
    src: "{{ playbook_dir }}/../../"
    dest: "{{ base_dir }}/src/"
    delete: true
    rsync_opts:
      - "--exclude=.git"
      - "--exclude=node_modules"
      - "--exclude=.next"
      - "--exclude=.env"
      - "--exclude=.env.*"
      - "--exclude=deploy/ansible/vars/secrets.yml"
  become: false

- name: Template the stack .env
  ansible.builtin.template:
    src: env.j2
    dest: "{{ base_dir }}/src/deploy/.env"
    owner: "{{ ansible_user }}"
    mode: "0600"

- name: Build and start the stack
  community.docker.docker_compose_v2:
    project_src: "{{ base_dir }}/src/deploy"
    build: always
    state: present
    remove_orphans: true

- name: Apply database schema
  ansible.builtin.command:
    cmd: docker compose exec -T app npm run migrate
    chdir: "{{ base_dir }}/src/deploy"
  register: migrate
  changed_when: "'schema applied' in migrate.stdout"

- name: Restart worker so it sees the schema
  community.docker.docker_compose_v2:
    project_src: "{{ base_dir }}/src/deploy"
    services: [worker]
    state: restarted
```

- [ ] **Step 3: Dry-run then run**

Run from the repo root (Ansible needs a real TTY — if it complains about non-blocking stdio, run it with `script -qc "ansible-playbook ..." /dev/null`):
```bash
cd deploy/ansible && ansible-playbook site.yml --check --diff --tags common,docker 2>&1 | tail -20
ansible-playbook site.yml 2>&1 | tail -40
```
Expected: play recap with `failed=0`. First real run takes several minutes (Docker install + image build).

- [ ] **Step 4: Verify on the VM**
```bash
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"; docker logs --tail 5 eve-worker; docker logs --tail 20 traefik 2>&1 | grep -iE "certificate|error" | tail -5'
curl -sS -o /dev/null -w "%{http_code} %{ssl_verify_result}\n" https://eve.plasma66.com/api/health
curl -sS https://eve.plasma66.com/api/health
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://eve.plasma66.com/
```
Expected: `traefik`, `eve-app`, `eve-worker`, `eve-postgres` all `Up`; the worker log shows `[worker] started`; health returns `200` with a valid cert (`ssl_verify_result` 0) and `{"ok":true,"db":true}`; `/` returns `307` to `/login`. If the cert is still pending, wait 60 s and retry — DNS-01 issuance takes up to a minute.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add Ansible provisioning for the EVE VM (common, docker, traefik, app)"`

- [ ] **Step 6: Acceptance (needs Daniel in a browser on the tailnet)**

1. Open `https://eve.plasma66.com` → login card → "Log in with EVE Online" → sign in to the **main** account, pick **Mara Vexley**, approve scopes → lands on Overview with Mara Vexley's card.
2. Character menu → **Add character** → same account, pick **Jorin Hale** → lands on Settings.
3. Repeat Add character for **Nyx Calder** and **Tove Ash** (alt account).
4. Settings → create accounts "Main" and "Alt"; assign the four characters. Character menu now shows two groups.
5. Within ~1 minute the Sync status table shows four `character-info` rows with status `ok`; Overview cards show corp/alliance names.
6. Settings → Remove **Tove Ash** → card disappears; Add character again → returns with status `ok`.
7. Check `ssh daniel@10.5.5.150 docker logs eve-worker` shows four `character-info ... ok rows=1` lines and no errors.

Record the outcome (pass, or what failed) in the plan's final commit message.

---

## Self-review

- **Spec coverage:** §3.1 → T1, T2; §3.2 → T5–T8, T11 (switcher), T12 (settings); §3.3 → T9; §3.4 → T3, T4, T10; §3.5 → T11, T12; §3.6 → T13, T14; §3.7 → T8 (error redirects), T9 (needs_reauth), T10 (sync_runs errors), T11 (layout catch); §3.8 → tests in every task, DB tests in T3/T4, acceptance in T14 step 6; §3.9 respected (no SDE/dogma/market work). One deliberate deviation from the spec: `esi_cache.character_id` uses `0` for public routes instead of `NULL`, because Postgres primary keys cannot contain NULL — the spec should be read that way.
- **Placeholders:** none — every step has its code or exact command.
- **Type consistency:** `Character`/`TokenStatus` (T4) are what T9 `TokenStore` and T11 `CharacterView` consume; `SyncRunSummary` (T4) is what T11 Overview and T12 `SyncStatus` render; `EsiClient.get` returns `EsiResult<T>` with `.data` and that is what T10's job reads; `startRun`/`finishRun` signatures match between T4 and T10; `signPayload`/`verifyPayload`/cookie names match between T6, T8 and `proxy.ts`.
