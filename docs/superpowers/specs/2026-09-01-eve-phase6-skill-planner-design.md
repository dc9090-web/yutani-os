# EVE Phase 6 — Skill Planner

**Date:** 2026-09-01
**Status:** Approved by delegation (project overview §2; rulings recorded inline)
**Depends on:** Phase 2 (`sde_*`), Phase 3 (`character_skills`, `character_skill_queue`, `character_attributes`, `character_implants`)
**Research:** `docs/research/skill-planner.md` (formulas verified against the SDE; EVEMon behaviour; formats)

## 1. Goal

EVEMon-style plans per character: build an ordered list of skill levels (prerequisites inserted automatically),
see SP and training time per entry and in total with the character's real attributes and implants, get an
optimal-remap suggestion, respect the one-trainer-per-account rule, and import/export plans as text.

## 2. Mechanics (`src/lib/skills/`, pure, unit-tested)

- `spForLevel(rank, level) = Math.ceil(250 * rank * 2 ** (2.5 * (level - 1)))` (rank = attribute 275
  `skillTimeConstant`); verified by summing the Alpha set to 19,669,072. `spBetween(rank, from, to)`.
- Attributes: primary 180 / secondary 181 hold attribute ids 164 charisma, 165 intelligence, 166 memory, 167
  perception, 168 willpower. `spPerMinute = primary + secondary / 2`; Ruling: Omega rate only (no ×0.5 Alpha
  factor) — all four characters are Omega. Cost if wrong: a flag on the character.
- Effective attributes = `character_attributes` values (ESI reports base+remap, **excluding** implants) +
  implant bonuses from `sde_type_attributes` 175–179 on `character_implants`. Boosters ignored.
- Remap model: each attribute base 17, 14 free points, max 27 per attribute (total 99). `optimalRemap(plan, implants)`
  enumerates every distribution (≤ 14,641 candidates) and returns the one minimising total plan time, plus the
  time saved versus current attributes.
- Prerequisites: `sde_type_attributes` pairs (182,277) (183,278) (184,279) (1285,1286) (1289,1287) (1290,1288),
  expanded recursively; `expandPlan(entries, known)` inserts each missing prerequisite level before the entry
  that needs it, skipping levels the character already has (trained or queued), and never duplicates a level.
- Queue overlay: the character's ESI queue entries count as "will have" — plan entries already in the queue
  are marked `queued` (not counted in the plan's remaining time); levels already trained are marked `done`.
- Current SP in a training skill: interpolate from the head queue entry's `training_start_sp`,
  `level_end_sp`, `start_date`, `finish_date` (derive the rate from the dates, per EVEMon).
- Timeline: cumulative finish times from `now` (or from the ESI queue's end when "after current queue" is on).

## 3. Static data additions (phase-2 importer, declarative)

- `cloneGrades.jsonl` → `sde_alpha_skills (skill_id int PK, max_level int)` (the Alpha set; all racial grades
  are identical — take the first). Used to badge "Alpha-trainable".
- `skillPlans.jsonl` → `sde_skill_plans (id int PK, name text, description text, skills jsonb, milestones jsonb)`
  — CCP's 40 career plans, offered as templates.
Re-import on the VM after deploy (the worker's next `sde-update` tick sees the same build; the CLI `npm run
sde:import` is run once from the worker container, or `sde_meta.build_number` is set to 0 to force it — Ruling:
the deploy task runs `docker compose exec worker npm run sde:import`).

## 4. Data model

```
skill_plans          id serial PK, character_id bigint REFERENCES characters ON DELETE CASCADE, name text,
                     remap jsonb,            -- null | { charisma, intelligence, memory, perception, willpower }
                     created_at, updated_at
skill_plan_entries   (plan_id int REFERENCES skill_plans ON DELETE CASCADE, position int) PK, skill_id int, level int,
                     note text
```

## 5. UI

- **`/skills`** (phase 3 page) gains a **Plans** section: plan list for the active character (name, entries,
  remaining time, done-at) and **New plan** / **From template** (CCP plans) / **Import**.
- **`/skills/plans/[id]`** — plan editor (client component with server-loaded data):
  - Header: name (inline edit), character, totals (entries, SP, time, done-at), toggle **after current queue**.
  - Table: position, skill (name, group), level (I–V), rank, SP for that level, time, cumulative time, done-at,
    status badge (`done` / `queued` / `planned`), move up/down, remove, level +/−. Prerequisite entries are
    indented/tagged `prereq`.
  - **Add skill**: search category 16 (`GET /api/sde/types?q=&category=16`), pick level; prerequisites are
    inserted automatically; adding a skill at level N adds levels 1..N as needed.
  - **Attributes panel**: current (base + implants) with per-attribute breakdown, SP/hour per primary/secondary
    pair used by the plan, **Optimal remap** suggestion (attribute deltas, new total time, time saved) and a
    "plan with this remap" toggle that recomputes the timeline; remap availability from `character_attributes`
    (`bonus_remaps`, `accrued_remap_cooldown_date`).
  - **Account rule** banner: if another character on the same account has a queue finishing in the future,
    show "Jorin Hale is training until <date> — this plan can't start before then" (informational; timeline
    offset option "start when account is free").
  - **Export** modal: EVEMon text (`Skill Name V` with Roman numerals) and in-game format (Arabic digits, one
    line per level, e.g. `Gunnery 5`), copy buttons. **Import** accepts both (Roman or Arabic; `Skill Name` alone
    means level I; unknown lines reported).
  - Save is explicit (`PUT`), with autosave 2 s after the last change.

## 6. API routes

```
GET/POST  /api/skill-plans?characterId=        list / create { characterId, name, entries?, templateId? }
GET/PUT/DELETE /api/skill-plans/[id]           PUT { name?, remap?, entries }  (entries replaced wholesale, then re-expanded server-side)
POST      /api/skill-plans/[id]/optimise       → { remap, totalMs, savedMs }
POST      /api/skill-plans/import              { characterId, name, text } → plan
GET       /api/skill-plans/[id]/export?format=evemon|ingame  → text/plain
```
Server computes the timeline (`GET /api/skill-plans/[id]` returns entries with SP/time/status) so the page and
the client agree; the client recomputes locally only for instant feedback while editing.

## 7. Error handling

Unknown skill ids (SDE drift) render as `Unknown skill (id)` and contribute 0 time; a plan for a character with
no synced skills computes from level 0 with a banner; import lines that don't resolve are listed, not fatal.

## 8. Testing

- **Unit:** `spForLevel` table (rank 1: 250, 1415, 8000, 45255, 256000; Alpha-set sum 19,669,072 from a fixture
  of the 175 skills' ranks/caps), `spPerMinute`, implant bonus application, mid-training SP interpolation,
  `expandPlan` (nested prerequisites, skip trained/queued, no duplicates, ordering), timeline cumulative
  times, `optimalRemap` (a Gunnery-heavy plan → perception/willpower), EVEMon/in-game parse + serialise
  round-trips, Roman numeral conversion.
- **DB:** plans/entries repo; cascade delete.
- **API:** route handlers with mocked repos; export content types.
- **Component:** plan table status badges, add-skill inserting prerequisites, remap panel.
- **Acceptance on the VM:** create a plan for one character, add a level-V skill with prerequisites, compare
  the computed time for the head entry with the in-game skill queue estimate (within the rounding of a minute),
  export in the in-game format and paste into the client's skill plan importer.

## 9. Out of scope

Alpha clone training rates, boosters/accelerators, skill extractor/injector maths, certificate/mastery views,
ship-mastery plans (the "From template" list covers CCP plans only), plan sharing.
