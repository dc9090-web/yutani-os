# Google Sign-In on the Site (Android app, phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google becomes the only way into the website; EVE SSO stays only for adding and re-authorising characters.

**Architecture:** A second OAuth flow beside the EVE one: `/auth/google/start` sends the browser to Google with PKCE, state and a nonce held in a short-lived signed cookie; `/auth/google/callback` exchanges the code, verifies the ID token with `jose`, checks the email against an allow-list and sets the session cookie. The session payload gains `sub` and `email`, and a cookie without `sub` stops being a session. The EVE routes move behind that session.

**Tech Stack:** Next.js 16 route handlers, TypeScript, `jose` 6 (already installed), vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-22-android-app-design.md` (section "1. Sign-in on the site", phase 1). Read it first.

## Global Constraints

- The repo is public. No real email address, hostname, client ID or secret in any tracked file. Tests use `owner@example.com` and `eve.example.com`. Real values live only in the git-ignored `deploy/ansible/vars/site.yml`, `deploy/ansible/vars/secrets.yml` and `.env`.
- No new npm dependencies.
- Work on a branch `feature/google-sign-in` off `main`. Do not push, merge or deploy; Task 7 is run only when the owner says so.
- Redirects in route handlers are built from `getConfig().siteOrigin`, never from `req.nextUrl` (behind Traefik the handler sees the container origin).
- An empty or missing Google allow-list must stop the app from starting. It must never mean "allow everyone".
- Gate before every commit: `npx tsc --noEmit -p . && npx vitest run`. The database-backed tests need the dev Postgres from `compose.dev.yml` running (`docker compose -f compose.dev.yml up -d`); confirm the test database name in `tests/db/helpers.ts` before the first run.
- Never run `next build` while a `next dev` server is up (they share `.next`).
- Commit messages follow the repo's style (a plain sentence, no `feat:` prefix) and end with the attribution lines the session supplies.

## Review Focus

1. **Email written differently from the allow-list** (`Owner@Example.com `, allow-list `owner@example.com`): the owner is let in. Compared trimmed and lower-cased on both sides. Test in Task 1 and Task 4.
2. **A session cookie from before the deploy** (no `sub`): treated as signed out and sent to `/login`, with no page throwing. Test in Task 2.
3. **The owner cancels on Google's screen** (callback arrives with `?error=access_denied` and no `code`): back to `/login` with a message, not a 500. Test in Task 4.
4. **Google cannot be reached or answers with an error** (the token request throws or returns non-200): `/login?error=token`, no session cookie set. Test in Task 3 and Task 4.
5. **A Google account whose email is not verified, or `email_verified` sent as the string `"true"`**: `false` and absent are refused; `true` and `"true"` are accepted. Test in Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/config.ts` (modify) | Google settings in; character allow-list out (Task 5) |
| `src/lib/auth/session.ts` (modify) | Session payload with `sub`/`email`; `verifySession`; `withActiveCharacter` |
| `src/proxy.ts` (modify) | Uses `verifySession`; only `/auth/google/` is public |
| `src/lib/auth/google.ts` (create) | Google endpoints, authorise URL, code exchange, ID-token verification. Reused by the app's sign-in route in phase 2 |
| `src/lib/auth/google-flow.ts` (create) | `startGoogleLogin`, `completeGoogleLogin` |
| `src/app/auth/google/start/route.ts`, `src/app/auth/google/callback/route.ts` (create) | The two HTTP entry points |
| `src/app/auth/start/route.ts`, `callback/route.ts`, `switch/route.ts`, `src/lib/auth/flow.ts` (modify) | EVE flow becomes add-character only and keeps `sub`/`email` |
| `src/app/login/LoginCard.tsx` (modify) | One "Sign in with Google" button and new messages |
| `deploy/**`, `.env.example`, `README.md` (modify) | Settings, installer prompts, owner's Google Cloud steps |

---

### Task 1: Google settings in the config

**Files:**
- Modify: `src/lib/config.ts`
- Test: `tests/config.test.ts`
- Modify: every test that calls `loadConfig({...})` or sets `process.env` for it (`tests/auth/flow.test.ts`, `tests/auth/callback.test.ts`, `tests/esi/tokens.test.ts`, and any other that `grep -rn "EVE_CALLBACK_URL" tests` finds): add the three Google variables.

**Interfaces:**
- Produces on `AppConfig`: `googleClientId: string`, `googleClientSecret: string`, `googleCallbackUrl: string` (`${siteOrigin}/auth/google/callback`), `allowedGoogleEmails: Set<string>` (trimmed, lower-cased).
- Produces: `export function parseAllowedEmails(raw: string | undefined): Set<string>`.
- `ALLOWED_CHARACTER_IDS` and `allowedCharacterIds` stay until Task 5.

- [ ] **Step 1: Write the failing tests** in `tests/config.test.ts`

```ts
it("parses the Google allow-list trimmed and lower-cased", () => {
  expect([...parseAllowedEmails(" Owner@Example.com , second@example.com,, ")]).toEqual(["owner@example.com", "second@example.com"]);
});
it("loads the Google settings and derives the callback from the site origin", () => {
  const c = loadConfig({ ...full, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: "Owner@Example.com" });
  expect(c.googleClientId).toBe("gid");
  expect(c.googleCallbackUrl).toBe("https://x/auth/google/callback");
  expect(c.allowedGoogleEmails.has("owner@example.com")).toBe(true);
});
it("refuses to start with no usable Google allow-list", () => {
  expect(() => loadConfig({ ...full, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: " , ," })).toThrow(/ALLOWED_GOOGLE_EMAILS/);
  expect(() => loadConfig({ ...full, GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: "a@example.com" })).toThrow(/GOOGLE_CLIENT_ID/);
});
```

`full` is the file's existing valid env object (its site origin is `https://x`). After this task it also carries the three Google variables, so the two calls above override or omit them as shown.

- [ ] **Step 2: Run** `npx vitest run tests/config.test.ts`. Expected: FAIL, `parseAllowedEmails` is not exported.
- [ ] **Step 3: Implement.** Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_GOOGLE_EMAILS` to `REQUIRED`; after parsing, throw `Missing env: ALLOWED_GOOGLE_EMAILS` when the parsed set is empty. An entry without `@` is dropped.
- [ ] **Step 4: Add the three variables to every other test env** found by the grep, then run the gate. Expected: PASS.
- [ ] **Step 5: Commit** — "Config: Google client settings and an allow-list of Google accounts".

---

### Task 2: A session means a Google account

**Files:**
- Modify: `src/lib/auth/session.ts`, `src/proxy.ts`
- Test: `tests/auth/session.test.ts`, `tests/proxy.test.ts`

**Interfaces:**
- Produces: `export interface SessionPayload { sub: string; email: string; activeCharacterId: number | null; iat: number }`
- Produces: `export function verifySession(token: string | undefined, secret: string, now?: number): SessionPayload | null` — `verifyPayload` with `SESSION_MAX_AGE`, then `null` unless `sub` and `email` are non-empty strings.
- Produces: `export function withActiveCharacter(session: SessionPayload, activeCharacterId: number | null, now?: number): SessionPayload` — same `sub` and `email`, new `iat`.
- Produces: `export const GOOGLE_OAUTH_COOKIE = "eve_goauth"`; `OauthPayload` gains optional `nonce?: string`.
- `readSession()` returns `verifySession(...)`.
- `isPublicPath`: the public prefix `/auth/` becomes `/auth/google/`. `/auth/start`, `/auth/callback`, `/auth/switch` and `/auth/logout` are guarded.

- [ ] **Step 1: Write the failing tests**

`tests/auth/session.test.ts`:

```ts
const s = "s".repeat(32);
it("accepts a session that names a Google account", () => {
  const t = signPayload({ sub: "g-1", email: "owner@example.com", activeCharacterId: 5, iat: 1000 }, s);
  expect(verifySession(t, s, 2000)).toEqual({ sub: "g-1", email: "owner@example.com", activeCharacterId: 5, iat: 1000 });
});
it("treats a pre-Google cookie as signed out", () => {
  expect(verifySession(signPayload({ activeCharacterId: 5, iat: 1000 }, s), s, 2000)).toBeNull();
  expect(verifySession(signPayload({ sub: "", email: "owner@example.com", activeCharacterId: 5, iat: 1000 }, s), s, 2000)).toBeNull();
});
it("keeps the account when the active character changes", () => {
  expect(withActiveCharacter({ sub: "g-1", email: "owner@example.com", activeCharacterId: 5, iat: 1000 }, 9, 3000))
    .toEqual({ sub: "g-1", email: "owner@example.com", activeCharacterId: 9, iat: 3000 });
});
```

`tests/proxy.test.ts`: move `/auth/start` and `/auth/callback?code=1` from the "allows" list to the "guards" list; add `/auth/google/start` and `/auth/google/callback?code=1` to "allows"; add `/auth/googlex` and `/auth/switch` to "guards". Change the pass-through test's cookie to `{ sub: "g-1", email: "owner@example.com", activeCharacterId: 1, iat }`, and add:

```ts
it("sends a pre-Google session cookie to /login", () => {
  process.env.SESSION_SECRET = "s".repeat(32);
  const req = new NextRequest("https://eve.example.com/settings");
  req.cookies.set(SESSION_COOKIE, signPayload({ activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET));
  expect(proxy(req).headers.get("location")).toBe("https://eve.example.com/login");
});
```

- [ ] **Step 2: Run** `npx vitest run tests/auth/session.test.ts tests/proxy.test.ts`. Expected: FAIL, `verifySession` not exported.
- [ ] **Step 3: Implement** the interfaces above; the proxy calls `verifySession`.
- [ ] **Step 4: Fix the type errors this causes** (`npx tsc --noEmit -p .`): `src/app/auth/switch/route.ts` writes `withActiveCharacter(session, id)`; `src/app/auth/callback/route.ts` gets a temporary `sub`/`email` from the existing session (it is rewritten in Task 5); test mocks of `readSession` return the new shape. Run the gate. Expected: PASS.
- [ ] **Step 5: Commit** — "Session: a session names a Google account; older cookies are signed out".

---

### Task 3: Talking to Google

**Files:**
- Create: `src/lib/auth/google.ts`
- Test: `tests/auth/google.test.ts`

**Interfaces:**
- Produces:

```ts
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export class GoogleError extends Error { code: "token" | "jwt" }
export interface GoogleIdentity { sub: string; email: string }
export function buildGoogleAuthorizeUrl(a: { clientId: string; callbackUrl: string; state: string; challenge: string; nonce: string }): string;
export function exchangeGoogleCode(a: { clientId: string; clientSecret: string; callbackUrl: string; code: string; verifier: string; fetchImpl?: typeof fetch }): Promise<{ idToken: string }>;
export function verifyGoogleIdToken(token: string, a: { jwks: JWTVerifyGetKey; clientId: string; nonce?: string }): Promise<GoogleIdentity>;
export function googleJwks(): JWTVerifyGetKey; // memoised createRemoteJWKSet(GOOGLE_JWKS_URL)
```

- Before writing code, fetch `https://accounts.google.com/.well-known/openid-configuration` once and confirm the three URLs and the issuer match; if they differ, use the published values and say so in the commit.
- Authorise URL parameters: `response_type=code`, `scope=openid email`, `code_challenge_method=S256`, `prompt=select_account`, plus `client_id`, `redirect_uri`, `state`, `code_challenge`, `nonce`.
- Code exchange: form POST with `grant_type=authorization_code`, `code`, `code_verifier`, `client_id`, `client_secret`, `redirect_uri`. A thrown fetch, a non-200 or a body without `id_token` becomes `GoogleError("token")`.
- Verification: `jwtVerify` with `issuer: GOOGLE_ISSUERS`, `audience: clientId`; then `nonce` must equal `a.nonce` when one is passed; `email_verified` must be `true` or `"true"`; `sub` and `email` must be non-empty strings. Any failure becomes `GoogleError("jwt")`. The returned email is trimmed and lower-cased.

- [ ] **Step 1: Write the failing tests.** Build tokens in the test with `jose`: `generateKeyPair("RS256")`, `SignJWT`, and `createLocalJWKSet` over the exported public key. One helper `token(claims, { key?, issuer?, audience?, expiresIn? })` with the defaults of a good token (`iss` `https://accounts.google.com`, `aud` `gid`, `sub` `g-1`, `email` `Owner@Example.com`, `email_verified` `true`, `nonce` `n1`).

```ts
it("accepts a good token and lower-cases the email", async () => {
  expect(await verifyGoogleIdToken(await token({}), { jwks, clientId: "gid", nonce: "n1" })).toEqual({ sub: "g-1", email: "owner@example.com" });
});
it("accepts email_verified sent as the string \"true\" and the bare-host issuer", async () => {
  await expect(verifyGoogleIdToken(await token({ email_verified: "true" }, { issuer: "accounts.google.com" }), { jwks, clientId: "gid" })).resolves.toMatchObject({ sub: "g-1" });
});
it.each([
  ["another app's audience", () => token({}, { audience: "someone-else" })],
  ["a wrong issuer", () => token({}, { issuer: "https://evil.example.com" })],
  ["an expired token", () => token({}, { expiresIn: -60 })],
  ["a token signed with another key", async () => token({}, { key: (await generateKeyPair("RS256")).privateKey })],
  ["an unverified email", () => token({ email_verified: false })],
  ["no email_verified claim", () => token({ email_verified: undefined })],
  ["a wrong nonce", () => token({ nonce: "other" })],
  ["no email", () => token({ email: undefined })],
])("refuses %s", async (_name, make) => {
  await expect(verifyGoogleIdToken(await make(), { jwks, clientId: "gid", nonce: "n1" })).rejects.toMatchObject({ code: "jwt" });
});
it("builds the authorise URL", () => {
  const u = new URL(buildGoogleAuthorizeUrl({ clientId: "gid", callbackUrl: "https://eve.example.com/auth/google/callback", state: "st", challenge: "ch", nonce: "n1" }));
  expect(u.origin + u.pathname).toBe(GOOGLE_AUTH_URL);
  expect(Object.fromEntries(u.searchParams)).toEqual({ response_type: "code", client_id: "gid", redirect_uri: "https://eve.example.com/auth/google/callback", scope: "openid email", state: "st", code_challenge: "ch", code_challenge_method: "S256", nonce: "n1", prompt: "select_account" });
});
it("exchanges a code and maps every failure to a token error", async () => {
  const ok = vi.fn(async () => new Response(JSON.stringify({ id_token: "tok" }), { status: 200 }));
  expect(await exchangeGoogleCode({ ...args, fetchImpl: ok as never })).toEqual({ idToken: "tok" });
  expect(String(ok.mock.calls[0][1].body)).toContain("code_verifier=ver");
  for (const bad of [async () => new Response("{}", { status: 400 }), async () => new Response("{}", { status: 200 }), async () => { throw new Error("offline"); }])
    await expect(exchangeGoogleCode({ ...args, fetchImpl: bad as never })).rejects.toMatchObject({ code: "token" });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/auth/google.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `src/lib/auth/google.ts` to the interfaces above.
- [ ] **Step 4: Run the gate.** Expected: PASS.
- [ ] **Step 5: Commit** — "Google sign-in: authorise URL, code exchange and ID-token verification".

---

### Task 4: The Google sign-in flow and its routes

**Files:**
- Create: `src/lib/auth/google-flow.ts`, `src/app/auth/google/start/route.ts`, `src/app/auth/google/callback/route.ts`
- Test: `tests/auth/google-flow.test.ts`, `tests/auth/google-callback.test.ts`

**Interfaces:**
- Consumes: Task 1 config fields; Task 2 `GOOGLE_OAUTH_COOKIE`, `OauthPayload.nonce`, `SessionPayload`; Task 3 functions; `AuthError` and `generatePkce` from the existing flow and SSO modules.
- Produces:

```ts
export interface GoogleFlowDeps { exchange: typeof exchangeGoogleCode; verify: typeof verifyGoogleIdToken; jwks: () => JWTVerifyGetKey }
export function startGoogleLogin(config: AppConfig): { url: string; oauthCookie: string };
export function completeGoogleLogin(a: { code: string | null; state: string | null; error: string | null; oauthCookie: string | undefined }, config: AppConfig, deps?: GoogleFlowDeps): Promise<GoogleIdentity>;
```

- `completeGoogleLogin` throws `AuthError`: `"cancelled"` when `error` is set; `"state"` for a missing, expired or mismatched cookie or a missing code; `"token"` and `"jwt"` from the Google errors; `"not-allowed"` when the email is not in `config.allowedGoogleEmails`. Add `"cancelled"` to `AuthError`'s code union.
- A refusal logs `console.error("[auth] google account not allowed:", email)` so the owner can see which address to add.
- `GET /auth/google/start`: redirect to the URL, set `GOOGLE_OAUTH_COOKIE` with `cookieOptions(OAUTH_MAX_AGE)`.
- `GET /auth/google/callback`: on success set the session cookie `{ sub, email, activeCharacterId: null, iat }` and redirect to `/`; on any error redirect to `/login?error=<code>` (`unknown` for a non-`AuthError`) and set no session cookie. Both delete `GOOGLE_OAUTH_COOKIE`.

- [ ] **Step 1: Write the failing flow tests** (`tests/auth/google-flow.test.ts`), with `config` from `loadConfig` (allow-list `owner@example.com`) and `deps` as `vi.fn` fakes returning `{ idToken: "tok" }` and `{ sub: "g-1", email: "owner@example.com" }`:

```ts
it("start: the cookie holds the state, verifier and nonce that are in the URL", () => {
  const { url, oauthCookie } = startGoogleLogin(config);
  const p = verifyPayload<OauthPayload>(oauthCookie, config.sessionSecret, OAUTH_MAX_AGE)!;
  const q = new URL(url).searchParams;
  expect(q.get("state")).toBe(p.state);
  expect(q.get("nonce")).toBe(p.nonce);
  expect(q.get("redirect_uri")).toBe("https://eve.example.com/auth/google/callback");
});
it("complete: returns the identity and passes the verifier and nonce on", async () => {
  const d = deps();
  expect(await completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d)).toEqual({ sub: "g-1", email: "owner@example.com" });
  expect(d.exchange).toHaveBeenCalledWith(expect.objectContaining({ code: "c", verifier: "ver", callbackUrl: "https://eve.example.com/auth/google/callback" }));
  expect(d.verify).toHaveBeenCalledWith("tok", expect.objectContaining({ clientId: "gid", nonce: "n1" }));
});
it("complete: refuses an account that is not on the list", async () => {
  const d = deps({ verify: vi.fn(async () => ({ sub: "g-2", email: "stranger@example.com" })) });
  await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d)).rejects.toMatchObject({ code: "not-allowed" });
});
it("complete: a cancelled sign-in never reaches Google", async () => {
  const d = deps();
  await expect(completeGoogleLogin({ code: null, state: "st", error: "access_denied", oauthCookie: cookie }, config, d)).rejects.toMatchObject({ code: "cancelled" });
  expect(d.exchange).not.toHaveBeenCalled();
});
it("complete: state mismatch, missing cookie and missing code are state errors", async () => { /* three rejects.toMatchObject({ code: "state" }) */ });
it("complete: maps Google's token and jwt failures", async () => { /* exchange throws GoogleError("token") -> "token"; verify throws GoogleError("jwt") -> "jwt" */ });
```

`cookie` is `signPayload({ state: "st", verifier: "ver", nonce: "n1", iat: now }, config.sessionSecret)`.

- [ ] **Step 2: Write the failing route tests** (`tests/auth/google-callback.test.ts`), mocking `google-flow.js` the way `tests/auth/callback.test.ts` mocks `flow.js`:

```ts
it("signs the owner in and lands on the overview", async () => {
  const res = await GET(req("?code=c&state=st"));
  expect(res.headers.get("location")).toBe("https://eve.example.com/");
  expect(verifySession(res.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET!)).toMatchObject({ sub: "g-1", email: "owner@example.com", activeCharacterId: null });
});
it.each(["not-allowed", "cancelled", "state", "token", "jwt"])("sends a %s failure to the login page with no session", async (code) => {
  vi.mocked(completeGoogleLogin).mockRejectedValue(new AuthError(code as never, "x"));
  const res = await GET(req("?code=c&state=st"));
  expect(res.headers.get("location")).toBe(`https://eve.example.com/login?error=${code}`);
  expect(res.cookies.get(SESSION_COOKIE)?.value ?? "").toBe("");
});
it("reports an unexpected failure as unknown", async () => { /* mockRejectedValue(new Error("boom")) -> /login?error=unknown */ });
```

- [ ] **Step 3: Run both files.** Expected: FAIL, modules not found.
- [ ] **Step 4: Implement** the flow module and the two routes.
- [ ] **Step 5: Run the gate.** Expected: PASS.
- [ ] **Step 6: Commit** — "Google sign-in: start and callback routes".

---

### Task 5: EVE login becomes "add a character"

**Files:**
- Modify: `src/lib/auth/flow.ts`, `src/lib/config.ts`, `src/app/auth/start/route.ts`, `src/app/auth/callback/route.ts`
- Test: `tests/auth/flow.test.ts`, `tests/auth/callback.test.ts`, `tests/auth/start.test.ts` (create), `tests/config.test.ts`

**Interfaces:**
- Consumes: `readSession`, `withActiveCharacter` (Task 2).
- `completeLogin` no longer checks an allow-list. `allowedCharacterIds` leaves `AppConfig` and `ALLOWED_CHARACTER_IDS` leaves `REQUIRED`; a value still present in the environment is ignored. `parseAllowedCharacterIds` stays (it parses `OVERVIEW_CHARACTER_IDS`).
- `GET /auth/start` with no session: redirect to `/login`, set no cookie, do not call `startLogin`.
- `GET /auth/callback` with no session: redirect to `/login`, do not call `completeLogin`. With a session: set `withActiveCharacter(session, session.activeCharacterId ?? characterId)` and redirect to `/settings`. On an `AuthError`: redirect to `/settings?error=<code>` and leave the session cookie untouched.

- [ ] **Step 1: Change the tests first.**
  - `flow.test.ts`: replace "rejects a character that is not allow-listed" with "stores any character the signed-in owner authorises" (the `verify` fake returns character `42`; expect `upsert` called with `id: 42`). Remove `ALLOWED_CHARACTER_IDS` from the env.
  - `config.test.ts`: remove the `allowedCharacterIds` assertion; add `expect(() => loadConfig(envWithoutAllowedCharacterIds)).not.toThrow()`.
  - `callback.test.ts`: the existing-session test expects the cookie to carry `{ sub: "g-1", email: "owner@example.com", activeCharacterId: 1 }`; the no-existing-active-character test (session with `activeCharacterId: null`) expects `activeCharacterId: 2`; replace the "first login goes to /" test with:

    ```ts
    it("does nothing for a visitor who is not signed in", async () => {
      vi.mocked(readSession).mockResolvedValue(null);
      const res = await GET(req());
      expect(res.headers.get("location")).toBe("https://eve.example.com/login");
      expect(completeLogin).not.toHaveBeenCalled();
    });
    it("reports a failed character authorisation on Settings and keeps the session", async () => {
      vi.mocked(completeLogin).mockRejectedValue(new AuthError("jwt" as never, "x"));
      const res = await GET(req());
      expect(res.headers.get("location")).toBe("https://eve.example.com/settings?error=jwt");
      expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    });
    ```
  - `start.test.ts`: signed out → `location` is `https://eve.example.com/login` and `startLogin` not called; signed in → `location` is the mocked authorise URL and `OAUTH_COOKIE` is set.
- [ ] **Step 2: Run** `npx vitest run tests/auth tests/config.test.ts`. Expected: the changed tests FAIL.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Show the failure on Settings.** Create `src/app/settings/AuthoriseError.tsx` exporting `AuthoriseError({ error }: { error: string | null })`: nothing when `error` is null, otherwise one `role="alert"` line, "That character could not be authorised. Please try again." `src/app/settings/page.tsx` reads `searchParams.error` and renders it above the panels. Test in `tests/components/authorise-error.test.tsx` (create): no alert for `null`, the exact sentence for `"jwt"`.
- [ ] **Step 5: Run the gate.** Expected: PASS. Then `grep -rn "allowedCharacterIds" src tests` must print nothing.
- [ ] **Step 6: Commit** — "EVE SSO only adds characters; the character allow-list is gone".

---

### Task 6: Login page, installer and documentation

**Files:**
- Modify: `src/app/login/LoginCard.tsx`, `tests/components/login.test.tsx`
- Modify: `deploy/ansible/roles/eve/templates/env.j2`, `deploy/ansible/site.yml` (the `assert` at line 15), `deploy/ansible/vars/site.yml.example`, `deploy/ansible/vars/secrets.yml.example`, `deploy/setup.sh`, `deploy/.env.example`, `.env.example`, `deploy/README.md`, `README.md`

**Exact copy for the login card:**
- Sub-heading: "Sign in with the Google account this site is set up for."
- Button: "Sign in with Google", `href="/auth/google/start"`, keeping the `sso-btn` class.
- Footer: "Private tool · only the owner's Google account can sign in."
- Messages: `not-allowed` "That Google account is not allowed on this site."; `cancelled` "Sign-in was cancelled."; `state` "The sign-in attempt expired or was tampered with. Please try again."; `token` "Google did not accept the sign-in. Please try again."; `jwt` "Google returned a sign-in we could not verify."; `unknown` "Sign-in failed. Please try again."

**Deploy settings:**
- `site.yml`: `allowed_google_emails` replaces `allowed_character_ids` (example value `"you@example.com"`); the playbook's assert checks the new key.
- `secrets.yml`: `google_client_id`, `google_client_secret`.
- `env.j2`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_GOOGLE_EMAILS`; the `ALLOWED_CHARACTER_IDS` line goes.
- `setup.sh`: the "Allowed character IDs" prompt and its `valid_ids` loop are replaced by prompts for the allowed Google email(s) (each must contain `@`), the Google client ID and the client secret; the closing notes say "sign in with Google, then add each character from Settings".

- [ ] **Step 1: Change `tests/components/login.test.tsx`**: the link is named `/sign in with google/i` with `href` `/auth/google/start`; `error="not-allowed"` shows "That Google account is not allowed on this site."; no element mentions "EVE Online".
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Update `LoginCard.tsx`** with the copy above. Run the gate. Expected: PASS.
- [ ] **Step 4: Update the deploy files** as listed. Verify with `cd deploy/ansible && ansible-playbook site.yml --syntax-check` and `bash -n ../setup.sh`.
- [ ] **Step 5: Write "Google sign-in set-up" in `deploy/README.md`**, the owner's steps. Check each label against the current Google Cloud console documentation (start at `https://developers.google.com/identity/protocols/oauth2/web-server`) before writing; the content must cover: create a project; configure the Google Auth Platform (app name, support email, audience External); leave it in Testing and add the owner's account as a test user; create an OAuth client of type "Web application" with the authorised redirect URI `https://<domain>/auth/google/callback`; copy the client ID and secret into `secrets.yml`; put the account's address in `allowed_google_emails`. Note that phase 2 adds an Android client to the same project.
- [ ] **Step 6: Update `README.md`**: the environment table (three new rows, `ALLOWED_CHARACTER_IDS` removed), the login description, and the sentence in `deploy/README.md` line 70 that mentions the "Log in with EVE Online" button. Leave `docs/screenshots/login.png` alone and list it as stale in the commit body; it is retaken after the live check.
- [ ] **Step 7: Commit** — "Login page, installer and docs for Google sign-in".

---

### Task 7: Roll out (only when the owner says to deploy)

No code. Every step here touches the live site or needs the owner.

- [ ] **Step 1: Owner** follows "Google sign-in set-up" and supplies the client ID and secret.
- [ ] **Step 2:** Add `google_client_id` and `google_client_secret` to `deploy/ansible/vars/secrets.yml`; confirm `allowed_google_emails` is in `vars/site.yml`. **Leave `allowed_character_ids` in `site.yml`** until Step 7 so the previous commit can be redeployed unchanged.
- [ ] **Step 3:** Run the gate on the branch, then `npx next build --webpack` (no dev server running). Expected: both succeed.
- [ ] **Step 4:** Back up the live database: `ssh daniel@eve 'docker exec eve-postgres pg_dump -U eve -Fc eve > ~/backups/eve-before-google-sign-in-2026-11-22.dump'` and confirm the file is not empty.
- [ ] **Step 5:** With the owner's go-ahead, merge to `main`, push, and deploy: `cd deploy/ansible && script -qc "ansible-playbook site.yml --tags eve" /dev/null` (add `-e ansible_host=100.114.208.10` when off the LAN).
- [ ] **Step 6: Owner checks on live**, on desktop and on the phone's browser: the login page shows the Google button; signing in with the allowed account lands on the Overview with all characters present; a second Google account is refused with the message; Settings › Add character still completes an EVE authorisation; the character switcher and Log out work. Check `docker logs eve-app | grep "\[auth\]"` shows only the expected refusal.
- [ ] **Step 7:** If Step 6 fails and is not fixed within the session: `git checkout a700202` in a clean worktree and redeploy from there, which restores EVE login with the untouched `allowed_character_ids`. If it passes: remove `allowed_character_ids` from `site.yml`, retake `docs/screenshots/login.png`, and commit it.
