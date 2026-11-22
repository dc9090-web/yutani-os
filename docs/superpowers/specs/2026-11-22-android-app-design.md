# Yutani OS for Android — design

Date: 2026-11-22. Status: approved by the owner on 2026-11-22. Nothing here is built yet.

## Intent

A native Android app that shows the same things as the website, in the same look, on the owner's
phone. It is built with Kotlin, following the agent set-up on
<https://kotlinlang.org/docs/ai-for-development.html>.

Two things come with it, both decided by the owner:

- **Google sign-in is the only way in**, on the website (desktop and mobile) and in the app. EVE
  login stops being a way into the site and becomes "add a character" and "re-authorise a
  character" in Settings.
- **The whole thing is planned before anything is built.** This document covers every phase; each
  phase then gets its own step-by-step implementation plan.

Items marked **(my call)** were chosen by Claude, not by the owner. Any of them can be overruled.

## Goals

- Every screen in today's navigation, native, in the Yutani look: Overview, Skills, Clones, Assets,
  Wallet, Ships and Ship detail, with the character switcher.
- One sign-in on every surface, tied to an allow-list of Google accounts.
- The app never recomputes anything the site already computes. Fit stats, training times, mastery
  and security colours come from the site as finished values.
- The site and the app cannot drift: both read from the same loading code.
- The app shows its last-known data when the phone is off Tailscale, clearly marked as old.

## Non-goals

- iPhone, Play Store listing, multi-user support.
- Talking to ESI from the phone. The site stays the only thing that holds EVE tokens.
- Making the site reachable from the public internet.
- Redesigning any screen. The handoff under `docs/design-handoff` is the design.

## Anti-goals

- A second copy of the dogma engine or any view logic in Kotlin.
- Any secret, hostname, email address or character name of the owner's in the public repo.
- A sign-in change that locks the owner out of the live site with no way back.

## Constraints found in the project

- The site is reachable only over Tailscale or the LAN (Traefik allow-list). The phone must be on
  the tailnet. Google sign-in still works, because Google only redirects the browser and never calls
  the site.
- The GitHub repo is public. `deploy/ansible/vars/site.yml` and `secrets.yml` are git-ignored and
  hold everything private.
- Pages are server-rendered. Each `page.tsx` reads the session, loads rows, builds plain objects
  with `src/lib/view/*` and passes them to a display component. Those objects mostly hold finished
  strings ("1.2b ISK", "3h 12m"), many worked out against the server's clock. The only read routes
  today are the paged ones behind "show more" (`/api/characters/{id}/wallet`, `skills`,
  `killmails`).
- The session is a signed cookie holding `{ activeCharacterId, iat }` (`src/lib/auth/session.ts`).
  `src/proxy.ts` checks its signature and age on every path except `/login`, `/api/health`,
  `/auth/*`, `/_next/` and `/yutani/`. Sign-in today is EVE SSO gated by `ALLOWED_CHARACTER_IDS`
  (`src/lib/auth/flow.ts`).
- Three screens do work in the browser: the drone selector on Ship detail recomputes DPS
  (`src/lib/view/drones.ts`), Assets filters and groups (`AssetsBrowser.tsx`), and Wallet loads 100
  rows at a time.
- Item and ship icons come from CCP's public image server (`images.evetech.net`), which the phone
  can reach directly.
- This machine has no Java, Gradle or Android SDK, and no graphical display (a `tty` session). It
  has KVM, 16 cores and 45 GB of memory, so an emulator and a virtual display are both workable.
- The owner has to create the Google Cloud project; Claude cannot.

## Approaches

**How the app is built**

- *Wrap the website in an app shell.* A day's work and no API. Rejected by the owner, who wants a
  native app.
- *Android-only with Jetpack Compose.* The standard route. Checking a screen means building,
  installing on an emulator and taking a screenshot each time.
- *Kotlin Multiplatform with Compose Multiplatform, Android plus a desktop window.* **Chosen (my
  call; the owner did not object when it was proposed).** The same UI code also runs as a desktop
  window, which is the target the Kotlin page's agent tooling works on: reload, screenshot, read
  the UI tree and click, in seconds. It keeps an iPhone version possible. The cost is a slightly
  more involved project and keeping Android-only pieces in their own source set.

**How the phone signs in**

- *Pair from the website with a QR code.* Claude's first recommendation. Dropped.
- *EVE login in the app.* Needs a new callback registered with CCP. Dropped.
- *Google sign-in everywhere.* **Chosen by the owner**, with Google as the only way in.

**How the app gets data**

- *The app parses the site's HTML.* Breaks whenever the markup changes. Rejected.
- *A JSON API that returns the view objects the pages already build.* **Chosen (my call).** The
  loading code moves out of each page into a shared function used by both the page and the route.

## Architecture

```
Phone (Tailscale) ── HTTPS ──> Traefik ──> Next.js site ──> Postgres
  Android app                                 │  pages      (server-rendered, cookie session)
  Google account picker ──> Google            │  /api/v1/*  (JSON, bearer token)
                                              └─ worker ──> ESI (unchanged)
```

### 1. Sign-in on the site

- New routes `/auth/google/start` and `/auth/google/callback`: the standard authorisation-code flow
  with PKCE and a `state` value, reusing the short-lived signed cookie pattern the EVE flow uses.
  The ID token is verified with `jose` (already a dependency) against Google's published keys:
  signature, issuer, audience equal to the web client ID, expiry, and `email_verified`.
- Allow-list: `ALLOWED_GOOGLE_EMAILS`, comma-separated, set from `allowed_google_emails` in
  `site.yml`. An account not on it gets the login page with a plain refusal, and the refused
  address is logged so it can be added, as refused characters are today.
- The session cookie gains the Google subject and email: `{ sub, email, activeCharacterId, iat }`.
  A cookie without `sub` is not a session, so every existing session ends once at deploy. This
  needs three changes beyond the new routes: the proxy must reject a payload without `sub`, and
  `/auth/switch` and `/auth/callback` must carry `sub` and `email` over when they re-sign the
  cookie (today they write only `{ activeCharacterId, iat }`).
- EVE SSO stays as it is, but `/auth/start` and `/auth/callback` now require a signed-in session
  and only add or re-authorise a character. They are public in the proxy today (`/auth/` prefix;
  `tests/proxy.test.ts` asserts it), so the public list narrows to `/auth/google/` and the two EVE
  routes also check the session themselves. `ALLOWED_CHARACTER_IDS` is removed
  **(my call)**: only a signed-in owner can reach the add-character button, so it protects nothing.
- The login page shows one "Sign in with Google" button. Settings keeps "Add character" and gains
  the list of signed-in phones (below).
- Way back if Google sign-in fails on live: redeploy the previous commit. The plan must take a
  database backup first and confirm sign-in on live before anything else is deployed on top.

New settings: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (in `secrets.yml`),
`ALLOWED_GOOGLE_EMAILS` (in `site.yml`). The callback URL is derived from the site origin.

### 2. Sign-in in the app

- The app uses Android's Credential Manager with Sign in with Google and the **web** client ID,
  and receives a Google ID token.
- It posts the token to `POST /api/v1/auth/google`. The site runs the same verification and
  allow-list check, then creates an app session and returns its token.
- App sessions live in a new table `app_sessions` (id, token hash, Google subject, device name,
  created, last used, revoked). Only a hash is stored. Tokens do not expire on a timer **(my
  call)**; they end when revoked from Settings or when the app signs out
  (`DELETE /api/v1/auth/session`).
- The app keeps the token in encrypted storage on the phone and sends it as
  `Authorization: Bearer …`. A `401` sends the app back to the sign-in screen.
- `src/proxy.ts` lets `/api/v1/auth/google` through unauthenticated and accepts either the cookie
  or a bearer token for the rest of `/api/v1/`. Token lookup needs the database, so it happens in
  a shared helper the routes call; the proxy only checks that a bearer header is present.
- Google Cloud needs two OAuth clients: a Web client (redirect URI
  `https://<domain>/auth/google/callback`) and an Android client (package name plus the SHA-1 of
  the signing key; one entry for the debug key, one for the release key). The plan includes
  click-by-click steps for the owner.

### 3. The read API

All routes are `GET`, return JSON, and take the character in the path so the app holds no
server-side "active character".

| Route | Returns | Built from |
|---|---|---|
| `/api/v1/me` | signed-in email, owner initials, API version | config |
| `/api/v1/characters` | the character list for the switcher | `view/characters.ts` |
| `/api/v1/overview` | Overview cards | `view/overview.ts` |
| `/api/v1/characters/{id}/skills` | Skills tab: summary and trained skills | `view/skills.ts` |
| `/api/v1/characters/{id}/training` | Training tab: queue | `view/skills.ts` |
| `/api/v1/training-overview` | Skills › Overview (all characters) | `view/training-overview.ts` |
| `/api/v1/characters/{id}/clones` | Clones | `view/clones.ts` |
| `/api/v1/characters/{id}/assets` | Assets tree | `view/assets.ts` |
| `/api/v1/characters/{id}/wallet` | Wallet | `view/wallet.ts` |
| `/api/v1/characters/{id}/ships` | Fitted ships and saved fits | `view/ships.ts` |
| `/api/v1/characters/{id}/ships/asset/{itemId}` | Ship detail for an owned ship | `view/fit-sheet.ts` |
| `/api/v1/characters/{id}/ships/fit/{fittingId}` | Ship detail for a saved fit | `view/fit-sheet.ts` |

- For each page, the code between "read the session" and "render the component" moves into
  `src/lib/pages/<name>.ts` as `load<Name>(characterId, …)`. The page and the route both call it.
  This is a refactor of working pages; the existing tests must stay green and each loader gets a
  test of its own.
- Responses are the view objects as they are, finished strings included, wrapped as
  `{ data, generatedAt }`. The app shows those strings and formats nothing itself, with one
  exception below.
- **Anything that depends on the clock also carries its raw values (my call).** Where a view
  object holds a string worked out against "now" (time left, progress, "queue active", an ETA),
  the view type gains the raw fields beside it: start and end times, and SP bounds for progress.
  This is additive, so the display components and their tests do not change. The app recomputes
  only these from the raw fields, so a saved copy never shows a frozen countdown or a finished
  skill as still training. That is the one piece of view logic ported to Kotlin: a duration
  formatter, a progress fraction, and dropping queue entries whose end time has passed. Its tests
  mirror the site's cases for `duration`, `queueProgress` and `liveQueue`.
- **Ship detail drones (my call):** the route takes the chosen drones as a query parameter and
  returns the recomputed numbers, so no DPS maths runs on the phone. Each change of selection is
  one request.
- **Assets (my call):** the route returns the whole tree; searching and grouping happen in the app,
  as they do in the browser. This is list filtering, not game logic.
- **Wallet (my call):** the route takes `kind` (journal or transactions) and `offset`, 100 rows a
  page, like the existing route.
- The existing un-versioned `/api/*` routes are untouched; the website keeps using them.
- Errors: `401` not signed in, `404` unknown character or ship, `400` bad id, each with
  `{ error: "<code>" }`.

**Contract fixtures (my call).** A script seeds a test database with invented characters, runs
each loader and writes one JSON file per route into `api-fixtures/v1/`. The files are committed
(they contain nothing of the owner's), and a site test fails when a loader's output no longer
matches its file. The app's tests decode the same files into its Kotlin models, and the desktop
build can run on them with no server. A change to a view object that the app cannot read then
fails a test instead of a screen. The generator needs Postgres, like `tests/db` (the
`eve-dev-postgres` container). `tests/fixtures` holds ESI responses and a mini SDE, not view data;
the builder must check early whether the mini SDE is rich enough for a believable ship-detail
fixture and extend it with `scripts/dogma-fixture.ts` if not.

### 4. The app

- **Location:** `android/` in this repo **(my call)**, so an API change and the app change that
  follows it land in one commit. Nothing in the site's build or deploy reads that folder.
- **Project:** Kotlin Multiplatform, one `composeApp` module with `commonMain` (all screens, models,
  networking), `androidMain` (Google sign-in, encrypted token storage, notifications later) and
  `desktopMain` (a window for development only).
- **Versions:** latest stable at build time. On 2026-11-22 the release pages showed Kotlin 2.4.21
  and Compose Multiplatform 1.12.2; the builder confirms and pins them. Java 21, because Compose
  Hot Reload requires 21 or earlier.
- **Libraries (my call):** Ktor client and kotlinx.serialization for the API, Coil 3 for icons,
  the multiplatform Navigation and ViewModel libraries, DataStore for small settings. Each must be
  checked on klibs.io for desktop support before it is added.
- **Structure:** one repository class per API area, one view model per screen exposing a single
  state (`Loading`, `Content(data, asOf, stale)`, `Error`), screens as plain composables that take
  that state. Screens never call the network.
- **Models:** hand-written `@Serializable` classes mirroring the TypeScript view types, kept honest
  by the contract fixtures. Unknown fields are ignored so the site can add fields freely.
- **Look:** a `YutaniTheme` carrying the `--yo-` tokens from `docs/design-handoff/tokens.css`
  (colours, spacing, radii, type scale) with Inter, Space Grotesk and JetBrains Mono bundled.
  Shared pieces mirror the site's `.yo-*` components: panel, stat strip, segmented bar, level
  blocks, gauge, tabs, pill, and `Place` with its security colour. Dark only, as the site is.
- **Layout:** the mobile artboards in `docs/design-handoff/artboards/mobile` are the reference,
  including the scrolling navigation strip under the logo. Where an artboard is missing (the
  handoff lists the Ships table), the app follows the live site at phone width.
- **Hover text:** the site shows item descriptions on hover. On the phone, a long press opens the
  same text in a bottom sheet **(my call)**.
- **Last-known data (my call):** each successful response is saved to disk. A screen shows the
  saved copy at once, refreshes in the background, and when the site cannot be reached keeps the
  copy with an "as of 14:05 — offline" line. Pull down to refresh.
- **Site address:** never in the repo. The Android build reads it from the git-ignored
  `android/local.properties`, along with the Google web client ID.
- **Desktop window sign-in:** the desktop target cannot use the Android account picker. It runs on
  the contract fixtures by default, or against a real site with a token passed in an environment
  variable, minted by a small script on the site side. It is a development tool and is not shipped.
- **Which site during development (my call):** a local dev site on this machine against the
  `eve_preview` database (a copy of live), as used for the redesign. The emulator reaches it at
  `10.0.2.2`. The live site is used only for the end-of-phase check on the owner's phone.
- **Testing Google sign-in (my call):** on the owner's phone only. The emulator and the desktop
  window run on a dev token, so nobody types the owner's Google password into an emulator here.
  The site-side verification is fully covered by tests with made-up tokens.
- **Distribution (my call):** a signed APK installed by hand. The release keystore lives outside
  the repo; its SHA-1 goes into the Google Android client. The plan covers building, signing and
  updating.

### 5. Agent set-up, per the Kotlin page

- Install the Kotlin skills: `claude plugin marketplace add Kotlin/kotlin-agent-skills`, then
  `claude plugin install kotlin-agent-skills@Kotlin`. This also turns on the Kotlin docs MCP
  server. The ten skills are migration and build-tooling skills; none covers Compose UI, so they
  are a reference, not a guide to building the screens.
- Install Google's Android CLI and its skills (`android init`, `android skills list`) for SDK
  set-up, emulators and builds.
- Add Compose Hot Reload's MCP server to `android/.mcp.json`, running
  `./gradlew --no-daemon --quiet --console=plain :composeApp:hotMcpServerJvm` (the task name
  follows the desktop target's name). It is marked experimental. This machine has no display, so
  the window runs under a virtual display (Xvfb); if that fails, screenshots fall back to the
  Android emulator.
- `android/AGENTS.md` carries the page's acceptance rules, adapted: run the tests after every
  change; both the Android and the desktop target must build before a task is done; no
  Android-only API in `commonMain`. It also records the commands for build, test, run and
  screenshot.
- Machine set-up: JDK 21, the Android SDK with an emulator image that includes Google Play
  services (needed to test sign-in), Xvfb.
- Junie, Air and the JetBrains IDE MCP server are not used: they need a JetBrains IDE or account,
  and the work is done from the terminal.

## Phases

Each phase ends in something that works on its own and gets its own implementation plan.

1. **Google sign-in on the site.** Section 1, including the owner's Google Cloud steps for the web
   client. Shipped and confirmed on live before anything else. Useful with no app at all.
2. **Read API and app sessions.** Sections 2 (site side) and 3, the contract fixtures, and the
   signed-in phones list in Settings.
3. **App foundation.** Machine and agent set-up (section 5), the project, the theme and shared
   components, sign-in, the shell and navigation, the character switcher, last-known data, and the
   Overview screen end to end on the owner's phone.
4. **The other read-only screens.** Skills (three tabs), Clones, Assets, Wallet, Ships, Ship
   detail. One screen per step, each checked against the site side by side.
5. **Changing things from the phone.** In this order, each optional: character tags and multiview
   selection; skill plans; the fitting editor. The fitting editor is the largest screen on the
   site and is a project of its own.
6. **Phone-only extras.** A notification before a skill queue runs empty, scheduled on the phone
   from the end times it already has (no push service); a home-screen widget for training.

Phases 5 and 6 are outlined only. They get their own design conversation when reached, because
what is wanted will be clearer once the read-only app is in daily use.

## Testing

- Site: the existing gate (`npx tsc --noEmit -p . && npx vitest run tests/view tests/components
  tests/dogma tests/fits`) does not cover where the new tests belong. The gate widens to include
  `tests/auth`, `tests/api`, `tests/proxy.test.ts` and the database-backed tests, with the
  `eve-dev-postgres` container running. New tests for Google token verification (good, wrong audience,
  expired, unverified email, not on the list), the app-session routes, each loader and each API
  route, and the proxy's bearer handling.
- App: decoding every contract fixture; view-model tests with a fake repository (loading, content,
  stale copy, error, signed out); formatting tests that match `view/format.ts` case for case.
- By eye: every screen compared with the site at phone width, on the desktop window and on an
  emulator; sign-in and one full pass on the owner's phone before a phase is called done.

## Left to the builder

- Exact library versions, Gradle layout and package name.
- Whether the shared loaders need splitting further than one per page.
- Component-level layout wherever the artboards and the live site agree.
- The shape of the dev-token script for the desktop window.

## Open points for the owner

- The Google account address or addresses to allow.
- Whether `ALLOWED_CHARACTER_IDS` should really go, or stay as a second check.
- Whether app tokens should expire after a period instead of living until revoked.
