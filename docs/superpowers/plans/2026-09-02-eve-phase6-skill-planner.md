# EVE Phase 6 (Skill Planner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EVEMon-style skill plans per character. Build an ordered list of (skill, level) entries with prerequisites inserted automatically; see SP, training time, cumulative time and completion date per entry and in total, computed from the character's **real** attributes and implants; get a brute-forced optimal-remap suggestion with the time it saves; see when the account's other character stops hogging the queue; import and export plans as text in both the EVEMon (`Gunnery V`) and in-game (`Gunnery 5`) flavours.

**Architecture:** All the maths lives in `src/lib/skills/**` as **pure, isomorphic functions** — no `pg`, no `node:*` — so the same code answers the server render and the client's instant feedback while editing, exactly as `src/lib/fits/**` does for phase 5. The server owns the truth: `GET /api/skill-plans/[id]` returns the entries already carrying SP, time, status and done-at, so a reload and a keystroke can never disagree. Postgres holds the plans (`skill_plans` / `skill_plan_entries`) and two new reference tables imported by the phase-2 declarative importer (`sde_alpha_skills`, `sde_skill_plans`). The editor is a `"use client"` island under `/skills/plans/[id]`, beside the phase-3b skills pages, and `/skills` grows a **Plans** section.

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Next.js 16 app router (server components + `"use client"` islands), React 19, Mantine 9 (theme only — layout is the Midnight CSS in `src/app/globals.css`), Tabler icons, Node 24, `pg` 8, Postgres 17, vitest 4 with happy-dom + `@testing-library/react`. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase6-skill-planner-design.md` — this plan implements all of §2–§8. Project-wide architecture decisions come from `docs/superpowers/specs/2026-09-01-eve-foundation-design.md` §2–3. The formulas, attribute ids and format details are all traceable to `docs/research/skill-planner.md`, which verified them against the SDE and EVEMon's source.

**Depends on:** Phase 2 (`sde_*` and the declarative importer), phase 3 (`character_skills`, `character_skill_queue`, `character_attributes`, `character_implants`, `character_clones`) and phase 5 (the `src/lib/api/json.ts` helpers, the `"use client"` island pattern, `tests/db/helpers.ts`) — all merged to `main`. Every signature this plan consumes is quoted verbatim from the code as it stands on `main`.

## Global Constraints

- **Same stack. No new runtime dependencies.** The spec names none, so `package.json`'s `dependencies` block does not change. No date library, no state library, no big-number library.
- **TypeScript strict, ESM.** Imports between local TS files carry the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- **Pages and API routes read Postgres only — never ESI inline** (foundation §2.1). Phase 6 adds no outbound HTTP at all.
- **`src/lib/skills/**` stays pure and isomorphic**: no `node:*` import, no `pg`, no `src/lib/db/**`, no `src/lib/sde/**`. `src/lib/skills/load.ts` is the single server-only module in that directory and is imported **only** by server components and API routes — never by a `"use client"` component. `npm run build` is what proves it; run it before the deploy task.
- **Training-time maths is exact and hand-derivable.** `spForLevel(rank, level) = Math.ceil(250 * rank * 2 ** (2.5 * (level - 1)))` — cumulative SP *at* that level, not the increment. `spPerMinute = primary + secondary / 2`, **Omega rate only** (no ×0.5 Alpha factor — spec §2 ruling: all four characters are Omega). Every pinned number in a test has its derivation written out in the task that pins it.
- **The dogma attribute ids are fixed and verified** (research §2, §4): 164 charisma, 165 intelligence, 166 memory, 167 perception, 168 willpower; 175–179 the matching implant bonuses (charisma…willpower, same order); 180 `primaryAttribute` and 181 `secondaryAttribute`, whose *values* are ids in 164–168; 275 `skillTimeConstant` (the rank); prerequisite pairs (182, 277) (183, 278) (184, 279) (1285, 1286) (1289, 1287) (1290, 1288) — note skill 5's level is **1287**, not 1289+1. SDE values are floats; `Math.round` them before use as ids or ranks.
- **All routes are session-guarded by `src/proxy.ts` already.** Its matcher is `["/((?!_next/static|_next/image).*)"]` and only `/login`, `/api/health`, `/auth/*`, `/_next/*` and two static files are public. **Do not add anything from phase 6 to `PUBLIC_EXACT` or `PUBLIC_PREFIXES`.**
- **400 on a malformed body or query, 404 on an unknown id.** Validation helpers live in `src/lib/api/json.ts` (`parseId`, `parseIdList`, `MAX_IDS`); phase-6 body validation lives in `src/lib/skills/parse.ts` as pure functions.
- **Midnight tokens only.** Colours come from the CSS variables in `src/app/globals.css`; new styling is a new class in that file. **Never inline a colour.** Reuse the existing classes (`card`, `card-title`, `card-stack`, `card-grid`, `table`, `badge`, `muted`, `faint`, `num`, `page-title`, `page-sub`, `section-title`, `banner`, `stat-row`, `stat-label`, `stat-value`, `attr-grid`, `attr`, `attr-label`, `attr-total`, `attr-bonus`, `filter-input`, `fit-btn`, `fit-select`, `fit-name-input`, `icon-btn`, `save-state`, `modal`, `modal-backdrop`, `eft-text`, `browser-results`, `browser-row`, `check-row`, `show-more`). A width or a length may be inline; a colour may not.
- **Tabler icons** (`@tabler/icons-react`) for any iconography.
- **"Active character" = `readSession()?.activeCharacterId`**, falling back to the first character of `listCharacters()` — that is exactly `pickActive(characters, session?.activeCharacterId ?? null)`.
- **Unknown skill ids** (SDE drift) render as `Unknown skill (id)` and contribute **0 SP and 0 time** (spec §7). A plan for a character with no synced skills computes from level 0 and the page shows a banner. Import lines that do not resolve are listed, never fatal.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`; the environment is happy-dom with `tests/setup.ts`. DB tests use `tests/db/helpers.ts` (`resetDb`, `resetSde`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **No network in tests.** Route and client tests inject a fake `fetch`; SDE-backed tests read `tests/fixtures/sde-mini.zip` or seed `sde_*` rows directly; the Alpha-set proof reads the committed `tests/fixtures/skills/alpha-set.json`.
- **Pristine test output.** A test that exercises a caught-and-logged failure must stub `console.error` (`vi.spyOn(console, "error").mockImplementation(() => {})`) so the run stays clean.
- **Never log tokens; never print `.env`.** No new secret is introduced by this phase.
- Work happens on branch **`feature/phase6-skill-planner`**, created from `main`. **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- VM: `ssh daniel@10.5.5.150`, site `https://eve.plasma66.com`, Ansible in `deploy/ansible`, Compose project directory `/opt/eve/src/deploy`.

## Decisions taken once, for the whole plan

These are the places the spec left a choice. They are recorded here so no task re-litigates them; each is repeated in the task that first depends on it.

1. **`spForLevel(rank, level)` is the *cumulative* SP at that level**, and `spForLevel(rank, 0) === 0`. The published Alpha maximum of 19,669,072 SP is the sum of `spForLevel(rank, cap)` over the 175 skills in `cloneGrades.jsonl` — verified against the real archive while writing this plan; the cumulative-of-increments reading gives 23,865,618 and is wrong. `spBetween(rank, from, to) = spForLevel(rank, to) - spForLevel(rank, from)`.
2. **A plan entry is one (skill, level) pair**, and `expandPlan` emits every missing level. "Gunnery III" in a plan with nothing trained is three rows, not one. This is EVEMon's `FillDependencies` contract (research §4) and it makes the text export — one line per level — a straight `map`.
3. **`prereq` is a display flag, not a different kind of row.** An emitted entry is `prereq: true` unless it exactly matches a (skillId, level) pair the caller asked for. So requesting Gunnery III yields Gunnery I and II tagged `prereq` and Gunnery III untagged.
4. **`character_attributes` holds base+remap and *excludes* implants** — spec §2 says so explicitly, and this plan follows the spec. Research §3 records that EVEMon subtracts implants from ESI's numbers, believing the opposite; the two readings differ by at most 5 per attribute. Task 12 therefore adds a **sanity check** rather than a conversion: if the stored five values are not each in 17..27 and do not sum to 99, log once and show "attributes look implant-inclusive" in the panel. Never silently subtract.
5. **The remap search minimises total plan time, full stop.** EVEMon's "maximise skills trained inside `maxDuration`, break ties by time" rule (research §3) needs a user-supplied horizon the spec does not have. Enumeration order is `perception → willpower → intelligence → memory`, charisma taking the remainder, and a candidate replaces the best only on a **strictly smaller** total, so ties resolve to the first candidate in that order and the result is deterministic.
6. **`sde_skill_plans.skills` is fed from the SDE's `skillRequirements` field.** The spec calls the column `skills`; the archive's field is `skillRequirements` (verified — there is no `skills` field on `skillPlans.jsonl` records). The column keeps the spec's name, the mapper reads the real field.
7. **`SdePgType` gains a `"jsonb"` member.** The spec asks for two `jsonb` columns; the importer's `INSERT … SELECT * FROM unnest($n::jsonb[])` accepts an array of JSON **strings** from `pg`, and reads back as parsed objects. Verified against the dev Postgres while writing this plan.
8. **Partial SP inside a level is honoured.** `character_skills.skillpoints` is real SP, so the first planned level of a part-trained skill costs `spForLevel(rank, level) - skillpoints` when that is smaller. Without it the head entry's estimate would not match the in-game queue, which is the acceptance check in spec §8.
9. **The account rule needs an account.** `characters.account_id` is nullable, and SQL's `NULL <> NULL` means an unassigned character has no siblings — so it simply gets no banner. Assigning accounts is a phase-1 `/settings` job, not this plan's.
10. **The plan editor's client-side recompute uses the same pure functions the server used**, fed from props. There is **no** `/api/skills/catalogue` route: `/skills/plans/[id]/page.tsx` reads the catalogue on the server and hands the editor only the ~600 skills' `{id, name, group, rank, primary, secondary, prereqs, alpha}` — about 90 KB of props, once per page load.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/sde/ddl.ts` | **Modified**: `sde_alpha_skills`, `sde_skill_plans`; `SdePgType` gains `"jsonb"` |
| `src/lib/sde/tables.ts` | **Modified**: the two new mappers and the `json()` field helper |
| `scripts/sde-fixture.ts` | **Modified**: `cloneGrades` and `skillPlans` copied whole into `sde-mini.zip` |
| `scripts/skills-fixture.ts` | Regenerates `tests/fixtures/skills/alpha-set.json` from a full SDE archive |
| `src/lib/sde/repo.ts` | **Modified**: `getAlphaSkills`, `listCareerPlans`, `getCareerPlan`, `listPlanSkills` |
| `src/lib/skills/sp.ts` | **Pure.** `spForLevel`, `spBetween`, `trainingMs`, `currentSpInTraining` |
| `src/lib/skills/attributes.ts` | **Pure.** `AttributeSet`, implant bonuses, `spPerMinute`, remap legality, `enumerateBases` |
| `src/lib/skills/catalogue.ts` | **Pure.** `PlanSkill`, `SkillCatalogue`, `buildCatalogue`, `skillRate` |
| `src/lib/skills/expand.ts` | **Pure.** `expandPlan` — recursive prerequisite expansion in trainable order |
| `src/lib/skills/timeline.ts` | **Pure.** `planTimeline` (statuses, SP, per-entry and cumulative time, done-at) and `planDurationMs` |
| `src/lib/skills/remap.ts` | **Pure.** `optimalRemap` — brute force over every legal base distribution |
| `src/lib/skills/text.ts` | **Pure.** EVEMon / in-game parse and serialise, Roman numerals |
| `src/lib/skills/parse.ts` | **Pure.** Request-body validation for the plan routes |
| `db/schema.sql` | **Modified**: `skill_plans` and `skill_plan_entries` (spec §4) |
| `src/lib/db/skill-plans.ts` | Repo: `listPlans`, `getPlan`, `createPlan`, `updatePlan`, `deletePlan` |
| `src/lib/db/character-skills.ts` | **Modified**: `accountQueueEnds(characterId)` |
| `src/app/api/skill-plans/route.ts` | `GET ?characterId=` list, `POST` create (from entries or a CCP template) |
| `src/app/api/skill-plans/[id]/route.ts` | `GET` (with the computed timeline), `PUT`, `DELETE` |
| `src/app/api/skill-plans/[id]/optimise/route.ts` | `POST` → `{ remap, totalMs, savedMs }` |
| `src/app/api/skill-plans/import/route.ts` | `POST { characterId, name, text }` → plan + unresolved lines |
| `src/app/api/skill-plans/[id]/export/route.ts` | `GET ?format=evemon\|ingame` → `text/plain` |
| `src/lib/skills/load.ts` | **Server only.** `loadSkillCatalogue`, `loadPlanContext`, `accountTrainingBlock`, `computePlan` |
| `src/lib/view/format.ts` | **Modified**: `duration(ms)` — "5 d 13 h 20 m" |
| `src/lib/view/plan.ts` | **Pure.** `planView`, `attributePanel`, `remapSuggestion` — the whole editor as strings |
| `src/app/skills/PlanTable.tsx` | `"use client"` — the entry table: status badges, prereq tags, move/remove/level |
| `src/app/skills/AttributesPanel.tsx` | `"use client"` — attributes, per-pair SP/hour, optimal remap, remap availability |
| `src/app/skills/PlanEditor.tsx` | `"use client"` — the state owner: entries, autosave, add-skill, export/import modals |
| `src/app/skills/plans/[id]/page.tsx` | The editor route (server): plan, context, catalogue, account rule |
| `src/app/skills/PlansCard.tsx` | `"use client"` — the Plans section on `/skills`: list, New, From template, Import |
| `src/app/skills/page.tsx` | **Modified**: renders `PlansCard` |
| `src/app/globals.css` | **Modified**: plan-table, plan-toolbar, remap and picker classes |
| `tests/fixtures/skills/alpha-set.json` | 175 `[typeId, rank, cap]` triples — the Alpha-set proof |
| `tests/sde/fixture.test.ts` | **Modified**: the two new members and their counts |
| `tests/sde/tables.test.ts` | **Modified**: 19 table defs, the `jsonb` type, the two new mappers |
| `tests/db/sde-import.test.ts` | **Modified**: `sde_alpha_skills` / `sde_skill_plans` counts |
| `tests/db/schema.test.ts` | **Modified**: the four new tables |
| `tests/db/helpers.ts` | **Modified**: `skill_plans` added to the TRUNCATE list |
| `tests/db/sde-skills.test.ts` | `getAlphaSkills`, `listCareerPlans`, `getCareerPlan`, `listPlanSkills` on real Postgres |
| `tests/skills/sp.test.ts` | The rank table, the Alpha-set sum, `spBetween`, `trainingMs`, interpolation |
| `tests/skills/attributes.test.ts` | Implant bonuses, `spPerMinute`, remap legality, `enumerateBases` |
| `tests/skills/catalogue.test.ts` | `buildCatalogue`, `skillRate`, unknown skills |
| `tests/skills/expand.test.ts` | Nested prerequisites, skipping trained/queued, no duplicates, ordering |
| `tests/skills/timeline.test.ts` | Statuses, per-entry and cumulative times, done-at, queue offset, partial SP |
| `tests/skills/remap.test.ts` | The Gunnery-heavy optimum, saved time, determinism, implants |
| `tests/skills/text.test.ts` | Roman/Arabic round trips, `<localized>` stripping, unresolved lines |
| `tests/skills/parse.test.ts` | Body validation and the remap shape |
| `tests/db/skill-plans.test.ts` | The repo on real Postgres, including cascade delete |
| `tests/db/skills-load.test.ts` | `loadPlanContext` / `accountTrainingBlock` on real Postgres |
| `tests/api/skill-plans-routes.test.ts` | CRUD, validation, 404s |
| `tests/api/skill-plans-extra-routes.test.ts` | optimise / import / export |
| `tests/view/plan.test.ts` | `planView`, `attributePanel`, `remapSuggestion`, `duration` |
| `tests/components/plan-table.test.tsx` | Status badges, prereq tag, move/remove/level |
| `tests/components/attributes-panel.test.tsx` | Breakdown, SP/hour pairs, remap suggestion |
| `tests/components/plan-editor.test.tsx` | Add a skill inserting prerequisites; remap toggle; export modal |
| `tests/components/plans-card.test.tsx` | List, New plan, From template, Import |

---

### Task 1: The two new SDE tables (`sde_alpha_skills`, `sde_skill_plans`)

Spec §3. Both members exist in the real archive — verified while writing this plan against
`.superpowers/research/sde-3484357.zip`: `cloneGrades.jsonl` has **4** records (`_key` 1, 2, 4, 8 —
Alpha Caldari/Minmatar/Amarr/Gallente) each with the **identical 175-skill** list, and
`skillPlans.jsonl` has **40** records. The importer is declarative, so this is a DDL entry, a table
def, a fixture regeneration and the three fixture-count tests.

**Files:**
- Modify: `src/lib/sde/ddl.ts`, `src/lib/sde/tables.ts`, `scripts/sde-fixture.ts`,
  `src/lib/sde/repo.ts`, `tests/sde/fixture.test.ts`, `tests/sde/tables.test.ts`,
  `tests/db/sde-import.test.ts`, `tests/db/schema.test.ts`
- Create: `tests/db/sde-skills.test.ts`

**Interfaces:**
- Consumes (phase 2, verbatim from the code on `main`):
```ts
// src/lib/sde/ddl.ts
export const SDE_TABLES = [ /* 17 names */ ] as const;
export type SdeTableName = (typeof SDE_TABLES)[number];
export function sdeDdl(schema: string): string[];
// src/lib/sde/tables.ts
export type SdePgType = "int" | "text" | "bool" | "float8";
export interface SdeColumn { name: string; type: SdePgType }
export interface SdeTable { table: SdeTableName; member: string; columns: SdeColumn[];
                            map(record: Record<string, unknown>): unknown[] | unknown[][] }
export function en(value: unknown): string | null;
export function int(value: unknown): number | null;
export function num(value: unknown): number | null;
export function bool(value: unknown): boolean | null;
export function str(value: unknown): string | null;
export const SDE_TABLE_DEFS: readonly SdeTable[];
export function tableDef(table: SdeTableName): SdeTable;
// src/lib/sde/import.ts — reads def.columns[i].type to build `$n::<type>[]`
export const SDE_STAGING_SCHEMA = "sde_import";
```
- Produces:
```ts
// src/lib/sde/ddl.ts
// SDE_TABLES gains "sde_alpha_skills", "sde_skill_plans" (19 entries)
// src/lib/sde/tables.ts
export type SdePgType = "int" | "text" | "bool" | "float8" | "jsonb";
export function json(value: unknown): string;        // JSON.stringify, for a jsonb column
// src/lib/sde/repo.ts
export interface SdeCareerPlan {
  id: number; name: string | null; description: string | null;
  skills: { skillId: number; level: number }[];
  milestones: { skillId: number; level: number }[];
}
export async function getAlphaSkills(): Promise<Map<number, number>>;      // skillId → max level
export async function listCareerPlans(): Promise<SdeCareerPlan[]>;         // name-ascending
export async function getCareerPlan(id: number): Promise<SdeCareerPlan | null>;
```

**Decisions recorded here (do not re-litigate them):**
- `sde_skill_plans.skills` is fed from the archive's **`skillRequirements`** field. There is no
  `skills` field on a `skillPlans.jsonl` record; the column keeps the spec's name.
- Only `cloneGrades._key === 1` produces rows. The four grades are byte-identical after sorting
  (verified), and Pyfa's importer asserts the same thing.
- `SdePgType` gains `"jsonb"`. `INSERT … SELECT * FROM unnest($n::jsonb[])` with an array of JSON
  **strings** works through `pg` (quotes and commas inside the JSON are escaped by pg's array
  serialiser) and reads back as parsed objects — verified against the dev Postgres.
- The fixture copies both members **whole** rather than filtering: `cloneGrades.jsonl` is 21 KB and
  `skillPlans.jsonl` is 345 KB raw, which deflate to 0.8 KB and 53 KB — `sde-mini.zip` goes from
  868,613 bytes to roughly 925 KB, still well inside the 1.5 MB budget the fixture test enforces.

- [ ] **Step 1: Create the branch**

```bash
cd /home/daniel/AI/Plasma/EVE
git checkout main && git pull --ff-only 2>/dev/null || true
git checkout -b feature/phase6-skill-planner
git log --oneline -1
docker compose -f compose.dev.yml up -d
```
Expected: a new branch off the commit where phase 5 merged, and a running local Postgres.

- [ ] **Step 2: Write the failing fixture-count test**

In `tests/sde/fixture.test.ts`, add the two members to the `members` array (after
`"npcStations.jsonl"`) and the two counts to the expected object:

```ts
      "mapConstellations.jsonl", "mapSolarSystems.jsonl", "npcStations.jsonl",
      "cloneGrades.jsonl", "skillPlans.jsonl",
```
```ts
      "npcStations.jsonl": 18,
      "cloneGrades.jsonl": 4,
      "skillPlans.jsonl": 40,
```

And add a third `it` inside the same `describe`:

```ts
  it("carries the Alpha clone grades and CCP's career plans", async () => {
    const alpha = await fixtureRecord("cloneGrades.jsonl", 1);
    expect(alpha.name).toBe("Alpha Caldari");
    expect((alpha.skills as unknown[]).length).toBe(175);
    const plan = await fixtureRecord("skillPlans.jsonl", 4);
    expect((plan.name as Record<string, string>).en).toBe("Minmatar Militia Fighter");
    expect((plan.skillRequirements as unknown[])[0]).toEqual({ level: 1, typeID: 3327 });
    expect(plan.milestones).toEqual([
      { level: 3, typeID: 3329 }, { level: 2, typeID: 3356 }, { level: 3, typeID: 3302 },
      { level: 3, typeID: 3315 }, { level: 3, typeID: 3310 },
    ]);
  }, 30_000);
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/sde/fixture.test.ts`
Expected: FAIL — `zip member not found: cloneGrades.jsonl in .../sde-mini.zip`.

- [ ] **Step 4: Regenerate the fixture**

In `scripts/sde-fixture.ts`, extend `FULL_MEMBERS`:

```ts
/** Copied whole: together these are ~4.5 MB of JSON that deflates to well under the budget. */
const FULL_MEMBERS = [
  "_sde", "categories", "groups", "metaGroups", "dogmaUnits",
  "dogmaAttributeCategories", "dogmaAttributes", "marketGroups", "mapRegions",
  "cloneGrades", "skillPlans",
];
```

Then regenerate and check the size:

```bash
cd /home/daniel/AI/Plasma/EVE
npm run sde:fixture -- .superpowers/research/sde-3484357.zip
ls -l tests/fixtures/sde-mini.zip
```
Expected: the log lines `cloneGrades.jsonl: 4` and `skillPlans.jsonl: 40`, and a file of roughly
920–930 KB. If the script throws "over the 1.5 MB budget", stop — something else changed.

- [ ] **Step 5: Run the fixture test to verify it passes**

Run: `npx vitest run tests/sde/fixture.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing mapper test**

In `tests/sde/tables.test.ts`, change the "every table def" expectations from 17 to 19 and allow
the new column type:

```ts
  it("covers 19 tables and declares a type for every column", () => {
    expect(SDE_TABLE_DEFS.length).toBe(19);
    expect(new Set(SDE_TABLE_DEFS.map((d) => d.table)).size).toBe(19);
    for (const def of SDE_TABLE_DEFS) {
      expect(def.columns.length).toBeGreaterThan(0);
      for (const c of def.columns) expect(["int", "text", "bool", "float8", "jsonb"]).toContain(c.type);
    }
  });
```

and add a new `describe` at the end of the file. It uses the two helpers already declared at the
top of that file — `row(table, member, key)` for a 1:1 mapper and `rows(table, member, key)` for a
fan-out mapper:

```ts
describe("phase 6 static data", () => {
  it("keeps only Alpha grade 1 and fans its 175 skills out", async () => {
    const alpha = await rows("sde_alpha_skills", "cloneGrades.jsonl", 1);
    expect(alpha).toHaveLength(175);
    expect(alpha[0]).toEqual([3300, 5]);                   // Gunnery, capped at V for Alphas
    expect(await rows("sde_alpha_skills", "cloneGrades.jsonl", 2)).toEqual([]);
    expect(await rows("sde_alpha_skills", "cloneGrades.jsonl", 8)).toEqual([]);
  }, 30_000);

  it("maps a career plan, reading skillRequirements into the skills column", async () => {
    const plan = await row("sde_skill_plans", "skillPlans.jsonl", 4);
    expect(plan[0]).toBe(4);
    expect(plan[1]).toBe("Minmatar Militia Fighter");
    expect(String(plan[2])).toContain("Minmatar Soldiers of Fortune");
    expect(JSON.parse(String(plan[3]))[0]).toEqual({ skillId: 3327, level: 1 });
    expect(JSON.parse(String(plan[4]))).toEqual([
      { skillId: 3329, level: 3 }, { skillId: 3356, level: 2 }, { skillId: 3302, level: 3 },
      { skillId: 3315, level: 3 }, { skillId: 3310, level: 3 },
    ]);
  }, 30_000);

  it("json stringifies without touching a string", () => {
    expect(json([{ skillId: 1, level: 2 }])).toBe('[{"skillId":1,"level":2}]');
    expect(json([])).toBe("[]");
  });
});
```

Also extend the import at the top of the file with `json`:

```ts
import { tableDef, en, int, num, bool, str, json, SDE_TABLE_DEFS } from "../../src/lib/sde/tables.js";
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/sde/tables.test.ts`
Expected: FAIL — `json` is not exported and `no SdeTable definition for sde_alpha_skills`.

- [ ] **Step 8: Add the DDL**

In `src/lib/sde/ddl.ts`, append the two names to `SDE_TABLES` (after `"sde_stations"`):

```ts
  "sde_stations",
  "sde_alpha_skills",
  "sde_skill_plans",
] as const;
```

and the two bodies to `TABLE_BODIES` (after `sde_stations`):

```ts
  // Spec §3: the Alpha skill set, from cloneGrades grade 1. All four racial grades are identical.
  sde_alpha_skills: `
    skill_id  int PRIMARY KEY,
    max_level int`,
  // Spec §3: CCP's 40 certified career plans, offered as templates.
  // skills/milestones are [{ "skillId": int, "level": int }, …] in the SDE's own order.
  sde_skill_plans: `
    id          int PRIMARY KEY,
    name        text,
    description text,
    skills      jsonb,
    milestones  jsonb`,
```

- [ ] **Step 9: Add the field helper and the two mappers**

In `src/lib/sde/tables.ts`, widen the type union and add the helper beside `str`:

```ts
export type SdePgType = "int" | "text" | "bool" | "float8" | "jsonb";
```
```ts
/**
 * A jsonb column's value. `pg` serialises a `text[]`/`jsonb[]` parameter by escaping each element,
 * so handing it JSON strings is safe for any content — quotes, commas and backslashes included.
 */
export function json(value: unknown): string {
  return JSON.stringify(value);
}
```

and append the two defs to `SDE_TABLE_DEFS` (after `sde_stations`):

```ts
  {
    table: "sde_alpha_skills",
    member: "cloneGrades",
    columns: cols({ skill_id: "int", max_level: "int" }),
    // Four racial grades, byte-identical after sorting; keep grade 1 and let the rest map to nothing.
    map: (r) => (int(r._key) === 1 ? list(r.skills).map((s) => [int(s.typeID), int(s.level)]) : []),
  },
  {
    table: "sde_skill_plans",
    member: "skillPlans",
    columns: cols({ id: "int", name: "text", description: "text", skills: "jsonb", milestones: "jsonb" }),
    // The SDE field is `skillRequirements`; the column keeps the spec's name `skills`.
    map: (r) => [
      int(r._key), en(r.name), en(r.description),
      json(list(r.skillRequirements).map((s) => ({ skillId: int(s.typeID), level: int(s.level) }))),
      json(list(r.milestones).map((s) => ({ skillId: int(s.typeID), level: int(s.level) }))),
    ],
  },
```

- [ ] **Step 10: Run the mapper test to verify it passes**

Run: `npx vitest run tests/sde/tables.test.ts`
Expected: PASS.

- [ ] **Step 11: Write the failing import and schema tests**

In `tests/db/sde-import.test.ts`, add to `EXPECTED_COUNTS`:

```ts
  sde_stations: 18,
  sde_alpha_skills: 175,
  sde_skill_plans: 40,
};
```

and add the two members to the list inside `fixtureWithout`:

```ts
    "mapConstellations.jsonl", "mapSolarSystems.jsonl", "npcStations.jsonl",
    "cloneGrades.jsonl", "skillPlans.jsonl",
```

In `tests/db/schema.test.ts`, add the two table names to the sorted list (they sort between
`"market_prices"` and `"sde_categories"`):

```ts
      "market_prices",
      "sde_alpha_skills",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
      "sde_dogma_effect_modifiers", "sde_dogma_effects", "sde_dogma_units", "sde_groups",
      "sde_market_groups", "sde_meta", "sde_meta_groups", "sde_regions", "sde_skill_plans",
      "sde_solar_systems", "sde_stations", "sde_type_attributes", "sde_type_bonuses",
      "sde_type_effects", "sde_types",
      "structures", "sync_runs", "universe_names",
```

- [ ] **Step 12: Run them to check status**

Run: `npx vitest run tests/db/sde-import.test.ts tests/db/schema.test.ts`
Expected: both may already PASS — by this step the DDL (Step 8), the table defs and mappers (earlier
steps) and the regenerated fixture (Step 9) all exist, so there is nothing left to fail on. That is
fine: these two are regression guards, not the tests driving new code in this task.

- [ ] **Step 13: Run them again to verify they pass**

Run: `npx vitest run tests/db/sde-import.test.ts tests/db/schema.test.ts`
Expected: PASS. No implementation was needed between Steps 12 and 13 — the DDL and mappers from
Steps 8 and 9 are the implementation. If the import test still fails, the fixture was not
regenerated in Step 4.

- [ ] **Step 14: Write the failing repo test**

Create `tests/db/sde-skills.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { getAlphaSkills, getCareerPlan, listCareerPlans, listPlanSkills } from "../../src/lib/sde/repo.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });
beforeEach(async () => { await resetSde(pool); });

describe("getAlphaSkills", () => {
  it("maps skill id to the Alpha cap", async () => {
    await pool.query("INSERT INTO sde_alpha_skills (skill_id, max_level) VALUES (3300, 5), (3327, 3)");
    const alpha = await getAlphaSkills();
    expect(alpha.get(3300)).toBe(5);
    expect(alpha.get(3327)).toBe(3);
    expect(alpha.has(11207)).toBe(false);
  });
});

describe("listCareerPlans / getCareerPlan", () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO sde_skill_plans (id, name, description, skills, milestones) VALUES
        (4, 'Minmatar Militia Fighter', 'Fly frigates.',
         '[{"skillId":3327,"level":1},{"skillId":3329,"level":3}]'::jsonb,
         '[{"skillId":3329,"level":3}]'::jsonb),
        (14, 'Manufacturer', 'Build things.', '[]'::jsonb, '[]'::jsonb)`);
  });

  it("lists plans name-ascending with parsed skill arrays", async () => {
    const plans = await listCareerPlans();
    expect(plans.map((p) => p.name)).toEqual(["Manufacturer", "Minmatar Militia Fighter"]);
    expect(plans[1].skills).toEqual([{ skillId: 3327, level: 1 }, { skillId: 3329, level: 3 }]);
    expect(plans[1].milestones).toEqual([{ skillId: 3329, level: 3 }]);
  });

  it("reads one plan and answers null for an unknown id", async () => {
    expect((await getCareerPlan(4))?.name).toBe("Minmatar Militia Fighter");
    expect(await getCareerPlan(999)).toBeNull();
  });
});

describe("listPlanSkills", () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO sde_groups (id, category_id, name, published) VALUES
        (255, 16, 'Gunnery', true), (505, 16, 'Fake Skills', false), (25, 6, 'Frigate', true)`);
    await pool.query(
      `INSERT INTO sde_types (id, group_id, name, published) VALUES
        (3300, 255, 'Gunnery', true), (3318, 255, 'Weapon Upgrades', true),
        (11207, 255, 'Advanced Weapon Upgrades', true),
        (9998, 255, 'Retired Skill', false), (9997, 505, 'Fake Skill', true),
        (587, 25, 'Rifter', true)`);
    // Gunnery: rank 1, perception/willpower, no prerequisites.
    // Weapon Upgrades: rank 2, perception/memory, needs Gunnery II.
    // Advanced Weapon Upgrades: rank 6, perception/willpower, needs Weapon Upgrades IV.
    await pool.query(
      `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
        (3300, 275, 1), (3300, 180, 167), (3300, 181, 168),
        (3318, 275, 2), (3318, 180, 167), (3318, 181, 166), (3318, 182, 3300), (3318, 277, 2),
        (11207, 275, 6), (11207, 180, 167), (11207, 181, 168), (11207, 182, 3318), (11207, 277, 4),
        (587, 275, 1)`);
  });

  it("returns published skills in published skill groups only, name-ascending", async () => {
    const skills = await listPlanSkills();
    expect(skills.map((s) => s.id)).toEqual([11207, 3300, 3318]);   // by name
    expect(skills.map((s) => s.name)).toEqual(["Advanced Weapon Upgrades", "Gunnery", "Weapon Upgrades"]);
  });

  it("rounds the rank and the attribute ids and collects prerequisites", async () => {
    const skills = await listPlanSkills();
    const awu = skills.find((s) => s.id === 11207)!;
    expect(awu).toMatchObject({ groupId: 255, groupName: "Gunnery", rank: 6, primaryAttr: 167, secondaryAttr: 168 });
    expect(awu.prereqs).toEqual([{ skillId: 3318, level: 4 }]);
    expect(skills.find((s) => s.id === 3300)!.prereqs).toEqual([]);
  });
});
```

- [ ] **Step 15: Run it to verify it fails**

Run: `npx vitest run tests/db/sde-skills.test.ts`
Expected: FAIL — `getAlphaSkills is not a function`.

- [ ] **Step 16: Add the four repo readers**

Append to `src/lib/sde/repo.ts`:

```ts
export interface SdeCareerPlan {
  id: number; name: string | null; description: string | null;
  skills: { skillId: number; level: number }[];
  milestones: { skillId: number; level: number }[];
}
export interface SdePlanSkill {
  id: number; name: string | null; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number;
  prereqs: { skillId: number; level: number }[];
}

const CAREER_PLAN_COLS = "id, name, description, skills, milestones";

/** skillId → the highest level an Alpha clone may train (spec §3). */
export async function getAlphaSkills(): Promise<Map<number, number>> {
  const { rows } = await getPool().query<{ skillId: number; maxLevel: number | null }>(
    `SELECT skill_id AS "skillId", max_level AS "maxLevel" FROM sde_alpha_skills`);
  const out = new Map<number, number>();
  for (const r of rows) if (r.maxLevel !== null) out.set(r.skillId, r.maxLevel);
  return out;
}

/** `pg` parses a jsonb column into plain objects, so the arrays come back ready to use. */
export async function listCareerPlans(): Promise<SdeCareerPlan[]> {
  const { rows } = await getPool().query<SdeCareerPlan>(
    `SELECT ${CAREER_PLAN_COLS} FROM sde_skill_plans ORDER BY name, id`);
  return rows.map(careerPlan);
}

export async function getCareerPlan(id: number): Promise<SdeCareerPlan | null> {
  const { rows } = await getPool().query<SdeCareerPlan>(
    `SELECT ${CAREER_PLAN_COLS} FROM sde_skill_plans WHERE id = $1`, [id]);
  return rows[0] ? careerPlan(rows[0]) : null;
}

/** A NULL jsonb column (an SDE record with no such list) reads as an empty array, never null. */
function careerPlan(r: SdeCareerPlan): SdeCareerPlan {
  return { ...r, skills: r.skills ?? [], milestones: r.milestones ?? [] };
}

/**
 * Every published skill in a published skill group (category 16), with the rank, the primary and
 * secondary attribute ids and the six prerequisite pairs pivoted out of `sde_type_attributes` in
 * one query. Group 505 "Fake Skills" is unpublished, so `g.published` excludes it without a
 * hard-coded id. Values are SDE floats — rounded here, as `getSkillRequirements` already does.
 */
export async function listPlanSkills(): Promise<SdePlanSkill[]> {
  const pairs = SKILL_ATTRIBUTE_PAIRS.flatMap(([skillAttr, levelAttr], i) =>
    [`max(a.value) FILTER (WHERE a.attribute_id = ${skillAttr}) AS "req${i}"`,
     `max(a.value) FILTER (WHERE a.attribute_id = ${levelAttr}) AS "req${i}Level"`]).join(",\n            ");
  type Row = {
    id: number; name: string | null; groupId: number | null; groupName: string | null;
    rank: number | null; primaryAttr: number | null; secondaryAttr: number | null;
  } & Record<string, number | null | string>;
  const { rows } = await getPool().query<Row>(
    `SELECT t.id, t.name, t.group_id AS "groupId", g.name AS "groupName",
            max(a.value) FILTER (WHERE a.attribute_id = 275) AS "rank",
            max(a.value) FILTER (WHERE a.attribute_id = 180) AS "primaryAttr",
            max(a.value) FILTER (WHERE a.attribute_id = 181) AS "secondaryAttr",
            ${pairs}
     FROM sde_types t
     JOIN sde_groups g ON g.id = t.group_id
     LEFT JOIN sde_type_attributes a ON a.type_id = t.id
     WHERE t.published AND g.published AND g.category_id = 16
     GROUP BY t.id, t.name, t.group_id, g.name
     ORDER BY t.name, t.id`);
  return rows.map((r) => {
    const prereqs: { skillId: number; level: number }[] = [];
    for (let i = 0; i < SKILL_ATTRIBUTE_PAIRS.length; i++) {
      const skill = r[`req${i}`];
      const level = r[`req${i}Level`];
      if (typeof skill !== "number" || typeof level !== "number") continue;
      const skillId = Math.round(skill);
      if (skillId <= 0) continue;
      prereqs.push({ skillId, level: Math.round(level) });
    }
    return {
      id: r.id, name: r.name, groupId: r.groupId, groupName: r.groupName,
      // A skill with no rank cannot be trained; rank 1 keeps the arithmetic finite and the row visible.
      rank: r.rank === null ? 1 : Math.round(r.rank),
      primaryAttr: r.primaryAttr === null ? 0 : Math.round(r.primaryAttr),
      secondaryAttr: r.secondaryAttr === null ? 0 : Math.round(r.secondaryAttr),
      prereqs,
    };
  });
}
```

`SKILL_ATTRIBUTE_PAIRS` already exists at the top of the file as
`readonly [number, number][] = [[182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288]]`
— reuse it, do not redeclare it.

- [ ] **Step 17: Run the repo test to verify it passes**

Run: `npx vitest run tests/db/sde-skills.test.ts`
Expected: PASS.

- [ ] **Step 18: Run the whole suite and the type check**

```bash
npm test && npm run typecheck
```
Expected: everything green, pristine output.

- [ ] **Step 19: Commit**

```bash
git add src/lib/sde/ddl.ts src/lib/sde/tables.ts src/lib/sde/repo.ts scripts/sde-fixture.ts \
  tests/fixtures/sde-mini.zip tests/sde/fixture.test.ts tests/sde/tables.test.ts \
  tests/db/sde-import.test.ts tests/db/schema.test.ts tests/db/sde-skills.test.ts
git commit -m "$(cat <<'EOM'
Import cloneGrades and skillPlans into sde_alpha_skills / sde_skill_plans

The Alpha skill set (175 skills from clone grade 1; all four racial grades are
identical) badges "Alpha-trainable", and CCP's 40 certified career plans become
the planner's templates. SdePgType gains "jsonb"; the skillPlans mapper reads
the archive's `skillRequirements` field into the spec's `skills` column.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: Skill points and training time (`src/lib/skills/sp.ts`)

Spec §2's first two bullets. Pure arithmetic, and the foundation every later task's numbers rest
on — so it is proved against a published external number, not just against itself.

**Files:**
- Create: `src/lib/skills/sp.ts`, `scripts/skills-fixture.ts`, `tests/skills/sp.test.ts`,
  `tests/fixtures/skills/alpha-set.json`
- Modify: `package.json` (one script line)

**Interfaces:**
- Consumes: nothing. This module has no imports at all.
- Produces:
```ts
// src/lib/skills/sp.ts — pure, isomorphic
export const MAX_SKILL_LEVEL = 5;
/** Cumulative SP a character must hold to have `level` in a skill of this rank. Level 0 → 0. */
export function spForLevel(rank: number, level: number): number;
export function spBetween(rank: number, from: number, to: number): number;
/** Milliseconds to train `sp` at `spPerMinute`. Not quantised — EVEMon does not round either. */
export function trainingMs(sp: number, spPerMinute: number): number;
export interface TrainingEntry {
  startDate: Date | null; finishDate: Date | null;
  trainingStartSp: number | null; levelEndSp: number | null;
}
/** SP the character holds right now in the skill the head queue entry is training. */
export function currentSpInTraining(entry: TrainingEntry, now: Date): number | null;
```

**Decisions recorded here (do not re-litigate them):**
- `spForLevel` is **cumulative**: `spForLevel(1, 5) === 256_000` is the total a rank-1 skill needs
  at level V, which is what EVE displays. `spBetween(rank, 4, 5)` is the 210,745 SP increment.
- Rounding is **`ceil`**, not `round` and not `floor`. Rank 1 level II is **1415** SP, not 1414.
  The proof is external: `[UNI]` publishes the maximum trained SP an Alpha clone can hold as
  **19,669,072**, and summing `spForLevel(rank, cap)` over the 175 skills in `cloneGrades.jsonl`
  gives exactly that with `ceil` (19,669,032 with `round`, 19,668,988 with `floor`). This plan
  re-ran that sum against `.superpowers/research/sde-3484357.zip` and got 19,669,072.
- `trainingMs` returns a **float**; the view rounds to whole minutes. Rounding per entry and then
  summing would drift from the total.
- `currentSpInTraining` derives the rate **from the dates**, per EVEMon (`QueuedSkill.CurrentSP`):
  that absorbs implants, boosters and clone state without modelling any of them. It returns `null`
  when the queue is paused (ESI omits both dates) or the two dates are equal, and clamps the answer
  into `[trainingStartSp, levelEndSp]`.

- [ ] **Step 1: Write the failing test**

Create `tests/skills/sp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_SKILL_LEVEL, currentSpInTraining, spBetween, spForLevel, trainingMs } from "../../src/lib/skills/sp.js";

const ALPHA_SET = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "skills", "alpha-set.json");

describe("spForLevel", () => {
  it("matches the published rank-1 table", () => {
    expect([1, 2, 3, 4, 5].map((l) => spForLevel(1, l))).toEqual([250, 1415, 8000, 45255, 256000]);
    expect(MAX_SKILL_LEVEL).toBe(5);
  });

  it("is zero at and below level 0", () => {
    expect(spForLevel(1, 0)).toBe(0);
    expect(spForLevel(8, -1)).toBe(0);
  });

  it("scales linearly with rank and rounds up, not to nearest", () => {
    // 250 * 2 * 2^2.5 = 2828.427… → 2829, and 250 * 16 * 2^2.5 = 22627.417… → 22628.
    expect(spForLevel(2, 2)).toBe(2829);
    expect(spForLevel(16, 2)).toBe(22628);
    expect(spForLevel(2, 5)).toBe(512000);
    expect(spForLevel(6, 4)).toBe(271530);
  });

  it("sums the Alpha skill set to CCP's published 19,669,072 SP", async () => {
    const rows = JSON.parse(await readFile(ALPHA_SET, "utf8")) as [number, number, number][];
    expect(rows).toHaveLength(175);
    const total = rows.reduce((sum, [, rank, cap]) => sum + spForLevel(rank, cap), 0);
    expect(total).toBe(19_669_072);
  });
});

describe("spBetween", () => {
  it("is the increment between two levels", () => {
    expect(spBetween(1, 0, 1)).toBe(250);
    expect(spBetween(1, 1, 2)).toBe(1165);
    expect(spBetween(1, 4, 5)).toBe(210745);
    expect(spBetween(1, 0, 5)).toBe(256000);
  });
  it("is zero when `to` is not above `from`", () => {
    expect(spBetween(1, 3, 3)).toBe(0);
    expect(spBetween(1, 5, 2)).toBe(0);
  });
});

describe("trainingMs", () => {
  it("converts SP to milliseconds at the given rate", () => {
    // 256,000 SP at 32 SP/min = 8,000 min = 480,000,000 ms.
    expect(trainingMs(256_000, 32)).toBe(480_000_000);
    // 250 SP at 32 SP/min = 7.8125 min = 468,750 ms.
    expect(trainingMs(250, 32)).toBe(468_750);
  });
  it("is zero for no SP and for a non-positive rate", () => {
    expect(trainingMs(0, 32)).toBe(0);
    expect(trainingMs(-5, 32)).toBe(0);
    expect(trainingMs(1000, 0)).toBe(0);
  });
});

describe("currentSpInTraining", () => {
  const entry = {
    startDate: new Date("2026-09-01T00:00:00Z"),
    finishDate: new Date("2026-09-08T00:00:00Z"),
    trainingStartSp: 45_255,
    levelEndSp: 256_000,
  };

  it("interpolates from the dates", () => {
    // 210,745 SP over 168 h; at the half-way mark 105,372.5 SP are in, so 45,255 + 105,372.5
    // = 150,627.5, truncated to whole SP.
    expect(currentSpInTraining(entry, new Date("2026-09-04T12:00:00Z"))).toBe(150_627);
  });

  it("clamps to the level's own bounds", () => {
    expect(currentSpInTraining(entry, new Date("2026-08-30T00:00:00Z"))).toBe(45_255);
    expect(currentSpInTraining(entry, new Date("2026-09-30T00:00:00Z"))).toBe(256_000);
  });

  it("returns null for a paused queue and for a zero-length window", () => {
    expect(currentSpInTraining({ ...entry, startDate: null, finishDate: null }, new Date())).toBeNull();
    expect(currentSpInTraining({ ...entry, finishDate: entry.startDate }, new Date())).toBeNull();
    expect(currentSpInTraining({ ...entry, levelEndSp: null }, new Date())).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/sp.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/sp.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skills/sp.ts`:

```ts
/**
 * Skill points and training time. Pure, isomorphic, no imports.
 *
 * SP(rank, level) = ceil(250 * rank * 2^(2.5 * (level - 1))) is the CUMULATIVE SP a character
 * must hold to have that level. `ceil` — not `round`, not `floor` — is the game's behaviour:
 * summing SP(rank, cap) over the 175 skills in the SDE's Alpha clone grade gives CCP's published
 * maximum of 19,669,072 SP exactly, while `round` gives 19,669,032 and `floor` 19,668,988.
 * A rank-1 skill therefore needs 1415 SP for level II, not the 1414 that a truncating
 * approximation (including EVEMon's own fast path) produces.
 */

export const MAX_SKILL_LEVEL = 5;

export function spForLevel(rank: number, level: number): number {
  if (level <= 0) return 0;
  return Math.ceil(250 * rank * Math.pow(2, 2.5 * (level - 1)));
}

export function spBetween(rank: number, from: number, to: number): number {
  const gap = spForLevel(rank, to) - spForLevel(rank, from);
  return gap > 0 ? gap : 0;
}

export function trainingMs(sp: number, spPerMinute: number): number {
  if (sp <= 0 || spPerMinute <= 0) return 0;
  return (sp / spPerMinute) * 60_000;
}

export interface TrainingEntry {
  startDate: Date | null; finishDate: Date | null;
  trainingStartSp: number | null; levelEndSp: number | null;
}

/**
 * SP held right now in the skill the head queue entry is training, interpolated from the entry's
 * own dates (EVEMon `QueuedSkill.CurrentSP`). Deriving the rate from the dates rather than from
 * attributes absorbs implants, boosters and clone state for free.
 * `null` when ESI gave us nothing to interpolate: a paused queue omits both dates.
 */
export function currentSpInTraining(entry: TrainingEntry, now: Date): number | null {
  const { startDate, finishDate, trainingStartSp, levelEndSp } = entry;
  if (startDate === null || finishDate === null || levelEndSp === null) return null;
  const window = finishDate.getTime() - startDate.getTime();
  if (window <= 0) return null;
  const from = trainingStartSp ?? 0;
  const done = (now.getTime() - startDate.getTime()) / window;
  const sp = from + (levelEndSp - from) * done;
  return Math.floor(Math.min(levelEndSp, Math.max(from, sp)));
}
```

- [ ] **Step 4: Write the Alpha-set fixture generator**

Create `scripts/skills-fixture.ts`:

```ts
/**
 * Regenerates tests/fixtures/skills/alpha-set.json from a full SDE archive.
 *
 *   npm run skills:fixture -- .superpowers/research/sde-3484357.zip
 *
 * The fixture is 175 `[typeId, rank, alphaCap]` triples — clone grade 1's skill list joined to
 * each skill's `skillTimeConstant` (attribute 275). `tests/skills/sp.test.ts` sums
 * `spForLevel(rank, cap)` over it and asserts CCP's published Alpha maximum of 19,669,072 SP, so
 * regenerating it against a different build is a deliberate test change.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { readJsonlMember } from "../src/lib/sde/jsonl.js";

const SKILL_TIME_CONSTANT = 275;

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error("usage: npm run skills:fixture -- <eve-online-static-data-<build>-jsonl.zip>");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dest = path.join(here, "..", "tests", "fixtures", "skills", "alpha-set.json");

  const caps = new Map<number, number>();
  for await (const record of readJsonlMember(source, "cloneGrades.jsonl")) {
    if (record._key !== 1) continue;                       // all four racial grades are identical
    for (const s of (record.skills as { typeID: number; level: number }[]) ?? []) {
      caps.set(s.typeID, s.level);
    }
  }
  if (caps.size === 0) throw new Error("clone grade 1 is missing from cloneGrades.jsonl");

  const ranks = new Map<number, number>();
  for await (const record of readJsonlMember(source, "typeDogma.jsonl")) {
    const id = record._key as number;
    if (!caps.has(id)) continue;
    for (const a of (record.dogmaAttributes as { attributeID: number; value: number }[]) ?? []) {
      if (Math.round(a.attributeID) === SKILL_TIME_CONSTANT) ranks.set(id, Math.round(a.value));
    }
  }

  const rows = [...caps.entries()].sort((a, b) => a[0] - b[0]).map(([typeId, cap]) => {
    const rank = ranks.get(typeId);
    if (rank === undefined) throw new Error(`no skillTimeConstant for type ${typeId}`);
    return [typeId, rank, cap];
  });

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, `${JSON.stringify(rows)}\n`);
  console.log(`wrote ${dest} (${rows.length} skills)`);
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
```

Add the script to `package.json` beside `dogma:fixture`:

```json
    "dogma:fixture": "tsx scripts/dogma-fixture.ts",
    "skills:fixture": "tsx scripts/skills-fixture.ts",
```

- [ ] **Step 5: Generate the fixture**

```bash
cd /home/daniel/AI/Plasma/EVE
npm run skills:fixture -- .superpowers/research/sde-3484357.zip
ls -l tests/fixtures/skills/alpha-set.json
head -c 80 tests/fixtures/skills/alpha-set.json; echo
```
Expected: `wrote …/alpha-set.json (175 skills)`, a file of about 2,007 bytes, beginning
`[[3300,1,5],[3301,1,5],[3302,1,5],[3303,1,5],[3304,3,5],…`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/skills/sp.test.ts`
Expected: PASS, including the 19,669,072 assertion. If that one number is off, the rounding mode
is wrong — do not "fix" the expectation.

- [ ] **Step 7: Commit**

```bash
git add src/lib/skills/sp.ts scripts/skills-fixture.ts package.json \
  tests/skills/sp.test.ts tests/fixtures/skills/alpha-set.json
git commit -m "$(cat <<'EOM'
Add skill-point and training-time maths

spForLevel is cumulative and rounds with ceil, proved by summing the SDE's
175-skill Alpha clone grade to CCP's published 19,669,072 SP. currentSpInTraining
interpolates the head queue entry from its own dates, as EVEMon does.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: Attributes, implants and legal remaps (`src/lib/skills/attributes.ts`)

Spec §2's third and fourth bullets: effective attributes, the SP/minute formula, and the shape of
the remap search space that Task 7 will walk.

**Files:**
- Create: `src/lib/skills/attributes.ts`, `tests/skills/attributes.test.ts`

**Interfaces:**
- Consumes (phase 3, verbatim from `src/lib/view/skills.ts` — pure, safe in a client component):
```ts
export type AttributeKey = "charisma" | "intelligence" | "memory" | "perception" | "willpower";
export const ATTRIBUTE_BONUS_ATTR: Record<AttributeKey, number>;   // 175, 176, 177, 178, 179
export const ATTRIBUTE_LABEL: Record<AttributeKey, string>;
```
- Produces:
```ts
// src/lib/skills/attributes.ts — pure, isomorphic
export type { AttributeKey };
export const ATTRIBUTE_KEYS: readonly AttributeKey[];      // charisma, intelligence, memory, perception, willpower
export const ATTRIBUTE_ATTR: Record<AttributeKey, number>; // 164, 165, 166, 167, 168
export const ATTRIBUTE_KEY_BY_ATTR: ReadonlyMap<number, AttributeKey>;
export const BASE_ATTRIBUTE = 17;
export const FREE_POINTS = 14;
export const MAX_REMAP_POINTS = 10;
export const TOTAL_ATTRIBUTE_POINTS = 99;
export type AttributeSet = Record<AttributeKey, number>;
export const ZERO_ATTRIBUTES: AttributeSet;                // all five zero
export function addAttributes(a: AttributeSet, b: AttributeSet): AttributeSet;
export function implantBonuses(implantAttributes: readonly ReadonlyMap<number, number>[]): AttributeSet;
export function effectiveAttributes(base: AttributeSet, implantAttributes: readonly ReadonlyMap<number, number>[]): AttributeSet;
export function spPerMinute(attrs: AttributeSet, primaryAttrId: number, secondaryAttrId: number): number;
export function isLegalBase(base: AttributeSet): boolean;
export function enumerateBases(): AttributeSet[];
```

**Decisions recorded here (do not re-litigate them):**
- `spPerMinute = primary + secondary / 2`, **Omega rate only** — spec §2's ruling. There is no
  ×0.5 Alpha factor anywhere in this phase.
- An unknown attribute id (a skill whose 180/181 the SDE never set) yields **0 SP/min**, which the
  timeline turns into a zero-time entry rather than an infinity.
- A legal base is each attribute in `[17, 27]` summing to exactly `99`. `enumerateBases` walks
  `perception → willpower → intelligence → memory` with charisma taking the remainder — that order
  is the tie-break Task 7 relies on. There are **2,885** legal distributions (fewer than the
  11⁴ = 14,641 tuples the search visits, because most remainders fall outside `0..10`).
- Implant bonuses come from attributes **175–179** on the implant types — reused from
  `src/lib/view/skills.ts` rather than redeclared, so the Skills page and the planner can never
  disagree about which id means which attribute.

- [ ] **Step 1: Write the failing test**

Create `tests/skills/attributes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_ATTR, ATTRIBUTE_KEYS, ATTRIBUTE_KEY_BY_ATTR, BASE_ATTRIBUTE, FREE_POINTS,
  MAX_REMAP_POINTS, TOTAL_ATTRIBUTE_POINTS, addAttributes, effectiveAttributes, enumerateBases,
  implantBonuses, isLegalBase, spPerMinute, type AttributeSet,
} from "../../src/lib/skills/attributes.js";

const BASE: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };

describe("constants", () => {
  it("names the five attribute ids in EVE's order", () => {
    expect(ATTRIBUTE_KEYS).toEqual(["charisma", "intelligence", "memory", "perception", "willpower"]);
    expect(ATTRIBUTE_ATTR).toEqual({ charisma: 164, intelligence: 165, memory: 166, perception: 167, willpower: 168 });
    expect(ATTRIBUTE_KEY_BY_ATTR.get(167)).toBe("perception");
    expect(ATTRIBUTE_KEY_BY_ATTR.get(999)).toBeUndefined();
    expect([BASE_ATTRIBUTE, FREE_POINTS, MAX_REMAP_POINTS, TOTAL_ATTRIBUTE_POINTS]).toEqual([17, 14, 10, 99]);
    // 5 * 17 + 14 = 99 — the two ways the wiki states it are the same statement.
    expect(BASE_ATTRIBUTE * 5 + FREE_POINTS).toBe(TOTAL_ATTRIBUTE_POINTS);
  });
});

describe("implants", () => {
  it("sums attributes 175-179 across the plugged implants", () => {
    // Ocular Filter - Basic (+3 perception) and Neural Boost - Basic (+3 willpower).
    const implants = [new Map([[178, 3], [331, 1]]), new Map([[179, 3], [331, 3]])];
    expect(implantBonuses(implants)).toEqual(
      { charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 });
    expect(effectiveAttributes(BASE, implants)).toEqual(
      { charisma: 18, intelligence: 20, memory: 18, perception: 24, willpower: 25 });
  });

  it("ignores a hardwiring with no attribute bonus", () => {
    expect(implantBonuses([new Map([[202, 5], [331, 6]])]))
      .toEqual({ charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 });
  });

  it("adds two sets attribute by attribute", () => {
    expect(addAttributes(BASE, { charisma: 1, intelligence: 0, memory: 0, perception: 5, willpower: 0 }))
      .toEqual({ charisma: 19, intelligence: 20, memory: 18, perception: 26, willpower: 22 });
  });
});

describe("spPerMinute", () => {
  it("is primary + secondary / 2", () => {
    // Gunnery is perception (167) primary, willpower (168) secondary: 21 + 22/2 = 32.
    expect(spPerMinute(BASE, 167, 168)).toBe(32);
    // Power Grid Management is intelligence (165) / memory (166): 20 + 18/2 = 29.
    expect(spPerMinute(BASE, 165, 166)).toBe(29);
  });
  it("is zero when either attribute id is unknown", () => {
    expect(spPerMinute(BASE, 0, 168)).toBe(0);
    expect(spPerMinute(BASE, 167, 999)).toBe(0);
  });
});

describe("legal bases", () => {
  it("accepts 17..27 summing to 99 and rejects everything else", () => {
    expect(isLegalBase(BASE)).toBe(true);
    expect(isLegalBase({ charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 })).toBe(true);
    expect(isLegalBase({ charisma: 16, intelligence: 18, memory: 17, perception: 27, willpower: 21 })).toBe(false);
    expect(isLegalBase({ charisma: 17, intelligence: 17, memory: 17, perception: 28, willpower: 20 })).toBe(false);
    expect(isLegalBase({ charisma: 17, intelligence: 17, memory: 17, perception: 17, willpower: 17 })).toBe(false);
  });

  it("enumerates every legal distribution once, in perception-first order", () => {
    const bases = enumerateBases();
    expect(bases).toHaveLength(2885);
    for (const base of bases) expect(isLegalBase(base)).toBe(true);
    expect(new Set(bases.map((b) => JSON.stringify(b))).size).toBe(2885);
    // The walk is perception outermost, ascending, and charisma takes the remainder, so the first
    // legal tuple is per=0 wil=0 int=0 mem=4 (charisma would be 14, over the +10 cap, until then).
    expect(bases[0]).toEqual({ charisma: 27, intelligence: 17, memory: 21, perception: 17, willpower: 17 });
    expect(bases[bases.length - 1]).toEqual({ charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/attributes.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/attributes.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skills/attributes.ts`:

```ts
/**
 * Character attributes, implant bonuses and the remap search space. Pure and isomorphic.
 *
 * The bonus ids (175-179) are imported from the phase-3 Skills page rather than redeclared, so the
 * two places that read implants can never disagree about which id means which attribute.
 */
import { ATTRIBUTE_BONUS_ATTR, type AttributeKey } from "../view/skills.js";

export type { AttributeKey };

export const ATTRIBUTE_KEYS: readonly AttributeKey[] =
  ["charisma", "intelligence", "memory", "perception", "willpower"];

/** charisma … willpower, in the order EVE numbers them. */
export const ATTRIBUTE_ATTR: Record<AttributeKey, number> = {
  charisma: 164, intelligence: 165, memory: 166, perception: 167, willpower: 168,
};

export const ATTRIBUTE_KEY_BY_ATTR: ReadonlyMap<number, AttributeKey> =
  new Map(ATTRIBUTE_KEYS.map((key) => [ATTRIBUTE_ATTR[key], key]));

/** Remap rules: floor 17 in each attribute, 14 free points, at most +10 into any one. 5*17+14 = 99. */
export const BASE_ATTRIBUTE = 17;
export const FREE_POINTS = 14;
export const MAX_REMAP_POINTS = 10;
export const TOTAL_ATTRIBUTE_POINTS = 99;

export type AttributeSet = Record<AttributeKey, number>;

export const ZERO_ATTRIBUTES: AttributeSet =
  { charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 };

export function addAttributes(a: AttributeSet, b: AttributeSet): AttributeSet {
  return {
    charisma: a.charisma + b.charisma, intelligence: a.intelligence + b.intelligence,
    memory: a.memory + b.memory, perception: a.perception + b.perception, willpower: a.willpower + b.willpower,
  };
}

/** One `getTypeAttributes(typeId)` map per implant on the active clone. Boosters are out of scope. */
export function implantBonuses(implantAttributes: readonly ReadonlyMap<number, number>[]): AttributeSet {
  const out: AttributeSet = { ...ZERO_ATTRIBUTES };
  for (const attributes of implantAttributes) {
    for (const key of ATTRIBUTE_KEYS) out[key] += attributes.get(ATTRIBUTE_BONUS_ATTR[key]) ?? 0;
  }
  return out;
}

export function effectiveAttributes(
  base: AttributeSet, implantAttributes: readonly ReadonlyMap<number, number>[],
): AttributeSet {
  return addAttributes(base, implantBonuses(implantAttributes));
}

/**
 * Omega rate (spec §2 ruling — every character on this install is Omega). `primaryAttrId` and
 * `secondaryAttrId` are the VALUES of dogma attributes 180/181, which are themselves ids in
 * 164-168. An id we do not recognise yields 0, which the timeline renders as an untrainable entry.
 */
export function spPerMinute(attrs: AttributeSet, primaryAttrId: number, secondaryAttrId: number): number {
  const primary = ATTRIBUTE_KEY_BY_ATTR.get(primaryAttrId);
  const secondary = ATTRIBUTE_KEY_BY_ATTR.get(secondaryAttrId);
  if (primary === undefined || secondary === undefined) return 0;
  return attrs[primary] + attrs[secondary] / 2;
}

export function isLegalBase(base: AttributeSet): boolean {
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const value = base[key];
    if (!Number.isInteger(value) || value < BASE_ATTRIBUTE || value > BASE_ATTRIBUTE + MAX_REMAP_POINTS) return false;
    total += value;
  }
  return total === TOTAL_ATTRIBUTE_POINTS;
}

/**
 * Every legal base distribution, walking perception → willpower → intelligence → memory with
 * charisma taking the remainder. The order is part of the contract: `optimalRemap` keeps the first
 * candidate of any tied group, so the search must be deterministic. 2,885 of the 11^4 = 14,641
 * visited tuples leave charisma inside 0..10.
 */
export function enumerateBases(): AttributeSet[] {
  const out: AttributeSet[] = [];
  for (let per = 0; per <= MAX_REMAP_POINTS; per++) {
    for (let wil = 0; wil <= MAX_REMAP_POINTS; wil++) {
      for (let int = 0; int <= MAX_REMAP_POINTS; int++) {
        for (let mem = 0; mem <= MAX_REMAP_POINTS; mem++) {
          const cha = FREE_POINTS - per - wil - int - mem;
          if (cha < 0 || cha > MAX_REMAP_POINTS) continue;
          out.push({
            charisma: BASE_ATTRIBUTE + cha, intelligence: BASE_ATTRIBUTE + int,
            memory: BASE_ATTRIBUTE + mem, perception: BASE_ATTRIBUTE + per, willpower: BASE_ATTRIBUTE + wil,
          });
        }
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/skills/attributes.test.ts`
Expected: PASS, including the 2,885 count and both boundary entries.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/attributes.ts tests/skills/attributes.test.ts
git commit -m "$(cat <<'EOM'
Add attribute, implant and remap-space maths

Effective attributes are base plus the 175-179 bonuses on the plugged implants;
SP/min is primary + secondary/2 at the Omega rate. enumerateBases walks the 2,885
legal 17..27 distributions in a fixed order so the remap search is deterministic.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: The skill catalogue (`src/lib/skills/catalogue.ts` + `loadSkillCatalogue`)

Everything downstream — expansion, timeline, remap, text, the editor's props — is expressed in
terms of one `PlanSkill` record per skill. This task defines it, builds it from the repo rows and
gives the server a single call that produces it.

**Files:**
- Create: `src/lib/skills/catalogue.ts`, `src/lib/skills/load.ts`,
  `tests/skills/catalogue.test.ts`, `tests/db/skills-load.test.ts`

**Interfaces:**
- Consumes (Tasks 1 and 3):
```ts
// src/lib/sde/repo.ts
export interface SdePlanSkill {
  id: number; name: string | null; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number;
  prereqs: { skillId: number; level: number }[];
}
export async function listPlanSkills(): Promise<SdePlanSkill[]>;
export async function getAlphaSkills(): Promise<Map<number, number>>;
// src/lib/skills/attributes.ts
export type AttributeSet = Record<AttributeKey, number>;
export function spPerMinute(attrs: AttributeSet, primaryAttrId: number, secondaryAttrId: number): number;
```
- Produces:
```ts
// src/lib/skills/catalogue.ts — pure, isomorphic, safe as React props
export interface SkillPrereq { skillId: number; level: number }
export interface PlanSkill {
  id: number; name: string; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number;
  prereqs: SkillPrereq[]; alphaMaxLevel: number | null;
}
export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;
export interface CatalogueRow {
  id: number; name: string | null; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number; prereqs: SkillPrereq[];
}
export function buildCatalogue(rows: readonly CatalogueRow[], alpha: ReadonlyMap<number, number>): PlanSkill[];
export function catalogueFrom(skills: readonly PlanSkill[]): SkillCatalogue;
export function skillRate(skill: PlanSkill, attrs: AttributeSet): number;   // SP per minute
export function skillLabel(catalogue: SkillCatalogue, skillId: number): string;
// src/lib/skills/load.ts — SERVER ONLY (imports src/lib/sde and src/lib/db)
export async function loadSkillCatalogue(): Promise<PlanSkill[]>;
```

**Decisions recorded here (do not re-litigate them):**
- `buildCatalogue` returns an **array**, `catalogueFrom` turns it into the `Map`. The array is what
  crosses the server/client boundary as props (a `Map` does not serialise); the `Map` is what the
  pure functions take. Decision 10: there is no catalogue API route — `/skills/plans/[id]/page.tsx`
  reads it on the server and passes it down (~600 skills, about 90 KB of props).
- A skill whose `name` is NULL in the SDE becomes `Skill <id>`, matching `groupSkills` in
  `src/lib/view/skills.ts`. A skill the catalogue does not hold at all is `Unknown skill (id)` —
  spec §7's wording, produced by `skillLabel`.
- `alphaMaxLevel` is `null` for a skill outside the Alpha set; the badge is rendered only when it
  is a number.
- `prereqs` keeps the SDE's own ordering (requiredSkill1 … requiredSkill6). Expansion order depends
  on it, and it is the order EVEMon walks.

- [ ] **Step 1: Write the failing pure test**

Create `tests/skills/catalogue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildCatalogue, catalogueFrom, skillLabel, skillRate, type CatalogueRow,
} from "../../src/lib/skills/catalogue.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3318, name: "Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 2, primaryAttr: 167, secondaryAttr: 166, prereqs: [{ skillId: 3300, level: 2 }] },
  { id: 4444, name: null, groupId: null, groupName: null, rank: 3, primaryAttr: 165, secondaryAttr: 166, prereqs: [] },
];
const ALPHA = new Map([[3300, 5], [3318, 4]]);
const ATTRS: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };

describe("buildCatalogue", () => {
  it("carries the Alpha cap and names a skill the SDE left unnamed", () => {
    const skills = buildCatalogue(ROWS, ALPHA);
    expect(skills.map((s) => s.id)).toEqual([3300, 3318, 4444]);
    expect(skills[0]).toEqual({
      id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery",
      rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5,
    });
    expect(skills[1].alphaMaxLevel).toBe(4);
    expect(skills[2]).toMatchObject({ name: "Skill 4444", alphaMaxLevel: null });
  });
});

describe("catalogueFrom / skillLabel", () => {
  it("indexes by id and names an id it does not hold", () => {
    const catalogue = catalogueFrom(buildCatalogue(ROWS, ALPHA));
    expect(catalogue.get(3318)?.name).toBe("Weapon Upgrades");
    expect(skillLabel(catalogue, 3318)).toBe("Weapon Upgrades");
    expect(skillLabel(catalogue, 999999)).toBe("Unknown skill (999999)");
  });
});

describe("skillRate", () => {
  it("uses the skill's own primary/secondary pair", () => {
    const catalogue = catalogueFrom(buildCatalogue(ROWS, ALPHA));
    // Gunnery: perception 21 + willpower 22/2 = 32 SP/min.
    expect(skillRate(catalogue.get(3300)!, ATTRS)).toBe(32);
    // Weapon Upgrades: perception 21 + memory 18/2 = 30 SP/min.
    expect(skillRate(catalogue.get(3318)!, ATTRS)).toBe(30);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/catalogue.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/catalogue.js`.

- [ ] **Step 3: Write the pure implementation**

Create `src/lib/skills/catalogue.ts`:

```ts
/**
 * One record per trainable skill. Pure and isomorphic: `PlanSkill[]` is what the editor receives
 * as props (a Map does not serialise across the server/client boundary), `SkillCatalogue` is what
 * every pure function here takes.
 */
import { spPerMinute, type AttributeSet } from "./attributes.js";

export interface SkillPrereq { skillId: number; level: number }

export interface PlanSkill {
  id: number; name: string; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number;
  prereqs: SkillPrereq[]; alphaMaxLevel: number | null;
}

export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;

/** Exactly the shape `listPlanSkills()` returns, restated so this module imports no server code. */
export interface CatalogueRow {
  id: number; name: string | null; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number; prereqs: SkillPrereq[];
}

export function buildCatalogue(rows: readonly CatalogueRow[], alpha: ReadonlyMap<number, number>): PlanSkill[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? `Skill ${r.id}`,
    groupId: r.groupId,
    groupName: r.groupName,
    rank: r.rank,
    primaryAttr: r.primaryAttr,
    secondaryAttr: r.secondaryAttr,
    prereqs: r.prereqs,
    alphaMaxLevel: alpha.get(r.id) ?? null,
  }));
}

export function catalogueFrom(skills: readonly PlanSkill[]): SkillCatalogue {
  return new Map(skills.map((s) => [s.id, s]));
}

export function skillRate(skill: PlanSkill, attrs: AttributeSet): number {
  return spPerMinute(attrs, skill.primaryAttr, skill.secondaryAttr);
}

/** Spec §7: an id the SDE no longer has still renders, as `Unknown skill (id)`. */
export function skillLabel(catalogue: SkillCatalogue, skillId: number): string {
  return catalogue.get(skillId)?.name ?? `Unknown skill (${skillId})`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/skills/catalogue.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing loader test**

Create `tests/db/skills-load.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { loadSkillCatalogue } from "../../src/lib/skills/load.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await resetSde(pool);
  await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (255, 16, 'Gunnery', true)");
  await pool.query(
    `INSERT INTO sde_types (id, group_id, name, published) VALUES
      (3300, 255, 'Gunnery', true), (11207, 255, 'Advanced Weapon Upgrades', true)`);
  await pool.query(
    `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
      (3300, 275, 1), (3300, 180, 167), (3300, 181, 168),
      (11207, 275, 6), (11207, 180, 167), (11207, 181, 168), (11207, 182, 3318), (11207, 277, 4)`);
  await pool.query("INSERT INTO sde_alpha_skills (skill_id, max_level) VALUES (3300, 5)");
});

describe("loadSkillCatalogue", () => {
  it("joins the skill rows to the Alpha caps", async () => {
    const skills = await loadSkillCatalogue();
    expect(skills.map((s) => s.id)).toEqual([11207, 3300]);            // name-ascending
    expect(skills.find((s) => s.id === 3300)).toMatchObject({
      name: "Gunnery", groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168,
      prereqs: [], alphaMaxLevel: 5,
    });
    expect(skills.find((s) => s.id === 11207)).toMatchObject({
      rank: 6, prereqs: [{ skillId: 3318, level: 4 }], alphaMaxLevel: null,
    });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/db/skills-load.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/load.js`.

- [ ] **Step 7: Write the loader**

Create `src/lib/skills/load.ts`:

```ts
/**
 * The planner's server-side glue. THIS IS THE ONLY MODULE UNDER src/lib/skills THAT TOUCHES
 * POSTGRES — everything else in this directory is pure and isomorphic. A "use client" component
 * must never import it; server components and API routes are its only callers.
 */
import { getAlphaSkills, listPlanSkills } from "../sde/repo.js";
import { buildCatalogue, type PlanSkill } from "./catalogue.js";

/** Every trainable skill with its rank, attribute pair, prerequisites and Alpha cap. */
export async function loadSkillCatalogue(): Promise<PlanSkill[]> {
  const [rows, alpha] = await Promise.all([listPlanSkills(), getAlphaSkills()]);
  return buildCatalogue(rows, alpha);
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run tests/db/skills-load.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/skills/catalogue.ts src/lib/skills/load.ts \
  tests/skills/catalogue.test.ts tests/db/skills-load.test.ts
git commit -m "$(cat <<'EOM'
Add the skill catalogue and its server loader

PlanSkill carries the rank, attribute pair, prerequisites and Alpha cap; the
array form crosses to the client as props and catalogueFrom indexes it for the
pure functions. load.ts is the only module under src/lib/skills touching Postgres.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: Prerequisite expansion (`src/lib/skills/expand.ts`)

Spec §2's fifth bullet. A port of EVEMon's `FillDependencies` (research §4): a flat, ordered,
de-duplicated list of (skill, level) pairs in trainable order.

**Files:**
- Create: `src/lib/skills/expand.ts`, `tests/skills/expand.test.ts`

**Interfaces:**
- Consumes (Task 4):
```ts
export interface PlanSkill { id: number; name: string; groupId: number | null; groupName: string | null;
                             rank: number; primaryAttr: number; secondaryAttr: number;
                             prereqs: SkillPrereq[]; alphaMaxLevel: number | null }
export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;
export function catalogueFrom(skills: readonly PlanSkill[]): SkillCatalogue;
// src/lib/skills/sp.ts
export const MAX_SKILL_LEVEL = 5;
```
- Produces:
```ts
// src/lib/skills/expand.ts — pure, isomorphic
export interface PlanEntry { skillId: number; level: number; note?: string | null }
export interface ExpandedEntry { skillId: number; level: number; note: string | null; prereq: boolean }
/** skillId → the highest level the character already has (trained, or the queue will deliver). */
export type KnownLevels = ReadonlyMap<number, number>;
export function expandPlan(
  entries: readonly PlanEntry[], known: KnownLevels, catalogue: SkillCatalogue,
): ExpandedEntry[];
```

**Decisions recorded here (do not re-litigate them):**
- Decision 2: **one entry per level.** `[{ skillId: 3300, level: 3 }]` against an untrained
  character expands to Gunnery I, II, III.
- Decision 3: `prereq` is `true` unless the (skillId, level) pair was explicitly requested.
- The dedupe key is the **pair**, not the skill, and a skill's prerequisites are walked **once**
  (guarded by "have we already emitted or skipped level I of it") — that is what keeps the walk
  near-linear on a long plan.
- A skill listing itself as a prerequisite is ignored (the SDE has such rows), and a prerequisite
  cycle is broken by an in-progress set: a skill already on the recursion stack is not re-entered.
- `known` suppresses **prerequisite** levels but never a **requested** one. A requested pair the
  character already has is still emitted, with `prereq: false`, so the timeline can mark it `done`
  — spec §2 asks for exactly that ("levels already trained are marked `done`"). Prerequisite levels
  the character already has, and levels below a requested level that the character already has, are
  dropped: "Gunnery I ✓ done" under every gunnery plan is noise, not information.
- A skill id the catalogue does not hold has no prerequisites to expand; the entry is emitted as
  asked so the row can render as `Unknown skill (id)`.
- Levels outside 1..`MAX_SKILL_LEVEL` are clamped away: an entry with level 0 or 6 is dropped.

- [ ] **Step 1: Write the failing test**

Create `tests/skills/expand.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";

// Gunnery (rank 1, no prereqs) ← Weapon Upgrades (rank 2, needs Gunnery II)
//   ← Advanced Weapon Upgrades (rank 6, needs Weapon Upgrades IV)
// Spaceship Command (rank 1, no prereqs) ← Minmatar Frigate (rank 2, needs Spaceship Command I)
// Ouroboros lists itself as a prerequisite, which the SDE really does contain.
const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3318, name: "Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 2, primaryAttr: 167, secondaryAttr: 166, prereqs: [{ skillId: 3300, level: 2 }] },
  { id: 11207, name: "Advanced Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 6, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 3318, level: 4 }] },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3329, name: "Minmatar Frigate", groupId: 257, groupName: "Spaceship Command", rank: 2, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 3327, level: 1 }] },
  { id: 8888, name: "Ouroboros", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 8888, level: 3 }] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));
const pairs = (entries: { skillId: number; level: number }[]) => entries.map((e) => [e.skillId, e.level]);

describe("expandPlan", () => {
  it("emits every level of a requested skill, tagging the ones below it as prereqs", () => {
    const out = expandPlan([{ skillId: 3300, level: 3 }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([[3300, 1], [3300, 2], [3300, 3]]);
    expect(out.map((e) => e.prereq)).toEqual([true, true, false]);
  });

  it("expands nested prerequisites in trainable order", () => {
    const out = expandPlan([{ skillId: 11207, level: 1 }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([
      [3300, 1], [3300, 2],                                  // Gunnery II, for Weapon Upgrades
      [3318, 1], [3318, 2], [3318, 3], [3318, 4],            // Weapon Upgrades IV, for AWU
      [11207, 1],
    ]);
    expect(out.filter((e) => !e.prereq).map((e) => e.skillId)).toEqual([11207]);
  });

  it("skips prerequisite levels the character already has", () => {
    const known = new Map([[3300, 2], [3318, 2]]);
    expect(pairs(expandPlan([{ skillId: 11207, level: 1 }], known, CATALOGUE)))
      .toEqual([[3318, 3], [3318, 4], [11207, 1]]);
  });

  it("keeps a requested level the character already has, so the table can mark it done", () => {
    const out = expandPlan([{ skillId: 3300, level: 2 }], new Map([[3300, 5]]), CATALOGUE);
    expect(pairs(out)).toEqual([[3300, 2]]);
    expect(out[0].prereq).toBe(false);
  });

  it("never emits the same pair twice, however many entries need it", () => {
    const out = expandPlan(
      [{ skillId: 3318, level: 4 }, { skillId: 11207, level: 1 }, { skillId: 3300, level: 5 }],
      new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([
      [3300, 1], [3300, 2], [3318, 1], [3318, 2], [3318, 3], [3318, 4],
      [11207, 1],
      [3300, 3], [3300, 4], [3300, 5],
    ]);
    expect(new Set(out.map((e) => `${e.skillId}:${e.level}`)).size).toBe(out.length);
  });

  it("carries the note of the requested entry only", () => {
    const out = expandPlan([{ skillId: 3329, level: 1, note: "for the Rifter" }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([[3327, 1], [3329, 1]]);
    expect(out.map((e) => e.note)).toEqual([null, "for the Rifter"]);
  });

  it("ignores a self-referencing prerequisite and drops out-of-range levels", () => {
    expect(pairs(expandPlan([{ skillId: 8888, level: 1 }], new Map(), CATALOGUE))).toEqual([[8888, 1]]);
    expect(expandPlan([{ skillId: 3300, level: 0 }, { skillId: 3300, level: 6 }], new Map(), CATALOGUE)).toEqual([]);
  });

  it("emits an unknown skill as asked, with no expansion", () => {
    const out = expandPlan([{ skillId: 999999, level: 2 }], new Map(), CATALOGUE);
    expect(pairs(out)).toEqual([[999999, 1], [999999, 2]]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/expand.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/expand.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skills/expand.ts`:

```ts
/**
 * Prerequisite expansion, ported from EVEMon's `FillDependencies`
 * (src/EVEMon.Common/Extensions/StaticSkillLevelEnumerableExtensions.cs).
 *
 * The output is a flat, ordered, de-duplicated list of (skill, level) pairs in trainable order —
 * "Eidetic Memory II" becomes Instant Recall I..IV then Eidetic Memory I, II. The dedupe key is the
 * PAIR, and a skill's prerequisites are walked at most once, which keeps a long plan near-linear.
 */
import { MAX_SKILL_LEVEL } from "./sp.js";
import type { SkillCatalogue } from "./catalogue.js";

export interface PlanEntry { skillId: number; level: number; note?: string | null }
export interface ExpandedEntry { skillId: number; level: number; note: string | null; prereq: boolean }

/** skillId → the highest level the character already has (trained, or the queue will deliver). */
export type KnownLevels = ReadonlyMap<number, number>;

const key = (skillId: number, level: number): string => `${skillId}:${level}`;

export function expandPlan(
  entries: readonly PlanEntry[], known: KnownLevels, catalogue: SkillCatalogue,
): ExpandedEntry[] {
  const out: ExpandedEntry[] = [];
  const emitted = new Set<string>();
  const walked = new Set<number>();       // skills whose prerequisites have already been expanded
  const stack = new Set<number>();        // guards a prerequisite cycle

  /** Emits levels `from`..`to` of a skill, skipping known ones unless the pair was requested. */
  const emit = (skillId: number, to: number, requestedLevel: number | null, note: string | null): void => {
    const have = known.get(skillId) ?? 0;
    for (let level = 1; level <= to; level++) {
      const requested = level === requestedLevel;
      if (!requested && level <= have) continue;
      const k = key(skillId, level);
      if (emitted.has(k)) continue;
      emitted.add(k);
      out.push({ skillId, level, note: requested ? note : null, prereq: !requested });
    }
  };

  const walk = (skillId: number, level: number, requestedLevel: number | null, note: string | null): void => {
    if (!walked.has(skillId) && !stack.has(skillId)) {
      walked.add(skillId);
      stack.add(skillId);
      for (const prereq of catalogue.get(skillId)?.prereqs ?? []) {
        if (prereq.skillId === skillId) continue;                         // the SDE has such rows
        if (prereq.level < 1 || prereq.level > MAX_SKILL_LEVEL) continue;
        walk(prereq.skillId, prereq.level, null, null);
      }
      stack.delete(skillId);
    }
    emit(skillId, level, requestedLevel, note);
  };

  for (const entry of entries) {
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > MAX_SKILL_LEVEL) continue;
    walk(entry.skillId, entry.level, entry.level, entry.note ?? null);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/skills/expand.test.ts`
Expected: PASS. All eight cases matter; the "never emits the same pair twice" ordering in
particular pins that a later entry appends its new levels at the end rather than reordering.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/expand.ts tests/skills/expand.test.ts
git commit -m "$(cat <<'EOM'
Add recursive prerequisite expansion

One row per (skill, level) in trainable order, de-duplicated on the pair, with
prerequisite levels the character already has dropped and requested levels kept
so the table can mark them done. Ported from EVEMon's FillDependencies.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: The timeline (`src/lib/skills/timeline.ts`)

Spec §2's queue-overlay and timeline bullets. Turns an expanded entry list into rows carrying
status, SP, time, cumulative time and completion date — the numbers the page, the API and the
editor all render.

**Files:**
- Create: `src/lib/skills/timeline.ts`, `tests/skills/timeline.test.ts`

**Interfaces:**
- Consumes (Tasks 2–5):
```ts
// src/lib/skills/sp.ts
export function spForLevel(rank: number, level: number): number;
export function spBetween(rank: number, from: number, to: number): number;
export function trainingMs(sp: number, spPerMinute: number): number;
// src/lib/skills/attributes.ts
export type AttributeSet = Record<AttributeKey, number>;
// src/lib/skills/catalogue.ts
export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;
export function skillRate(skill: PlanSkill, attrs: AttributeSet): number;
// src/lib/skills/expand.ts
export interface ExpandedEntry { skillId: number; level: number; note: string | null; prereq: boolean }
export type KnownLevels = ReadonlyMap<number, number>;
```
- Produces:
```ts
// src/lib/skills/timeline.ts — pure, isomorphic
export type PlanStatus = "done" | "queued" | "planned";
export interface TimelineInput {
  entries: readonly ExpandedEntry[];
  catalogue: SkillCatalogue;
  /** Effective attributes: base (or a remap candidate) plus implant bonuses. */
  attributes: AttributeSet;
  trained: KnownLevels;
  queued: KnownLevels;
  /** skillId → SP the character already holds in it, for a part-trained level. Optional. */
  partialSp?: ReadonlyMap<number, number>;
  /** `now`, or the end of the ESI queue when "after current queue" is on. */
  startAt: Date;
}
export interface TimelineEntry {
  skillId: number; level: number; prereq: boolean; note: string | null;
  status: PlanStatus;
  rank: number | null;
  /** The full SP increment for this level — what the table's "SP" column shows. */
  levelSp: number;
  /** SP this entry still costs. Zero unless the status is `planned`. */
  sp: number;
  spPerMinute: number;
  ms: number; cumulativeMs: number; doneAt: Date;
}
export interface Timeline {
  entries: TimelineEntry[]; totalSp: number; totalMs: number; doneAt: Date; unknownSkillIds: number[];
}
export function planTimeline(input: TimelineInput): Timeline;
/** The remap search's hot loop: total remaining milliseconds, no allocation per entry. */
export function planDurationMs(input: Omit<TimelineInput, "startAt">): number;
```

**Decisions recorded here (do not re-litigate them):**
- Status is `done` when `trained >= level`, else `queued` when `queued >= level`, else `planned`.
  Only `planned` entries cost time, so a plan whose head is already in the ESI queue reports the
  remaining work honestly (spec §2: queued entries are "not counted in the plan's remaining time").
- Decision 8: **partial SP is honoured.** A planned level costs
  `spForLevel(rank, level) - max(spForLevel(rank, level - 1), min(held, spForLevel(rank, level)))`.
  Because `expandPlan` emits a skill's levels in ascending order, the `max` makes the rule
  self-limiting — only the first planned level of a skill can be discounted.
- An unknown skill contributes `rank: null`, 0 SP and 0 ms (spec §7) and its id lands in
  `unknownSkillIds`. A known skill whose attribute pair the SDE never set gets a rate of 0, and
  `trainingMs` turns that into 0 ms rather than `Infinity` — the row renders as untrainable instead
  of poisoning the total.
- `ms` stays a float; `doneAt` is `startAt + Math.round(cumulativeMs)` so the Date is a whole
  millisecond. Rounding only at the end keeps a 500-entry plan exact.

- [ ] **Step 1: Write the failing test**

Create `tests/skills/timeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";
import { planDurationMs, planTimeline } from "../../src/lib/skills/timeline.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3329, name: "Minmatar Frigate", groupId: 257, groupName: "Spaceship Command", rank: 2, primaryAttr: 167, secondaryAttr: 168, prereqs: [{ skillId: 3327, level: 1 }] },
  { id: 7777, name: "Attributeless", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 0, secondaryAttr: 0, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));

// perception 21, willpower 22 → every skill here trains at 21 + 22/2 = 32 SP/min.
const ATTRS: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };
const START = new Date("2026-09-01T00:00:00Z");
const ENTRIES = expandPlan([{ skillId: 3300, level: 3 }, { skillId: 3329, level: 1 }], new Map(), CATALOGUE);

describe("planTimeline", () => {
  it("prices every level and accumulates the clock", () => {
    const t = planTimeline({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map(), queued: new Map(), startAt: START,
    });
    expect(t.entries.map((e) => [e.skillId, e.level])).toEqual([[3300, 1], [3300, 2], [3300, 3], [3327, 1], [3329, 1]]);
    // Rank-1 cumulative SP is 250 / 1415 / 8000, so the increments are 250 / 1165 / 6585.
    // Minmatar Frigate is rank 2, so level I is 500 SP. Spaceship Command is rank 1: 250 SP.
    expect(t.entries.map((e) => e.sp)).toEqual([250, 1165, 6585, 250, 500]);
    expect(t.entries.map((e) => e.spPerMinute)).toEqual([32, 32, 32, 32, 32]);
    // sp / 32 SP-per-minute * 60,000 ms.
    expect(t.entries.map((e) => e.ms)).toEqual([468_750, 2_184_375, 12_346_875, 468_750, 937_500]);
    expect(t.entries.map((e) => e.cumulativeMs)).toEqual([468_750, 2_653_125, 15_000_000, 15_468_750, 16_406_250]);
    expect(t.totalSp).toBe(8750);
    expect(t.totalMs).toBe(16_406_250);
    // 16,406,250 ms = 273.4375 min = 4 h 33 m 26.25 s after midnight.
    expect(t.doneAt.toISOString()).toBe("2026-09-01T04:33:26.250Z");
    expect(t.entries[0].doneAt.toISOString()).toBe("2026-09-01T00:07:48.750Z");
    expect(t.entries.map((e) => e.status)).toEqual(["planned", "planned", "planned", "planned", "planned"]);
    expect(t.unknownSkillIds).toEqual([]);
  });

  it("marks trained and queued levels and charges them nothing", () => {
    const t = planTimeline({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map([[3300, 2]]), queued: new Map([[3300, 3]]), startAt: START,
    });
    expect(t.entries.map((e) => e.status)).toEqual(["done", "done", "queued", "planned", "planned"]);
    expect(t.entries.map((e) => e.sp)).toEqual([0, 0, 0, 250, 500]);
    // levelSp still reports what the level costs, for the table's SP column.
    expect(t.entries.map((e) => e.levelSp)).toEqual([250, 1165, 6585, 250, 500]);
    expect(t.entries.map((e) => e.cumulativeMs)).toEqual([0, 0, 0, 468_750, 1_406_250]);
    expect(t.totalMs).toBe(1_406_250);
    expect(t.totalSp).toBe(750);
    expect(t.doneAt.toISOString()).toBe("2026-09-01T00:23:26.250Z");
  });

  it("discounts SP already held inside a part-trained level, once", () => {
    const gunneryToIv = expandPlan([{ skillId: 3300, level: 4 }], new Map(), CATALOGUE);
    const t = planTimeline({
      entries: gunneryToIv, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map([[3300, 2]]), queued: new Map(),
      partialSp: new Map([[3300, 3000]]), startAt: START,
    });
    expect(t.entries.map((e) => e.status)).toEqual(["done", "done", "planned", "planned"]);
    // Gunnery III wants 8,000 SP in total and 3,000 are already in: 5,000 SP at 32 SP/min.
    expect(t.entries[2]).toMatchObject({ sp: 5000, ms: 9_375_000 });
    // Gunnery IV starts from level III's own 8,000 floor, not from the 3,000 again:
    // 45,255 - 8,000 = 37,255 SP → 1164.21875 min → 69,853,125 ms.
    expect(t.entries[3]).toMatchObject({ sp: 37_255, ms: 69_853_125 });
  });

  it("starts from the queue's end when asked to", () => {
    const after = new Date("2026-09-10T00:00:00Z");
    const t = planTimeline({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map(), queued: new Map(), startAt: after,
    });
    expect(t.entries[0].doneAt.toISOString()).toBe("2026-09-10T00:07:48.750Z");
    expect(t.doneAt.toISOString()).toBe("2026-09-10T04:33:26.250Z");
  });

  it("gives an unknown skill zero time and reports its id", () => {
    const t = planTimeline({
      entries: [{ skillId: 999999, level: 1, note: null, prereq: false }],
      catalogue: CATALOGUE, attributes: ATTRS, trained: new Map(), queued: new Map(), startAt: START,
    });
    expect(t.entries[0]).toMatchObject({ status: "planned", rank: null, levelSp: 0, sp: 0, ms: 0 });
    expect(t.totalMs).toBe(0);
    expect(t.unknownSkillIds).toEqual([999999]);
  });

  it("gives a skill with no attribute pair zero time rather than infinity", () => {
    const t = planTimeline({
      entries: [{ skillId: 7777, level: 1, note: null, prereq: false }],
      catalogue: CATALOGUE, attributes: ATTRS, trained: new Map(), queued: new Map(), startAt: START,
    });
    expect(t.entries[0]).toMatchObject({ sp: 250, spPerMinute: 0, ms: 0 });
    expect(Number.isFinite(t.totalMs)).toBe(true);
  });
});

describe("planDurationMs", () => {
  it("agrees with planTimeline's total", () => {
    expect(planDurationMs({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS, trained: new Map(), queued: new Map(),
    })).toBe(16_406_250);
    expect(planDurationMs({
      entries: ENTRIES, catalogue: CATALOGUE, attributes: ATTRS,
      trained: new Map([[3300, 2]]), queued: new Map([[3300, 3]]),
    })).toBe(1_406_250);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/timeline.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/timeline.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skills/timeline.ts`:

```ts
/**
 * The plan's clock. Pure and isomorphic: the server renders with it, the editor recomputes with it
 * on every keystroke, and `planDurationMs` is the inner loop the remap optimiser runs 2,885 times.
 */
import { spBetween, spForLevel, trainingMs } from "./sp.js";
import type { AttributeSet } from "./attributes.js";
import { skillRate, type SkillCatalogue } from "./catalogue.js";
import type { ExpandedEntry, KnownLevels } from "./expand.js";

export type PlanStatus = "done" | "queued" | "planned";

export interface TimelineInput {
  entries: readonly ExpandedEntry[];
  catalogue: SkillCatalogue;
  attributes: AttributeSet;
  trained: KnownLevels;
  queued: KnownLevels;
  partialSp?: ReadonlyMap<number, number>;
  startAt: Date;
}

export interface TimelineEntry {
  skillId: number; level: number; prereq: boolean; note: string | null;
  status: PlanStatus;
  rank: number | null;
  levelSp: number;
  sp: number;
  spPerMinute: number;
  ms: number; cumulativeMs: number; doneAt: Date;
}

export interface Timeline {
  entries: TimelineEntry[]; totalSp: number; totalMs: number; doneAt: Date; unknownSkillIds: number[];
}

function statusOf(entry: ExpandedEntry, trained: KnownLevels, queued: KnownLevels): PlanStatus {
  if ((trained.get(entry.skillId) ?? 0) >= entry.level) return "done";
  if ((queued.get(entry.skillId) ?? 0) >= entry.level) return "queued";
  return "planned";
}

/**
 * SP still owed for a planned level. `held` only bites on a skill's FIRST planned level, because
 * `expandPlan` emits levels in ascending order and the floor overtakes `held` immediately after.
 */
function remainingSp(rank: number, level: number, held: number): number {
  const target = spForLevel(rank, level);
  const floor = spForLevel(rank, level - 1);
  const from = Math.max(floor, Math.min(held, target));
  return target - from;
}

export function planTimeline(input: TimelineInput): Timeline {
  const { entries, catalogue, attributes, trained, queued, partialSp, startAt } = input;
  const out: TimelineEntry[] = [];
  const unknown: number[] = [];
  const seenUnknown = new Set<number>();
  let cumulativeMs = 0;
  let totalSp = 0;

  for (const entry of entries) {
    const skill = catalogue.get(entry.skillId);
    const status = statusOf(entry, trained, queued);
    if (skill === undefined) {
      if (!seenUnknown.has(entry.skillId)) { seenUnknown.add(entry.skillId); unknown.push(entry.skillId); }
      out.push({
        skillId: entry.skillId, level: entry.level, prereq: entry.prereq, note: entry.note,
        status, rank: null, levelSp: 0, sp: 0, spPerMinute: 0,
        ms: 0, cumulativeMs, doneAt: new Date(startAt.getTime() + Math.round(cumulativeMs)),
      });
      continue;
    }
    const levelSp = spBetween(skill.rank, entry.level - 1, entry.level);
    const rate = skillRate(skill, attributes);
    const sp = status === "planned"
      ? remainingSp(skill.rank, entry.level, partialSp?.get(entry.skillId) ?? 0)
      : 0;
    const ms = trainingMs(sp, rate);
    cumulativeMs += ms;
    totalSp += sp;
    out.push({
      skillId: entry.skillId, level: entry.level, prereq: entry.prereq, note: entry.note,
      status, rank: skill.rank, levelSp, sp, spPerMinute: rate,
      ms, cumulativeMs, doneAt: new Date(startAt.getTime() + Math.round(cumulativeMs)),
    });
  }

  return {
    entries: out, totalSp, totalMs: cumulativeMs,
    doneAt: new Date(startAt.getTime() + Math.round(cumulativeMs)),
    unknownSkillIds: unknown,
  };
}

/**
 * Total remaining milliseconds, with no per-entry allocation. `optimalRemap` calls this once per
 * candidate distribution, so it must stay a plain loop.
 */
export function planDurationMs(input: Omit<TimelineInput, "startAt">): number {
  const { entries, catalogue, attributes, trained, queued, partialSp } = input;
  let total = 0;
  for (const entry of entries) {
    if (statusOf(entry, trained, queued) !== "planned") continue;
    const skill = catalogue.get(entry.skillId);
    if (skill === undefined) continue;
    const sp = remainingSp(skill.rank, entry.level, partialSp?.get(entry.skillId) ?? 0);
    total += trainingMs(sp, skillRate(skill, attributes));
  }
  return total;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/skills/timeline.test.ts`
Expected: PASS. Every millisecond above is exact — `468750`, `2184375`, `12346875`, `937500` all
divide cleanly at 32 SP/min — so `toEqual` is correct and no `toBeCloseTo` is needed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/timeline.ts tests/skills/timeline.test.ts
git commit -m "$(cat <<'EOM'
Add the plan timeline

Statuses (done / queued / planned) from the trained sheet and the ESI queue, SP
and time per level, cumulative time and completion dates from a chosen start.
planDurationMs is the allocation-free total the remap optimiser will loop over.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: The optimal remap (`src/lib/skills/remap.ts`)

Spec §2's remap bullet. A brute-force walk of every legal base distribution, exactly as EVEMon's
`AttributesOptimizer` does, minus the `maxDuration` machinery the spec does not ask for.

**Files:**
- Create: `src/lib/skills/remap.ts`, `tests/skills/remap.test.ts`

**Interfaces:**
- Consumes (Tasks 3, 4, 6):
```ts
export function enumerateBases(): AttributeSet[];
export function addAttributes(a: AttributeSet, b: AttributeSet): AttributeSet;
export const ZERO_ATTRIBUTES: AttributeSet;
export function planDurationMs(input: Omit<TimelineInput, "startAt">): number;
export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;
export type KnownLevels = ReadonlyMap<number, number>;
export interface ExpandedEntry { skillId: number; level: number; note: string | null; prereq: boolean }
```
- Produces:
```ts
// src/lib/skills/remap.ts — pure, isomorphic
export interface RemapInput {
  entries: readonly ExpandedEntry[];
  catalogue: SkillCatalogue;
  /** The character's current BASE attributes (implants excluded). */
  currentBase: AttributeSet;
  /** Implant bonuses, added on top of every candidate as well as of `currentBase`. */
  implantBonus?: AttributeSet;
  trained: KnownLevels;
  queued: KnownLevels;
  partialSp?: ReadonlyMap<number, number>;
}
export interface RemapResult {
  /** The winning BASE distribution — what the character would set in the remap window. */
  remap: AttributeSet;
  /** Total plan time under the winning remap, in milliseconds. */
  totalMs: number;
  /** Total plan time under `currentBase`, in milliseconds. */
  currentMs: number;
  /** currentMs - totalMs; never negative. */
  savedMs: number;
  /** How many distributions were evaluated — 2,885. */
  candidates: number;
}
export function optimalRemap(input: RemapInput): RemapResult;
```

**Decisions recorded here (do not re-litigate them):**
- Decision 5: **minimise total plan time, full stop.** EVEMon's "maximise skills trained inside
  `maxDuration`, break ties by time" rule needs a horizon the spec does not define.
- The search replaces the best only on a **strictly smaller** total, and `enumerateBases()` walks in
  a fixed order (perception → willpower → intelligence → memory, charisma taking the remainder), so
  ties resolve to the first candidate in that order and the result is reproducible.
- Implants are a separate additive layer: they are added to every candidate and to the current
  base alike, which is why a uniform implant set cannot change which distribution wins.
- 2,885 candidates × a 500-entry plan is about 1.4 M `planDurationMs` iterations — a few tens of
  milliseconds. No early-exit pruning is needed, and none is implemented; adding one would make the
  tie-break order harder to reason about for no user-visible gain.
- `savedMs` is clamped at 0. If the character's current base already is the optimum, the panel
  should read "already optimal", not "saves -0 ms".

- [ ] **Step 1: Write the failing test**

Create `tests/skills/remap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";
import { optimalRemap } from "../../src/lib/skills/remap.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  // Gunnery: perception primary, willpower secondary, rank 1.
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  // Power Grid Management: intelligence primary, memory secondary, rank 1.
  { id: 3413, name: "Power Grid Management", groupId: 272, groupName: "Engineering", rank: 1, primaryAttr: 165, secondaryAttr: 166, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));
const CURRENT: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };

describe("optimalRemap", () => {
  it("pushes a Gunnery-only plan into perception and willpower", () => {
    const entries = expandPlan([{ skillId: 3300, level: 5 }], new Map(), CATALOGUE);
    const result = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map(),
    });
    // rate = perception + willpower/2, maximised at perception 27 (the +10 cap) with the
    // remaining 4 points in willpower: 27 + 21/2 = 37.5 SP/min. perception 26 / willpower 22
    // would give 37, so the optimum is unique.
    expect(result.remap).toEqual(
      { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
    expect(result.candidates).toBe(2885);
    // Gunnery V is 256,000 SP. Current 21 + 22/2 = 32 → 8,000 min = 480,000,000 ms.
    // Optimal 37.5 → 6,826.66… min = 409,600,000 ms. Saved 70,400,000 ms (19 h 33 m 20 s).
    expect(result.currentMs).toBe(480_000_000);
    expect(result.totalMs).toBe(409_600_000);
    expect(result.savedMs).toBe(70_400_000);
  });

  it("adds implants on top of every candidate without changing the winner", () => {
    const entries = expandPlan([{ skillId: 3300, level: 5 }], new Map(), CATALOGUE);
    const result = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map(),
      implantBonus: { charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 },
    });
    expect(result.remap).toEqual(
      { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
    // 30 + 24/2 = 42 SP/min → 256,000 / 42 min.
    expect(result.totalMs).toBeCloseTo((256_000 / 42) * 60_000, 3);
  });

  it("balances a plan that pulls on both attribute pairs", () => {
    const entries = expandPlan(
      [{ skillId: 3300, level: 5 }, { skillId: 3413, level: 5 }], new Map(), CATALOGUE);
    const result = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map(),
    });
    // Both halves are 256,000 SP, so the winner must put real points into intelligence too.
    expect(result.remap.intelligence).toBeGreaterThan(17);
    expect(result.remap.perception).toBeGreaterThan(17);
    expect(result.remap.charisma).toBe(17);
    expect(result.totalMs).toBeLessThan(result.currentMs);
  });

  it("never reports a negative saving, and skips entries that cost nothing", () => {
    const entries = expandPlan([{ skillId: 3300, level: 5 }], new Map(), CATALOGUE);
    const done = optimalRemap({
      entries, catalogue: CATALOGUE, currentBase: CURRENT,
      trained: new Map([[3300, 5]]), queued: new Map(),
    });
    expect(done.currentMs).toBe(0);
    expect(done.totalMs).toBe(0);
    expect(done.savedMs).toBe(0);
  });

  it("is deterministic", () => {
    const entries = expandPlan([{ skillId: 3300, level: 3 }], new Map(), CATALOGUE);
    const args = { entries, catalogue: CATALOGUE, currentBase: CURRENT, trained: new Map(), queued: new Map() };
    expect(optimalRemap(args)).toEqual(optimalRemap(args));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/remap.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/remap.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skills/remap.ts`:

```ts
/**
 * The optimal neural remap: brute force over every legal base distribution, as EVEMon's
 * `Helpers/AttributesOptimizer.cs` does. There are 2,885 of them, so even a 500-entry plan is a
 * couple of million multiplications — fast enough to run on every "optimise" click.
 *
 * Spec §2 asks only for "the distribution minimising total plan time", so there is no maxDuration
 * and no "trained the most skills" tie-break. Ties fall to the first candidate `enumerateBases()`
 * yields, which is deterministic by construction.
 */
import { ZERO_ATTRIBUTES, addAttributes, enumerateBases, type AttributeSet } from "./attributes.js";
import type { SkillCatalogue } from "./catalogue.js";
import type { ExpandedEntry, KnownLevels } from "./expand.js";
import { planDurationMs } from "./timeline.js";

export interface RemapInput {
  entries: readonly ExpandedEntry[];
  catalogue: SkillCatalogue;
  currentBase: AttributeSet;
  implantBonus?: AttributeSet;
  trained: KnownLevels;
  queued: KnownLevels;
  partialSp?: ReadonlyMap<number, number>;
}

export interface RemapResult {
  remap: AttributeSet;
  totalMs: number;
  currentMs: number;
  savedMs: number;
  candidates: number;
}

export function optimalRemap(input: RemapInput): RemapResult {
  const { entries, catalogue, currentBase, trained, queued, partialSp } = input;
  const implantBonus = input.implantBonus ?? ZERO_ATTRIBUTES;
  const duration = (base: AttributeSet): number => planDurationMs({
    entries, catalogue, attributes: addAttributes(base, implantBonus), trained, queued, partialSp,
  });

  const currentMs = duration(currentBase);
  const bases = enumerateBases();
  let best = bases[0];
  let bestMs = duration(best);
  for (let i = 1; i < bases.length; i++) {
    const ms = duration(bases[i]);
    if (ms < bestMs) { bestMs = ms; best = bases[i]; }
  }

  return {
    remap: best,
    totalMs: bestMs,
    currentMs,
    savedMs: Math.max(0, currentMs - bestMs),
    candidates: bases.length,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/skills/remap.test.ts`
Expected: PASS. If the "never reports a negative saving" case fails with `bestMs > 0`, the
`planned`-only filter in `planDurationMs` regressed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/remap.ts tests/skills/remap.test.ts
git commit -m "$(cat <<'EOM'
Add the brute-force optimal remap

2,885 legal 17..27 distributions, each scored with planDurationMs, keeping the
first strictly-fastest. A Gunnery-only plan lands on perception 27 / willpower 21
and saves 19 h 33 m on Gunnery V from scratch.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: Plan text — import and export (`src/lib/skills/text.ts`)

Spec §5's Export/Import modal. Two flavours out (EVEMon's `Gunnery V`, the in-game client's
`Gunnery 5`), both flavours in, plus the `<localized>` wrapper a non-English client emits.

**Files:**
- Create: `src/lib/skills/text.ts`, `tests/skills/text.test.ts`

**Interfaces:**
- Consumes:
```ts
// src/lib/view/format.ts — pure, no imports of its own
export function roman(level: number): string;         // "", "I", "II", "III", "IV", "V"
// src/lib/skills/catalogue.ts
export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;
```
- Produces:
```ts
// src/lib/skills/text.ts — pure, isomorphic
export type PlanTextFormat = "evemon" | "ingame";
export const PLAN_TEXT_FORMATS: readonly PlanTextFormat[];        // ["evemon", "ingame"]
export function isPlanTextFormat(value: unknown): value is PlanTextFormat;
export function levelFromToken(token: string): number | null;     // "V" / "5" / "iii" → 5 / 5 / 3
export interface PlanTextLine { name: string; level: number; raw: string }
export function tokenisePlanText(text: string): PlanTextLine[];
export function planTextNames(text: string): string[];            // lower-cased, deduplicated
export interface ParsedPlanText { entries: { skillId: number; level: number }[]; unresolved: string[] }
export function resolvePlanLines(lines: readonly PlanTextLine[], byName: ReadonlyMap<string, number>): ParsedPlanText;
export function exportPlanText(
  entries: readonly { skillId: number; level: number }[], catalogue: SkillCatalogue, format: PlanTextFormat,
): string;
```

**Decisions recorded here (do not re-litigate them):**
- The exported text is **one line per level**, in plan order, ending with a trailing newline. That
  is what both EVEMon and the in-game importer expect (research §7).
- Level detection reads the **last whitespace-separated token**. If it is `1`–`5` or `I`–`V`
  (case-insensitive) it is the level and the rest is the name; otherwise the whole line is the name
  and the level is **I** (spec §5: "`Skill Name` alone means level I"). No EVE *skill* name ends in
  a bare Roman numeral — module names like "200mm AutoCannon II" do, but those are not category-16
  types and will simply not resolve.
- `<localized hint="…">Name*</localized>` is unwrapped and a single trailing `*` is dropped, so a
  paste from a Japanese or German client works. This is a superset of what spec §5 asks for; it
  costs one regex and research §7 shows it is the shape the client actually emits.
- Blank lines, EVEMon remap markers (`***anything***`) and lines beginning `#` or `//` are skipped
  silently — they are not "unresolved", they are not entries.
- **Unknown skill ids are omitted from an export.** `Unknown skill (12345)` would not import
  anywhere. The export route's body is `text/plain` and nothing else; the editor already knows how
  many ids are unknown, from the timeline's `unknownSkillIds`, and says so in the modal.
- Duplicate (skill, level) pairs in an import are kept as-is; `expandPlan` de-duplicates them the
  first time the plan is computed.

- [ ] **Step 1: Write the failing test**

Create `tests/skills/text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import {
  PLAN_TEXT_FORMATS, exportPlanText, isPlanTextFormat, levelFromToken, planTextNames,
  resolvePlanLines, tokenisePlanText,
} from "../../src/lib/skills/text.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 11207, name: "Advanced Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 6, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map()));
const BY_NAME = new Map([["gunnery", 3300], ["advanced weapon upgrades", 11207]]);

describe("levelFromToken", () => {
  it("reads Arabic and Roman levels, case-insensitively", () => {
    expect([1, 2, 3, 4, 5].map((n) => levelFromToken(String(n)))).toEqual([1, 2, 3, 4, 5]);
    expect(["I", "ii", "III", "iv", "V"].map(levelFromToken)).toEqual([1, 2, 3, 4, 5]);
  });
  it("rejects anything else", () => {
    expect(levelFromToken("6")).toBeNull();
    expect(levelFromToken("0")).toBeNull();
    expect(levelFromToken("VI")).toBeNull();
    expect(levelFromToken("Upgrades")).toBeNull();
  });
  it("names the two formats", () => {
    expect(PLAN_TEXT_FORMATS).toEqual(["evemon", "ingame"]);
    expect(isPlanTextFormat("evemon")).toBe(true);
    expect(isPlanTextFormat("eft")).toBe(false);
  });
});

describe("tokenisePlanText", () => {
  it("splits name from level in both flavours", () => {
    expect(tokenisePlanText("Gunnery V\nAdvanced Weapon Upgrades 3\n"))
      .toEqual([
        { name: "Gunnery", level: 5, raw: "Gunnery V" },
        { name: "Advanced Weapon Upgrades", level: 3, raw: "Advanced Weapon Upgrades 3" },
      ]);
  });

  it("treats a bare name as level I", () => {
    expect(tokenisePlanText("Gunnery")).toEqual([{ name: "Gunnery", level: 1, raw: "Gunnery" }]);
  });

  it("unwraps the client's localisation tag and drops the trailing star", () => {
    const text = '<localized hint="宇宙船操作">Spaceship Command*</localized> 2';
    expect(tokenisePlanText(text)).toEqual([
      { name: "Spaceship Command", level: 2, raw: text },
    ]);
  });

  it("skips blanks, remap markers and comments", () => {
    expect(tokenisePlanText("\n***Remap to perception***\n# a note\n// another\nGunnery I\n   \n"))
      .toEqual([{ name: "Gunnery", level: 1, raw: "Gunnery I" }]);
  });

  it("handles CRLF and surrounding whitespace", () => {
    expect(tokenisePlanText("  Gunnery  II  \r\nGunnery III\r\n").map((l) => [l.name, l.level]))
      .toEqual([["Gunnery", 2], ["Gunnery", 3]]);
  });

  it("lists the lower-cased names to resolve, once each", () => {
    expect(planTextNames("Gunnery I\nGUNNERY II\nAdvanced Weapon Upgrades 1\n"))
      .toEqual(["gunnery", "advanced weapon upgrades"]);
  });
});

describe("resolvePlanLines", () => {
  it("resolves case-insensitively and reports the rest verbatim", () => {
    const parsed = resolvePlanLines(tokenisePlanText("gunnery V\nDamage Controll II\n"), BY_NAME);
    expect(parsed.entries).toEqual([{ skillId: 3300, level: 5 }]);
    expect(parsed.unresolved).toEqual(["Damage Controll II"]);
  });
});

describe("exportPlanText", () => {
  const entries = [
    { skillId: 3300, level: 1 }, { skillId: 3300, level: 2 }, { skillId: 11207, level: 1 },
  ];

  it("writes Roman numerals for EVEMon and Arabic digits for the client", () => {
    expect(exportPlanText(entries, CATALOGUE, "evemon"))
      .toBe("Gunnery I\nGunnery II\nAdvanced Weapon Upgrades I\n");
    expect(exportPlanText(entries, CATALOGUE, "ingame"))
      .toBe("Gunnery 1\nGunnery 2\nAdvanced Weapon Upgrades 1\n");
  });

  it("omits a skill the catalogue does not hold", () => {
    expect(exportPlanText([...entries, { skillId: 999999, level: 3 }], CATALOGUE, "ingame"))
      .toBe("Gunnery 1\nGunnery 2\nAdvanced Weapon Upgrades 1\n");
  });

  it("is empty for an empty plan", () => {
    expect(exportPlanText([], CATALOGUE, "evemon")).toBe("");
  });

  it("round-trips through both formats", () => {
    for (const format of PLAN_TEXT_FORMATS) {
      const text = exportPlanText(entries, CATALOGUE, format);
      const parsed = resolvePlanLines(tokenisePlanText(text), BY_NAME);
      expect(parsed.unresolved).toEqual([]);
      expect(parsed.entries).toEqual(entries);
      expect(exportPlanText(parsed.entries, CATALOGUE, format)).toBe(text);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/text.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/text.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skills/text.ts`:

```ts
/**
 * Plan text, both directions (spec §5).
 *
 * Out: one line per LEVEL, in plan order, `Gunnery V` (EVEMon) or `Gunnery 5` (the in-game
 * importer). In: either flavour, plus the `<localized hint="…">Name*</localized>` wrapper a
 * non-English client pastes, plus a bare name meaning level I.
 */
import { roman } from "../view/format.js";
import { skillLabel, type SkillCatalogue } from "./catalogue.js";

export type PlanTextFormat = "evemon" | "ingame";
export const PLAN_TEXT_FORMATS: readonly PlanTextFormat[] = ["evemon", "ingame"];

export function isPlanTextFormat(value: unknown): value is PlanTextFormat {
  return typeof value === "string" && (PLAN_TEXT_FORMATS as readonly string[]).includes(value);
}

const ROMAN_LEVELS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

export function levelFromToken(token: string): number | null {
  const lower = token.trim().toLowerCase();
  if (/^[1-5]$/.test(lower)) return Number(lower);
  return ROMAN_LEVELS[lower] ?? null;
}

export interface PlanTextLine { name: string; level: number; raw: string }

const LOCALIZED = /<localized\b[^>]*>([\s\S]*?)<\/localized>/gi;
const SKIPPED = /^(\*\*\*.*\*\*\*|#.*|\/\/.*)$/;

/**
 * One `PlanTextLine` per usable line. Blank lines, EVEMon remap markers (`***…***`) and `#` / `//`
 * comments are dropped silently — they are not entries and not failures.
 */
export function tokenisePlanText(text: string): PlanTextLine[] {
  const out: PlanTextLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (raw === "" || SKIPPED.test(raw)) continue;
    // Unwrap the client's localisation tag, then drop the trailing "*" it appends to the English name.
    const flat = raw.replace(LOCALIZED, "$1").replace(/\s+/g, " ").trim();
    const parts = flat.split(" ");
    const last = parts.length > 1 ? levelFromToken(parts[parts.length - 1]) : null;
    const level = last ?? 1;
    const name = (last === null ? flat : parts.slice(0, -1).join(" ")).replace(/\*$/, "").trim();
    if (name === "") continue;
    out.push({ name, level, raw });
  }
  return out;
}

/** The lower-cased names an import must resolve, deduplicated, in first-appearance order. */
export function planTextNames(text: string): string[] {
  const seen = new Set<string>();
  for (const line of tokenisePlanText(text)) seen.add(line.name.toLowerCase());
  return [...seen];
}

export interface ParsedPlanText { entries: { skillId: number; level: number }[]; unresolved: string[] }

/** `byName` is a lower-cased skill name → id map, from the catalogue (spec §5: exact, case-insensitive). */
export function resolvePlanLines(
  lines: readonly PlanTextLine[], byName: ReadonlyMap<string, number>,
): ParsedPlanText {
  const entries: { skillId: number; level: number }[] = [];
  const unresolved: string[] = [];
  for (const line of lines) {
    const skillId = byName.get(line.name.toLowerCase());
    if (skillId === undefined) unresolved.push(line.raw);
    else entries.push({ skillId, level: line.level });
  }
  return { entries, unresolved };
}

/**
 * A skill the catalogue does not hold is omitted: `skillLabel` would write "Unknown skill (id)",
 * which no importer anywhere accepts.
 */
export function exportPlanText(
  entries: readonly { skillId: number; level: number }[], catalogue: SkillCatalogue, format: PlanTextFormat,
): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (!catalogue.has(entry.skillId)) continue;
    const level = format === "evemon" ? roman(entry.level) : String(entry.level);
    lines.push(`${skillLabel(catalogue, entry.skillId)} ${level}`);
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/skills/text.test.ts`
Expected: PASS, including both round trips.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/text.ts tests/skills/text.test.ts
git commit -m "$(cat <<'EOM'
Add plan text import and export

One line per level. Out: Roman for EVEMon, Arabic for the in-game importer.
In: either flavour, a bare name meaning level I, the client's <localized>
wrapper unwrapped, and unresolved lines reported rather than fatal.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 9: The `skill_plans` / `skill_plan_entries` tables and their repo

Spec §4's data model, and the repo the routes and pages read through.

**Files:**
- Create: `src/lib/db/skill-plans.ts`, `tests/db/skill-plans.test.ts`
- Modify: `db/schema.sql`, `tests/db/helpers.ts`, `tests/db/schema.test.ts`

**Interfaces:**
- Consumes (phase 1/3/5, verbatim):
```ts
// src/lib/db/client.ts
export function getPool(): Pool;
// src/lib/skills/expand.ts
export interface PlanEntry { skillId: number; level: number; note?: string | null }
// src/lib/skills/attributes.ts
export type AttributeSet = Record<AttributeKey, number>;
```
- Produces:
```ts
// src/lib/db/skill-plans.ts
export interface PlanEntryRow { position: number; skillId: number; level: number; note: string | null }
export interface PlanRow {
  id: number; characterId: number; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
}
export interface PlanInput {
  characterId: number; name: string; remap?: AttributeSet | null; entries?: PlanEntry[];
}
export interface PlanPatch { name?: string; remap?: AttributeSet | null; entries?: PlanEntry[] }
export async function listPlans(characterId: number): Promise<PlanRow[]>;
export async function getPlan(id: number): Promise<PlanRow | null>;
export async function createPlan(input: PlanInput): Promise<PlanRow>;
export async function updatePlan(id: number, patch: PlanPatch): Promise<PlanRow | null>;
export async function deletePlan(id: number): Promise<boolean>;
```

**Decisions recorded here (do not re-litigate them):**
- A plan belongs to exactly one character and **`character_id` is `NOT NULL` and never patched**.
  Spec §4 has it cascade on delete; a plan without a pilot has no attributes, no queue and no
  meaning, so unlike a phase-5 fit it does not degrade to an "all V" object.
- `position` is the spec's column name. Postgres accepts it unquoted in DDL, `INSERT` column lists,
  `SELECT` lists and `ORDER BY` — verified against the dev database — so no quoting dance is needed.
- `position` is **dense from 0** and rewritten on every `PUT`, exactly like `fit_items.idx`. The
  editor moves entries by rewriting the whole list.
- `remap` is stored as `jsonb` and passed to `pg` as `JSON.stringify(...)`. `pg` gives it back as a
  parsed object, so `PlanRow.remap` is already an `AttributeSet`. Shape validation is the parser's
  job (Task 10), not the repo's.
- `note` is nullable and defaults to `null`, never `""`.

- [ ] **Step 1: Write the failing schema test**

In `tests/db/schema.test.ts`, add the two tables to the sorted list (between `"market_prices"` and
`"sde_alpha_skills"`, then `"skill_plan_entries"` / `"skill_plans"` after `"sde_types"`):

```ts
      "market_prices",
      "sde_alpha_skills",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
      "sde_dogma_effect_modifiers", "sde_dogma_effects", "sde_dogma_units", "sde_groups",
      "sde_market_groups", "sde_meta", "sde_meta_groups", "sde_regions", "sde_skill_plans",
      "sde_solar_systems", "sde_stations", "sde_type_attributes", "sde_type_bonuses",
      "sde_type_effects", "sde_types",
      "skill_plan_entries", "skill_plans",
      "structures", "sync_runs", "universe_names",
```

and add a case to the existing "cascades every per-character table" test, right after the
`character_assets` insert:

```ts
    await pool.query("INSERT INTO skill_plans (id, character_id, name) VALUES (900, 42, 'Cascade plan')");
    await pool.query("INSERT INTO skill_plan_entries (plan_id, position, skill_id, level) VALUES (900, 0, 3300, 5)");
```

and, wherever that test asserts the tables are empty after the delete, add — scoped to the rows this
test itself inserted, so it stays correct regardless of what other tests in the file have left
behind:

```ts
    expect((await pool.query("SELECT count(*) FROM skill_plans WHERE character_id = 42")).rows[0].count).toBe("0");
    expect((await pool.query("SELECT count(*) FROM skill_plan_entries WHERE plan_id = 900")).rows[0].count).toBe("0");
```

Add one more `it` to the same `describe`, **last**, after the "cascades every per-character table"
test:

```ts
  it("rejects a plan entry outside levels 1..5", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (43, 'Levels', 'enc') ON CONFLICT (id) DO NOTHING");
    await pool.query("INSERT INTO skill_plans (id, character_id, name) VALUES (901, 43, 'Levels')");
    await expect(pool.query("INSERT INTO skill_plan_entries (plan_id, position, skill_id, level) VALUES (901, 0, 3300, 6)"))
      .rejects.toThrow(/check/i);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL — `relation "skill_plans" does not exist`.

- [ ] **Step 3: Add the tables to `db/schema.sql`**

Append to `db/schema.sql`:

```sql
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
```

In `tests/db/helpers.ts`, add `skill_plans` to the TRUNCATE so its serial restarts between files:

```ts
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts, universe_names, structures, market_prices, fits, skill_plans RESTART IDENTITY CASCADE");
```

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing repo test**

Create `tests/db/skill-plans.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createPlan, deletePlan, getPlan, listPlans, updatePlan } from "../../src/lib/db/skill-plans.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const REMAP: AttributeSet = { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 };

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await pool.query("TRUNCATE characters RESTART IDENTITY CASCADE");
  await pool.query(
    `INSERT INTO characters (id, name, refresh_token_enc) VALUES
      (90000101, 'Mara Vexley', 'enc'), (95465499, 'Jorin Hale', 'enc')`);
});

describe("createPlan / getPlan", () => {
  it("stores the head, the remap and the entries in order", async () => {
    const plan = await createPlan({
      characterId: 90000101, name: "Gunnery", remap: REMAP,
      entries: [{ skillId: 3300, level: 5 }, { skillId: 3318, level: 4, note: "for AWU" }],
    });
    expect(plan).toMatchObject({ characterId: 90000101, name: "Gunnery", remap: REMAP });
    expect(plan.entries).toEqual([
      { position: 0, skillId: 3300, level: 5, note: null },
      { position: 1, skillId: 3318, level: 4, note: "for AWU" },
    ]);
    expect(await getPlan(plan.id)).toEqual(plan);
  });

  it("defaults the remap to null and the entries to empty", async () => {
    const plan = await createPlan({ characterId: 90000101, name: "Empty" });
    expect(plan.remap).toBeNull();
    expect(plan.entries).toEqual([]);
  });

  it("answers null for an unknown id", async () => {
    expect(await getPlan(999999)).toBeNull();
  });
});

describe("listPlans", () => {
  it("returns only that character's plans, newest first", async () => {
    const first = await createPlan({ characterId: 90000101, name: "First", entries: [{ skillId: 3300, level: 1 }] });
    const second = await createPlan({ characterId: 90000101, name: "Second" });
    await createPlan({ characterId: 95465499, name: "Someone else's" });
    const plans = await listPlans(90000101);
    expect(plans.map((p) => p.name)).toEqual(["Second", "First"]);
    expect(plans.find((p) => p.id === first.id)!.entries).toHaveLength(1);
    expect(plans.find((p) => p.id === second.id)!.entries).toEqual([]);
  });
});

describe("updatePlan", () => {
  it("replaces the entries wholesale and touches updated_at", async () => {
    const plan = await createPlan({
      characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }],
    });
    const updated = await updatePlan(plan.id, {
      name: "Gunnery and frigates",
      entries: [{ skillId: 3327, level: 1 }, { skillId: 3329, level: 3 }],
    });
    expect(updated!.name).toBe("Gunnery and frigates");
    expect(updated!.entries.map((e) => [e.position, e.skillId, e.level]))
      .toEqual([[0, 3327, 1], [1, 3329, 3]]);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(plan.updatedAt.getTime());
  });

  it("leaves the entries alone when the patch omits them, and clears a remap with null", async () => {
    const plan = await createPlan({
      characterId: 90000101, name: "Gunnery", remap: REMAP, entries: [{ skillId: 3300, level: 5 }],
    });
    const renamed = await updatePlan(plan.id, { name: "Renamed" });
    expect(renamed!.entries).toHaveLength(1);
    expect(renamed!.remap).toEqual(REMAP);
    const cleared = await updatePlan(plan.id, { remap: null });
    expect(cleared!.remap).toBeNull();
    expect(cleared!.entries).toHaveLength(1);
  });

  it("can empty a plan and answers null for an unknown id", async () => {
    const plan = await createPlan({ characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }] });
    expect((await updatePlan(plan.id, { entries: [] }))!.entries).toEqual([]);
    expect(await updatePlan(999999, { name: "nope" })).toBeNull();
  });
});

describe("deletePlan and cascades", () => {
  it("deletes a plan and its entries, and reports an unknown id", async () => {
    const plan = await createPlan({ characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }] });
    expect(await deletePlan(plan.id)).toBe(true);
    expect(await getPlan(plan.id)).toBeNull();
    const { rows } = await pool.query("SELECT count(*) FROM skill_plan_entries WHERE plan_id = $1", [plan.id]);
    expect(rows[0].count).toBe("0");
    expect(await deletePlan(plan.id)).toBe(false);
  });

  it("dies with its character", async () => {
    const plan = await createPlan({ characterId: 95465499, name: "Doomed", entries: [{ skillId: 3300, level: 1 }] });
    await pool.query("DELETE FROM characters WHERE id = 95465499");
    expect(await getPlan(plan.id)).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/db/skill-plans.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/db/skill-plans.js`.

- [ ] **Step 7: Write the repo**

Create `src/lib/db/skill-plans.ts`:

```ts
import { getPool } from "./client.js";
import type { PoolClient } from "pg";
import type { AttributeSet } from "../skills/attributes.js";
import type { PlanEntry } from "../skills/expand.js";

export interface PlanEntryRow { position: number; skillId: number; level: number; note: string | null }
export interface PlanRow {
  id: number; characterId: number; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
}
export interface PlanInput {
  characterId: number; name: string; remap?: AttributeSet | null; entries?: PlanEntry[];
}
export interface PlanPatch { name?: string; remap?: AttributeSet | null; entries?: PlanEntry[] }

interface HeadRow {
  id: number; characterId: string; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date;
}
interface EntryDbRow { planId: number; position: number; skillId: number; level: number; note: string | null }

const HEAD_COLS = `id, character_id AS "characterId", name, remap,
  created_at AS "createdAt", updated_at AS "updatedAt"`;
const ENTRY_COLS = `plan_id AS "planId", position, skill_id AS "skillId", level, note`;

/** bigint columns arrive from pg as strings. */
const head = (r: HeadRow, entries: PlanEntryRow[]): PlanRow => ({
  ...r, characterId: Number(r.characterId), entries,
});
const entry = (r: EntryDbRow): PlanEntryRow => ({
  position: r.position, skillId: r.skillId, level: r.level, note: r.note,
});

export async function listPlans(characterId: number): Promise<PlanRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(
    `SELECT ${HEAD_COLS} FROM skill_plans WHERE character_id = $1 ORDER BY updated_at DESC, id DESC`,
    [characterId]);
  if (rows.length === 0) return [];
  const { rows: entries } = await pool.query<EntryDbRow>(
    `SELECT ${ENTRY_COLS} FROM skill_plan_entries WHERE plan_id = ANY($1::int[]) ORDER BY plan_id, position`,
    [rows.map((r) => r.id)]);
  const byPlan = new Map<number, PlanEntryRow[]>();
  for (const r of entries) {
    const list = byPlan.get(r.planId);
    if (list) list.push(entry(r)); else byPlan.set(r.planId, [entry(r)]);
  }
  return rows.map((r) => head(r, byPlan.get(r.id) ?? []));
}

export async function getPlan(id: number): Promise<PlanRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<HeadRow>(`SELECT ${HEAD_COLS} FROM skill_plans WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: entries } = await pool.query<EntryDbRow>(
    `SELECT ${ENTRY_COLS} FROM skill_plan_entries WHERE plan_id = $1 ORDER BY position`, [id]);
  return head(rows[0], entries.map(entry));
}

export async function createPlan(input: PlanInput): Promise<PlanRow> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<HeadRow>(
      `INSERT INTO skill_plans (character_id, name, remap) VALUES ($1, $2, $3::jsonb)
       RETURNING ${HEAD_COLS}`,
      [String(input.characterId), input.name,
       input.remap === undefined || input.remap === null ? null : JSON.stringify(input.remap)]);
    const entries = input.entries ?? [];
    await writeEntries(client, rows[0].id, entries);
    await client.query("COMMIT");
    return head(rows[0], entries.map((e, i) => ({
      position: i, skillId: e.skillId, level: e.level, note: e.note ?? null,
    })));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updatePlan(id: number, patch: PlanPatch): Promise<PlanRow | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // `$4` says "the patch mentioned remap", so an explicit null clears it while an absent key does not.
    const { rows } = await client.query<HeadRow>(
      `UPDATE skill_plans SET name = COALESCE($2, name),
         remap = CASE WHEN $3 THEN $4::jsonb ELSE remap END, updated_at = now()
       WHERE id = $1 RETURNING ${HEAD_COLS}`,
      [id, patch.name ?? null, "remap" in patch,
       patch.remap === undefined || patch.remap === null ? null : JSON.stringify(patch.remap)]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    if (patch.entries !== undefined) {
      await client.query("DELETE FROM skill_plan_entries WHERE plan_id = $1", [id]);
      await writeEntries(client, id, patch.entries);
    }
    await client.query("COMMIT");
    if (patch.entries !== undefined) {
      return head(rows[0], patch.entries.map((e, i) => ({
        position: i, skillId: e.skillId, level: e.level, note: e.note ?? null,
      })));
    }
    const { rows: entries } = await getPool().query<EntryDbRow>(
      `SELECT ${ENTRY_COLS} FROM skill_plan_entries WHERE plan_id = $1 ORDER BY position`, [id]);
    return head(rows[0], entries.map(entry));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deletePlan(id: number): Promise<boolean> {
  const res = await getPool().query("DELETE FROM skill_plans WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

/** One statement for the whole list — `position` is the array index, so the order is preserved. */
async function writeEntries(
  client: PoolClient, planId: number, entries: PlanEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await client.query(
    `INSERT INTO skill_plan_entries (plan_id, position, skill_id, level, note)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::text[])`,
    [planId, entries.map((_, i) => i), entries.map((e) => e.skillId), entries.map((e) => e.level),
     entries.map((e) => e.note ?? null)]);
}
```

- [ ] **Step 8: Run the repo test to verify it passes**

Run: `npx vitest run tests/db/skill-plans.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the whole suite and the type check**

```bash
npm test && npm run typecheck
```
Expected: green.

- [ ] **Step 10: Commit**

```bash
git add db/schema.sql src/lib/db/skill-plans.ts tests/db/helpers.ts \
  tests/db/schema.test.ts tests/db/skill-plans.test.ts
git commit -m "$(cat <<'EOM'
Add skill_plans / skill_plan_entries and their repo

A plan belongs to one character and cascades with it; entries are dense from
position 0 and replaced wholesale by a patch, exactly like fit_items. The remap
column is jsonb holding the five base attribute values the plan assumes.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 10: The plan context and `computePlan` (`src/lib/skills/load.ts`)

The server-side assembly: read the character's attributes, implants, skill sheet and queue, turn
them into the pure functions' inputs, and expose one call — `computePlan` — that every route and
page in the rest of this plan uses so they cannot disagree.

**Files:**
- Modify: `src/lib/skills/load.ts`, `src/lib/db/character-skills.ts`, `tests/db/skills-load.test.ts`

**Interfaces:**
- Consumes (phase 3 and Tasks 2–9, verbatim from the code on `main`):
```ts
// src/lib/db/characters.ts
export interface Character { id: number; name: string; accountId: number | null; /* … */ }
export async function getCharacter(id: number): Promise<Character | null>;
// src/lib/db/character-skills.ts
export interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}
export interface AttributesRow {
  characterId: number; charisma: number; intelligence: number; memory: number;
  perception: number; willpower: number; bonusRemaps: number | null;
  lastRemapDate: Date | null; accruedRemapCooldownDate: Date | null; updatedAt: Date;
}
export async function listSkills(characterId: number): Promise<SkillRow[]>;
export async function listSkillQueue(characterId: number): Promise<SkillQueueRow[]>;
export async function getAttributes(characterId: number): Promise<AttributesRow | null>;
// src/lib/db/character-clones.ts
export async function listImplants(characterId: number): Promise<number[]>;
// src/lib/sde/repo.ts
export async function getTypeAttributes(typeId: number): Promise<Map<number, number>>;
// src/lib/db/skill-plans.ts
export interface PlanRow { id: number; characterId: number; name: string; remap: AttributeSet | null;
                           createdAt: Date; updatedAt: Date; entries: PlanEntryRow[] }
```
- Produces:
```ts
// src/lib/skills/load.ts — SERVER ONLY
export interface PlanContext {
  characterId: number; characterName: string;
  base: AttributeSet; implantBonus: AttributeSet; effective: AttributeSet;
  /** False when the stored attributes are not five 17..27 values summing to 99 (Decision 4). */
  attributesSane: boolean;
  trained: Map<number, number>;
  partialSp: Map<number, number>;
  queued: Map<number, number>;
  queueEndsAt: Date | null;
  bonusRemaps: number | null;
  lastRemapDate: Date | null;
  accruedRemapCooldownDate: Date | null;
  /** False when phase 3 has never synced this character's skills. */
  synced: boolean;
}
export const DEFAULT_BASE_ATTRIBUTES: AttributeSet;   // 19 charisma, 20 everywhere else
export async function loadPlanContext(characterId: number): Promise<PlanContext>;
export interface AccountBlock { characterId: number; name: string; until: Date }
export async function accountTrainingBlock(characterId: number, now?: Date): Promise<AccountBlock | null>;
export interface ComputeOptions { afterQueue?: boolean; remap?: AttributeSet | null; now?: Date }
export interface ComputedPlan {
  plan: PlanRow; context: PlanContext; catalogue: PlanSkill[];
  entries: ExpandedEntry[]; timeline: Timeline;
  /** The effective attributes actually used — remap (if any) plus implants. */
  attributes: AttributeSet;
  startAt: Date;
}
export async function computePlan(plan: PlanRow, opts?: ComputeOptions): Promise<ComputedPlan>;
// src/lib/db/character-skills.ts (added)
export interface AccountQueueEnd { characterId: number; name: string; endsAt: Date }
export async function accountQueueEnds(characterId: number): Promise<AccountQueueEnd[]>;
```

**Decisions recorded here (do not re-litigate them):**
- Decision 4: `character_attributes` is taken as **base, implants excluded** (spec §2). The sanity
  check is `attributesSane` — five integers in `[17, 27]` summing to 99, i.e. `isLegalBase`. It is
  reported, never acted on: silently subtracting implants would make a wrong reading unfixable.
- A character with no `character_attributes` row uses `DEFAULT_BASE_ATTRIBUTES` — perception,
  intelligence, memory and willpower 20, charisma 19, the displayed EVE baseline, total 99.
- `queued` is the **highest `finished_level` per skill** across the whole queue, so a queue that
  trains Gunnery III then IV marks both as queued.
- `partialSp` is `character_skills.skillpoints`, raised by the head queue entry's interpolated SP
  when that is larger (`currentSpInTraining`). ESI's `/skills` is stale until the character logs in,
  so without the interpolation a plan behind a long queue would over-charge its first level.
- `startAt` is `now`, or `queueEndsAt` when `afterQueue` is on **and** the queue actually ends in the
  future. A paused or empty queue has no end, so `afterQueue` degrades to `now` rather than throwing.
- The remap passed to `computePlan` (or stored on the plan) replaces the **base**; implants are
  added on top of whichever base is in play.
- Decision 9: `accountTrainingBlock` returns `null` for a character with no `account_id`. It picks
  the sibling whose queue ends **latest**, and only if that is in the future.

- [ ] **Step 1: Write the failing test**

Append to `tests/db/skills-load.test.ts` (the file Task 4 created — keep its existing imports and
`beforeEach`, and add these):

```ts
import { accountTrainingBlock, computePlan, loadPlanContext, DEFAULT_BASE_ATTRIBUTES } from "../../src/lib/skills/load.js";
import { createPlan } from "../../src/lib/db/skill-plans.js";
```

```ts
describe("loadPlanContext", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE characters RESTART IDENTITY CASCADE");
    await pool.query(
      `INSERT INTO characters (id, name, refresh_token_enc) VALUES (90000101, 'Mara Vexley', 'enc')`);
  });

  it("falls back to EVE's displayed baseline when nothing is synced", async () => {
    const ctx = await loadPlanContext(90000101);
    expect(ctx.base).toEqual(DEFAULT_BASE_ATTRIBUTES);
    expect(DEFAULT_BASE_ATTRIBUTES).toEqual(
      { charisma: 19, intelligence: 20, memory: 20, perception: 20, willpower: 20 });
    expect(ctx.effective).toEqual(DEFAULT_BASE_ATTRIBUTES);
    expect(ctx.attributesSane).toBe(true);
    expect(ctx.synced).toBe(false);
    expect(ctx.queueEndsAt).toBeNull();
    expect(ctx.trained.size).toBe(0);
  });

  it("adds implant bonuses to the stored base and reads the queue", async () => {
    await pool.query(
      `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower, bonus_remaps)
       VALUES (90000101, 18, 20, 18, 21, 22, 2)`);
    // Ocular Filter - Basic (+3 perception) and Neural Boost - Basic (+3 willpower).
    await pool.query("INSERT INTO character_implants (character_id, type_id) VALUES (90000101, 9899), (90000101, 9942)");
    await pool.query(
      `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
        (9899, 178, 3), (9899, 331, 1), (9942, 179, 3), (9942, 331, 3)`);
    await pool.query(
      `INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints)
       VALUES (90000101, 3300, 2, 2, 3000)`);
    await pool.query(
      `INSERT INTO character_skill_queue
         (character_id, queue_position, skill_id, finished_level, start_date, finish_date, training_start_sp, level_end_sp)
       VALUES (90000101, 0, 3300, 3, '2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z', 1415, 8000),
              (90000101, 1, 3300, 4, '2026-09-08T00:00:00Z', '2026-09-20T00:00:00Z', 8000, 45255)`);

    const ctx = await loadPlanContext(90000101);
    expect(ctx.base).toEqual({ charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 });
    expect(ctx.implantBonus).toEqual({ charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 });
    expect(ctx.effective).toEqual({ charisma: 18, intelligence: 20, memory: 18, perception: 24, willpower: 25 });
    expect(ctx.attributesSane).toBe(true);
    expect(ctx.synced).toBe(true);
    expect(ctx.trained.get(3300)).toBe(2);
    expect(ctx.queued.get(3300)).toBe(4);                       // the highest level the queue delivers
    expect(ctx.queueEndsAt?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(ctx.bonusRemaps).toBe(2);
    expect(ctx.partialSp.get(3300)).toBeGreaterThanOrEqual(3000);
  });

  it("flags attributes that cannot be a legal base", async () => {
    await pool.query(
      `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower)
       VALUES (90000101, 24, 25, 25, 26, 27)`);                 // sums to 127, so implants are baked in
    expect((await loadPlanContext(90000101)).attributesSane).toBe(false);
  });
});

describe("accountTrainingBlock", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE characters, accounts RESTART IDENTITY CASCADE");
    await pool.query("INSERT INTO accounts (id, name) VALUES (1, 'Account one')");
    await pool.query(
      `INSERT INTO characters (id, name, refresh_token_enc, account_id) VALUES
        (90000101, 'Mara Vexley', 'enc', 1), (95465499, 'Jorin Hale', 'enc', 1),
        (11111111, 'Loner', 'enc', NULL)`);
  });

  it("names the account-mate whose queue runs longest into the future", async () => {
    await pool.query(
      `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date)
       VALUES (95465499, 0, 3300, 5, '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z'),
              (95465499, 1, 3318, 4, '2026-09-30T00:00:00Z', '2026-10-05T00:00:00Z')`);
    const block = await accountTrainingBlock(90000101, new Date("2026-09-02T00:00:00Z"));
    expect(block).toEqual({ characterId: 95465499, name: "Jorin Hale", until: new Date("2026-10-05T00:00:00Z") });
  });

  it("is null when the mate's queue has already finished, and when there is no account", async () => {
    await pool.query(
      `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date)
       VALUES (95465499, 0, 3300, 5, '2026-08-01T00:00:00Z', '2026-08-10T00:00:00Z')`);
    expect(await accountTrainingBlock(90000101, new Date("2026-09-02T00:00:00Z"))).toBeNull();
    expect(await accountTrainingBlock(11111111, new Date("2026-09-02T00:00:00Z"))).toBeNull();
  });
});

describe("computePlan", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE characters RESTART IDENTITY CASCADE");
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (90000101, 'Mara Vexley', 'enc')");
    await pool.query(
      `INSERT INTO character_attributes (character_id, charisma, intelligence, memory, perception, willpower)
       VALUES (90000101, 18, 20, 18, 21, 22)`);
  });

  it("expands and prices the plan from now", async () => {
    const plan = await createPlan({ characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 3 }] });
    const now = new Date("2026-09-01T00:00:00Z");
    const computed = await computePlan(plan, { now });
    expect(computed.entries.map((e) => [e.skillId, e.level])).toEqual([[3300, 1], [3300, 2], [3300, 3]]);
    // perception 21 + willpower 22/2 = 32 SP/min; 8,000 SP total → 250 min → 15,000,000 ms.
    expect(computed.timeline.totalMs).toBe(15_000_000);
    expect(computed.startAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(computed.attributes).toEqual({ charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 });
  });

  it("applies a remap and can start after the queue", async () => {
    await pool.query(
      `INSERT INTO character_skill_queue (character_id, queue_position, skill_id, finished_level, start_date, finish_date)
       VALUES (90000101, 0, 3413, 5, '2026-09-01T00:00:00Z', '2026-09-05T00:00:00Z')`);
    const plan = await createPlan({ characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 5 }] });
    const remap = { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 };
    const computed = await computePlan(plan, { now: new Date("2026-09-01T00:00:00Z"), afterQueue: true, remap });
    expect(computed.startAt.toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(computed.attributes).toEqual(remap);
    // 256,000 SP at 27 + 21/2 = 37.5 SP/min → 6,826.66… min → 409,600,000 ms.
    expect(computed.timeline.totalMs).toBe(409_600_000);
    expect(computed.timeline.doneAt.toISOString()).toBe("2026-09-09T17:46:40.000Z");
  });
});
```

The `beforeEach` at the top of the file seeds `sde_groups` / `sde_types` / `sde_type_attributes` for
Gunnery (3300) and Advanced Weapon Upgrades (11207). Extend it so the new tests have the skills they
need — add `3413 Power Grid Management` (rank 1, intelligence/memory) to both the type and the
attribute inserts:

```ts
  await pool.query(
    `INSERT INTO sde_types (id, group_id, name, published) VALUES
      (3300, 255, 'Gunnery', true), (11207, 255, 'Advanced Weapon Upgrades', true),
      (3413, 255, 'Power Grid Management', true)`);
  await pool.query(
    `INSERT INTO sde_type_attributes (type_id, attribute_id, value) VALUES
      (3300, 275, 1), (3300, 180, 167), (3300, 181, 168),
      (11207, 275, 6), (11207, 180, 167), (11207, 181, 168), (11207, 182, 3318), (11207, 277, 4),
      (3413, 275, 1), (3413, 180, 165), (3413, 181, 166)`);
```

and make the outer `beforeEach` run `resetSde` **before** the per-describe `beforeEach` truncates
characters, which it already does — vitest runs the outer hook first.

Also update Task 4's assertion in the same file: adding `3413` to this shared `beforeEach` means
`loadSkillCatalogue`'s `describe("loadSkillCatalogue")` test (line ~1433) now sees three skills, not
two. Change `expect(skills.map((s) => s.id)).toEqual([11207, 3300]);` to
`expect(skills.map((s) => s.id)).toEqual([11207, 3300, 3413]);` (still name-ascending: "Advanced
Weapon Upgrades", "Gunnery", "Power Grid Management").

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/db/skills-load.test.ts`
Expected: FAIL — `loadPlanContext is not a function`.

- [ ] **Step 3: Add `accountQueueEnds` to the character-skills repo**

Append to `src/lib/db/character-skills.ts`:

```ts
export interface AccountQueueEnd { characterId: number; name: string; endsAt: Date }

/**
 * When each of this character's account-mates stops training (spec §5's one-trainer-per-account
 * rule). `characters.account_id` is nullable and SQL's NULL never equals NULL, so an unassigned
 * character simply has no mates and gets an empty list — which is the right answer, not a bug.
 * A paused queue has no finish_date and contributes nothing.
 */
export async function accountQueueEnds(characterId: number): Promise<AccountQueueEnd[]> {
  const { rows } = await getPool().query<{ characterId: string; name: string; endsAt: Date }>(
    `SELECT other.id AS "characterId", other.name, max(q.finish_date) AS "endsAt"
     FROM characters me
     JOIN characters other ON other.account_id = me.account_id AND other.id <> me.id
     JOIN character_skill_queue q ON q.character_id = other.id
     WHERE me.id = $1 AND me.account_id IS NOT NULL AND q.finish_date IS NOT NULL
     GROUP BY other.id, other.name
     ORDER BY max(q.finish_date) DESC`, [characterId]);
  return rows.map((r) => ({ characterId: Number(r.characterId), name: r.name, endsAt: r.endsAt }));
}
```

- [ ] **Step 4: Extend `src/lib/skills/load.ts`**

Replace the file's contents with (the `loadSkillCatalogue` from Task 4 stays exactly as it was):

```ts
/**
 * The planner's server-side glue. THIS IS THE ONLY MODULE UNDER src/lib/skills THAT TOUCHES
 * POSTGRES — everything else in this directory is pure and isomorphic. A "use client" component
 * must never import it; server components and API routes are its only callers.
 */
import { accountQueueEnds, getAttributes, listSkillQueue, listSkills } from "../db/character-skills.js";
import { listImplants } from "../db/character-clones.js";
import { getCharacter } from "../db/characters.js";
import type { PlanRow } from "../db/skill-plans.js";
import { getAlphaSkills, getTypeAttributes, listPlanSkills } from "../sde/repo.js";
import {
  addAttributes, effectiveAttributes, implantBonuses, isLegalBase, type AttributeSet,
} from "./attributes.js";
import { buildCatalogue, catalogueFrom, type PlanSkill } from "./catalogue.js";
import { expandPlan, type ExpandedEntry } from "./expand.js";
import { currentSpInTraining } from "./sp.js";
import { planTimeline, type Timeline } from "./timeline.js";

/** EVE's displayed baseline: 20 everywhere except charisma at 19. 20*4 + 19 = 99. */
export const DEFAULT_BASE_ATTRIBUTES: AttributeSet =
  { charisma: 19, intelligence: 20, memory: 20, perception: 20, willpower: 20 };

/** Every trainable skill with its rank, attribute pair, prerequisites and Alpha cap. */
export async function loadSkillCatalogue(): Promise<PlanSkill[]> {
  const [rows, alpha] = await Promise.all([listPlanSkills(), getAlphaSkills()]);
  return buildCatalogue(rows, alpha);
}

export interface PlanContext {
  characterId: number; characterName: string;
  base: AttributeSet; implantBonus: AttributeSet; effective: AttributeSet;
  attributesSane: boolean;
  trained: Map<number, number>;
  partialSp: Map<number, number>;
  queued: Map<number, number>;
  queueEndsAt: Date | null;
  bonusRemaps: number | null;
  lastRemapDate: Date | null;
  accruedRemapCooldownDate: Date | null;
  synced: boolean;
}

export async function loadPlanContext(characterId: number): Promise<PlanContext> {
  const now = new Date();
  const [character, attributes, skills, queue, implantIds] = await Promise.all([
    getCharacter(characterId), getAttributes(characterId), listSkills(characterId),
    listSkillQueue(characterId), listImplants(characterId),
  ]);
  const implantAttributes = await Promise.all(implantIds.map((id) => getTypeAttributes(id)));

  const base: AttributeSet = attributes === null ? DEFAULT_BASE_ATTRIBUTES : {
    charisma: attributes.charisma, intelligence: attributes.intelligence, memory: attributes.memory,
    perception: attributes.perception, willpower: attributes.willpower,
  };
  const implantBonus = implantBonuses(implantAttributes);

  const trained = new Map<number, number>();
  const partialSp = new Map<number, number>();
  for (const skill of skills) {
    trained.set(skill.skillId, skill.trainedLevel);
    partialSp.set(skill.skillId, skill.skillpoints);
  }

  const queued = new Map<number, number>();
  let queueEndsAt: Date | null = null;
  for (const entry of queue) {
    const highest = queued.get(entry.skillId) ?? 0;
    if (entry.finishedLevel > highest) queued.set(entry.skillId, entry.finishedLevel);
    if (entry.finishDate !== null && (queueEndsAt === null || entry.finishDate > queueEndsAt)) {
      queueEndsAt = entry.finishDate;
    }
  }
  // ESI's /skills is stale until the character logs in, so the head entry's own dates give a
  // fresher SP figure for the skill it is training (EVEMon QueuedSkill.CurrentSP).
  const head = queue.find((q) => q.queuePosition === 0);
  if (head !== undefined) {
    const live = currentSpInTraining(head, now);
    if (live !== null && live > (partialSp.get(head.skillId) ?? 0)) partialSp.set(head.skillId, live);
  }

  return {
    characterId,
    characterName: character?.name ?? `Character ${characterId}`,
    base, implantBonus, effective: effectiveAttributes(base, implantAttributes),
    // Decision 4: spec §2 says the stored values exclude implants. Report a reading that cannot be
    // a legal base — never silently subtract, because that would hide the real problem.
    attributesSane: attributes === null || isLegalBase(base),
    trained, partialSp, queued, queueEndsAt,
    bonusRemaps: attributes?.bonusRemaps ?? null,
    lastRemapDate: attributes?.lastRemapDate ?? null,
    accruedRemapCooldownDate: attributes?.accruedRemapCooldownDate ?? null,
    synced: skills.length > 0,
  };
}

export interface AccountBlock { characterId: number; name: string; until: Date }

/** Spec §5: "Jorin Hale is training until <date> — this plan can't start before then". */
export async function accountTrainingBlock(
  characterId: number, now: Date = new Date(),
): Promise<AccountBlock | null> {
  const ends = await accountQueueEnds(characterId);
  const blocking = ends.filter((e) => e.endsAt.getTime() > now.getTime());
  if (blocking.length === 0) return null;
  const latest = blocking.reduce((a, b) => (b.endsAt > a.endsAt ? b : a));
  return { characterId: latest.characterId, name: latest.name, until: latest.endsAt };
}

export interface ComputeOptions { afterQueue?: boolean; remap?: AttributeSet | null; now?: Date }
export interface ComputedPlan {
  plan: PlanRow; context: PlanContext; catalogue: PlanSkill[];
  entries: ExpandedEntry[]; timeline: Timeline;
  attributes: AttributeSet;
  startAt: Date;
}

/**
 * The one place a plan turns into numbers. Spec §6: the server computes the timeline so the page
 * and the client agree — the editor recomputes locally only for instant feedback while editing,
 * using the very same pure functions on the very same catalogue.
 */
export async function computePlan(plan: PlanRow, opts: ComputeOptions = {}): Promise<ComputedPlan> {
  const now = opts.now ?? new Date();
  const [catalogue, context] = await Promise.all([
    loadSkillCatalogue(), loadPlanContext(plan.characterId),
  ]);
  const index = catalogueFrom(catalogue);

  const remap = opts.remap === undefined ? plan.remap : opts.remap;
  const attributes = addAttributes(remap ?? context.base, context.implantBonus);

  // A prerequisite level the queue will deliver counts as "will have" (spec §2).
  const known = new Map(context.trained);
  for (const [skillId, level] of context.queued) {
    if ((known.get(skillId) ?? 0) < level) known.set(skillId, level);
  }
  const entries = expandPlan(plan.entries, known, index);

  const startAt = opts.afterQueue === true && context.queueEndsAt !== null
    && context.queueEndsAt.getTime() > now.getTime()
    ? context.queueEndsAt
    : now;

  const timeline = planTimeline({
    entries, catalogue: index, attributes,
    trained: context.trained, queued: context.queued, partialSp: context.partialSp, startAt,
  });
  return { plan, context, catalogue, entries, timeline, attributes, startAt };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/db/skills-load.test.ts`
Expected: PASS. The `2026-09-09T17:46:40.000Z` figure is 409,600,000 ms after
`2026-09-05T00:00:00Z`: 409,600,000 ms = 4 d 17 h 46 m 40 s.

- [ ] **Step 6: Run the whole suite and the type check**

```bash
npm test && npm run typecheck
```
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/skills/load.ts src/lib/db/character-skills.ts tests/db/skills-load.test.ts
git commit -m "$(cat <<'EOM'
Add the plan context, the account rule and computePlan

loadPlanContext turns the synced attributes, implants, skill sheet and queue into
the pure functions' inputs, flagging attributes that cannot be a legal base rather
than guessing. computePlan is the single place a stored plan becomes numbers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 11: `/api/skill-plans` and `/api/skill-plans/[id]`

Spec §6's first two lines, plus the body validation they need.

**Files:**
- Create: `src/lib/skills/parse.ts`, `src/app/api/skill-plans/route.ts`,
  `src/app/api/skill-plans/[id]/route.ts`, `tests/skills/parse.test.ts`,
  `tests/api/skill-plans-routes.test.ts`
- Modify: `src/lib/skills/load.ts` (adds `summarisePlans`)

**Interfaces:**
- Consumes (Tasks 3, 9, 10 and phase 1/5):
```ts
// src/lib/api/json.ts
export function parseId(raw: string): number | null;
// src/lib/db/skill-plans.ts
export async function listPlans(characterId: number): Promise<PlanRow[]>;
export async function getPlan(id: number): Promise<PlanRow | null>;
export async function createPlan(input: PlanInput): Promise<PlanRow>;
export async function updatePlan(id: number, patch: PlanPatch): Promise<PlanRow | null>;
export async function deletePlan(id: number): Promise<boolean>;
// src/lib/db/characters.ts
export async function getCharacter(id: number): Promise<Character | null>;
// src/lib/sde/repo.ts
export async function getCareerPlan(id: number): Promise<SdeCareerPlan | null>;
// src/lib/skills/load.ts
export async function computePlan(plan: PlanRow, opts?: ComputeOptions): Promise<ComputedPlan>;
// src/lib/skills/attributes.ts
export function isLegalBase(base: AttributeSet): boolean;
export const ATTRIBUTE_KEYS: readonly AttributeKey[];
// src/lib/skills/sp.ts
export const MAX_SKILL_LEVEL = 5;
```
- Produces:
```ts
// src/lib/skills/parse.ts — pure
export const MAX_PLAN_ENTRIES = 500;
export const MAX_PLAN_NAME = 60;
export const MAX_PLAN_NOTE = 200;
export const MAX_IMPORT_CHARS = 40_000;
export function clampPlanName(raw: string): string;
export function parsePlanEntries(raw: unknown): PlanEntry[] | null;
export function parseRemap(raw: unknown): AttributeSet | null | undefined;   // undefined = reject
export interface PlanCreateBody { characterId: number; name: string; entries: PlanEntry[]; templateId: number | null }
export interface PlanPatchBody { name?: string; remap?: AttributeSet | null; entries?: PlanEntry[] }
export interface PlanImportBody { characterId: number; name: string; text: string }
export function parsePlanCreate(body: unknown): PlanCreateBody | null;
export function parsePlanPatch(body: unknown): PlanPatchBody | null;
export function parsePlanImport(body: unknown): PlanImportBody | null;
// src/lib/skills/load.ts (added)
export interface PlanSummary {
  id: number; characterId: number; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
  entryCount: number; totalSp: number; totalMs: number; doneAt: Date;
}
export async function summarisePlans(plans: readonly PlanRow[], opts?: ComputeOptions): Promise<PlanSummary[]>;
```

**Response shapes (this is the contract the editor and the pages code against):**
```ts
GET  /api/skill-plans?characterId=90000101  → 200 { plans: PlanSummary[] }
POST /api/skill-plans                        → 201 { plan: PlanRow }
GET  /api/skill-plans/7?afterQueue=1         → 200 { plan: PlanRow, timeline: Timeline, startAt: string }
PUT  /api/skill-plans/7                      → 200 { plan: PlanRow, timeline: Timeline, startAt: string }
DELETE /api/skill-plans/7                    → 204 (no body)
```

**Decisions recorded here (do not re-litigate them):**
- `PUT` replaces entries **wholesale and re-expands server-side** (spec §6): the stored rows are
  what the client sent, and the response's `timeline` is the re-expanded, re-priced version. The
  client therefore never has to send prerequisites, and never has to guess whether the server
  inserted any.
- **`characterId` is not patchable.** It is set at creation and validated against `getCharacter`;
  a `PUT` carrying one is a 400, not a silent no-op, so a UI bug surfaces immediately.
- `templateId` and `entries` are mutually exclusive; supplying both is a 400. A `templateId` the
  SDE does not have is a **404**, not a 400 — the id is well-formed, the row is missing.
- A remap must be a **legal base** (`isLegalBase`) or the body is rejected. An explicit `null`
  clears it. This is the only place remap legality is enforced, so the repo can stay dumb.
- `MAX_PLAN_ENTRIES = 500` bounds the *stored* entries. Expansion can legitimately produce more
  rows than that (a 500-entry plan of level-V skills expands to thousands), and that is fine —
  the cap is on what a client may post, not on what the maths may produce.
- The list route is `?characterId=`-scoped and **required**: there is no "all plans" view, and a
  missing or malformed `characterId` is a 400.

- [ ] **Step 1: Write the failing parser test**

Create `tests/skills/parse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_IMPORT_CHARS, MAX_PLAN_ENTRIES, MAX_PLAN_NAME, clampPlanName, parsePlanCreate,
  parsePlanEntries, parsePlanImport, parsePlanPatch, parseRemap,
} from "../../src/lib/skills/parse.js";

const REMAP = { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 };

describe("parsePlanEntries", () => {
  it("accepts skill ids with levels 1..5 and defaults the note", () => {
    expect(parsePlanEntries([{ skillId: 3300, level: 5 }, { skillId: 3318, level: 1, note: "why" }]))
      .toEqual([{ skillId: 3300, level: 5, note: null }, { skillId: 3318, level: 1, note: "why" }]);
    expect(parsePlanEntries([])).toEqual([]);
  });
  it("rejects bad ids, bad levels, long notes, non-arrays and over-long lists", () => {
    expect(parsePlanEntries([{ skillId: 0, level: 1 }])).toBeNull();
    expect(parsePlanEntries([{ skillId: 3300, level: 0 }])).toBeNull();
    expect(parsePlanEntries([{ skillId: 3300, level: 6 }])).toBeNull();
    expect(parsePlanEntries([{ skillId: 3300, level: 1, note: "x".repeat(201) }])).toBeNull();
    expect(parsePlanEntries("nope")).toBeNull();
    expect(parsePlanEntries(Array.from({ length: MAX_PLAN_ENTRIES + 1 }, () => ({ skillId: 3300, level: 1 })))).toBeNull();
  });
});

describe("parseRemap", () => {
  it("accepts a legal base and an explicit null", () => {
    expect(parseRemap(REMAP)).toEqual(REMAP);
    expect(parseRemap(null)).toBeNull();
  });
  it("rejects an illegal or incomplete distribution", () => {
    expect(parseRemap({ ...REMAP, perception: 28, willpower: 20 })).toBeUndefined();
    expect(parseRemap({ ...REMAP, charisma: 18 })).toBeUndefined();     // sums to 100
    expect(parseRemap({ charisma: 17, intelligence: 17 })).toBeUndefined();
    expect(parseRemap("nope")).toBeUndefined();
  });
});

describe("parsePlanCreate", () => {
  it("requires a character and a name, and defaults the rest", () => {
    expect(parsePlanCreate({ characterId: 90000101, name: " Gunnery " }))
      .toEqual({ characterId: 90000101, name: "Gunnery", entries: [], templateId: null });
  });
  it("takes entries or a template, never both", () => {
    expect(parsePlanCreate({ characterId: 1, name: "x", entries: [{ skillId: 3300, level: 1 }] }))
      .toMatchObject({ entries: [{ skillId: 3300, level: 1, note: null }], templateId: null });
    expect(parsePlanCreate({ characterId: 1, name: "x", templateId: 4 })).toMatchObject({ templateId: 4 });
    expect(parsePlanCreate({ characterId: 1, name: "x", templateId: 4, entries: [] })).toBeNull();
  });
  it("rejects a missing character, an empty or over-long name and a bad template id", () => {
    expect(parsePlanCreate({ name: "x" })).toBeNull();
    expect(parsePlanCreate({ characterId: 1, name: "   " })).toBeNull();
    expect(parsePlanCreate({ characterId: 1, name: "x".repeat(MAX_PLAN_NAME + 1) })).toBeNull();
    expect(parsePlanCreate({ characterId: 1, name: "x", templateId: 0 })).toBeNull();
    expect(parsePlanCreate(null)).toBeNull();
  });
});

describe("parsePlanPatch", () => {
  it("takes any subset and distinguishes an absent key from an explicit null", () => {
    expect(parsePlanPatch({ name: "Renamed" })).toEqual({ name: "Renamed" });
    expect(parsePlanPatch({ remap: null })).toEqual({ remap: null });
    expect(parsePlanPatch({ remap: REMAP })).toEqual({ remap: REMAP });
    expect(parsePlanPatch({ entries: [] })).toEqual({ entries: [] });
    expect(parsePlanPatch({})).toEqual({});
  });
  it("rejects a character id and any malformed field", () => {
    expect(parsePlanPatch({ characterId: 1 })).toBeNull();
    expect(parsePlanPatch({ name: "" })).toBeNull();
    expect(parsePlanPatch({ remap: { charisma: 1 } })).toBeNull();
    expect(parsePlanPatch({ entries: [{ skillId: 3300, level: 9 }] })).toBeNull();
    expect(parsePlanPatch([])).toBeNull();
  });
});

describe("parsePlanImport / clampPlanName", () => {
  it("requires a character, a name and some text", () => {
    expect(parsePlanImport({ characterId: 1, name: "Pasted", text: "Gunnery V\n" }))
      .toEqual({ characterId: 1, name: "Pasted", text: "Gunnery V\n" });
    expect(parsePlanImport({ characterId: 1, name: "Pasted", text: "" })).toBeNull();
    expect(parsePlanImport({ characterId: 1, name: "Pasted", text: "x".repeat(MAX_IMPORT_CHARS + 1) })).toBeNull();
  });
  it("cleans a generated name instead of rejecting it", () => {
    expect(clampPlanName("  Minmatar Militia Fighter\n ")).toBe("Minmatar Militia Fighter");
    expect(clampPlanName("x".repeat(MAX_PLAN_NAME + 20))).toHaveLength(MAX_PLAN_NAME);
    expect(clampPlanName("   ")).toBe("Unnamed plan");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills/parse.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/skills/parse.js`.

- [ ] **Step 3: Write the parser**

Create `src/lib/skills/parse.ts`:

```ts
/**
 * Request-body validation for the plan routes, as pure functions so the rules are unit-tested
 * rather than smoke-tested through a route. `null` always means "answer 400".
 */
import { ATTRIBUTE_KEYS, isLegalBase, type AttributeSet } from "./attributes.js";
import type { PlanEntry } from "./expand.js";
import { MAX_SKILL_LEVEL } from "./sp.js";

export const MAX_PLAN_ENTRIES = 500;
export const MAX_PLAN_NAME = 60;
export const MAX_PLAN_NOTE = 200;
export const MAX_IMPORT_CHARS = 40_000;

const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const field = (body: unknown, key: string): unknown =>
  body !== null && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
const has = (body: unknown, key: string): boolean =>
  body !== null && typeof body === "object" && key in (body as Record<string, unknown>);
const isObject = (body: unknown): boolean =>
  body !== null && typeof body === "object" && !Array.isArray(body);

function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_PLAN_NAME ? name : null;
}

/** For names the app generates (a template's name, "<name> copy", an import's default). */
export function clampPlanName(raw: string): string {
  const cleaned = raw.replace(/[\n\r]/g, " ").trim().slice(0, MAX_PLAN_NAME).trim();
  return cleaned.length > 0 ? cleaned : "Unnamed plan";
}

export function parsePlanEntries(raw: unknown): PlanEntry[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PLAN_ENTRIES) return null;
  const out: PlanEntry[] = [];
  for (const item of raw) {
    const skillId = field(item, "skillId");
    const level = field(item, "level");
    if (!isPositiveInt(skillId)) return null;
    if (!isPositiveInt(level) || level > MAX_SKILL_LEVEL) return null;
    const rawNote = field(item, "note");
    if (rawNote !== undefined && rawNote !== null
        && (typeof rawNote !== "string" || rawNote.length > MAX_PLAN_NOTE)) return null;
    out.push({ skillId, level, note: typeof rawNote === "string" ? rawNote : null });
  }
  return out;
}

/**
 * `undefined` means "reject the whole body"; `null` means "clear the remap". A remap must be a
 * legal base — five integers in 17..27 summing to 99 — because nothing downstream re-checks it.
 */
export function parseRemap(raw: unknown): AttributeSet | null | undefined {
  if (raw === null) return null;
  if (!isObject(raw)) return undefined;
  const out = {} as AttributeSet;
  for (const key of ATTRIBUTE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
    out[key] = value;
  }
  return isLegalBase(out) ? out : undefined;
}

export interface PlanCreateBody {
  characterId: number; name: string; entries: PlanEntry[]; templateId: number | null;
}

export function parsePlanCreate(body: unknown): PlanCreateBody | null {
  const characterId = field(body, "characterId");
  const name = parseName(field(body, "name"));
  if (!isPositiveInt(characterId) || name === null) return null;

  const rawTemplate = field(body, "templateId");
  const templateId = rawTemplate === undefined || rawTemplate === null ? null : rawTemplate;
  if (templateId !== null && !isPositiveInt(templateId)) return null;

  const rawEntries = field(body, "entries");
  // Spec §6 offers entries OR a template; asking for both is a bug in the caller, not a merge.
  if (templateId !== null && rawEntries !== undefined) return null;
  const entries = rawEntries === undefined ? [] : parsePlanEntries(rawEntries);
  if (entries === null) return null;

  return { characterId, name, entries, templateId };
}

export interface PlanPatchBody { name?: string; remap?: AttributeSet | null; entries?: PlanEntry[] }

export function parsePlanPatch(body: unknown): PlanPatchBody | null {
  if (!isObject(body)) return null;
  // A plan belongs to one character for life (Task 9); moving it is not a patch, it is a new plan.
  if (has(body, "characterId")) return null;
  const patch: PlanPatchBody = {};
  if (has(body, "name")) {
    const name = parseName(field(body, "name"));
    if (name === null) return null;
    patch.name = name;
  }
  if (has(body, "remap")) {
    const remap = parseRemap(field(body, "remap"));
    if (remap === undefined) return null;
    patch.remap = remap;
  }
  if (has(body, "entries")) {
    const entries = parsePlanEntries(field(body, "entries"));
    if (entries === null) return null;
    patch.entries = entries;
  }
  return patch;
}

export interface PlanImportBody { characterId: number; name: string; text: string }

export function parsePlanImport(body: unknown): PlanImportBody | null {
  const characterId = field(body, "characterId");
  const name = parseName(field(body, "name"));
  const text = field(body, "text");
  if (!isPositiveInt(characterId) || name === null) return null;
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_IMPORT_CHARS) return null;
  return { characterId, name, text };
}
```

- [ ] **Step 4: Run the parser test to verify it passes**

Run: `npx vitest run tests/skills/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route test**

Create `tests/api/skill-plans-routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { listPlans, getPlan, createPlan, updatePlan, deletePlan } = vi.hoisted(() => ({
  listPlans: vi.fn(), getPlan: vi.fn(), createPlan: vi.fn(), updatePlan: vi.fn(), deletePlan: vi.fn(),
}));
const { getCharacter } = vi.hoisted(() => ({ getCharacter: vi.fn() }));
const { getCareerPlan } = vi.hoisted(() => ({ getCareerPlan: vi.fn() }));
const { computePlan, summarisePlans } = vi.hoisted(() => ({ computePlan: vi.fn(), summarisePlans: vi.fn() }));

vi.mock("../../src/lib/db/skill-plans.js", () => ({ listPlans, getPlan, createPlan, updatePlan, deletePlan }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/sde/repo.js", () => ({ getCareerPlan }));
vi.mock("../../src/lib/skills/load.js", () => ({ computePlan, summarisePlans }));

const { GET: LIST, POST } = await import("../../src/app/api/skill-plans/route.js");
const { GET: ONE, PUT, DELETE } = await import("../../src/app/api/skill-plans/[id]/route.js");

const PLAN = {
  id: 7, characterId: 90000101, name: "Gunnery", remap: null,
  createdAt: new Date("2026-09-02T10:00:00Z"), updatedAt: new Date("2026-09-02T10:00:00Z"),
  entries: [{ position: 0, skillId: 3300, level: 3, note: null }],
};
const TIMELINE = { entries: [], totalSp: 8000, totalMs: 15_000_000, doneAt: new Date("2026-09-01T04:10:00Z"), unknownSkillIds: [] };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (url: string) => new NextRequest(`https://eve.plasma66.com${url}`);
const body = (url: string, method: string, value: unknown) =>
  new NextRequest(`https://eve.plasma66.com${url}`,
    { method, body: JSON.stringify(value), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  listPlans.mockResolvedValue([PLAN]);
  summarisePlans.mockResolvedValue([{ ...PLAN, entryCount: 3, totalSp: 8000, totalMs: 15_000_000, doneAt: TIMELINE.doneAt }]);
  getPlan.mockImplementation(async (id: number) => (id === 7 ? PLAN : null));
  createPlan.mockResolvedValue(PLAN);
  updatePlan.mockImplementation(async (id: number) => (id === 7 ? PLAN : null));
  deletePlan.mockImplementation(async (id: number) => id === 7);
  getCharacter.mockImplementation(async (id: number) => (id === 90000101 ? { id, name: "Mara Vexley" } : null));
  getCareerPlan.mockImplementation(async (id: number) =>
    (id === 4 ? { id: 4, name: "Minmatar Militia Fighter", description: "", skills: [{ skillId: 3327, level: 1 }], milestones: [] } : null));
  computePlan.mockResolvedValue({ plan: PLAN, timeline: TIMELINE, startAt: new Date("2026-09-01T00:00:00Z") });
});

describe("GET /api/skill-plans", () => {
  it("lists a character's plans with their totals", async () => {
    const res = await LIST(get("/api/skill-plans?characterId=90000101"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plans: [{ id: 7, entryCount: 3, totalMs: 15_000_000 }] });
    expect(listPlans).toHaveBeenCalledWith(90000101);
  });

  it("400s without a usable characterId", async () => {
    expect((await LIST(get("/api/skill-plans"))).status).toBe(400);
    expect((await LIST(get("/api/skill-plans?characterId=abc"))).status).toBe(400);
    expect((await LIST(get("/api/skill-plans?characterId=0"))).status).toBe(400);
  });
});

describe("POST /api/skill-plans", () => {
  it("creates a plan from entries", async () => {
    const res = await POST(body("/api/skill-plans", "POST",
      { characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 3 }] }));
    expect(res.status).toBe(201);
    expect(createPlan).toHaveBeenCalledWith({
      characterId: 90000101, name: "Gunnery", entries: [{ skillId: 3300, level: 3, note: null }],
    });
  });

  it("creates a plan from a CCP template", async () => {
    const res = await POST(body("/api/skill-plans", "POST",
      { characterId: 90000101, name: "Militia", templateId: 4 }));
    expect(res.status).toBe(201);
    expect(createPlan).toHaveBeenCalledWith({
      characterId: 90000101, name: "Militia", entries: [{ skillId: 3327, level: 1, note: null }],
    });
  });

  it("404s on an unknown character and on an unknown template", async () => {
    expect((await POST(body("/api/skill-plans", "POST", { characterId: 1, name: "x" }))).status).toBe(404);
    expect((await POST(body("/api/skill-plans", "POST", { characterId: 90000101, name: "x", templateId: 99 }))).status).toBe(404);
  });

  it("400s on a malformed body", async () => {
    expect((await POST(body("/api/skill-plans", "POST", { name: "x" }))).status).toBe(400);
    expect((await POST(body("/api/skill-plans", "POST", { characterId: 90000101, name: "x", templateId: 4, entries: [] }))).status).toBe(400);
  });
});

describe("GET /api/skill-plans/[id]", () => {
  it("returns the plan with its computed timeline", async () => {
    const res = await ONE(get("/api/skill-plans/7"), ctx("7"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plan: { id: 7 }, timeline: { totalMs: 15_000_000 } });
    expect(computePlan).toHaveBeenCalledWith(PLAN, { afterQueue: false });
  });

  it("passes afterQueue through", async () => {
    await ONE(get("/api/skill-plans/7?afterQueue=1"), ctx("7"));
    expect(computePlan).toHaveBeenCalledWith(PLAN, { afterQueue: true });
  });

  it("400s on a bad id and 404s on an unknown one", async () => {
    expect((await ONE(get("/api/skill-plans/x"), ctx("x"))).status).toBe(400);
    expect((await ONE(get("/api/skill-plans/8"), ctx("8"))).status).toBe(404);
  });
});

describe("PUT /api/skill-plans/[id]", () => {
  it("replaces the entries and answers with the re-expanded timeline", async () => {
    const res = await PUT(body("/api/skill-plans/7", "PUT", { entries: [{ skillId: 3300, level: 5 }] }), ctx("7"));
    expect(res.status).toBe(200);
    expect(updatePlan).toHaveBeenCalledWith(7, { entries: [{ skillId: 3300, level: 5, note: null }] });
    expect(await res.json()).toMatchObject({ timeline: { totalMs: 15_000_000 } });
  });

  it("400s on a body carrying characterId, 404s on an unknown plan", async () => {
    expect((await PUT(body("/api/skill-plans/7", "PUT", { characterId: 1 }), ctx("7"))).status).toBe(400);
    expect((await PUT(body("/api/skill-plans/8", "PUT", { name: "x" }), ctx("8"))).status).toBe(404);
  });
});

describe("DELETE /api/skill-plans/[id]", () => {
  it("answers 204, and 404 for an unknown plan", async () => {
    expect((await DELETE(get("/api/skill-plans/7"), ctx("7"))).status).toBe(204);
    expect((await DELETE(get("/api/skill-plans/8"), ctx("8"))).status).toBe(404);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/api/skill-plans-routes.test.ts`
Expected: FAIL — cannot resolve `../../src/app/api/skill-plans/route.js`.

- [ ] **Step 7: Add `summarisePlans` to the loader**

Append to `src/lib/skills/load.ts` (and add `PlanEntryRow` to the existing
`import type { PlanRow } …` line so it reads
`import type { PlanEntryRow, PlanRow } from "../db/skill-plans.js";`):

```ts
export interface PlanSummary {
  id: number; characterId: number; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
  entryCount: number; totalSp: number; totalMs: number; doneAt: Date;
}

/**
 * The `/skills` Plans section and `GET /api/skill-plans`. Every plan in a list belongs to the same
 * character, so the catalogue and the context are read ONCE rather than once per plan.
 */
export async function summarisePlans(
  plans: readonly PlanRow[], opts: ComputeOptions = {},
): Promise<PlanSummary[]> {
  if (plans.length === 0) return [];
  const now = opts.now ?? new Date();
  const [catalogue, context] = await Promise.all([
    loadSkillCatalogue(), loadPlanContext(plans[0].characterId),
  ]);
  const index = catalogueFrom(catalogue);
  const known = new Map(context.trained);
  for (const [skillId, level] of context.queued) {
    if ((known.get(skillId) ?? 0) < level) known.set(skillId, level);
  }
  const startAt = opts.afterQueue === true && context.queueEndsAt !== null
    && context.queueEndsAt.getTime() > now.getTime() ? context.queueEndsAt : now;

  return plans.map((plan) => {
    const attributes = addAttributes(
      (opts.remap === undefined ? plan.remap : opts.remap) ?? context.base, context.implantBonus);
    const entries = expandPlan(plan.entries, known, index);
    const timeline = planTimeline({
      entries, catalogue: index, attributes,
      trained: context.trained, queued: context.queued, partialSp: context.partialSp, startAt,
    });
    return {
      id: plan.id, characterId: plan.characterId, name: plan.name, remap: plan.remap,
      createdAt: plan.createdAt, updatedAt: plan.updatedAt, entries: plan.entries,
      entryCount: entries.length, totalSp: timeline.totalSp, totalMs: timeline.totalMs,
      doneAt: timeline.doneAt,
    };
  });
}
```

- [ ] **Step 8: Write the two routes**

Create `src/app/api/skill-plans/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createPlan, listPlans } from "../../../lib/db/skill-plans.js";
import { getCharacter } from "../../../lib/db/characters.js";
import { getCareerPlan } from "../../../lib/sde/repo.js";
import { summarisePlans } from "../../../lib/skills/load.js";
import { parsePlanCreate } from "../../../lib/skills/parse.js";

const bad = () => NextResponse.json({ error: "bad request" }, { status: 400 });
const missing = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** Spec §6: the plan list is always scoped to one character. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("characterId");
  const characterId = raw === null ? NaN : Number(raw);
  if (!Number.isInteger(characterId) || characterId <= 0) return bad();
  const plans = await listPlans(characterId);
  return NextResponse.json({ plans: await summarisePlans(plans) });
}

export async function POST(req: NextRequest) {
  const input = parsePlanCreate(await req.json().catch(() => null));
  if (input === null) return bad();
  if ((await getCharacter(input.characterId)) === null) return missing();

  let entries = input.entries;
  if (input.templateId !== null) {
    const template = await getCareerPlan(input.templateId);
    if (template === null) return missing();
    entries = template.skills.map((s) => ({ skillId: s.skillId, level: s.level, note: null }));
  }
  const plan = await createPlan({ characterId: input.characterId, name: input.name, entries });
  return NextResponse.json({ plan }, { status: 201 });
}
```

Create `src/app/api/skill-plans/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../lib/api/json.js";
import { deletePlan, getPlan, updatePlan } from "../../../../lib/db/skill-plans.js";
import { computePlan } from "../../../../lib/skills/load.js";
import { parsePlanPatch } from "../../../../lib/skills/parse.js";

type Ctx = { params: Promise<{ id: string }> };

const bad = () => NextResponse.json({ error: "bad request" }, { status: 400 });
const missing = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** "1" and "true" both switch the timeline's start to the end of the ESI queue (spec §5). */
function afterQueueFlag(req: NextRequest): boolean {
  const raw = req.nextUrl.searchParams.get("afterQueue");
  return raw === "1" || raw === "true";
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return bad();
  const plan = await getPlan(id);
  if (plan === null) return missing();
  const computed = await computePlan(plan, { afterQueue: afterQueueFlag(req) });
  return NextResponse.json({ plan, timeline: computed.timeline, startAt: computed.startAt });
}

/** Spec §6: entries are replaced wholesale, then re-expanded server-side for the response. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return bad();
  const patch = parsePlanPatch(await req.json().catch(() => null));
  if (patch === null) return bad();
  const plan = await updatePlan(id, patch);
  if (plan === null) return missing();
  const computed = await computePlan(plan, { afterQueue: afterQueueFlag(req) });
  return NextResponse.json({ plan, timeline: computed.timeline, startAt: computed.startAt });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return bad();
  if (!(await deletePlan(id))) return missing();
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 9: Run the route test to verify it passes**

Run: `npx vitest run tests/api/skill-plans-routes.test.ts`
Expected: PASS.

- [ ] **Step 10: Run the whole suite and the type check**

```bash
npm test && npm run typecheck
```
Expected: green.

- [ ] **Step 11: Commit**

```bash
git add src/lib/skills/parse.ts src/lib/skills/load.ts \
  src/app/api/skill-plans/route.ts "src/app/api/skill-plans/[id]/route.ts" \
  tests/skills/parse.test.ts tests/api/skill-plans-routes.test.ts
git commit -m "$(cat <<'EOM'
Add the skill-plan CRUD routes

List is character-scoped and carries each plan's remaining SP, time and done-at;
create takes entries or a CCP template; PUT replaces the entries wholesale and
answers with the re-expanded, re-priced timeline so the client never guesses.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 12: `optimise`, `import` and `export` routes

Spec §6's remaining three lines.

**Files:**
- Create: `src/app/api/skill-plans/[id]/optimise/route.ts`,
  `src/app/api/skill-plans/import/route.ts`, `src/app/api/skill-plans/[id]/export/route.ts`,
  `tests/api/skill-plans-extra-routes.test.ts`

**Interfaces:**
- Consumes (Tasks 4, 7, 8, 10, 11):
```ts
// src/lib/skills/load.ts
export async function loadSkillCatalogue(): Promise<PlanSkill[]>;
export async function computePlan(plan: PlanRow, opts?: ComputeOptions): Promise<ComputedPlan>;
export interface ComputedPlan { plan: PlanRow; context: PlanContext; catalogue: PlanSkill[];
                                entries: ExpandedEntry[]; timeline: Timeline;
                                attributes: AttributeSet; startAt: Date }
// src/lib/skills/remap.ts
export function optimalRemap(input: RemapInput): RemapResult;
// src/lib/skills/text.ts
export function planTextNames(text: string): string[];
export function tokenisePlanText(text: string): PlanTextLine[];
export function resolvePlanLines(lines: readonly PlanTextLine[], byName: ReadonlyMap<string, number>): ParsedPlanText;
export function exportPlanText(entries, catalogue: SkillCatalogue, format: PlanTextFormat): string;
export function isPlanTextFormat(value: unknown): value is PlanTextFormat;
// src/lib/skills/catalogue.ts
export function catalogueFrom(skills: readonly PlanSkill[]): SkillCatalogue;
// src/lib/skills/parse.ts
export function parsePlanImport(body: unknown): PlanImportBody | null;
export const MAX_PLAN_ENTRIES = 500;
```
- Produces:
```ts
POST /api/skill-plans/7/optimise   → 200 { remap: AttributeSet, totalMs: number, currentMs: number,
                                           savedMs: number, candidates: number }
POST /api/skill-plans/import       → 201 { plan: PlanRow, unresolved: string[] }
GET  /api/skill-plans/7/export?format=evemon → 200 text/plain
```

**Decisions recorded here (do not re-litigate them):**
- **Import resolves names against the skill catalogue, not `getTypesByNames`.** Matching every SDE
  type by name would let "200mm AutoCannon II" become a plan entry. The catalogue is already
  category-16-only, and the route needs it anyway.
- More resolved lines than `MAX_PLAN_ENTRIES` are **not** silently truncated: the first 500 are
  stored and the overflow is reported as one extra `unresolved` line,
  `"… and N more lines (a plan holds at most 500 entries)"`. Losing lines quietly is worse than
  saying so.
- `optimise` is a **POST** (spec §6) even though it writes nothing: it is an expensive computation
  with no cacheable identity, and `POST` keeps it off any intermediary's GET cache. It does **not**
  save the remap — the client decides whether to `PUT` it.
- `optimise` optimises against the plan's expanded entries **as they stand**, honouring the queue
  overlay: levels the queue will deliver are not part of what a remap could speed up.
- **Export writes the expanded plan minus its `done` entries.** Prerequisites are included (they
  are real training), queued entries are included (they are still ahead of the character), and
  levels already trained are not — pasting those back into the client is noise.
- The export's default format is `evemon`; an unrecognised `format` is a **400**, not a silent
  fallback. The response carries `Cache-Control: no-store` because a plan changes constantly.

- [ ] **Step 1: Write the failing test**

Create `tests/api/skill-plans-extra-routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getPlan, createPlan } = vi.hoisted(() => ({ getPlan: vi.fn(), createPlan: vi.fn() }));
const { getCharacter } = vi.hoisted(() => ({ getCharacter: vi.fn() }));
const { computePlan, loadSkillCatalogue } = vi.hoisted(() => ({ computePlan: vi.fn(), loadSkillCatalogue: vi.fn() }));

vi.mock("../../src/lib/db/skill-plans.js", () => ({ getPlan, createPlan }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/skills/load.js", () => ({ computePlan, loadSkillCatalogue }));

const { POST: OPTIMISE } = await import("../../src/app/api/skill-plans/[id]/optimise/route.js");
const { POST: IMPORT } = await import("../../src/app/api/skill-plans/import/route.js");
const { GET: EXPORT } = await import("../../src/app/api/skill-plans/[id]/export/route.js");

const SKILLS = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
];
const PLAN = {
  id: 7, characterId: 90000101, name: "Gunnery", remap: null,
  createdAt: new Date("2026-09-02T10:00:00Z"), updatedAt: new Date("2026-09-02T10:00:00Z"),
  entries: [{ position: 0, skillId: 3300, level: 3, note: null }],
};
const EXPANDED = [
  { skillId: 3300, level: 1, note: null, prereq: true },
  { skillId: 3300, level: 2, note: null, prereq: true },
  { skillId: 3300, level: 3, note: null, prereq: false },
];
const CONTEXT = {
  base: { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 },
  implantBonus: { charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 },
  trained: new Map([[3300, 1]]), queued: new Map<number, number>(), partialSp: new Map<number, number>(),
};

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (url: string) => new NextRequest(`https://eve.plasma66.com${url}`);
const post = (url: string, value: unknown) =>
  new NextRequest(`https://eve.plasma66.com${url}`,
    { method: "POST", body: JSON.stringify(value), headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  getPlan.mockImplementation(async (id: number) => (id === 7 ? PLAN : null));
  createPlan.mockImplementation(async (input: { entries: unknown[] }) => ({ ...PLAN, id: 9, entries: input.entries }));
  getCharacter.mockImplementation(async (id: number) => (id === 90000101 ? { id, name: "Mara Vexley" } : null));
  loadSkillCatalogue.mockResolvedValue(SKILLS);
  computePlan.mockResolvedValue({
    plan: PLAN, context: CONTEXT, catalogue: SKILLS, entries: EXPANDED,
    timeline: {
      entries: EXPANDED.map((e, i) => ({ ...e, status: i === 0 ? "done" : "planned" })),
      totalSp: 7750, totalMs: 14_531_250, doneAt: new Date("2026-09-01T04:02:11Z"), unknownSkillIds: [],
    },
    attributes: CONTEXT.base, startAt: new Date("2026-09-01T00:00:00Z"),
  });
});

describe("POST /api/skill-plans/[id]/optimise", () => {
  it("returns the best legal remap and what it saves", async () => {
    const res = await OPTIMISE(post("/api/skill-plans/7/optimise", {}), ctx("7"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Gunnery is perception/willpower, so the optimum is perception 27 / willpower 21.
    expect(json.remap).toEqual({ charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 });
    expect(json.candidates).toBe(2885);
    expect(json.savedMs).toBeGreaterThan(0);
    expect(json.totalMs).toBeLessThan(json.currentMs);
  });

  it("400s on a bad id and 404s on an unknown plan", async () => {
    expect((await OPTIMISE(post("/api/skill-plans/x/optimise", {}), ctx("x"))).status).toBe(400);
    expect((await OPTIMISE(post("/api/skill-plans/8/optimise", {}), ctx("8"))).status).toBe(404);
  });
});

describe("POST /api/skill-plans/import", () => {
  it("creates a plan from pasted text and reports what did not resolve", async () => {
    const res = await IMPORT(post("/api/skill-plans/import", {
      characterId: 90000101, name: "Pasted",
      text: "Gunnery V\nSpaceship Command 1\n200mm AutoCannon II\n",
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.plan.entries).toEqual([
      { skillId: 3300, level: 5, note: null }, { skillId: 3327, level: 1, note: null },
    ]);
    expect(json.unresolved).toEqual(["200mm AutoCannon II"]);
  });

  it("reports the overflow instead of silently dropping it", async () => {
    const text = `${Array.from({ length: 505 }, () => "Gunnery 1").join("\n")}\n`;
    const res = await IMPORT(post("/api/skill-plans/import", { characterId: 90000101, name: "Big", text }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.plan.entries).toHaveLength(500);
    expect(json.unresolved).toEqual(["… and 5 more lines (a plan holds at most 500 entries)"]);
  });

  it("400s on a malformed body and 404s on an unknown character", async () => {
    expect((await IMPORT(post("/api/skill-plans/import", { characterId: 90000101, name: "x", text: "" }))).status).toBe(400);
    expect((await IMPORT(post("/api/skill-plans/import", { characterId: 1, name: "x", text: "Gunnery V" }))).status).toBe(404);
  });
});

describe("GET /api/skill-plans/[id]/export", () => {
  it("writes EVEMon text by default, skipping levels already trained", async () => {
    const res = await EXPORT(get("/api/skill-plans/7/export"), ctx("7"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("Gunnery II\nGunnery III\n");
  });

  it("writes the in-game flavour when asked", async () => {
    const res = await EXPORT(get("/api/skill-plans/7/export?format=ingame"), ctx("7"));
    expect(await res.text()).toBe("Gunnery 2\nGunnery 3\n");
  });

  it("400s on an unknown format and 404s on an unknown plan", async () => {
    expect((await EXPORT(get("/api/skill-plans/7/export?format=eft"), ctx("7"))).status).toBe(400);
    expect((await EXPORT(get("/api/skill-plans/8/export"), ctx("8"))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/api/skill-plans-extra-routes.test.ts`
Expected: FAIL — cannot resolve the three route modules.

- [ ] **Step 3: Write the optimise route**

Create `src/app/api/skill-plans/[id]/optimise/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../../lib/api/json.js";
import { getPlan } from "../../../../../lib/db/skill-plans.js";
import { catalogueFrom } from "../../../../../lib/skills/catalogue.js";
import { computePlan } from "../../../../../lib/skills/load.js";
import { optimalRemap } from "../../../../../lib/skills/remap.js";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Spec §6. A POST because it is an expensive pure computation with no cacheable identity — it
 * writes nothing; the client decides whether to PUT the remap it gets back.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const plan = await getPlan(id);
  if (plan === null) return NextResponse.json({ error: "not found" }, { status: 404 });

  const computed = await computePlan(plan);
  const result = optimalRemap({
    entries: computed.entries,
    catalogue: catalogueFrom(computed.catalogue),
    currentBase: computed.context.base,
    implantBonus: computed.context.implantBonus,
    trained: computed.context.trained,
    queued: computed.context.queued,
    partialSp: computed.context.partialSp,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Write the import route**

Create `src/app/api/skill-plans/import/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { createPlan } from "../../../../lib/db/skill-plans.js";
import { loadSkillCatalogue } from "../../../../lib/skills/load.js";
import { MAX_PLAN_ENTRIES, parsePlanImport } from "../../../../lib/skills/parse.js";
import { resolvePlanLines, tokenisePlanText } from "../../../../lib/skills/text.js";

/**
 * Spec §6. Names resolve against the SKILL CATALOGUE, not every SDE type: matching all types by
 * name would happily turn "200mm AutoCannon II" into a plan entry.
 */
export async function POST(req: NextRequest) {
  const input = parsePlanImport(await req.json().catch(() => null));
  if (input === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if ((await getCharacter(input.characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const catalogue = await loadSkillCatalogue();
  const byName = new Map(catalogue.map((s) => [s.name.toLowerCase(), s.id]));
  const parsed = resolvePlanLines(tokenisePlanText(input.text), byName);

  const entries = parsed.entries.slice(0, MAX_PLAN_ENTRIES)
    .map((e) => ({ skillId: e.skillId, level: e.level, note: null }));
  const overflow = parsed.entries.length - entries.length;
  const unresolved = overflow > 0
    ? [...parsed.unresolved, `… and ${overflow} more lines (a plan holds at most ${MAX_PLAN_ENTRIES} entries)`]
    : parsed.unresolved;

  const plan = await createPlan({ characterId: input.characterId, name: input.name, entries });
  return NextResponse.json({ plan, unresolved }, { status: 201 });
}
```

- [ ] **Step 5: Write the export route**

Create `src/app/api/skill-plans/[id]/export/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../../lib/api/json.js";
import { getPlan } from "../../../../../lib/db/skill-plans.js";
import { catalogueFrom } from "../../../../../lib/skills/catalogue.js";
import { computePlan } from "../../../../../lib/skills/load.js";
import { exportPlanText, isPlanTextFormat } from "../../../../../lib/skills/text.js";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Spec §5/§6. The expanded plan minus what the character has already trained: prerequisites are
 * real training and belong in the text, and so does anything the queue has not delivered yet.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const raw = req.nextUrl.searchParams.get("format") ?? "evemon";
  if (!isPlanTextFormat(raw)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const plan = await getPlan(id);
  if (plan === null) return NextResponse.json({ error: "not found" }, { status: 404 });

  const computed = await computePlan(plan);
  const entries = computed.timeline.entries.filter((e) => e.status !== "done");
  const text = exportPlanText(entries, catalogueFrom(computed.catalogue), raw);
  return new NextResponse(text, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api/skill-plans-extra-routes.test.ts`
Expected: PASS. The optimise case runs the real 2,885-candidate search over a 3-entry plan — a few
milliseconds.

- [ ] **Step 7: Run the whole suite and the type check**

```bash
npm test && npm run typecheck
```
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/skill-plans/[id]/optimise/route.ts" src/app/api/skill-plans/import/route.ts \
  "src/app/api/skill-plans/[id]/export/route.ts" tests/api/skill-plans-extra-routes.test.ts
git commit -m "$(cat <<'EOM'
Add the optimise, import and export plan routes

optimise runs the 2,885-candidate remap search over the plan as it stands and
returns the saving without writing anything; import resolves pasted lines against
the skill catalogue only; export writes EVEMon or in-game text, minus done levels.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 13: `duration()` and the plan view model (`src/lib/view/plan.ts`)

Spec §5's table and attributes panel, as plain strings and numbers. Pure, so the editor and the
server render identically and the component tests have nothing to stub.

**Files:**
- Create: `src/lib/view/plan.ts`, `tests/view/plan.test.ts`
- Modify: `src/lib/view/format.ts` (one new exported function)

**Interfaces:**
- Consumes (phase 3 and Tasks 3, 4, 6, 7):
```ts
// src/lib/view/format.ts
export function grouped(value: string | number): string;
export function sp(value: number): string;               // "12.3M SP" / "850k SP" / "512 SP"
export function roman(level: number): string;
export function relativeTime(date: Date | null, now?: Date): string;
export function stamp(date: Date | null): string;        // "2026-08-31 18:30"
// src/lib/view/skills.ts
export const ATTRIBUTE_LABEL: Record<AttributeKey, string>;
export function remapAvailability(attrs: { bonusRemaps: number | null; accruedRemapCooldownDate: Date | null }, now: Date): string | null;
// src/lib/skills/timeline.ts
export interface Timeline { entries: TimelineEntry[]; totalSp: number; totalMs: number; doneAt: Date; unknownSkillIds: number[] }
export type PlanStatus = "done" | "queued" | "planned";
// src/lib/skills/remap.ts
export interface RemapResult { remap: AttributeSet; totalMs: number; currentMs: number; savedMs: number; candidates: number }
```
- Produces:
```ts
// src/lib/view/format.ts (added)
/** "5 d 13 h 20 m" / "4 h 33 m" / "12 m" / "< 1 m" / "0 m". */
export function duration(ms: number): string;
// src/lib/view/plan.ts — pure
export interface PlanRowView {
  position: number; skillId: number; skill: string; group: string | null;
  level: string; levelNumber: number; rank: string;
  sp: string; time: string; cumulative: string; doneAt: string;
  status: PlanStatus; statusLabel: string; prereq: boolean; alpha: boolean;
  note: string | null; unknown: boolean;
  /** Index into the STORED entries, or null for a row the expansion inserted. */
  entryIndex: number | null;
}
export interface PlanTotalsView { entries: number; remaining: number; sp: string; time: string; doneAt: string }
export interface PlanViewModel { rows: PlanRowView[]; totals: PlanTotalsView; unknownCount: number }
export function planView(
  timeline: Timeline, catalogue: SkillCatalogue,
  requested?: readonly { skillId: number; level: number }[],
): PlanViewModel;

export interface AttributeRowView { key: AttributeKey; label: string; base: number; bonus: number; total: number }
export interface AttributePairView { label: string; spPerHour: string; entries: number }
export interface AttributePanelInput {
  base: AttributeSet; implantBonus: AttributeSet; effective: AttributeSet;
  bonusRemaps: number | null; accruedRemapCooldownDate: Date | null; attributesSane: boolean;
  timeline: Timeline; catalogue: SkillCatalogue; now: Date;
}
export interface AttributePanelView {
  attributes: AttributeRowView[]; pairs: AttributePairView[];
  remapAvailable: string | null; bonusRemaps: number | null; sane: boolean;
}
export function attributePanel(input: AttributePanelInput): AttributePanelView;

export interface RemapDeltaView { key: AttributeKey; label: string; from: number; to: number; delta: string }
export interface RemapSuggestionView {
  deltas: RemapDeltaView[]; totalTime: string; currentTime: string; saved: string; alreadyOptimal: boolean;
}
export function remapSuggestion(currentBase: AttributeSet, result: RemapResult): RemapSuggestionView;
```

**Decisions recorded here (do not re-litigate them):**
- `duration` is a **new** exported function in `format.ts`, not a change to `relativeTime`. The
  existing private `span` helper collapses anything over a day to whole days ("2 days"), which is
  right for "synced 2 days ago" and useless for "this plan takes 5 d 13 h 20 m".
- `duration` rounds to whole **minutes** and prints the non-zero units from days down to minutes,
  always ending in minutes: `duration(480_000_000) === "5 d 13 h 20 m"`. Sub-minute but non-zero is
  `"< 1 m"`; zero or negative is `"0 m"`.
- Status labels are **Done / In queue / Planned**. "In queue" rather than "Queued" because it means
  the *game's* queue, not this plan's.
- `pairs` lists one row per distinct primary/secondary pair used by **planned** entries, in
  first-appearance order, with the rate in SP/hour (`spPerMinute * 60`) — the unit EVE's own
  character sheet shows.
- A row's `time`, `cumulative` and `doneAt` read `"—"` when the entry costs nothing (done or
  queued), so the eye goes straight to the work that remains.
- `alreadyOptimal` is `savedMs === 0`, and the panel then says so instead of showing a zero saving.
- **`entryIndex` is how the editor edits.** The table shows the *expanded* list, but only the rows
  the user actually asked for can be moved, re-levelled or removed — a prerequisite row would just
  come straight back. `planView`'s optional third argument is the stored entry list; a row's
  `entryIndex` is that entry's position, or `null` for a row the expansion inserted. Passing no
  third argument makes every row read-only, which is what a server render wants.

- [ ] **Step 1: Write the failing test**

Create `tests/view/plan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { duration } from "../../src/lib/view/format.js";
import { attributePanel, planView, remapSuggestion } from "../../src/lib/view/plan.js";
import { buildCatalogue, catalogueFrom, type CatalogueRow } from "../../src/lib/skills/catalogue.js";
import { expandPlan } from "../../src/lib/skills/expand.js";
import { planTimeline } from "../../src/lib/skills/timeline.js";
import type { AttributeSet } from "../../src/lib/skills/attributes.js";

const ROWS: CatalogueRow[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [] },
  { id: 3413, name: "Power Grid Management", groupId: 272, groupName: "Engineering", rank: 1, primaryAttr: 165, secondaryAttr: 166, prereqs: [] },
];
const CATALOGUE = catalogueFrom(buildCatalogue(ROWS, new Map([[3300, 5]])));
const BASE: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 };
const BONUS: AttributeSet = { charisma: 0, intelligence: 0, memory: 0, perception: 3, willpower: 3 };
const EFFECTIVE: AttributeSet = { charisma: 18, intelligence: 20, memory: 18, perception: 24, willpower: 25 };
const START = new Date("2026-09-01T00:00:00Z");

describe("duration", () => {
  it("prints days, hours and minutes, ending in minutes", () => {
    expect(duration(480_000_000)).toBe("5 d 13 h 20 m");     // 8,000 minutes
    expect(duration(16_406_250)).toBe("4 h 33 m");           // 273.4375 → 273 minutes
    expect(duration(720_000)).toBe("12 m");
    expect(duration(86_400_000)).toBe("1 d");
  });
  it("handles the small and the empty cases", () => {
    expect(duration(1000)).toBe("< 1 m");
    expect(duration(0)).toBe("0 m");
    expect(duration(-5)).toBe("0 m");
  });
});

describe("planView", () => {
  const entries = expandPlan([{ skillId: 3300, level: 3 }], new Map(), CATALOGUE);
  const timeline = planTimeline({
    entries, catalogue: CATALOGUE, attributes: BASE,
    trained: new Map([[3300, 1]]), queued: new Map([[3300, 2]]), startAt: START,
  });

  it("renders one row per level with status, badges and times", () => {
    const view = planView(timeline, CATALOGUE, [{ skillId: 3300, level: 3 }]);
    expect(view.rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(view.rows.map((r) => r.level)).toEqual(["I", "II", "III"]);
    expect(view.rows.map((r) => r.statusLabel)).toEqual(["Done", "In queue", "Planned"]);
    expect(view.rows.map((r) => r.prereq)).toEqual([true, true, false]);
    // Only the requested pair is editable; the two prerequisite rows are not.
    expect(view.rows.map((r) => r.entryIndex)).toEqual([null, null, 0]);
    expect(view.rows.map((r) => r.alpha)).toEqual([true, true, true]);
    expect(view.rows[2]).toMatchObject({ skill: "Gunnery", group: "Gunnery", rank: "×1", unknown: false });
    // Only the planned level costs anything: 6,585 SP at 32 SP/min = 205.78 min.
    expect(view.rows.map((r) => r.time)).toEqual(["—", "—", "3 h 26 m"]);
    expect(view.rows.map((r) => r.cumulative)).toEqual(["—", "—", "3 h 26 m"]);
    expect(view.rows[2].doneAt).toBe("2026-09-01 03:25");
  });

  it("totals the remaining work", () => {
    const view = planView(timeline, CATALOGUE);
    expect(view.totals).toMatchObject({ entries: 3, remaining: 1, sp: "6k SP", time: "3 h 26 m" });
    expect(view.unknownCount).toBe(0);
  });

  it("renders an unknown skill without breaking the totals", () => {
    const unknown = planTimeline({
      entries: [{ skillId: 999999, level: 2, note: null, prereq: false }],
      catalogue: CATALOGUE, attributes: BASE, trained: new Map(), queued: new Map(), startAt: START,
    });
    const view = planView(unknown, CATALOGUE);
    expect(view.rows[0]).toMatchObject({
      skill: "Unknown skill (999999)", rank: "—", unknown: true, time: "—", entryIndex: null,
    });
    expect(view.unknownCount).toBe(1);
  });
});

describe("attributePanel", () => {
  const entries = expandPlan([{ skillId: 3300, level: 3 }, { skillId: 3413, level: 2 }], new Map(), CATALOGUE);
  const timeline = planTimeline({
    entries, catalogue: CATALOGUE, attributes: EFFECTIVE,
    trained: new Map(), queued: new Map(), startAt: START,
  });

  it("shows the breakdown and one rate row per attribute pair the plan uses", () => {
    const panel = attributePanel({
      base: BASE, implantBonus: BONUS, effective: EFFECTIVE,
      bonusRemaps: 2, accruedRemapCooldownDate: null, attributesSane: true,
      timeline, catalogue: CATALOGUE, now: START,
    });
    expect(panel.attributes.map((a) => [a.label, a.base, a.bonus, a.total])).toEqual([
      ["Charisma", 18, 0, 18], ["Intelligence", 20, 0, 20], ["Memory", 18, 0, 18],
      ["Perception", 21, 3, 24], ["Willpower", 22, 3, 25],
    ]);
    // Gunnery: perception 24 + willpower 25/2 = 36.5 SP/min = 2,190 SP/h, over 3 entries.
    // Power Grid Management: intelligence 20 + memory 18/2 = 29 SP/min = 1,740 SP/h, over 2 entries.
    expect(panel.pairs).toEqual([
      { label: "Perception / Willpower", spPerHour: "2,190 SP/h", entries: 3 },
      { label: "Intelligence / Memory", spPerHour: "1,740 SP/h", entries: 2 },
    ]);
    expect(panel.remapAvailable).toBe("available now");
    expect(panel.bonusRemaps).toBe(2);
    expect(panel.sane).toBe(true);
  });
});

describe("remapSuggestion", () => {
  it("shows the deltas and the saving", () => {
    const view = remapSuggestion(BASE, {
      remap: { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 },
      totalMs: 409_600_000, currentMs: 480_000_000, savedMs: 70_400_000, candidates: 2885,
    });
    expect(view.deltas.map((d) => [d.label, d.from, d.to, d.delta])).toEqual([
      ["Charisma", 18, 17, "-1"], ["Intelligence", 20, 17, "-3"], ["Memory", 18, 17, "-1"],
      ["Perception", 21, 27, "+6"], ["Willpower", 22, 21, "-1"],
    ]);
    // 409,600,000 ms = 6,826.67 min → 6,827 min = 4 d (5,760) + 1,067 min = 17 h 47 m.
    expect(view.totalTime).toBe("4 d 17 h 47 m");
    expect(view.currentTime).toBe("5 d 13 h 20 m");
    expect(view.saved).toBe("19 h 33 m");
    expect(view.alreadyOptimal).toBe(false);
  });

  it("says so when there is nothing to gain", () => {
    const view = remapSuggestion(BASE, {
      remap: BASE, totalMs: 480_000_000, currentMs: 480_000_000, savedMs: 0, candidates: 2885,
    });
    expect(view.alreadyOptimal).toBe(true);
    expect(view.saved).toBe("0 m");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/view/plan.test.ts`
Expected: FAIL — `duration` is not exported and `../../src/lib/view/plan.js` does not resolve.

- [ ] **Step 3: Add `duration` to `src/lib/view/format.ts`**

Insert after the existing private `span` function:

```ts
/**
 * "5 d 13 h 20 m" — a training span, as the planner shows it. Distinct from `relativeTime`'s
 * private `span`, which collapses anything over a day to whole days: right for "synced 2 days ago",
 * useless for a plan whose length is the whole point.
 */
export function duration(ms: number): string {
  if (ms <= 0) return "0 m";
  const minutes = Math.round(ms / MINUTE);
  if (minutes === 0) return "< 1 m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest} m`);
  return parts.join(" ");
}
```

- [ ] **Step 4: Write the view model**

Create `src/lib/view/plan.ts`:

```ts
/**
 * The plan editor as plain strings and numbers (spec §5). Pure: the server component renders it
 * and the client recomputes it on every edit, so the two can never diverge.
 */
import { skillLabel, type SkillCatalogue } from "../skills/catalogue.js";
import { ATTRIBUTE_KEY_BY_ATTR, ATTRIBUTE_KEYS, type AttributeKey, type AttributeSet } from "../skills/attributes.js";
import type { RemapResult } from "../skills/remap.js";
import type { PlanStatus, Timeline } from "../skills/timeline.js";
import { duration, grouped, roman, sp as spLabel, stamp } from "./format.js";
import { ATTRIBUTE_LABEL, remapAvailability } from "./skills.js";

const STATUS_LABEL: Record<PlanStatus, string> = {
  done: "Done", queued: "In queue", planned: "Planned",
};

export interface PlanRowView {
  position: number; skillId: number; skill: string; group: string | null;
  level: string; levelNumber: number; rank: string;
  sp: string; time: string; cumulative: string; doneAt: string;
  status: PlanStatus; statusLabel: string; prereq: boolean; alpha: boolean;
  note: string | null; unknown: boolean;
  /** Index into the STORED entries, or null for a row the expansion inserted. */
  entryIndex: number | null;
}
export interface PlanTotalsView { entries: number; remaining: number; sp: string; time: string; doneAt: string }
export interface PlanViewModel { rows: PlanRowView[]; totals: PlanTotalsView; unknownCount: number }

export function planView(
  timeline: Timeline, catalogue: SkillCatalogue,
  requested: readonly { skillId: number; level: number }[] = [],
): PlanViewModel {
  const byPair = new Map(requested.map((e, i) => [`${e.skillId}:${e.level}`, i]));
  const rows = timeline.entries.map((entry, index): PlanRowView => {
    const skill = catalogue.get(entry.skillId);
    const costs = entry.status === "planned" && entry.ms > 0;
    return {
      position: index + 1,
      skillId: entry.skillId,
      skill: skillLabel(catalogue, entry.skillId),
      group: skill?.groupName ?? null,
      level: roman(entry.level),
      levelNumber: entry.level,
      rank: skill === undefined ? "—" : `×${skill.rank}`,
      sp: entry.levelSp === 0 ? "—" : spLabel(entry.levelSp),
      time: costs ? duration(entry.ms) : "—",
      cumulative: costs ? duration(entry.cumulativeMs) : "—",
      doneAt: costs ? stamp(entry.doneAt) : "—",
      status: entry.status,
      statusLabel: STATUS_LABEL[entry.status],
      prereq: entry.prereq,
      alpha: skill?.alphaMaxLevel != null && entry.level <= skill.alphaMaxLevel,
      note: entry.note,
      unknown: skill === undefined,
      entryIndex: byPair.get(`${entry.skillId}:${entry.level}`) ?? null,
    };
  });
  return {
    rows,
    totals: {
      entries: rows.length,
      remaining: rows.filter((r) => r.status === "planned").length,
      sp: spLabel(timeline.totalSp),
      time: duration(timeline.totalMs),
      doneAt: stamp(timeline.doneAt),
    },
    unknownCount: timeline.unknownSkillIds.length,
  };
}

export interface AttributeRowView { key: AttributeKey; label: string; base: number; bonus: number; total: number }
export interface AttributePairView { label: string; spPerHour: string; entries: number }
export interface AttributePanelInput {
  base: AttributeSet; implantBonus: AttributeSet; effective: AttributeSet;
  bonusRemaps: number | null; accruedRemapCooldownDate: Date | null; attributesSane: boolean;
  timeline: Timeline; catalogue: SkillCatalogue; now: Date;
}
export interface AttributePanelView {
  attributes: AttributeRowView[]; pairs: AttributePairView[];
  remapAvailable: string | null; bonusRemaps: number | null; sane: boolean;
}

export function attributePanel(input: AttributePanelInput): AttributePanelView {
  const attributes = ATTRIBUTE_KEYS.map((key): AttributeRowView => ({
    key, label: ATTRIBUTE_LABEL[key],
    base: input.base[key], bonus: input.implantBonus[key], total: input.effective[key],
  }));

  // One rate row per attribute pair the REMAINING work uses, in first-appearance order.
  const pairs = new Map<string, AttributePairView>();
  for (const entry of input.timeline.entries) {
    if (entry.status !== "planned") continue;
    const skill = input.catalogue.get(entry.skillId);
    if (skill === undefined) continue;
    const primary = ATTRIBUTE_KEY_BY_ATTR.get(skill.primaryAttr);
    const secondary = ATTRIBUTE_KEY_BY_ATTR.get(skill.secondaryAttr);
    if (primary === undefined || secondary === undefined) continue;
    const label = `${ATTRIBUTE_LABEL[primary]} / ${ATTRIBUTE_LABEL[secondary]}`;
    const existing = pairs.get(label);
    if (existing) existing.entries += 1;
    else pairs.set(label, { label, spPerHour: `${grouped(entry.spPerMinute * 60)} SP/h`, entries: 1 });
  }

  return {
    attributes,
    pairs: [...pairs.values()],
    remapAvailable: remapAvailability(
      { bonusRemaps: input.bonusRemaps, accruedRemapCooldownDate: input.accruedRemapCooldownDate },
      input.now),
    bonusRemaps: input.bonusRemaps,
    sane: input.attributesSane,
  };
}

export interface RemapDeltaView { key: AttributeKey; label: string; from: number; to: number; delta: string }
export interface RemapSuggestionView {
  deltas: RemapDeltaView[]; totalTime: string; currentTime: string; saved: string; alreadyOptimal: boolean;
}

export function remapSuggestion(currentBase: AttributeSet, result: RemapResult): RemapSuggestionView {
  return {
    deltas: ATTRIBUTE_KEYS.map((key) => {
      const from = currentBase[key];
      const to = result.remap[key];
      const change = to - from;
      return { key, label: ATTRIBUTE_LABEL[key], from, to, delta: change > 0 ? `+${change}` : String(change) };
    }),
    totalTime: duration(result.totalMs),
    currentTime: duration(result.currentMs),
    saved: duration(result.savedMs),
    alreadyOptimal: result.savedMs === 0,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/view/plan.test.ts`
Expected: PASS. The derivations behind the pinned strings, so a failure can be diagnosed rather
than re-baselined:
- Gunnery III costs 8,000 - 1,415 = 6,585 SP; at 32 SP/min that is 205.78 min = 12,346,875 ms,
  which `duration` rounds to 206 min = **3 h 26 m**, and `stamp(START + 12,346,875 ms)` is
  **2026-09-01 03:25** (03:25:46.875).
- `spLabel(6585)` floors the thousands, so the totals read **6k SP**.
- 409,600,000 ms = 6,826.67 min → 6,827 min → 4 d (5,760 min) + 1,067 min = **4 d 17 h 47 m**;
  480,000,000 ms = 8,000 min = **5 d 13 h 20 m**; 70,400,000 ms = 1,173.33 → 1,173 min =
  **19 h 33 m**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/view/format.ts src/lib/view/plan.ts tests/view/plan.test.ts
git commit -m "$(cat <<'EOM'
Add duration() and the plan view model

duration prints a training span in days, hours and minutes, unlike relativeTime's
day-granular span. planView renders the table, attributePanel the attributes and
per-pair rates, remapSuggestion the deltas and the saving — all pure.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 14: `PlanTable` and `AttributesPanel`

Spec §5's entry table and attributes panel. Both are dumb: they take a view model and call back.

**Files:**
- Create: `src/app/skills/PlanTable.tsx`, `src/app/skills/AttributesPanel.tsx`,
  `tests/components/plan-table.test.tsx`, `tests/components/attributes-panel.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes (Task 13):
```ts
export interface PlanRowView {
  position: number; skillId: number; skill: string; group: string | null;
  level: string; levelNumber: number; rank: string;
  sp: string; time: string; cumulative: string; doneAt: string;
  status: "done" | "queued" | "planned"; statusLabel: string; prereq: boolean; alpha: boolean;
  note: string | null; unknown: boolean; entryIndex: number | null;
}
export interface AttributePanelView {
  attributes: { key: AttributeKey; label: string; base: number; bonus: number; total: number }[];
  pairs: { label: string; spPerHour: string; entries: number }[];
  remapAvailable: string | null; bonusRemaps: number | null; sane: boolean;
}
export interface RemapSuggestionView {
  deltas: { key: AttributeKey; label: string; from: number; to: number; delta: string }[];
  totalTime: string; currentTime: string; saved: string; alreadyOptimal: boolean;
}
```
- Produces:
```tsx
// src/app/skills/PlanTable.tsx — "use client"
export interface PlanTableProps {
  rows: PlanRowView[];
  /** Always a row's `entryIndex` — an index into the STORED entries, never a display index. */
  onMove(entryIndex: number, direction: -1 | 1): void;
  onRemove(entryIndex: number): void;
  onLevel(entryIndex: number, delta: -1 | 1): void;
}
export function PlanTable(props: PlanTableProps): JSX.Element;
// src/app/skills/AttributesPanel.tsx — "use client"
export interface AttributesPanelProps {
  panel: AttributePanelView;
  suggestion: RemapSuggestionView | null;
  optimising: boolean;
  usingRemap: boolean;
  onOptimise(): void;
  onToggleRemap(next: boolean): void;
}
export function AttributesPanel(props: AttributesPanelProps): JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- Every action button carries an `aria-label` naming the row (`Move Gunnery III up`), because the
  icons are the only visible content and the tests — and a screen reader — need to tell rows apart.
- **Only rows with an `entryIndex` carry action buttons.** A prerequisite row's actions would be
  meaningless — remove it and the next expansion puts it straight back — so its actions cell is
  empty. Every callback receives the row's `entryIndex`, never its display position.
- Among the editable rows the move buttons are **disabled** at the ends (`entryIndex === 0` and
  `entryIndex === ` the largest one present); remove is never disabled; the level buttons are
  disabled at I and V. A disabled button still renders, so the column widths do not jump.
- Prerequisite rows get the class `prereq` on the `<tr>` and a `prereq` badge — spec §5 says
  "indented/tagged"; a badge is the tag, and the CSS indents the skill cell.
- The panel's **Optimal remap** block is only rendered once a suggestion exists; before that the
  button says "Find optimal remap" and, while the POST is in flight, "Optimising…" and is disabled.
- `sane === false` renders a `banner` reading "These attributes cannot be a legal remap (they must
  be five values of 17–27 totalling 99) — they may already include implant bonuses." That is
  Decision 4's visible half.

- [ ] **Step 1: Write the failing component tests**

Create `tests/components/plan-table.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanTable } from "../../src/app/skills/PlanTable.js";
import type { PlanRowView } from "../../src/lib/view/plan.js";

const row = (over: Partial<PlanRowView>): PlanRowView => ({
  position: 1, skillId: 3300, skill: "Gunnery", group: "Gunnery", level: "I", levelNumber: 1,
  rank: "×1", sp: "250 SP", time: "8 m", cumulative: "8 m", doneAt: "2026-09-01 00:08",
  status: "planned", statusLabel: "Planned", prereq: false, alpha: true, note: null, unknown: false,
  entryIndex: null, ...over,
});
const ROWS: PlanRowView[] = [
  row({ position: 1, level: "I", levelNumber: 1, status: "done", statusLabel: "Done", prereq: true, time: "—" }),
  row({ position: 2, level: "II", levelNumber: 2, status: "queued", statusLabel: "In queue", prereq: true, time: "—" }),
  row({ position: 3, level: "III", levelNumber: 3, note: "for the Rifter", entryIndex: 0 }),
  row({ position: 4, skillId: 3329, skill: "Minmatar Frigate", group: "Spaceship Command",
        level: "I", levelNumber: 1, rank: "×2", entryIndex: 1 }),
];

const onMove = vi.fn(); const onRemove = vi.fn(); const onLevel = vi.fn();
beforeEach(() => { onMove.mockClear(); onRemove.mockClear(); onLevel.mockClear(); });

const table = (rows: PlanRowView[] = ROWS) =>
  render(<PlanTable rows={rows} onMove={onMove} onRemove={onRemove} onLevel={onLevel} />);

describe("PlanTable", () => {
  it("says so when the plan is empty", () => {
    table([]);
    expect(screen.getByText("No entries yet — add a skill to start planning.")).toBeInTheDocument();
  });

  it("renders one row per level with its status badge and tags", () => {
    table();
    expect(screen.getAllByRole("row")).toHaveLength(5);          // header + four entries
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("In queue")).toBeInTheDocument();
    expect(screen.getAllByText("Planned")).toHaveLength(2);
    expect(screen.getAllByText("prereq")).toHaveLength(2);
    expect(screen.getAllByText("alpha")).toHaveLength(4);
    expect(screen.getByText("for the Rifter")).toBeInTheDocument();
    expect(screen.getAllByText("×1")).toHaveLength(3);           // the three Gunnery rows
  });

  it("gives a prerequisite row no actions at all", () => {
    table();
    expect(screen.queryByRole("button", { name: "Remove Gunnery I" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise Gunnery II" })).not.toBeInTheDocument();
  });

  it("moves, removes and re-levels by stored entry index", () => {
    table();
    fireEvent.click(screen.getByRole("button", { name: "Move Minmatar Frigate I up" }));
    expect(onMove).toHaveBeenCalledWith(1, -1);
    fireEvent.click(screen.getByRole("button", { name: "Remove Gunnery III" }));
    expect(onRemove).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Raise Gunnery III" }));
    expect(onLevel).toHaveBeenCalledWith(0, 1);
  });

  it("disables the moves at the ends and the levels at the extremes", () => {
    table([row({ position: 1, level: "V", levelNumber: 5, entryIndex: 0 })]);
    expect(screen.getByRole("button", { name: "Move Gunnery V up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Gunnery V down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Raise Gunnery V" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lower Gunnery V" })).toBeEnabled();
  });

  it("renders an unknown skill without a rank or an alpha badge", () => {
    table([row({ skill: "Unknown skill (999999)", group: null, rank: "—", alpha: false, unknown: true, entryIndex: 0 })]);
    expect(screen.getByText("Unknown skill (999999)")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
  });
});
```

Create `tests/components/attributes-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttributesPanel } from "../../src/app/skills/AttributesPanel.js";
import type { AttributePanelView, RemapSuggestionView } from "../../src/lib/view/plan.js";

const PANEL: AttributePanelView = {
  attributes: [
    { key: "charisma", label: "Charisma", base: 18, bonus: 0, total: 18 },
    { key: "intelligence", label: "Intelligence", base: 20, bonus: 0, total: 20 },
    { key: "memory", label: "Memory", base: 18, bonus: 0, total: 18 },
    { key: "perception", label: "Perception", base: 21, bonus: 3, total: 24 },
    { key: "willpower", label: "Willpower", base: 22, bonus: 3, total: 25 },
  ],
  pairs: [{ label: "Perception / Willpower", spPerHour: "2,190 SP/h", entries: 3 }],
  remapAvailable: "available now", bonusRemaps: 2, sane: true,
};
const SUGGESTION: RemapSuggestionView = {
  deltas: [
    { key: "charisma", label: "Charisma", from: 18, to: 17, delta: "-1" },
    { key: "perception", label: "Perception", from: 21, to: 27, delta: "+6" },
  ],
  totalTime: "4 d 17 h 47 m", currentTime: "5 d 13 h 20 m", saved: "19 h 33 m", alreadyOptimal: false,
};

const onOptimise = vi.fn(); const onToggleRemap = vi.fn();
beforeEach(() => { onOptimise.mockClear(); onToggleRemap.mockClear(); });

describe("AttributesPanel", () => {
  it("shows the breakdown and the per-pair rate", () => {
    render(<AttributesPanel panel={PANEL} suggestion={null} optimising={false} usingRemap={false}
                            onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText("Perception")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getAllByText("+3")).toHaveLength(2);           // perception and willpower implants
    expect(screen.getByText("2,190 SP/h")).toBeInTheDocument();
    expect(screen.getByText(/available now/)).toBeInTheDocument();
    expect(screen.getByText(/2 bonus remaps/)).toBeInTheDocument();
  });

  it("asks for an optimal remap and reports progress", () => {
    const { rerender } = render(
      <AttributesPanel panel={PANEL} suggestion={null} optimising={false} usingRemap={false}
                       onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    fireEvent.click(screen.getByRole("button", { name: "Find optimal remap" }));
    expect(onOptimise).toHaveBeenCalledTimes(1);
    rerender(<AttributesPanel panel={PANEL} suggestion={null} optimising usingRemap={false}
                              onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByRole("button", { name: "Optimising…" })).toBeDisabled();
  });

  it("shows the deltas and toggles planning with the remap", () => {
    render(<AttributesPanel panel={PANEL} suggestion={SUGGESTION} optimising={false} usingRemap={false}
                            onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText("+6")).toBeInTheDocument();
    expect(screen.getByText("19 h 33 m")).toBeInTheDocument();
    expect(screen.getByText("4 d 17 h 47 m")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Plan with this remap"));
    expect(onToggleRemap).toHaveBeenCalledWith(true);
  });

  it("says when the current attributes are already optimal", () => {
    render(<AttributesPanel panel={PANEL} suggestion={{ ...SUGGESTION, alreadyOptimal: true, saved: "0 m" }}
                            optimising={false} usingRemap={false}
                            onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText("Already optimal for this plan.")).toBeInTheDocument();
  });

  it("warns when the stored attributes cannot be a legal remap", () => {
    render(<AttributesPanel panel={{ ...PANEL, sane: false }} suggestion={null} optimising={false}
                            usingRemap={false} onOptimise={onOptimise} onToggleRemap={onToggleRemap} />);
    expect(screen.getByText(/cannot be a legal remap/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/components/plan-table.test.tsx tests/components/attributes-panel.test.tsx`
Expected: FAIL — neither component module resolves.

- [ ] **Step 3: Write `PlanTable`**

Create `src/app/skills/PlanTable.tsx`:

```tsx
"use client";
import { IconArrowDown, IconArrowUp, IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import type { PlanRowView } from "../../lib/view/plan.js";

export interface PlanTableProps {
  rows: PlanRowView[];
  /** Always a row's `entryIndex` — an index into the STORED entries, never a display index. */
  onMove(entryIndex: number, direction: -1 | 1): void;
  onRemove(entryIndex: number): void;
  onLevel(entryIndex: number, delta: -1 | 1): void;
}

export function PlanTable({ rows, onMove, onRemove, onLevel }: PlanTableProps) {
  if (rows.length === 0) return <p className="faint">No entries yet — add a skill to start planning.</p>;
  // The last STORED entry present, so "move down" is disabled on it and not on the last display row.
  const lastEntryIndex = rows.reduce((max, r) => Math.max(max, r.entryIndex ?? -1), -1);
  return (
    <table className="table plan-table">
      <thead>
        <tr>
          <th>#</th><th>Skill</th><th>Level</th><th>Rank</th><th>SP</th>
          <th>Time</th><th>Total</th><th>Done</th><th>Status</th><th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const name = `${row.skill} ${row.level}`;
          const at = row.entryIndex;
          return (
            <tr key={`${row.skillId}:${row.levelNumber}`} className={row.prereq ? "prereq" : undefined}>
              <td className="muted">{row.position}</td>
              <td>
                <span>{row.skill}</span>
                {row.group === null ? null : <span className="faint"> · {row.group}</span>}
                {row.prereq ? <span className="badge prereq-badge">prereq</span> : null}
                {row.alpha ? <span className="badge alpha">alpha</span> : null}
                {row.note === null ? null : <div className="faint">{row.note}</div>}
              </td>
              <td>{row.level}</td>
              <td className="num">{row.rank}</td>
              <td className="num">{row.sp}</td>
              <td className="num">{row.time}</td>
              <td className="num">{row.cumulative}</td>
              <td className="muted">{row.doneAt}</td>
              <td><span className={`badge ${row.status}`}>{row.statusLabel}</span></td>
              <td className="plan-actions">
                {at === null ? null : (<>
                  <button type="button" className="icon-btn" aria-label={`Lower ${name}`}
                          disabled={row.levelNumber <= 1} onClick={() => onLevel(at, -1)}>
                    <IconMinus size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Raise ${name}`}
                          disabled={row.levelNumber >= 5} onClick={() => onLevel(at, 1)}>
                    <IconPlus size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${name} up`}
                          disabled={at === 0} onClick={() => onMove(at, -1)}>
                    <IconArrowUp size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${name} down`}
                          disabled={at === lastEntryIndex} onClick={() => onMove(at, 1)}>
                    <IconArrowDown size={14} />
                  </button>
                  <button type="button" className="icon-btn danger" aria-label={`Remove ${name}`}
                          onClick={() => onRemove(at)}>
                    <IconTrash size={14} />
                  </button>
                </>)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Write `AttributesPanel`**

Create `src/app/skills/AttributesPanel.tsx`:

```tsx
"use client";
import { IconWand } from "@tabler/icons-react";
import type { AttributePanelView, RemapSuggestionView } from "../../lib/view/plan.js";

export interface AttributesPanelProps {
  panel: AttributePanelView;
  suggestion: RemapSuggestionView | null;
  optimising: boolean;
  usingRemap: boolean;
  onOptimise(): void;
  onToggleRemap(next: boolean): void;
}

export function AttributesPanel({
  panel, suggestion, optimising, usingRemap, onOptimise, onToggleRemap,
}: AttributesPanelProps) {
  const remapNote = [
    panel.bonusRemaps === null ? null : `${panel.bonusRemaps} bonus remap${panel.bonusRemaps === 1 ? "" : "s"}`,
    panel.remapAvailable === null ? null : `next remap ${panel.remapAvailable}`,
  ].filter((part): part is string => part !== null).join(" · ");

  return (
    <div className="card">
      <h2 className="card-title">Attributes</h2>
      {panel.sane ? null : (
        <p className="banner">
          These attributes cannot be a legal remap (they must be five values of 17–27 totalling 99)
          — they may already include implant bonuses.
        </p>
      )}
      <div className="attr-grid">
        {panel.attributes.map((a) => (
          <div key={a.key} className="attr">
            <span className="attr-label">{a.label}</span>
            <div>
              <span className="attr-total">{a.total}</span>
              {a.bonus > 0 ? <span className="attr-bonus">+{a.bonus}</span> : null}
            </div>
            <span className="faint">{a.base} base</span>
          </div>
        ))}
      </div>
      {remapNote === "" ? null : <p className="faint">{remapNote}</p>}

      <h3 className="section-title">Training rate</h3>
      {panel.pairs.length === 0
        ? <p className="faint">Nothing left to train.</p>
        : (
          <ul className="value-list">
            {panel.pairs.map((pair) => (
              <li key={pair.label}>
                <span>{pair.label}</span>
                <span className="num">{pair.spPerHour}</span>
                <span className="faint">{pair.entries} entr{pair.entries === 1 ? "y" : "ies"}</span>
              </li>
            ))}
          </ul>
        )}

      <h3 className="section-title">Optimal remap</h3>
      <button type="button" className="fit-btn" onClick={onOptimise} disabled={optimising}>
        <IconWand size={14} /> {optimising ? "Optimising…" : "Find optimal remap"}
      </button>
      {suggestion === null ? null : suggestion.alreadyOptimal
        ? <p className="faint">Already optimal for this plan.</p>
        : (
          <>
            <ul className="remap-list">
              {suggestion.deltas.map((d) => (
                <li key={d.key}>
                  <span>{d.label}</span>
                  <span className="num">{d.from} → {d.to}</span>
                  <span className="num remap-delta">{d.delta}</span>
                </li>
              ))}
            </ul>
            <ul className="value-list">
              <li><span>With this remap</span><span className="num">{suggestion.totalTime}</span></li>
              <li><span>As you are</span><span className="num">{suggestion.currentTime}</span></li>
              <li className="value-total"><span>Saved</span><span className="num pos">{suggestion.saved}</span></li>
            </ul>
            <label className="check-row">
              <input type="checkbox" checked={usingRemap} aria-label="Plan with this remap"
                     onChange={(e) => onToggleRemap(e.target.checked)} />
              Plan with this remap
            </label>
          </>
        )}
    </div>
  );
}
```

- [ ] **Step 5: Add the phase-6 CSS**

Append to `src/app/globals.css`:

```css
/* ---------- phase 6: skill planner ---------- */
.plan-table td { vertical-align: top; }
.plan-table tr.prereq td:nth-child(2) { padding-left: 18px; }
.badge.prereq-badge { margin-left: 6px; background: rgba(148, 163, 184, 0.14); color: var(--muted); }
.badge.alpha { margin-left: 6px; background: rgba(94, 176, 255, 0.14); color: var(--accent-2); }
.badge.done { background: rgba(148, 163, 184, 0.14); color: var(--muted); }
.badge.queued { background: rgba(94, 176, 255, 0.14); color: var(--accent-2); }
.badge.planned { background: rgba(125, 211, 160, 0.14); color: var(--pos); }
.plan-actions { display: flex; gap: 2px; align-items: center; white-space: nowrap; }
.plan-editor { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.plan-editor-main { display: grid; gap: 20px; }
.plan-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 18px; }
.remap-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 2px; font-size: 12px; }
.remap-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto 44px; gap: 8px; }
.remap-delta { color: var(--accent); }
.plan-list-row { display: grid; grid-template-columns: minmax(0, 1fr) 90px 130px 150px auto; gap: 12px; align-items: center; font-size: 13px; }
.skill-picker { display: grid; gap: 8px; }
.skill-picker-results { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 320px; overflow: auto; }
.skill-picker-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 3px 6px; border-radius: 6px; font-size: 13px; }
.skill-picker-row:hover { background: var(--raised); }
@media (max-width: 900px) { .plan-editor { grid-template-columns: 1fr; } }
```

If any of `--muted`, `--accent-2`, `--pos`, `--raised`, `--accent` is not already defined in the
token block at the top of `globals.css`, **stop and use one that is** — never introduce a colour
literal outside these rgba tints, which follow the existing `.badge.meta` precedent exactly.

- [ ] **Step 6: Run the component tests to verify they pass**

Run: `npx vitest run tests/components/plan-table.test.tsx tests/components/attributes-panel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/skills/PlanTable.tsx src/app/skills/AttributesPanel.tsx src/app/globals.css \
  tests/components/plan-table.test.tsx tests/components/attributes-panel.test.tsx
git commit -m "$(cat <<'EOM'
Add the plan table and attributes panel components

Status and prereq/alpha badges per row, move/remove/level actions labelled by
skill and level, and an attributes panel with the implant breakdown, per-pair
SP/hour, the optimal-remap deltas and the "plan with this remap" toggle.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 15: `PlanEditor` and the `/skills/plans/[id]` route

Spec §5's editor. The state owner: it holds the entry list, derives everything from it on every
change with the same pure functions the server used, autosaves 2 s after the last edit, and hosts
the add-skill picker and the export modal.

**Files:**
- Create: `src/app/skills/PlanEditor.tsx`, `src/app/skills/plans/[id]/page.tsx`,
  `tests/components/plan-editor.test.tsx`

**Interfaces:**
- Consumes (Tasks 3–8, 10, 13, 14):
```ts
// src/lib/skills/catalogue.ts
export interface PlanSkill { id: number; name: string; groupId: number | null; groupName: string | null;
                             rank: number; primaryAttr: number; secondaryAttr: number;
                             prereqs: { skillId: number; level: number }[]; alphaMaxLevel: number | null }
export function catalogueFrom(skills: readonly PlanSkill[]): SkillCatalogue;
// src/lib/skills/expand.ts
export function expandPlan(entries, known, catalogue): ExpandedEntry[];
// src/lib/skills/timeline.ts
export function planTimeline(input: TimelineInput): Timeline;
// src/lib/skills/attributes.ts
export function addAttributes(a: AttributeSet, b: AttributeSet): AttributeSet;
// src/lib/view/plan.ts
export function planView(timeline, catalogue, requested?): PlanViewModel;
export function attributePanel(input: AttributePanelInput): AttributePanelView;
export function remapSuggestion(currentBase: AttributeSet, result: RemapResult): RemapSuggestionView;
// src/app/skills/PlanTable.tsx, src/app/skills/AttributesPanel.tsx  (Task 14)
// src/lib/skills/parse.ts
export const MAX_PLAN_ENTRIES = 500;
// src/lib/skills/load.ts (server, used by the page only)
export async function loadSkillCatalogue(): Promise<PlanSkill[]>;
export async function loadPlanContext(characterId: number): Promise<PlanContext>;
export async function accountTrainingBlock(characterId: number, now?: Date): Promise<AccountBlock | null>;
// src/lib/db/skill-plans.ts
export async function getPlan(id: number): Promise<PlanRow | null>;
```
- Produces:
```tsx
// src/app/skills/PlanEditor.tsx — "use client"
export const AUTOSAVE_MS = 2000;
export interface PlanEditorContext {
  base: AttributeSet; implantBonus: AttributeSet;
  trained: [number, number][]; queued: [number, number][]; partialSp: [number, number][];
  queueEndsAt: string | null; bonusRemaps: number | null; accruedRemapCooldownDate: string | null;
  attributesSane: boolean; synced: boolean;
}
export interface PlanEditorProps {
  plan: { id: number; characterId: number; name: string; remap: AttributeSet | null;
          entries: { skillId: number; level: number; note: string | null }[] };
  characterName: string;
  catalogue: PlanSkill[];
  context: PlanEditorContext;
  accountBlock: { name: string; until: string } | null;
  /** Injected by the tests; production passes nothing and the component uses `new Date()`. */
  now?: string;
}
export function PlanEditor(props: PlanEditorProps): JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- Decision 10 again: **the add-skill picker searches the in-memory catalogue, not the network.**
  Spec §5 suggests `GET /api/sde/types?q=&category=16`, but the page already ships the whole
  catalogue for the maths, so a request would be slower and could disagree with the numbers beside
  it. The phase-5 route still exists and is untouched.
- `now` is captured **once**, on mount, and passed to every derivation. A `new Date()` inside the
  render would make every completion timestamp shift on each keystroke.
- Adding a skill that is already in the plan **raises that entry's level in place** rather than
  appending a second row; `expandPlan` would collapse the duplicate anyway, and moving the row
  would be a surprise.
- The **"plan with this remap" toggle also stores the remap** (`PUT { remap }`), so it survives a
  reload; unchecking clears it. A suggestion the user never toggles is not stored.
- Export **flushes the pending autosave first, then fetches `/api/skill-plans/[id]/export`**. The
  text has to match what is saved, and going through the route is what proves the route works.
- Maps and Dates do not cross the server/client boundary, so `context` carries `[id, level]` tuple
  arrays and ISO strings; the editor rebuilds `Map`s and `Date`s in a `useMemo`.
- Two independent start offsets: **After current queue** (spec §5) and, when there is one,
  **Start when the account is free** (spec §5's account rule). With both on, the later of the two
  wins — that is what actually happens in game.
- **Deliberate reduction from spec §5:** the spec lists Import as an action inside this editor. This
  plan only offers Import on `/skills` (Task 16's `PlansCard`), where it creates a new plan; there is
  no import-into-the-current-plan UI here. Re-planning around an imported list is indistinguishable
  from starting a new plan from it, so the extra entry point would duplicate the New/From
  template/Import flow for no real gain. Do not add editor import UI.
- **`characterName` renders once, in this component's toolbar** (`<span className="muted">`), not
  also on the page above it — `tests/components/plan-editor.test.tsx` renders `PlanEditor` in
  isolation and asserts the name is visible, so the toolbar is the one copy; the page in Step 4 does
  not repeat it.

- [ ] **Step 1: Write the failing test**

Create `tests/components/plan-editor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanEditor, AUTOSAVE_MS } from "../../src/app/skills/PlanEditor.js";
import type { PlanSkill } from "../../src/lib/skills/catalogue.js";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const CATALOGUE: PlanSkill[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
  { id: 3318, name: "Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 2, primaryAttr: 167, secondaryAttr: 166, prereqs: [{ skillId: 3300, level: 2 }], alphaMaxLevel: 4 },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
];
const CONTEXT = {
  base: { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 },
  implantBonus: { charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 },
  trained: [] as [number, number][], queued: [] as [number, number][], partialSp: [] as [number, number][],
  queueEndsAt: "2026-09-10T00:00:00.000Z", bonusRemaps: 2, accruedRemapCooldownDate: null,
  attributesSane: true, synced: true,
};
const PLAN = {
  id: 7, characterId: 90000101, name: "Gunnery", remap: null,
  entries: [{ skillId: 3300, level: 3, note: null }],
};
const NOW = "2026-09-01T00:00:00.000Z";

let puts: unknown[] = [];
let optimiseCalls = 0;

afterEach(() => { vi.useRealTimers(); });

beforeEach(() => {
  puts = []; optimiseCalls = 0; refresh.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/optimise")) {
      optimiseCalls += 1;
      return { ok: true, status: 200, json: async () => ({
        remap: { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 },
        totalMs: 409_600_000, currentMs: 480_000_000, savedMs: 70_400_000, candidates: 2885,
      }) } as Response;
    }
    if (url.includes("/export")) {
      return { ok: true, status: 200, text: async () => "Gunnery I\nGunnery II\nGunnery III\n" } as Response;
    }
    puts.push({ url, body: JSON.parse(String(init?.body)) });
    return { ok: true, status: 200, json: async () => ({ plan: PLAN }) } as Response;
  }) as typeof fetch;
});

const editor = (over: Partial<React.ComponentProps<typeof PlanEditor>> = {}) =>
  render(<PlanEditor plan={PLAN} characterName="Mara Vexley" catalogue={CATALOGUE}
                     context={CONTEXT} accountBlock={null} now={NOW} {...over} />);

describe("PlanEditor", () => {
  it("expands the stored entries and totals them", () => {
    editor();
    expect(screen.getByDisplayValue("Gunnery")).toBeInTheDocument();
    expect(screen.getByText("Mara Vexley")).toBeInTheDocument();
    // Gunnery I..III = 8,000 SP at perception 21 + willpower 22/2 = 32 SP/min = 250 min.
    expect(screen.getAllByRole("row")).toHaveLength(4);
    // Both the totals card and the last row's cumulative cell read the same span.
    expect(screen.getAllByText("4 h 10 m").length).toBeGreaterThan(0);
  });

  it("adds a skill and inserts its prerequisites", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Search skills"), { target: { value: "weapon" } });
    fireEvent.click(await screen.findByRole("button", { name: "Add Weapon Upgrades IV" }));
    // Gunnery I, II, III already there; Weapon Upgrades I..IV appended, no duplicate Gunnery rows.
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(8));
    expect(screen.getAllByText("Weapon Upgrades")).toHaveLength(4);
  });

  it("removes and re-levels a stored entry", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Raise Gunnery III" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(5));   // now I..IV
    fireEvent.click(screen.getByRole("button", { name: "Remove Gunnery IV" }));
    await waitFor(() => expect(screen.getByText("No entries yet — add a skill to start planning.")).toBeInTheDocument());
  });

  it("autosaves the entries two seconds after the last change", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Raise Gunnery III" }));
    expect(puts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({
      url: "/api/skill-plans/7",
      body: { name: "Gunnery", entries: [{ skillId: 3300, level: 4, note: null }] },
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shifts the timeline to the end of the queue", async () => {
    editor();
    expect(screen.getAllByText("2026-09-01 04:10").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("After current queue"));
    await waitFor(() => expect(screen.getAllByText("2026-09-10 04:10").length).toBeGreaterThan(0));
  });

  it("asks for an optimal remap, shows the saving and stores it when toggled", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Find optimal remap" }));
    await waitFor(() => expect(optimiseCalls).toBe(1));
    expect(await screen.findByText("19 h 33 m")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Plan with this remap"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    await waitFor(() => expect(puts.some((p) =>
      (p as { body: { remap?: unknown } }).body.remap !== undefined)).toBe(true));
  });

  it("shows the account-rule banner", () => {
    editor({ accountBlock: { name: "Jorin Hale", until: "2026-09-20T00:00:00.000Z" } });
    expect(screen.getByText(/Jorin Hale is training until 2026-09-20 00:00/)).toBeInTheDocument();
  });

  it("exports through the route after flushing the pending save", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByDisplayValue("Gunnery I\nGunnery II\nGunnery III\n")).toBeInTheDocument();
  });

  it("warns when the character has never been synced", () => {
    editor({ context: { ...CONTEXT, synced: false } });
    expect(screen.getByText(/No skills synced yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/plan-editor.test.tsx`
Expected: FAIL — cannot resolve `../../src/app/skills/PlanEditor.js`.

- [ ] **Step 3: Write `PlanEditor`**

Create `src/app/skills/PlanEditor.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDeviceFloppy, IconFileExport, IconPlus } from "@tabler/icons-react";
import { addAttributes, type AttributeSet } from "../../lib/skills/attributes.js";
import { catalogueFrom, type PlanSkill } from "../../lib/skills/catalogue.js";
import { expandPlan, type PlanEntry } from "../../lib/skills/expand.js";
import { MAX_PLAN_ENTRIES } from "../../lib/skills/parse.js";
import { MAX_SKILL_LEVEL } from "../../lib/skills/sp.js";
import { PLAN_TEXT_FORMATS, type PlanTextFormat } from "../../lib/skills/text.js";
import { planTimeline } from "../../lib/skills/timeline.js";
import { roman, stamp } from "../../lib/view/format.js";
import { attributePanel, planView, remapSuggestion, type RemapSuggestionView } from "../../lib/view/plan.js";
import { AttributesPanel } from "./AttributesPanel.js";
import { PlanTable } from "./PlanTable.js";

/** Spec §5: "Save is explicit (PUT), with autosave 2 s after the last change". */
export const AUTOSAVE_MS = 2000;
const MAX_RESULTS = 30;

export interface PlanEditorContext {
  base: AttributeSet; implantBonus: AttributeSet;
  trained: [number, number][]; queued: [number, number][]; partialSp: [number, number][];
  queueEndsAt: string | null; bonusRemaps: number | null; accruedRemapCooldownDate: string | null;
  attributesSane: boolean; synced: boolean;
}

export interface PlanEditorProps {
  plan: {
    id: number; characterId: number; name: string; remap: AttributeSet | null;
    entries: { skillId: number; level: number; note: string | null }[];
  };
  characterName: string;
  catalogue: PlanSkill[];
  context: PlanEditorContext;
  accountBlock: { name: string; until: string } | null;
  now?: string;
}

interface SavePayload { name: string; entries: PlanEntry[]; remap: AttributeSet | null }

const SAVE_LABELS = {
  idle: "", saving: "Saving…", saved: "Saved",
  error: "Could not save — retrying on the next change",
};

export function PlanEditor({ plan, characterName, catalogue, context, accountBlock, now }: PlanEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [entries, setEntries] = useState<PlanEntry[]>(plan.entries);
  const [remap, setRemap] = useState<AttributeSet | null>(plan.remap);
  const [suggestion, setSuggestion] = useState<RemapSuggestionView | null>(null);
  const [suggested, setSuggested] = useState<AttributeSet | null>(null);
  const [optimising, setOptimising] = useState(false);
  const [afterQueue, setAfterQueue] = useState(false);
  const [afterAccount, setAfterAccount] = useState(false);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<keyof typeof SAVE_LABELS>("idle");
  const [exportFormat, setExportFormat] = useState<PlanTextFormat>("evemon");
  const [exportText, setExportText] = useState<string | null>(null);

  // Captured once: a `new Date()` in the render would shift every completion time per keystroke.
  const [mountedAt] = useState(() => (now === undefined ? new Date() : new Date(now)));

  const index = useMemo(() => catalogueFrom(catalogue), [catalogue]);
  const trained = useMemo(() => new Map(context.trained), [context.trained]);
  const queued = useMemo(() => new Map(context.queued), [context.queued]);
  const partialSp = useMemo(() => new Map(context.partialSp), [context.partialSp]);

  const known = useMemo(() => {
    const merged = new Map(trained);
    for (const [skillId, level] of queued) if ((merged.get(skillId) ?? 0) < level) merged.set(skillId, level);
    return merged;
  }, [trained, queued]);

  const startAt = useMemo(() => {
    let start = mountedAt;
    const queueEnd = context.queueEndsAt === null ? null : new Date(context.queueEndsAt);
    if (afterQueue && queueEnd !== null && queueEnd > start) start = queueEnd;
    const free = accountBlock === null ? null : new Date(accountBlock.until);
    if (afterAccount && free !== null && free > start) start = free;
    return start;
  }, [mountedAt, afterQueue, afterAccount, context.queueEndsAt, accountBlock]);

  const attributes = useMemo(
    () => addAttributes(remap ?? context.base, context.implantBonus),
    [remap, context.base, context.implantBonus]);

  const expanded = useMemo(() => expandPlan(entries, known, index), [entries, known, index]);
  const timeline = useMemo(() => planTimeline({
    entries: expanded, catalogue: index, attributes, trained, queued, partialSp, startAt,
  }), [expanded, index, attributes, trained, queued, partialSp, startAt]);
  const view = useMemo(() => planView(timeline, index, entries), [timeline, index, entries]);
  const panel = useMemo(() => attributePanel({
    base: remap ?? context.base, implantBonus: context.implantBonus, effective: attributes,
    bonusRemaps: context.bonusRemaps,
    accruedRemapCooldownDate: context.accruedRemapCooldownDate === null
      ? null : new Date(context.accruedRemapCooldownDate),
    attributesSane: context.attributesSane, timeline, catalogue: index, now: mountedAt,
  }), [remap, context, attributes, timeline, index, mountedAt]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    return catalogue.filter((s) => s.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [query, catalogue]);

  // ── editing ───────────────────────────────────────────────────────────────
  const moveEntry = useCallback((at: number, direction: -1 | 1) => {
    setEntries((prev) => {
      const to = at + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  }, []);
  const removeEntry = useCallback((at: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== at));
  }, []);
  const levelEntry = useCallback((at: number, delta: -1 | 1) => {
    setEntries((prev) => prev.map((e, i) => (i === at
      ? { ...e, level: Math.min(MAX_SKILL_LEVEL, Math.max(1, e.level + delta)) } : e)));
  }, []);
  // Adding a skill already in the plan raises that entry in place; expandPlan would collapse a
  // duplicate anyway, and moving the row would surprise the user.
  const addSkill = useCallback((skillId: number, level: number) => {
    setEntries((prev) => {
      const at = prev.findIndex((e) => e.skillId === skillId);
      if (at >= 0) return prev.map((e, i) => (i === at ? { ...e, level } : e));
      if (prev.length >= MAX_PLAN_ENTRIES) return prev;
      return [...prev, { skillId, level, note: null }];
    });
  }, []);

  // ── saving ────────────────────────────────────────────────────────────────
  const payload = useMemo<SavePayload>(() => ({ name, entries, remap }), [name, entries, remap]);
  const savedRef = useRef(JSON.stringify({ name: plan.name, entries: plan.entries, remap: plan.remap }));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (body: SavePayload) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/skill-plans/${plan.id}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PUT /api/skill-plans/${plan.id} answered ${res.status}`);
      savedRef.current = JSON.stringify(body);
      setSaveState("saved");
      router.refresh();
    } catch (e) {
      // Spec §7: keep the local state and retry on the next change.
      console.error("[planner] could not save the plan", e);
      setSaveState("error");
    }
    // `router.refresh` rather than `router` itself: Next.js's router object is stable across
    // renders, but under `vi.mock`'s `useRouter: () => ({ push: vi.fn(), refresh })` it is a new
    // object every render. Depending on `router` would give `save` (and the autosave effect below,
    // which depends on `save`) a new identity on every unrelated re-render, tearing down and
    // restarting the 2 s timer before it ever fires.
  }, [plan.id, router.refresh]);

  useEffect(() => {
    if (JSON.stringify(payload) === savedRef.current) return;
    timerRef.current = setTimeout(() => { timerRef.current = null; void save(payload); }, AUTOSAVE_MS);
    return () => { if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [payload, save]);

  const flush = useCallback(async () => {
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (JSON.stringify(payload) === savedRef.current) return;
    await save(payload);
  }, [payload, save]);

  // ── remap ─────────────────────────────────────────────────────────────────
  const optimise = useCallback(async () => {
    setOptimising(true);
    try {
      await flush();
      const res = await fetch(`/api/skill-plans/${plan.id}/optimise`, { method: "POST" });
      if (!res.ok) throw new Error(`optimise answered ${res.status}`);
      const result = await res.json() as Parameters<typeof remapSuggestion>[1];
      setSuggested(result.remap);
      setSuggestion(remapSuggestion(context.base, result));
    } catch (e) {
      console.error("[planner] could not optimise the remap", e);
    } finally {
      setOptimising(false);
    }
  }, [flush, plan.id, context.base]);

  const toggleRemap = useCallback((next: boolean) => {
    setRemap(next ? suggested : null);
  }, [suggested]);

  // ── export ────────────────────────────────────────────────────────────────
  const openExport = useCallback(async (format: PlanTextFormat) => {
    setExportFormat(format);
    setExportText("");
    try {
      await flush();
      const res = await fetch(`/api/skill-plans/${plan.id}/export?format=${format}`);
      if (!res.ok) throw new Error(`export answered ${res.status}`);
      setExportText(await res.text());
    } catch (e) {
      console.error("[planner] could not export the plan", e);
      setExportText("");
    }
  }, [flush, plan.id]);

  return (
    <div className="plan-editor">
      <div className="plan-editor-main">
        <div className="plan-toolbar">
          <input className="fit-name-input" aria-label="Plan name" value={name}
                 onChange={(e) => setName(e.target.value)} />
          <span className="muted">{characterName}</span>
          <button type="button" className="fit-btn" onClick={() => void flush()}>
            <IconDeviceFloppy size={14} /> Save
          </button>
          <button type="button" className="fit-btn" onClick={() => void openExport(exportFormat)}>
            <IconFileExport size={14} /> Export
          </button>
          <span className={`save-state ${saveState === "error" ? "error" : ""}`}>{SAVE_LABELS[saveState]}</span>
        </div>

        {context.synced ? null : (
          <p className="banner">No skills synced yet for {characterName} — this plan is computed from level 0.</p>
        )}
        {accountBlock === null ? null : (
          <p className="banner">
            {accountBlock.name} is training until {stamp(new Date(accountBlock.until))} — this plan
            can’t start before then.
          </p>
        )}

        <div className="card">
          <div className="stat-row">
            <div><span className="stat-label">Entries</span><span className="stat-value">{view.totals.entries}</span></div>
            <div><span className="stat-label">Remaining</span><span className="stat-value">{view.totals.remaining}</span></div>
            <div><span className="stat-label">SP</span><span className="stat-value">{view.totals.sp}</span></div>
            <div><span className="stat-label">Time</span><span className="stat-value">{view.totals.time}</span></div>
            <div><span className="stat-label">Done</span><span className="stat-value">{view.totals.doneAt}</span></div>
          </div>
          <label className="check-row">
            <input type="checkbox" aria-label="After current queue" checked={afterQueue}
                   onChange={(e) => setAfterQueue(e.target.checked)} />
            After current queue
          </label>
          {accountBlock === null ? null : (
            <label className="check-row">
              <input type="checkbox" aria-label="Start when the account is free" checked={afterAccount}
                     onChange={(e) => setAfterAccount(e.target.checked)} />
              Start when the account is free
            </label>
          )}
          {view.unknownCount === 0 ? null : (
            <p className="faint">{view.unknownCount} entr{view.unknownCount === 1 ? "y" : "ies"} reference a skill this SDE build does not have.</p>
          )}
          <PlanTable rows={view.rows} onMove={moveEntry} onRemove={removeEntry} onLevel={levelEntry} />
        </div>

        <div className="card skill-picker">
          <h2 className="card-title">Add skill</h2>
          <input className="filter-input" aria-label="Search skills" value={query} placeholder="Search skills"
                 onChange={(e) => setQuery(e.target.value)} />
          <ul className="skill-picker-results">
            {results.map((skill) => (
              <li key={skill.id} className="skill-picker-row">
                <span>{skill.name}<span className="faint"> · {skill.groupName ?? "—"}</span></span>
                <span className="faint num">×{skill.rank}</span>
                <span className="plan-actions">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button key={level} type="button" className="icon-btn"
                            aria-label={`Add ${skill.name} ${roman(level)}`}
                            onClick={() => addSkill(skill.id, level)}>
                      {roman(level)}
                    </button>
                  ))}
                  <IconPlus size={14} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <AttributesPanel panel={panel} suggestion={suggestion} optimising={optimising}
                       usingRemap={remap !== null} onOptimise={() => void optimise()}
                       onToggleRemap={toggleRemap} />

      {exportText === null ? null : (
        <div className="modal-backdrop" role="dialog" aria-label="Export plan"
             onClick={() => setExportText(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Export plan</h2>
            <div className="plan-toolbar">
              {PLAN_TEXT_FORMATS.map((format) => (
                <button key={format} type="button" className="fit-btn" disabled={format === exportFormat}
                        onClick={() => void openExport(format)}>
                  {format === "evemon" ? "EVEMon (Roman)" : "In-game (Arabic)"}
                </button>
              ))}
              <button type="button" className="fit-btn"
                      onClick={() => void navigator.clipboard?.writeText(exportText)}>Copy</button>
              <button type="button" className="fit-btn" onClick={() => setExportText(null)}>Close</button>
            </div>
            <textarea className="eft-text" aria-label="Plan text" readOnly value={exportText} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

Create `src/app/skills/plans/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { parseId } from "../../../../lib/api/json.js";
import { getPlan } from "../../../../lib/db/skill-plans.js";
import { accountTrainingBlock, loadPlanContext, loadSkillCatalogue } from "../../../../lib/skills/load.js";
import { PlanEditor } from "../../PlanEditor.js";

export default async function PlanEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const plan = await getPlan(id);
  if (plan === null) notFound();

  const [catalogue, context, accountBlock] = await Promise.all([
    loadSkillCatalogue(), loadPlanContext(plan.characterId), accountTrainingBlock(plan.characterId),
  ]);

  return (<>
    <h1 className="page-title">Skill plan</h1>
    <PlanEditor
      key={plan.id}
      plan={{
        id: plan.id, characterId: plan.characterId, name: plan.name, remap: plan.remap,
        entries: plan.entries.map((e) => ({ skillId: e.skillId, level: e.level, note: e.note })),
      }}
      characterName={context.characterName}
      catalogue={catalogue}
      // Maps and Dates do not cross the server/client boundary: tuples and ISO strings do.
      context={{
        base: context.base, implantBonus: context.implantBonus,
        trained: [...context.trained], queued: [...context.queued], partialSp: [...context.partialSp],
        queueEndsAt: context.queueEndsAt?.toISOString() ?? null,
        bonusRemaps: context.bonusRemaps,
        accruedRemapCooldownDate: context.accruedRemapCooldownDate?.toISOString() ?? null,
        attributesSane: context.attributesSane, synced: context.synced,
      }}
      accountBlock={accountBlock === null
        ? null : { name: accountBlock.name, until: accountBlock.until.toISOString() }}
    />
  </>);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/plan-editor.test.tsx`
Expected: PASS. The pinned strings:
- Gunnery I–III is 8,000 SP; at perception 21 + willpower 22 / 2 = 32 SP/min that is 250 minutes,
  so the total reads **4 h 10 m** and, from `2026-09-01T00:00:00Z`, the done stamp is
  **2026-09-01 04:10**. With **After current queue** on and the queue ending
  `2026-09-10T00:00:00Z`, it becomes **2026-09-10 04:10**.
- The optimise response's `savedMs` of 70,400,000 renders as **19 h 33 m**.
- Adding Weapon Upgrades IV inserts levels I–IV after the three Gunnery rows: 7 entry rows plus the
  header is 8 `row` elements. Gunnery II is already in the plan, so no extra prerequisite appears.

- [ ] **Step 6: Prove no server code leaked into the client bundle**

```bash
npm run build
```
Expected: `next build` succeeds. A failure naming `pg`, `node:fs` or `dns` means a `"use client"`
component reached `src/lib/skills/load.js`, `src/lib/db/**` or `src/lib/sde/**` — fix that before
moving on.

- [ ] **Step 7: Commit**

```bash
git add src/app/skills/PlanEditor.tsx "src/app/skills/plans/[id]/page.tsx" \
  tests/components/plan-editor.test.tsx
git commit -m "$(cat <<'EOM'
Add the plan editor and its route

The editor owns the entry list and re-derives expansion, timeline and view model
on every change with the same pure functions the server used. Add-skill searches
the in-memory catalogue, remap and export go through their routes, autosave is 2 s.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 16: The Plans section on `/skills`

Spec §5's first bullet: the phase-3 Skills page gains a Plans section with the active character's
plans and the three ways to start a new one.

**Files:**
- Create: `src/app/skills/PlansCard.tsx`, `tests/components/plans-card.test.tsx`
- Modify: `src/app/skills/page.tsx`

**Interfaces:**
- Consumes (Tasks 1, 9, 11, 13, and phase 3's page):
```ts
// src/lib/db/skill-plans.ts
export async function listPlans(characterId: number): Promise<PlanRow[]>;
// src/lib/skills/load.ts
export async function summarisePlans(plans: readonly PlanRow[], opts?: ComputeOptions): Promise<PlanSummary[]>;
export interface PlanSummary { id: number; characterId: number; name: string; remap: AttributeSet | null;
                               createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
                               entryCount: number; totalSp: number; totalMs: number; doneAt: Date }
// src/lib/sde/repo.ts
export async function listCareerPlans(): Promise<SdeCareerPlan[]>;
// src/lib/view/format.ts
export function duration(ms: number): string;
export function relativeTime(date: Date | null, now?: Date): string;
export function stamp(date: Date | null): string;
// src/app/skills/page.tsx already has, verbatim:
const [session, characters] = await Promise.all([readSession(), listCharacters()]);
const character = pickActive(characters, session?.activeCharacterId ?? null);
```
- Produces:
```tsx
// src/app/skills/PlansCard.tsx — "use client"
export interface PlanListRow {
  id: number; name: string; entries: number; remaining: string; doneAt: string;
}
export interface PlansCardProps {
  characterId: number;
  plans: PlanListRow[];
  templates: { id: number; name: string }[];
}
export function PlansCard(props: PlansCardProps): JSX.Element;
```

**Decisions recorded here (do not re-litigate them):**
- The card lives inside `card-stack` on `/skills`, **after** the training queue and **before** the
  skill sheet: a plan is about what comes next, so it belongs next to the queue.
- **New plan** creates an empty plan and navigates straight into the editor. **From template** does
  the same with `templateId`. **Import** posts to `/api/skill-plans/import`; the plan is created
  either way, but when something did not resolve the card lists the offending lines and offers an
  **Open plan** button instead of navigating away, so the user sees what was dropped (spec §7:
  reported, not fatal).
- The nav's `Skills` item stays highlighted on `/skills/plans/7` for free — `isNavActive` matches on
  the `/skills` prefix. **Do not add a nav entry** (`tests/nav.test.ts` pins the seven destinations).
- Delete asks for no confirmation dialog and simply refreshes; a plan is cheap to rebuild and the
  app has no modal-confirm pattern anywhere else.
- A character with no plans reads "No plans yet — start one with 'New plan'."
- **Accepted perf cost, no code change:** `summarisePlans` (Task 11) loads the skill catalogue
  itself via `loadSkillCatalogue`, so `/skills` reads the catalogue twice per request — once for
  this section, once for the existing skill sheet. Plans is a small, infrequently-loaded section and
  keeping `summarisePlans` self-contained (usable from the API routes too, which do not build a
  catalogue for anything else) is worth the extra query.

- [ ] **Step 1: Write the failing test**

Create `tests/components/plans-card.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlansCard, type PlanListRow } from "../../src/app/skills/PlansCard.js";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const PLANS: PlanListRow[] = [{
  id: 7, name: "Gunnery", entries: 3, remaining: "4 h 10 m", doneAt: "2026-09-01 04:10",
}];
const TEMPLATES = [{ id: 4, name: "Minmatar Militia Fighter" }, { id: 14, name: "Manufacturer" }];

let posts: { url: string; body: unknown }[] = [];
let deletes: string[] = [];
let unresolved: string[] = [];

beforeEach(() => {
  posts = []; deletes = []; unresolved = []; push.mockClear(); refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "DELETE") { deletes.push(url); return { ok: true, status: 204 } as Response; }
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return { ok: true, status: 201, json: async () => ({ plan: { id: 9 }, unresolved }) } as Response;
  }) as typeof fetch;
});

const card = (plans: PlanListRow[] = PLANS) =>
  render(<PlansCard characterId={90000101} plans={plans} templates={TEMPLATES} />);

describe("PlansCard", () => {
  it("lists the plans with their remaining time", () => {
    card();
    expect(screen.getByRole("link", { name: "Gunnery" })).toHaveAttribute("href", "/skills/plans/7");
    expect(screen.getByText("4 h 10 m")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01 04:10")).toBeInTheDocument();
  });

  it("says so when there are none", () => {
    card([]);
    expect(screen.getByText("No plans yet — start one with “New plan”.")).toBeInTheDocument();
  });

  it("creates an empty plan and opens it", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Frigates" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/plans/9"));
    expect(posts[0]).toEqual({
      url: "/api/skill-plans", body: { characterId: 90000101, name: "Frigates" },
    });
  });

  it("creates a plan from a CCP template", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "From template" }));
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Create from template" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/plans/9"));
    expect(posts[0]).toEqual({
      url: "/api/skill-plans",
      body: { characterId: 90000101, name: "Minmatar Militia Fighter", templateId: 4 },
    });
  });

  it("imports text and reports the lines that did not resolve", async () => {
    unresolved = ["200mm AutoCannon II"];
    card();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Pasted" } });
    fireEvent.change(screen.getByLabelText("Plan text"), { target: { value: "Gunnery V\n200mm AutoCannon II\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Import plan" }));
    expect(await screen.findByText("200mm AutoCannon II")).toBeInTheDocument();
    expect(posts[0]).toEqual({
      url: "/api/skill-plans/import",
      body: { characterId: 90000101, name: "Pasted", text: "Gunnery V\n200mm AutoCannon II\n" },
    });
  });

  it("deletes a plan and refreshes", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "Delete Gunnery" }));
    await waitFor(() => expect(deletes).toEqual(["/api/skill-plans/7"]));
    expect(refresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/plans-card.test.tsx`
Expected: FAIL — cannot resolve `../../src/app/skills/PlansCard.js`.

- [ ] **Step 3: Write `PlansCard`**

Create `src/app/skills/PlansCard.tsx`:

```tsx
"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconFileImport, IconPlus, IconTemplate, IconTrash } from "@tabler/icons-react";

export interface PlanListRow {
  id: number; name: string; entries: number; remaining: string; doneAt: string;
}
export interface PlansCardProps {
  characterId: number;
  plans: PlanListRow[];
  templates: { id: number; name: string }[];
}

type Panel = "none" | "new" | "template" | "import";

export function PlansCard({ characterId, plans, templates }: PlansCardProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("none");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [created, setCreated] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const create = useCallback(async (url: string, body: unknown) => {
    setBusy(true); setFailed(false); setUnresolved([]); setCreated(null);
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      const json = await res.json() as { plan: { id: number }; unresolved?: string[] };
      // Spec §7: unresolved lines are reported, not fatal. The plan exists either way; we only hold
      // the navigation back so the user can read what was dropped before leaving the page.
      if (json.unresolved !== undefined && json.unresolved.length > 0) {
        setUnresolved(json.unresolved);
        setCreated(json.plan.id);
      } else {
        router.push(`/skills/plans/${json.plan.id}`);
      }
    } catch (e) {
      console.error("[planner] could not create the plan", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [router]);

  const remove = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/skill-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`DELETE /api/skill-plans/${id} answered ${res.status}`);
      router.refresh();
    } catch (e) {
      console.error("[planner] could not delete the plan", e);
      setFailed(true);
    }
  }, [router]);

  return (
    <div className="card">
      <h2 className="card-title">Plans</h2>
      <div className="plan-toolbar">
        <button type="button" className="fit-btn" onClick={() => setPanel(panel === "new" ? "none" : "new")}>
          <IconPlus size={14} /> New plan
        </button>
        <button type="button" className="fit-btn" disabled={templates.length === 0}
                onClick={() => setPanel(panel === "template" ? "none" : "template")}>
          <IconTemplate size={14} /> From template
        </button>
        <button type="button" className="fit-btn" onClick={() => setPanel(panel === "import" ? "none" : "import")}>
          <IconFileImport size={14} /> Import
        </button>
      </div>

      {panel === "none" ? null : (
        <div className="skill-picker">
          {panel === "template" ? (
            <select className="fit-select" aria-label="Template" value={templateId}
                    onChange={(e) => setTemplateId(Number(e.target.value))}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <input className="filter-input" aria-label="Plan name" value={name} placeholder="Plan name"
                   onChange={(e) => setName(e.target.value)} />
          )}
          {panel === "import" ? (
            <textarea className="eft-text" aria-label="Plan text" value={text} placeholder="Gunnery V"
                      onChange={(e) => setText(e.target.value)} />
          ) : null}
          {panel === "new" ? (
            <button type="button" className="fit-btn" disabled={busy || name.trim() === ""}
                    onClick={() => void create("/api/skill-plans", { characterId, name: name.trim() })}>
              Create
            </button>
          ) : null}
          {panel === "template" ? (
            <button type="button" className="fit-btn" disabled={busy}
                    onClick={() => void create("/api/skill-plans", {
                      characterId, name: templates.find((t) => t.id === templateId)?.name ?? "Career plan",
                      templateId,
                    })}>
              Create from template
            </button>
          ) : null}
          {panel === "import" ? (
            <button type="button" className="fit-btn" disabled={busy || name.trim() === "" || text.trim() === ""}
                    onClick={() => void create("/api/skill-plans/import", { characterId, name: name.trim(), text })}>
              Import plan
            </button>
          ) : null}
          {unresolved.length === 0 ? null : (
            <>
              <p className="warn-text">These lines did not resolve to a skill:</p>
              <ul className="problem-list">{unresolved.map((line) => <li key={line}>{line}</li>)}</ul>
              {created === null ? null : (
                <button type="button" className="fit-btn"
                        onClick={() => router.push(`/skills/plans/${created}`)}>
                  Open plan
                </button>
              )}
            </>
          )}
          {failed ? <p className="warn-text">Could not reach the server — try again.</p> : null}
        </div>
      )}

      {plans.length === 0 ? <p className="faint">No plans yet — start one with “New plan”.</p> : (
        <ul className="entry-list">
          {plans.map((plan) => (
            <li key={plan.id} className="plan-list-row">
              <Link href={`/skills/plans/${plan.id}`}>{plan.name}</Link>
              <span className="muted num">{plan.entries}</span>
              <span className="num">{plan.remaining}</span>
              <span className="muted">{plan.doneAt}</span>
              <button type="button" className="icon-btn danger" aria-label={`Delete ${plan.name}`}
                      onClick={() => void remove(plan.id)}>
                <IconTrash size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Render it from `/skills`**

In `src/app/skills/page.tsx`, add three imports and extend the existing format import — the file
already has `import { relativeTime, roman, sp, stamp } from "../../lib/view/format.js";`, so add
`duration` to that same statement rather than opening a second one:

```ts
import { listPlans } from "../../lib/db/skill-plans.js";
import { listCareerPlans } from "../../lib/sde/repo.js";
import { summarisePlans } from "../../lib/skills/load.js";
import { duration, relativeTime, roman, sp, stamp } from "../../lib/view/format.js";
import { PlansCard, type PlanListRow } from "./PlansCard.js";
```
(`getGroups`, `getTypeAttributes` and `getTypes` are already imported from `../../lib/sde/repo.js`
— add `listCareerPlans` to that statement too, not a second one.)

extend the existing `Promise.all` that already reads the character's data — add `listPlans` and
`listCareerPlans` to it:

```ts
  const [summary, attributes, queue, skills, implantIds, clones, storedPlans, templates] = await Promise.all([
    getSkillSummary(character.id),
    getAttributes(character.id),
    listSkillQueue(character.id),
    listSkills(character.id),
    listImplants(character.id),
    getClones(character.id),
    listPlans(character.id),
    listCareerPlans(),
  ]);
```

build the rows after `groupProps` is built:

```ts
  const planRows: PlanListRow[] = (await summarisePlans(storedPlans)).map((plan) => ({
    id: plan.id,
    name: plan.name,
    entries: plan.entryCount,
    remaining: duration(plan.totalMs),
    doneAt: stamp(plan.doneAt),
  }));
```

and render the card between the training queue and the skill sheet:

```tsx
      <div className="card">
        <h2 className="card-title">Training queue</h2>
        <QueueTable entries={entries} />
      </div>
      <PlansCard
        characterId={character.id}
        plans={planRows}
        templates={templates.map((t) => ({ id: t.id, name: t.name ?? `Plan ${t.id}` }))}
      />
      <div className="card">
        <h2 className="card-title">Skills</h2>
        <SkillGroups groups={groupProps} />
      </div>
```

`now` is the `const now = new Date();` the page already declares before its `Promise.all`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/plans-card.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run everything, type check and build**

```bash
npm test && npm run typecheck && npm run build
```
Expected: all green; `next build` succeeds with no `pg` / `node:fs` complaint.

- [ ] **Step 7: Commit**

```bash
git add src/app/skills/PlansCard.tsx src/app/skills/page.tsx tests/components/plans-card.test.tsx
git commit -m "$(cat <<'EOM'
Add the Plans section to /skills

The active character's plans with entry counts, remaining time and completion
date, plus New plan, From template (CCP's 40 career plans) and Import. Unresolved
import lines are listed under the textarea rather than failing the import.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 17: Deploy phase 6 to the VM and record acceptance

The acceptance for the whole phase. No Ansible or env changes: the existing `eve` role rsyncs the
repo, rebuilds the image, runs `npm run migrate` (which now applies `skill_plans` and
`skill_plan_entries` from `db/schema.sql`) and restarts the app and worker.

**Phase 6 *does* add `sde_*` tables**, and that changes the deploy: `migrate` creates
`sde_alpha_skills` and `sde_skill_plans` **empty**, and the worker's `sde-update` job short-circuits
whenever the published build number already matches `sde_meta.build_number` — so it would never fill
them. A forced `npm run sde:import` is therefore **mandatory** on this deploy (spec §3's ruling).

**Files:**
- Modify: `deploy/README.md` (a "Skill planner" section, and a line in the SDE section)

**Interfaces:**
- Consumes: Tasks 1–16, all committed on `feature/phase6-skill-planner`.
- Produces: `https://eve.plasma66.com/skills` with a live Plans section, `/skills/plans/[id]` serving
  the editor, and populated `sde_alpha_skills` / `sde_skill_plans` / `skill_plans` tables in the
  production database.

- [ ] **Step 1: Confirm the branch is clean and green**

```bash
cd /home/daniel/AI/Plasma/EVE
git status --short
docker compose -f compose.dev.yml up -d
npm test && npm run typecheck && npm run build
```
Expected: no uncommitted changes; every test passes with pristine output; `tsc --noEmit` clean;
`next build` succeeds. A build failure naming `pg`, `node:fs` or `dns` means a `"use client"`
component imported `src/lib/skills/load.js` or a `db`/`sde` module — fix that before deploying.

- [ ] **Step 2: Document the planner in `deploy/README.md`**

Add to the end of the existing "Static data (SDE)" section:

```markdown
- **A release that adds new `sde_*` tables needs a forced import.** The `sde-update` job only
  downloads when the published build number differs from `sde_meta.build_number`, so tables added by
  a migration stay empty until `npm run sde:import` is run by hand (the command above). Phase 6's
  `sde_alpha_skills` and `sde_skill_plans` were filled that way.
```

and add a new section after "Fitting designer":

```markdown
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
```

- [ ] **Step 3: Deploy**

```bash
cd deploy/ansible && script -qc "ansible-playbook site.yml --tags eve" /dev/null
```
Expected: play recap with `failed=0`. The image rebuild takes a few minutes on the VM.
(`script -qc … /dev/null` gives Ansible the TTY it wants; without it the playbook can abort on
non-blocking stdio.)

- [ ] **Step 4: Confirm the containers came back and the site is healthy**

```bash
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
curl -sS https://eve.plasma66.com/api/health
```
Expected: `eve-app`, `eve-worker`, `eve-postgres`, `traefik` all `Up`; health returns
`{"ok":true,"db":true}`.

- [ ] **Step 5: Confirm the migration created the two plan tables**

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select table_name from information_schema.tables
  where table_schema='public' and table_name like 'skill_plan%' order by table_name\""
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select conname, confdeltype from pg_constraint
  where conrelid in ('skill_plans'::regclass,'skill_plan_entries'::regclass) and contype='f'\""
```
Expected: `skill_plan_entries` and `skill_plans`; two foreign keys, both with `c` (cascade) —
`skill_plans.character_id → characters` and `skill_plan_entries.plan_id → skill_plans`.

- [ ] **Step 6: Force the SDE re-import so the two new reference tables fill**

```bash
ssh daniel@10.5.5.150 'cd /opt/eve/src/deploy && docker compose exec -T worker npm run sde:import'
```
Expected: the importer downloads the current archive (~95 MB), logs
`cloneGrades.jsonl → sde_alpha_skills=175` and `skillPlans.jsonl → sde_skill_plans=40` among the
other members, and finishes with `swapped 19 tables into public`. This takes several minutes,
mostly download. **This step is not optional** — without it both tables stay empty, every plan row
loses its Alpha badge and "From template" offers nothing.

- [ ] **Step 7: Verify the new reference data landed**

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select (select count(*) from sde_alpha_skills), (select count(*) from sde_skill_plans),
         (select max_level from sde_alpha_skills where skill_id = 3300),
         (select name from sde_skill_plans order by id limit 1)\""
```
Expected: `175|40|5|Minmatar Militia Fighter`.

- [ ] **Step 8: Acceptance — Daniel, in a browser on the tailnet**

Work through this list and record the result of each item.

1. `https://eve.plasma66.com/skills` loads with the nav item **Skills** highlighted, and a **Plans**
   card sits between the training queue and the skill sheet reading
   "No plans yet — start one with 'New plan'."
2. **New plan** → name it "Gunnery test" → the editor opens at `/skills/plans/<id>` with the nav
   item **Skills** still highlighted, the character's name beside the plan name and an empty table.
3. **Add skill**: search "advanced weapon" and add **Advanced Weapon Upgrades V**. The table fills
   with the whole prerequisite chain in trainable order — Gunnery levels, then Weapon Upgrades
   levels, then Advanced Weapon Upgrades I–V — with every inserted row tagged `prereq` and indented,
   and levels you have already trained **absent**. Nothing appears twice.
4. Every row shows a rank (`×6` for Advanced Weapon Upgrades), the SP for that level, its own time,
   the cumulative time and a completion date, and a status badge of **Done**, **In queue** or
   **Planned**. Levels inside the Alpha set carry an `alpha` badge.
5. **The head-entry check (the most important item on this list).** Take the first **Planned** row
   in the table and compare its **Time** with what the in-game client shows for training that exact
   skill level right now. They must agree to within a minute. If they do not, the attributes or the
   implant bonuses are wrong — check the Attributes panel's per-attribute breakdown against the
   character sheet in game before blaming the formula.
6. **Attributes panel**: the five attributes show `total` with a `+n` implant bonus and the base
   underneath, matching the in-game character sheet. The **Training rate** list shows one row per
   attribute pair the remaining work uses, in SP/hour. No warning banner appears (if it does, the
   stored attributes are not a legal 17–27 / total-99 base — say so in the acceptance note).
7. **Find optimal remap** → within a second or two the panel shows the five deltas (e.g.
   Perception 21 → 27), the plan time with the remap, the plan time as you are, and the saving.
   Tick **Plan with this remap** → every time in the table shrinks, the totals shrink by the stated
   saving, and reloading the page keeps the remap applied. Untick it → everything returns.
8. **After current queue** → every completion date shifts to start at the end of the real ESI queue,
   and the totals' **Done** date moves by the same amount.
9. **Account rule**: open a plan for a character whose account-mate is training. A banner reads
   "<name> is training until <date> — this plan can't start before then", and ticking **Start when
   the account is free** pushes the timeline out to that date. (If both characters' queues are
   empty, note that this item could not be exercised.)
10. **Autosave**: rename the plan, move an entry up, raise a level, wait two seconds, see "Saved",
    reload — the name, the order and the levels all survive.
11. **Export** → the modal shows text beginning with the first skill of the plan. **EVEMon (Roman)**
    gives `Gunnery V`-style lines; **In-game (Arabic)** gives `Gunnery 5`-style lines; one line per
    level; already-trained levels are absent. **Copy** puts it on the clipboard.
12. **Paste that in-game text into EVE's own skill-plan importer** (Skills window → skill plan area
    → hamburger → Import). The client accepts it and the resulting plan matches. This is the
    end-to-end proof and the one item worth redoing if anything looks off.
13. Back on `/skills`, **From template** → pick "Minmatar Militia Fighter" → a plan opens carrying
    CCP's own skill list, expanded with prerequisites.
14. **Import** → paste the text exported in item 11 plus one junk line ("Damage Controll II") →
    the card lists that line as unresolved and offers **Open plan**; the opened plan contains
    everything else.
15. **Delete** a plan from the `/skills` list; it disappears and does not come back on reload.
16. Open DevTools → Network on the editor: editing a row, moving it or changing a level fires **no**
    request at all (the maths is local); only the 2 s autosave `PUT`, the `optimise` `POST` and the
    `export` `GET` should appear.

- [ ] **Step 9: Commit the acceptance and merge**

```bash
cd /home/daniel/AI/Plasma/EVE
git add deploy/README.md
git commit -m "$(cat <<'EOM'
Deploy phase 6 (skill planner) and record acceptance

Acceptance: skill_plans/skill_plan_entries created by the migration; forced
sde:import filled sde_alpha_skills (175) and sde_skill_plans (40); a plan for
Advanced Weapon Upgrades V expanded its full prerequisite chain in trainable
order with no duplicates; the head planned entry's time matched the in-game
queue estimate to <n> s; the optimal remap suggested <deltas> and saved <time>;
after-current-queue, the account-rule banner, autosave, template creation,
import with an unresolved line and delete all behaved as listed. The in-game
Arabic export pasted into EVE's own skill-plan importer and produced the same
plan. Editing fires no network request.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
git checkout main && git merge --no-ff feature/phase6-skill-planner
```

---

## Self-review

**1. Spec coverage.**

| Spec | Task |
|---|---|
| §2 `spForLevel(rank, level) = ceil(250 * rank * 2**(2.5*(level-1)))`, Alpha-set proof at 19,669,072 | 2 |
| §2 `spBetween(rank, from, to)` | 2 |
| §2 attribute ids 164–168; 180/181 hold them; `spPerMinute = primary + secondary/2` | 3 |
| §2 ruling: Omega rate only, no ×0.5 Alpha factor | Global Constraints, 3 |
| §2 effective attributes = `character_attributes` + implant bonuses 175–179; boosters ignored | 3, 10 |
| §2 remap model: base 17, 14 free points, max 27 each, total 99 | 3 |
| §2 `optimalRemap(plan, implants)` enumerates every distribution, returns the fastest and the saving | 7 |
| §2 prerequisite attribute pairs, recursive `expandPlan`, skip trained/queued, no duplicates | 1 (repo pivot), 5 |
| §2 queue overlay: `queued` not counted, `done` marked | 6, 10 |
| §2 mid-training SP interpolated from `training_start_sp` / `level_end_sp` / the dates | 2, 10 |
| §2 timeline: cumulative finish times from `now`, or from the queue's end | 6, 10 |
| §3 `cloneGrades.jsonl` → `sde_alpha_skills (skill_id, max_level)`, first grade only, Alpha badge | 1, 4, 13 |
| §3 `skillPlans.jsonl` → `sde_skill_plans (id, name, description, skills, milestones)`, 40 templates | 1, 16 |
| §3 ruling: the deploy task runs a forced `sde:import` from the worker container | 17 |
| §4 `skill_plans` (character cascade, `remap jsonb`) and `skill_plan_entries` (`position` PK part) | 9 |
| §5 `/skills` gains a Plans section: list, New plan, From template, Import | 16 |
| §5 `/skills/plans/[id]` client editor with server-loaded data | 15 |
| §5 header: inline name, character, totals (entries, SP, time, done-at), "after current queue" | 15 |
| §5 table: position, skill+group, level, rank, SP, time, cumulative, done-at, status badge | 13, 14 |
| §5 move up/down, remove, level +/−; prerequisite rows indented and tagged | 13, 14, 15 |
| §5 Add skill by search over category 16, level pick, prerequisites inserted, levels 1..N added | 15 (see Decision 10 — searched in memory) |
| §5 Attributes panel: current with per-attribute breakdown, SP/hour per pair | 13, 14 |
| §5 Optimal remap: deltas, new total time, time saved, "plan with this remap" toggle | 7, 13, 14, 15 |
| §5 remap availability from `bonus_remaps` / `accrued_remap_cooldown_date` | 10, 13, 14 |
| §5 account-rule banner and the "start when account is free" offset | 10, 15 |
| §5 Export modal: EVEMon Roman and in-game Arabic, copy buttons | 8, 12, 15 |
| §5 Import accepts Roman or Arabic, bare name = level I, unknown lines reported | 8, 12, 16 |
| §5 explicit Save plus 2 s autosave | 15 |
| §6 `GET/POST /api/skill-plans?characterId=` with `entries?` / `templateId?` | 11 |
| §6 `GET/PUT/DELETE /api/skill-plans/[id]`, entries replaced then re-expanded server-side | 11 |
| §6 `POST /api/skill-plans/[id]/optimise` → `{ remap, totalMs, savedMs }` | 12 |
| §6 `POST /api/skill-plans/import` → plan | 12 |
| §6 `GET /api/skill-plans/[id]/export?format=evemon\|ingame` → `text/plain` | 12 |
| §6 the server computes the timeline; the client recomputes only for instant feedback | 10, 11, 15 |
| §7 unknown skill ids render as `Unknown skill (id)` and cost 0 time | 4, 6, 13, 14 |
| §7 a character with no synced skills computes from level 0, with a banner | 10, 15 |
| §7 import lines that do not resolve are listed, not fatal | 8, 12, 16 |
| §8 unit: `spForLevel` table, Alpha-set sum, `spPerMinute`, implant bonuses, interpolation | 2, 3 |
| §8 unit: `expandPlan` (nesting, skipping, duplicates, ordering) | 5 |
| §8 unit: timeline cumulative times | 6 |
| §8 unit: `optimalRemap` on a Gunnery-heavy plan → perception/willpower | 7 |
| §8 unit: EVEMon/in-game parse + serialise round trips, Roman conversion | 8 |
| §8 DB: plans/entries repo, cascade delete | 9 |
| §8 API: route handlers with mocked repos; export content types | 11, 12 |
| §8 component: status badges, add-skill inserting prerequisites, remap panel | 14, 15 |
| §8 acceptance on the VM, including the in-game paste | 17 |
| §9 out of scope (Alpha rates, boosters, extractors, certificates, ship-mastery plans, sharing) | not implemented anywhere |

No spec requirement is left without a task.

**2. Placeholder scan.** No "TBD", no "similar to Task N", no "add error handling", no step that
describes without showing. Every code step carries complete code. The deliberately open values are
the acceptance commit message's `<n>` / `<deltas>` / `<time>` placeholders (Task 17 Step 9), which
are measurements the operator fills in.

**3. Type consistency.** Traced end to end:
`spForLevel` / `spBetween` / `trainingMs` / `currentSpInTraining` (2) → `planTimeline` (6) →
`planDurationMs` (6) → `optimalRemap` (7) → the optimise route (12).
`AttributeSet` / `ATTRIBUTE_KEYS` / `ATTRIBUTE_ATTR` / `addAttributes` / `implantBonuses` /
`effectiveAttributes` / `spPerMinute` / `isLegalBase` / `enumerateBases` (3) → `skillRate` (4) →
`planTimeline` (6) → `optimalRemap` (7) → `parseRemap` (11) → `loadPlanContext` (10) →
`attributePanel` / `remapSuggestion` (13) → `AttributesPanel` (14) → `PlanEditor` (15).
`CatalogueRow` (4) is structurally exactly `SdePlanSkill` (1); `buildCatalogue` (4) consumes it,
`catalogueFrom` (4) indexes it, `loadSkillCatalogue` (4/10) produces `PlanSkill[]`, and that array
is what `/skills/plans/[id]/page.tsx` (15) passes as props and `PlanEditor` (15) re-indexes.
`PlanEntry` (5) is the repo's write shape (9), the parser's output (11) and the editor's state (15).
`ExpandedEntry` (5) → `planTimeline` / `planDurationMs` (6) → `optimalRemap` (7).
`Timeline` / `TimelineEntry` / `PlanStatus` (6) → `planView` / `attributePanel` (13) → the export
route's `status !== "done"` filter (12) → `PlanTable` (14).
`PlanRowView.entryIndex` (13) → `PlanTable`'s callbacks (14) → `moveEntry` / `removeEntry` /
`levelEntry` in `PlanEditor` (15), which index the STORED entries.
`PlanRow` / `PlanEntryRow` / `PlanInput` / `PlanPatch` (9) → the CRUD routes (11) → `computePlan`
and `summarisePlans` (10, 11) → `PlanSummary` (11) → `PlanListRow` (16).
`PlanTextFormat` / `tokenisePlanText` / `resolvePlanLines` / `exportPlanText` (8) → the import and
export routes (12) → the editor's export modal (15).
`SdeCareerPlan` (1) → the POST route's template branch (11) → `PlansCard`'s template select (16).

**4. Corrections made while writing this plan** (they matter to the executor):
- **`spForLevel` is cumulative, and the Alpha proof only works that way.** Summing
  `spForLevel(rank, cap)` over clone grade 1 gives 19,669,072 exactly; summing the per-level
  increments gives 23,865,618. Both sums were run against the real archive while writing this.
- **`skillPlans.jsonl` has no `skills` field.** The list is `skillRequirements`; the spec's column
  name is kept and the mapper reads the real field. `milestones` does exist, as named.
- **`SdePgType` has no `jsonb` member today**, and the importer builds its `unnest` casts from it,
  so the spec's two `jsonb` columns require widening that union. Passing `pg` an array of JSON
  strings for a `jsonb[]` parameter was verified against the dev database, quotes and commas
  included.
- **`enumerateBases()` yields 2,885 tuples, not 14,641.** The spec's "≤ 14,641 candidates" counts
  the 11⁴ loop iterations; most leave charisma outside 0..10 and are skipped.
- **Spec §2 and the research disagree about implants in `character_attributes`.** The spec says the
  stored values exclude them; EVEMon subtracts them, believing ESI includes them. This plan follows
  the spec and adds a visible sanity check (Decision 4) instead of guessing.
- **The editor searches the catalogue in memory** rather than calling `GET /api/sde/types?category=16`
  as spec §5 suggests. The page already ships the catalogue for the maths, so a request would be
  slower and could disagree with the numbers next to it. The phase-5 route is untouched.
- **Phase 6 adds `sde_*` tables, so the deploy needs a forced `sde:import`** — unlike phase 5, where
  the step was explicitly unnecessary. The `sde-update` job short-circuits on an unchanged build
  number and would leave both new tables empty.

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast
   iteration. Uses `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute the tasks in one session with checkpoints, using
   `superpowers:executing-plans`.
