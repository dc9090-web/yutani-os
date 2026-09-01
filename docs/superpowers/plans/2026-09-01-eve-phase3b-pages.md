# EVE Phase 3b (Character Sync — pages and API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the character data phase 3a syncs into the four pages the spec describes — a real Overview, `/skills`, `/assets` and `/wallet` — plus the `GET /api/characters/[id]/wallet` JSON route that backs "Show more", and then deploy and accept the whole of phase 3 on the VM.

**Architecture:** Every page is a Next server component that reads Postgres through the phase-3a repos and the phase-2 SDE repo, batches all its id→name lookups into one call per kind, and hands plain serialisable view objects to presentational components. All display logic lives in pure, unit-tested helpers under `src/lib/view/` (`format.ts`, `enums.ts`, `assets.ts`, `skills.ts`, `wallet.ts`), so the components stay dumb and the component tests stay small. Only three components are `"use client"`: the collapsible skill groups, the asset tree (expand/collapse + filter) and the wallet tables (which fetch the next 100 rows from the JSON route).

**Tech Stack:** TypeScript 5.9 strict + ESM (local imports carry the `.js` extension), Next.js 16 server components + `"use client"` islands, Mantine 9 (theme only — layout is the Midnight CSS in `src/app/globals.css`), Tabler icons, Node 24, `pg` 8, Postgres 17, vitest 4 with happy-dom + `@testing-library/react`. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-01-eve-phase3-character-sync-design.md` — this plan implements **§7 (UI)**, **§8 (API routes)**, the component/unit parts of **§10** that cover them, and the **§10 acceptance-on-the-VM** step for the whole of phase 3. §2–§6, §9 and the rest of §10 are phase 3a.

**Depends on:** `docs/superpowers/plans/2026-09-01-eve-phase3a-sync.md`, fully implemented and committed on `feature/phase3-character-sync` before this plan starts. Its final "Interfaces for phase 3b" section is the contract; every task below quotes the exact signatures it consumes.

**Research (enum vocabularies):** `docs/research/esi-endpoints.md` §8a (`location_flag`, 89 members) and §2.8 (`ref_type`, ~180 members).

## Global Constraints

- **TypeScript strict, ESM.** Imports between local TS files carry the `.js` extension. `npm run typecheck` (`tsc --noEmit`) covers `tests/**` too and must stay clean.
- **Server components read repos directly.** No `fetch` to our own API from a page, no client-side data loading except the wallet "Show more" button. `export const dynamic = "force-dynamic"` is already set in `src/app/layout.tsx`; do not add per-page caching directives.
- **Pages read only Postgres.** A page or a route handler never calls ESI. `locationLabel`/`locationLabels`/`displayNames` are Postgres-only; `resolveNames`/`resolveLocations` hit ESI on a cache miss and belong to the worker.
- **Batch every lookup.** Collect all type ids on a page and call `getTypes(ids)` **once**; all location ids go through **one** `locationLabels(ids)`; all party ids through **one** `displayNames(ids)`. Never query inside a row loop.
- **`"use client"` only for interaction** — expand/collapse, filter, "show more". Everything else is a server component.
- **Midnight tokens only.** Colours come from the CSS variables in `src/app/globals.css`; new styling is a new class in that file. **Never inline a colour** in a component. Reuse the existing classes (`card`, `card-title`, `card-grid`, `table`, `badge`, `muted`, `faint`, `pos`, `neg`, `coming-soon`, `page-title`, `page-sub`).
- **Tabler icons** (`@tabler/icons-react`) for any iconography.
- **"Active character" = `readSession()?.activeCharacterId`**, falling back to the first character of `listCharacters()`. A page with no character at all renders the phase-1 empty card (`<div className="card coming-soon">No characters yet — use the menu top-right to add one.</div>`).
- **"Not synced yet" placeholders.** A table with no rows renders a `faint` sentence, never a blank card and never a crash (spec §9).
- **ESI enums are open vocabularies.** `location_flag` and `ref_type` humanisers must have a total fallback (the raw value / a generic snake_case rule) and no exhaustive `switch`.
- **`bigint`/`numeric` are already `Number`s** by the time a repo read returns them — phase 3a does that mapping. Do not re-map.
- Tests live in `tests/**` mirroring `src/**`. `npm test` = `vitest run` with `fileParallelism: false`; the environment is happy-dom with `tests/setup.ts`. DB tests use `tests/db/helpers.ts` (`resetDb`, `resetSde`) against `eve_test` on the local compose Postgres (`postgres://eve:eve@127.0.0.1:5432/eve_test`; start it with `docker compose -f compose.dev.yml up -d`).
- **No network in tests.** The wallet "Show more" test mocks `globalThis.fetch`; the route-handler test mocks the repo modules.
- Work happens on branch `feature/phase3-character-sync`. **Every task ends with a commit.** Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- VM: `ssh daniel@10.5.5.150`, site `https://eve.plasma66.com`, Ansible in `deploy/ansible`.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/view/format.ts` | Pure: `grouped`, `isk`, `sp`, `roman`, `relativeTime`, `secClass`, `secText`, `trainingLabel` |
| `src/lib/view/enums.ts` | Pure: `flagLabel` (asset `location_flag`), `refTypeLabel` (wallet `ref_type`) |
| `src/lib/view/characters.ts` | Modified: `pickActive(characters, activeId)` |
| `src/app/components/NoCharacter.tsx` | The shared "no characters yet" empty page |
| `src/lib/view/assets.ts` | Pure: `buildAssetTree`, `toViewNodes`, `sumVolume`, `filterAssetTree` |
| `src/lib/view/skills.ts` | Pure: `attributeViews`, `queueProgress`, `groupSkills` |
| `src/lib/view/wallet.ts` | Pure `toJournalViews`/`toTransactionViews` + repo-backed `loadJournalViews`/`loadTransactionViews` |
| `src/lib/sde/repo.ts` | Modified (**new in 3b**): `getGroups`, `getSolarSystems`, `getStations` |
| `src/lib/names/label.ts` | Modified (**new in 3b**): batched `locationLabels`, `displayNames`; `locationLabel` delegates |
| `src/lib/names/index.ts` | Modified: re-exports `locationLabels`, `displayNames` |
| `src/worker/jobs/clones.ts` | Modified (**new in 3b**): resolves the home + jump-clone locations so the page can label them |
| `src/worker/jobs/wallet.ts` | Modified (**new in 3b**): resolves transaction `location_id`s for the same reason |
| `src/app/page.tsx` | Overview — one card per character |
| `src/app/components/CharacterCard.tsx` | Presentational Overview card |
| `src/app/skills/page.tsx` | Skills page — assembles summary, queue, groups, clones |
| `src/app/skills/SkillSummaryCard.tsx` | Total SP, unallocated SP, attributes with implant bonuses, remap info |
| `src/app/skills/QueueTable.tsx` | Training queue table with the head-entry progress bar |
| `src/app/skills/SkillGroups.tsx` | `"use client"` — collapsible groups, five level boxes per skill |
| `src/app/skills/ClonesCard.tsx` | Active implants, jump clones, home location |
| `src/app/assets/page.tsx` | Assets page — one query, tree built in `src/lib/view/assets.ts` |
| `src/app/assets/AssetsBrowser.tsx` | `"use client"` — location expand/collapse, item expand/collapse, name filter |
| `src/app/wallet/page.tsx` | Wallet page — balance + the first 100 journal and transaction rows |
| `src/app/wallet/WalletTables.tsx` | `"use client"` — the two tables and their "Show more" buttons |
| `src/app/api/characters/[id]/wallet/route.ts` | `GET ?kind=journal\|transactions&offset=N`, 100 rows |
| `src/app/globals.css` | Modified: `--warn` token + Overview / Skills / Assets / Wallet classes |
| `tests/view/{format,enums,assets,skills,wallet}.test.ts` | Pure-helper unit tests |
| `tests/view/characters.test.ts` | Modified: `pickActive` |
| `tests/db/sde-repo.test.ts` | Modified: `getGroups`, `getSolarSystems`, `getStations` |
| `tests/db/name-label.test.ts` | Modified: `locationLabels`, `displayNames` |
| `tests/worker/{clones,wallet}.test.ts` | Modified: the new `resolveLocations` dependency |
| `tests/components/{no-character,character-card,skill-summary,queue-table,skill-groups,clones-card,assets-browser,wallet-tables}.test.tsx` | happy-dom component tests |
| `tests/api/wallet-route.test.ts` | Route-handler test with mocked repos |
| `tests/proxy.test.ts` | Modified: the wallet route is session-guarded |

---

### Task 1: View formatters, ESI enum humanisers and the active-character helper

Everything the four pages need to turn numbers, dates and open ESI vocabularies into text. All pure,
all unit-tested, no I/O.

**Files:**
- Create: `src/lib/view/format.ts`, `src/lib/view/enums.ts`, `src/app/components/NoCharacter.tsx`
- Modify: `src/lib/view/characters.ts`
- Test: `tests/view/format.test.ts`, `tests/view/enums.test.ts`, `tests/view/characters.test.ts` (modify), `tests/components/no-character.test.tsx`

**Interfaces:**
- Consumes (phase 1, already in the repo, verbatim):
```ts
// src/lib/view/characters.ts
export interface CharacterView { id: number; name: string; accountId: number | null; corporationName: string | null; allianceName: string | null; tokenStatus: "ok" | "needs_reauth" }
export function portraitUrl(id: number, size: 64 | 128 | 256 = 64): string
```
- Produces:
```ts
// src/lib/view/format.ts
export function grouped(value: string | number): string;
export function isk(value: number): string;                 // "1,234,567.89 ISK"
export function sp(value: number): string;                  // "12.3M SP" | "850k SP" | "512 SP"
export function roman(level: number): string;               // 0..5 -> "" | "I".."V"
export function relativeTime(date: Date | null, now?: Date): string;   // "in 3 h 12 m" | "2 days ago" | "just now" | "never"
export type SecClass = "sec-high" | "sec-low" | "sec-null";
export function secClass(status: number | null): SecClass;
export function secText(status: number | null): string;     // "0.9" | "—"
export interface QueueHeadLabel { skillName: string; finishedLevel: number; finishDate: Date | null }
export function trainingLabel(head: QueueHeadLabel | null, now?: Date): string;

// src/lib/view/enums.ts
export function flagLabel(flag: string): string;            // "HiSlot3" -> "High slot 4"
export function refTypeLabel(refType: string): string;      // "market_transaction" -> "Market transaction"

// src/lib/view/characters.ts (added)
export function pickActive<T extends { id: number }>(characters: T[], activeId: number | null): T | null;

// src/app/components/NoCharacter.tsx
export function NoCharacter({ title }: { title: string }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/view/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { grouped, isk, sp, roman, relativeTime, secClass, secText, trainingLabel } from "../../src/lib/view/format.js";

const NOW = new Date("2026-09-01T12:00:00Z");

describe("grouped", () => {
  it("adds thousands separators without touching the fraction or the sign", () => {
    expect(grouped(0)).toBe("0");
    expect(grouped(999)).toBe("999");
    expect(grouped(1000)).toBe("1,000");
    expect(grouped(1234567)).toBe("1,234,567");
    expect(grouped("1234567.89")).toBe("1,234,567.89");
    expect(grouped("-1234.50")).toBe("-1,234.50");
  });
});

describe("isk", () => {
  it("always shows two decimals and the ISK suffix", () => {
    expect(isk(1234567.891)).toBe("1,234,567.89 ISK");
    expect(isk(0)).toBe("0.00 ISK");
    expect(isk(-4500)).toBe("-4,500.00 ISK");
    expect(isk(4.187)).toBe("4.19 ISK");
  });
});

describe("sp", () => {
  it("switches units at a million and at a thousand", () => {
    expect(sp(47382910)).toBe("47.4M SP");
    expect(sp(1000000)).toBe("1.0M SP");
    expect(sp(999999)).toBe("999k SP");     // floored, so it never reads "1000k"
    expect(sp(850000)).toBe("850k SP");
    expect(sp(45255)).toBe("45k SP");
    expect(sp(512)).toBe("512 SP");
    expect(sp(0)).toBe("0 SP");
  });
});

describe("roman", () => {
  it("renders skill levels", () => {
    expect([0, 1, 2, 3, 4, 5].map(roman)).toEqual(["", "I", "II", "III", "IV", "V"]);
    expect(roman(7)).toBe("7");
  });
});

describe("relativeTime", () => {
  it("labels the future", () => {
    expect(relativeTime(new Date("2026-09-01T15:12:00Z"), NOW)).toBe("in 3 h 12 m");
    expect(relativeTime(new Date("2026-09-01T15:00:00Z"), NOW)).toBe("in 3 h");
    expect(relativeTime(new Date("2026-09-01T12:42:00Z"), NOW)).toBe("in 42 m");
    expect(relativeTime(new Date("2026-09-03T12:00:00Z"), NOW)).toBe("in 2 days");
    expect(relativeTime(new Date("2026-09-02T12:00:00Z"), NOW)).toBe("in 1 day");
  });
  it("labels the past", () => {
    expect(relativeTime(new Date("2026-08-30T12:00:00Z"), NOW)).toBe("2 days ago");
    expect(relativeTime(new Date("2026-09-01T08:48:00Z"), NOW)).toBe("3 h 12 m ago");
    expect(relativeTime(new Date("2026-09-01T11:18:00Z"), NOW)).toBe("42 m ago");
  });
  it("collapses the last minute and handles a missing date", () => {
    expect(relativeTime(new Date("2026-09-01T12:00:30Z"), NOW)).toBe("just now");
    expect(relativeTime(new Date("2026-09-01T11:59:31Z"), NOW)).toBe("just now");
    expect(relativeTime(null, NOW)).toBe("never");
  });
});

describe("security", () => {
  it("classifies the way the client rounds — to one decimal", () => {
    expect(secClass(0.9459)).toBe("sec-high");
    expect(secClass(0.5)).toBe("sec-high");
    expect(secClass(0.45)).toBe("sec-high");    // rounds to 0.5
    expect(secClass(0.44)).toBe("sec-low");
    expect(secClass(0.04)).toBe("sec-null");    // rounds to 0.0
    expect(secClass(-0.19)).toBe("sec-null");
    expect(secClass(null)).toBe("sec-null");
  });
  it("renders the number to one decimal", () => {
    expect(secText(0.9459)).toBe("0.9");
    expect(secText(-0.19)).toBe("-0.2");
    expect(secText(null)).toBe("—");
  });
});

describe("trainingLabel", () => {
  it("names the head entry and when it finishes", () => {
    expect(trainingLabel({ skillName: "Caldari Frigate", finishedLevel: 5, finishDate: new Date("2026-09-01T15:12:00Z") }, NOW))
      .toBe("Caldari Frigate V · finishes in 3 h 12 m");
  });
  it("says paused when the queue carries no dates", () => {
    expect(trainingLabel({ skillName: "Gunnery", finishedLevel: 3, finishDate: null }, NOW)).toBe("Gunnery III · paused");
  });
  it("says the queue is empty", () => {
    expect(trainingLabel(null, NOW)).toBe("Queue empty");
  });
});
```

Create `tests/view/enums.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { flagLabel, refTypeLabel } from "../../src/lib/view/enums.js";

describe("flagLabel", () => {
  it("renumbers the slot flags from one", () => {
    expect(flagLabel("HiSlot0")).toBe("High slot 1");
    expect(flagLabel("HiSlot3")).toBe("High slot 4");
    expect(flagLabel("MedSlot7")).toBe("Mid slot 8");
    expect(flagLabel("LoSlot0")).toBe("Low slot 1");
    expect(flagLabel("RigSlot2")).toBe("Rig slot 3");
    expect(flagLabel("SubSystemSlot1")).toBe("Subsystem slot 2");
    expect(flagLabel("FighterTube0")).toBe("Fighter tube 1");
  });
  it("names the well-known holds", () => {
    expect(flagLabel("Cargo")).toBe("Cargo hold");
    expect(flagLabel("Hangar")).toBe("Hangar");
    expect(flagLabel("HangarAll")).toBe("Hangar");
    expect(flagLabel("DroneBay")).toBe("Drone bay");
    expect(flagLabel("FleetHangar")).toBe("Fleet hangar");
    expect(flagLabel("AssetSafety")).toBe("Asset safety");
    expect(flagLabel("Implant")).toBe("Implant");
  });
  it("makes the Specialized* holds readable", () => {
    expect(flagLabel("SpecializedOreHold")).toBe("Ore hold");
    expect(flagLabel("SpecializedLargeShipHold")).toBe("Large ship hold");
    expect(flagLabel("SpecializedPlanetaryCommoditiesHold")).toBe("Planetary commodities hold");
    expect(flagLabel("SpecializedFuelBay")).toBe("Fuel bay");
  });
  it("returns the raw value for a member CCP added after this was written", () => {
    // location_flag grows without a compatibility-date bump (research §8a).
    expect(flagLabel("BrandNewHold2027")).toBe("BrandNewHold2027");
    expect(flagLabel("")).toBe("");
  });
});

describe("refTypeLabel", () => {
  it("turns snake_case into a sentence", () => {
    expect(refTypeLabel("market_transaction")).toBe("Market transaction");
    expect(refTypeLabel("player_donation")).toBe("Player donation");
    expect(refTypeLabel("corporation_account_withdrawal")).toBe("Corporation account withdrawal");
    expect(refTypeLabel("bounty_prizes")).toBe("Bounty prizes");
  });
  it("survives a ref_type nobody has seen before", () => {
    expect(refTypeLabel("brand_new_ref_type_2027")).toBe("Brand new ref type 2027");
    expect(refTypeLabel("")).toBe("");
  });
});
```

Append to `tests/view/characters.test.ts`:
```ts
import { pickActive } from "../../src/lib/view/characters.js";

describe("pickActive", () => {
  const characters = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it("returns the session's active character", () => {
    expect(pickActive(characters, 2)).toEqual({ id: 2 });
  });
  it("falls back to the first character when the session names none", () => {
    expect(pickActive(characters, null)).toEqual({ id: 1 });
  });
  it("falls back to the first character when the session names one that is gone", () => {
    expect(pickActive(characters, 99)).toEqual({ id: 1 });
  });
  it("returns null when there are no characters at all", () => {
    expect(pickActive([], 2)).toBeNull();
  });
});
```

Create `tests/components/no-character.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoCharacter } from "../../src/app/components/NoCharacter.js";

describe("NoCharacter", () => {
  it("renders the page title and the phase-1 empty card", () => {
    render(<NoCharacter title="Skills" />);
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText(/no characters yet/i)).toHaveClass("coming-soon");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/format.test.ts tests/view/enums.test.ts tests/view/characters.test.ts tests/components/no-character.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/format.js"`.

- [ ] **Step 3: Write `src/lib/view/format.ts`**

```ts
/**
 * Display formatting for the phase-3 pages. Pure, no locale data: the runtime's ICU tables are not
 * guaranteed in the production container, so thousands separators are done by hand exactly like
 * `StaticDataPanel.grouped` in phase 2.
 */

export function grouped(value: string | number): string {
  const raw = typeof value === "number" ? String(value) : value;
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [whole, fraction] = body.split(".");
  const separated = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${separated}${fraction === undefined ? "" : `.${fraction}`}`;
}

/** "1,234,567.89 ISK" — spec §7. Always two decimals, even for a whole number. */
export function isk(value: number): string {
  return `${grouped(value.toFixed(2))} ISK`;
}

/** "12.3M SP" / "850k SP" / "512 SP". The k branch floors so 999,999 never reads "1000k SP". */
export function sp(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M SP`;
  if (value >= 1_000) return `${Math.floor(value / 1_000)}k SP`;
  return `${grouped(Math.round(value))} SP`;
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];

export function roman(level: number): string {
  return ROMAN[level] ?? String(level);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 h 12 m" / "42 m" / "2 days" — the magnitude, without direction. */
function span(ms: number): string {
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} m`;
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} m`;
  }
  const days = Math.floor(ms / DAY);
  return days === 1 ? "1 day" : `${days} days`;
}

/** "in 3 h 12 m" / "2 days ago" / "just now" / "never" — spec §7. */
export function relativeTime(date: Date | null, now: Date = new Date()): string {
  if (date === null) return "never";
  const delta = date.getTime() - now.getTime();
  const magnitude = Math.abs(delta);
  if (magnitude < MINUTE) return "just now";
  return delta > 0 ? `in ${span(magnitude)}` : `${span(magnitude)} ago`;
}

export type SecClass = "sec-high" | "sec-low" | "sec-null";

/** The client rounds security to one decimal before colouring it, and so do we: 0.45 is high-sec. */
function rounded(status: number): number {
  return Math.round(status * 10) / 10;
}

export function secClass(status: number | null): SecClass {
  if (status === null) return "sec-null";
  const value = rounded(status);
  if (value >= 0.5) return "sec-high";
  return value > 0 ? "sec-low" : "sec-null";
}

export function secText(status: number | null): string {
  return status === null ? "—" : rounded(status).toFixed(1);
}

export interface QueueHeadLabel { skillName: string; finishedLevel: number; finishDate: Date | null }

/** "Caldari Frigate V · finishes in 3 h 12 m" — the Overview's training line. */
export function trainingLabel(head: QueueHeadLabel | null, now: Date = new Date()): string {
  if (head === null) return "Queue empty";
  const skill = `${head.skillName} ${roman(head.finishedLevel)}`;
  // A paused queue comes back from ESI with no dates at all (phase 3a stores them as NULL).
  if (head.finishDate === null) return `${skill} · paused`;
  return `${skill} · finishes ${relativeTime(head.finishDate, now)}`;
}
```

- [ ] **Step 4: Write `src/lib/view/enums.ts`**

```ts
/**
 * Humanisers for the two open ESI vocabularies the pages show. Both enums grow without a
 * compatibility-date bump (research §8a and §2.8), so neither function may be exhaustive:
 * an unknown location_flag falls back to the raw value and an unknown ref_type to the generic
 * snake_case rule.
 */

/** Slot families that carry a zero-based index EVE displays one-based. */
const NUMBERED: [RegExp, string][] = [
  [/^HiSlot(\d+)$/, "High slot"],
  [/^MedSlot(\d+)$/, "Mid slot"],
  [/^LoSlot(\d+)$/, "Low slot"],
  [/^RigSlot(\d+)$/, "Rig slot"],
  [/^SubSystemSlot(\d+)$/, "Subsystem slot"],
  [/^FighterTube(\d+)$/, "Fighter tube"],
];

const EXACT: Record<string, string> = {
  AssetSafety: "Asset safety",
  AutoFit: "Auto-fit",
  BoosterBay: "Booster bay",
  CapsuleerDeliveries: "Capsuleer deliveries",
  Cargo: "Cargo hold",
  CorporationGoalDeliveries: "Corporation goal deliveries",
  CorpseBay: "Corpse bay",
  Deliveries: "Deliveries",
  DroneBay: "Drone bay",
  ExpeditionHold: "Expedition hold",
  FighterBay: "Fighter bay",
  FleetHangar: "Fleet hangar",
  FrigateEscapeBay: "Frigate escape bay",
  Hangar: "Hangar",
  HangarAll: "Hangar",
  HiddenModifiers: "Hidden modifiers",
  Implant: "Implant",
  InfrastructureHangar: "Infrastructure hangar",
  Locked: "Locked",
  MobileDepotHold: "Mobile depot hold",
  MoonMaterialBay: "Moon material bay",
  QuafeBay: "Quafe bay",
  ShipHangar: "Ship hangar",
  Skill: "Skill",
  StructureDeedBay: "Structure deed bay",
  SubSystemBay: "Subsystem bay",
  Unlocked: "Unlocked",
  Wardrobe: "Wardrobe",
};

/** SpecializedOreHold, SpecializedFuelBay, … — 15 members that all read better without the prefix. */
const SPECIALIZED = /^Specialized([A-Za-z]+)$/;

function splitCamel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

function sentence(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

/** "HiSlot3" -> "High slot 4"; "Cargo" -> "Cargo hold"; anything unknown -> the raw value. */
export function flagLabel(flag: string): string {
  const exact = EXACT[flag];
  if (exact !== undefined) return exact;
  for (const [pattern, label] of NUMBERED) {
    const match = pattern.exec(flag);
    if (match !== null) return `${label} ${Number(match[1]) + 1}`;
  }
  const specialized = SPECIALIZED.exec(flag);
  if (specialized !== null) return sentence(splitCamel(specialized[1]));
  return flag;
}

/** "market_transaction" -> "Market transaction". Deliberately generic — there are ~180 members. */
export function refTypeLabel(refType: string): string {
  return sentence(refType.replace(/_/g, " "));
}
```

- [ ] **Step 5: Add `pickActive` to `src/lib/view/characters.ts`**

Append to `src/lib/view/characters.ts`:
```ts
/**
 * "Active character" per spec §7: the session's `activeCharacterId`, falling back to the first
 * character. Returns null only when no character is authorised at all.
 */
export function pickActive<T extends { id: number }>(characters: T[], activeId: number | null): T | null {
  if (characters.length === 0) return null;
  return characters.find((c) => c.id === activeId) ?? characters[0];
}
```

- [ ] **Step 6: Write `src/app/components/NoCharacter.tsx`**

```tsx
/** The phase-1 empty state, shared by every page that needs an active character. */
export function NoCharacter({ title }: { title: string }) {
  return (<>
    <h1 className="page-title">{title}</h1>
    <div className="card coming-soon">No characters yet — use the menu top-right to add one.</div>
  </>);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/view tests/components/no-character.test.tsx && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the phase-3 view formatters and ESI enum humanisers

ISK, SP, relative time, security class and the training label, plus the
location_flag and ref_type humanisers. Both ESI vocabularies grow without a
compatibility-date bump, so both humanisers fall back instead of switching
exhaustively.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: The asset tree builder

`GET /assets` is a flat list; the page shows a tree. This is the pure builder plus the view
conversion and the filter the client component uses, all unit-tested with no database.

**⚠ ID-range hazard.** `classifyLocation(id)` from phase 3a maps **any** id `>= 1_000_000_000_000`
to `"structure"`, and asset `item_id`s live in exactly that range. So a nested row's
`location_id` is an item id that would be mislabelled "Unknown structure (1035…)" if it were ever
passed to `locationLabel`. The builder therefore records each root's `locationType` so the page can
label **only** roots whose `location_type` is not `"item"` (Task 8 enforces it).

**Files:**
- Create: `src/lib/view/assets.ts`
- Test: `tests/view/assets.test.ts`

**Interfaces:**
- Consumes (phase 3a, verbatim):
```ts
// src/lib/db/character-assets.ts
listAssets(characterId: number): Promise<AssetRow[]>                 // ordered by itemId
interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean; name: string | null;
}
```
  and Task 1 `flagLabel(flag: string): string`.
- Produces:
```ts
export interface AssetNode {
  itemId: number; typeId: number; quantity: number; locationFlag: string;
  isSingleton: boolean; isBlueprintCopy: boolean; name: string | null; children: AssetNode[];
}
export interface AssetLocation { locationId: number; locationType: string; itemCount: number; nodes: AssetNode[] }
export function buildAssetTree(rows: AssetRow[]): AssetLocation[];

export interface TypeInfo { name: string | null; volume: number | null }
export interface AssetViewNode {
  itemId: number; typeName: string; name: string | null; quantity: number;
  flag: string; isBlueprintCopy: boolean; volume: number; children: AssetViewNode[];
}
export interface AssetViewLocation {
  locationId: number; label: string; itemCount: number; volume: number; nodes: AssetViewNode[];
}
export function toViewNodes(nodes: AssetNode[], types: ReadonlyMap<number, TypeInfo>): AssetViewNode[];
export function sumVolume(nodes: AssetViewNode[]): number;
export function filterAssetTree(nodes: AssetViewNode[], query: string): AssetViewNode[];
```

- [ ] **Step 1: Write the failing test**

Create `tests/view/assets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import {
  buildAssetTree, toViewNodes, sumVolume, filterAssetTree,
  type AssetViewNode, type TypeInfo,
} from "../../src/lib/view/assets.js";

const STATION = 60003760;
const SHIP = 1_035_000_000_001;      // an item_id, and also inside classifyLocation's structure range
const CONTAINER = 1_035_000_000_002;

function row(over: Partial<AssetRow> & Pick<AssetRow, "itemId" | "typeId" | "locationId" | "locationType" | "locationFlag">): AssetRow {
  return {
    quantity: 1, isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  } as AssetRow;
}

const rows: AssetRow[] = [
  row({ itemId: SHIP, typeId: 587, locationId: STATION, locationType: "station", locationFlag: "Hangar", isSingleton: true, name: "Scarlet Dart" }),
  row({ itemId: 2001, typeId: 519, locationId: SHIP, locationType: "item", locationFlag: "LoSlot0" }),
  row({ itemId: CONTAINER, typeId: 3465, locationId: SHIP, locationType: "item", locationFlag: "Cargo", isSingleton: true, name: "Ammo can" }),
  row({ itemId: 2003, typeId: 34, locationId: CONTAINER, locationType: "item", locationFlag: "Cargo", quantity: 5000 }),
  row({ itemId: 2004, typeId: 34, locationId: STATION, locationType: "station", locationFlag: "Hangar", quantity: 120 }),
];

describe("buildAssetTree", () => {
  it("nests location_type='item' rows under their parent and groups roots by location id", () => {
    const tree = buildAssetTree(rows);
    expect(tree).toHaveLength(1);
    const station = tree[0];
    expect(station.locationId).toBe(STATION);
    expect(station.locationType).toBe("station");
    expect(station.itemCount).toBe(5);                       // the whole subtree, not just the roots
    expect(station.nodes.map((n) => n.itemId)).toEqual([SHIP, 2004]);
  });

  it("keeps a container's contents under the ROOT location, however deep the nesting", () => {
    // The regression this guards: SHIP and CONTAINER are >= 1e12, so classifyLocation() calls them
    // "structure". They must never become locations of their own — they are items in the station.
    const tree = buildAssetTree(rows);
    expect(tree.map((l) => l.locationId)).toEqual([STATION]);
    const ship = tree[0].nodes[0];
    expect(ship.children.map((n) => n.itemId)).toEqual([CONTAINER, 2001]);   // Cargo before LoSlot0
    const container = ship.children[0];
    expect(container.children.map((n) => n.itemId)).toEqual([2003]);
    expect(container.name).toBe("Ammo can");
  });

  it("sorts locations by item count then id, and siblings by flag then item id", () => {
    const other = 60008494;
    const tree = buildAssetTree([
      ...rows,
      row({ itemId: 3001, typeId: 34, locationId: other, locationType: "station", locationFlag: "Hangar" }),
    ]);
    expect(tree.map((l) => [l.locationId, l.itemCount])).toEqual([[STATION, 5], [other, 1]]);
  });

  it("keeps an orphan item-located row as its own root, flagged as an item location", () => {
    const orphan = buildAssetTree([row({ itemId: 4001, typeId: 34, locationId: 1_099_999_999_999, locationType: "item", locationFlag: "Cargo" })]);
    expect(orphan).toEqual([{
      locationId: 1_099_999_999_999, locationType: "item", itemCount: 1,
      nodes: [expect.objectContaining({ itemId: 4001 })],
    }]);
  });

  it("returns nothing for a character with no assets", () => {
    expect(buildAssetTree([])).toEqual([]);
  });
});

const types = new Map<number, TypeInfo>([
  [587, { name: "Rifter", volume: 27289 }],
  [519, { name: "Gyrostabilizer II", volume: 5 }],
  [3465, { name: "Small Standard Container", volume: 65 }],
  [34, { name: "Tritanium", volume: 0.01 }],
]);

describe("toViewNodes", () => {
  it("names types, humanises flags and multiplies volume by quantity", () => {
    const view = toViewNodes(buildAssetTree(rows)[0].nodes, types);
    expect(view[0]).toMatchObject({ typeName: "Rifter", name: "Scarlet Dart", flag: "Hangar", volume: 27289 });
    expect(view[0].children.map((c) => c.flag)).toEqual(["Cargo hold", "Low slot 1"]);
    expect(view[1]).toMatchObject({ typeName: "Tritanium", quantity: 120, volume: 1.2 });
  });

  it("degrades for a type the SDE has not imported and marks blueprint copies", () => {
    const view = toViewNodes(buildAssetTree([
      row({ itemId: 5001, typeId: 999999, locationId: STATION, locationType: "station", locationFlag: "Hangar", isBlueprintCopy: true }),
    ])[0].nodes, types);
    expect(view[0]).toMatchObject({ typeName: "Type 999999", volume: 0, isBlueprintCopy: true });
  });
});

describe("sumVolume", () => {
  it("sums the whole subtree", () => {
    const view = toViewNodes(buildAssetTree(rows)[0].nodes, types);
    // 27289 (ship) + 5 (gyro) + 65 (can) + 50 (5000 tritanium) + 1.2 (120 tritanium)
    expect(sumVolume(view)).toBeCloseTo(27410.2, 3);
    expect(sumVolume([])).toBe(0);
  });
});

describe("filterAssetTree", () => {
  const view: AssetViewNode[] = toViewNodes(buildAssetTree(rows)[0].nodes, types);

  it("returns everything for a blank query", () => {
    expect(filterAssetTree(view, "   ")).toBe(view);
  });

  it("keeps an ancestor whose descendant matches", () => {
    const found = filterAssetTree(view, "gyro");
    expect(found.map((n) => n.typeName)).toEqual(["Rifter"]);
    expect(found[0].children.map((n) => n.typeName)).toEqual(["Gyrostabilizer II"]);
  });

  it("keeps every child of a node that matches itself", () => {
    const found = filterAssetTree(view, "rifter");
    expect(found[0].children).toHaveLength(2);
  });

  it("matches the custom name too, case-insensitively", () => {
    expect(filterAssetTree(view, "AMMO CAN")[0].children.map((n) => n.name)).toEqual(["Ammo can"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterAssetTree(view, "zzz")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/view/assets.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/assets.js"`.

- [ ] **Step 3: Write `src/lib/view/assets.ts`**

```ts
import type { AssetRow } from "../db/character-assets.js";
import { flagLabel } from "./enums.js";

export interface AssetNode {
  itemId: number; typeId: number; quantity: number; locationFlag: string;
  isSingleton: boolean; isBlueprintCopy: boolean; name: string | null; children: AssetNode[];
}

/**
 * A root location. `locationType` is the raw ESI `location_type` of the rows sitting directly in it
 * — "station" | "solar_system" | "item" | "other". The page must only call locationLabel/locationLabels
 * for a root whose type is NOT "item": item ids are >= 1e12, which classifyLocation() would happily
 * (and wrongly) call a player structure.
 */
export interface AssetLocation { locationId: number; locationType: string; itemCount: number; nodes: AssetNode[] }

/**
 * Turns the flat asset list into one tree per root location. Rows with `location_type = 'item'`
 * nest under the row whose `item_id` equals their `location_id`; a row whose parent is missing from
 * the response stays a root (nothing is silently dropped). A parent cycle is impossible in ESI data
 * and, because the walk only ever starts from roots, would leave those rows out rather than loop.
 */
export function buildAssetTree(rows: AssetRow[]): AssetLocation[] {
  const nodes = new Map<number, AssetNode>();
  for (const r of rows) {
    nodes.set(r.itemId, {
      itemId: r.itemId, typeId: r.typeId, quantity: r.quantity, locationFlag: r.locationFlag,
      isSingleton: r.isSingleton, isBlueprintCopy: r.isBlueprintCopy, name: r.name, children: [],
    });
  }
  const roots = new Map<number, { locationType: string; nodes: AssetNode[] }>();
  for (const r of rows) {
    const node = nodes.get(r.itemId);
    if (node === undefined) continue;
    const parent = r.locationType === "item" ? nodes.get(r.locationId) : undefined;
    if (parent !== undefined && parent !== node) {
      parent.children.push(node);
      continue;
    }
    const bucket = roots.get(r.locationId);
    if (bucket === undefined) roots.set(r.locationId, { locationType: r.locationType, nodes: [node] });
    else bucket.nodes.push(node);
  }
  const out: AssetLocation[] = [];
  for (const [locationId, bucket] of roots) {
    sortNodes(bucket.nodes);
    out.push({ locationId, locationType: bucket.locationType, itemCount: countNodes(bucket.nodes), nodes: bucket.nodes });
  }
  // Biggest hangar first; ties broken by id so the order never depends on Map insertion order.
  out.sort((a, b) => b.itemCount - a.itemCount || a.locationId - b.locationId);
  return out;
}

function sortNodes(list: AssetNode[]): void {
  // Flag first (Cargo before LoSlot0…), then assembled/singleton items (ships, containers) before stacks,
  // then id — so a hangar lists its ships and containers ahead of loose stacks.
  list.sort((a, b) =>
    a.locationFlag.localeCompare(b.locationFlag) || Number(b.isSingleton) - Number(a.isSingleton) || a.itemId - b.itemId);
  for (const node of list) sortNodes(node.children);
}

function countNodes(list: AssetNode[]): number {
  let total = 0;
  for (const node of list) total += 1 + countNodes(node.children);
  return total;
}

/** The subset of `SdeType` this module needs; `getTypes()`' map satisfies it structurally. */
export interface TypeInfo { name: string | null; volume: number | null }

export interface AssetViewNode {
  itemId: number; typeName: string; name: string | null; quantity: number;
  flag: string; isBlueprintCopy: boolean; volume: number; children: AssetViewNode[];
}

export interface AssetViewLocation {
  locationId: number; label: string; itemCount: number; volume: number; nodes: AssetViewNode[];
}

/** Serialisable view nodes: names resolved, flags humanised, volume already multiplied out. */
export function toViewNodes(nodes: AssetNode[], types: ReadonlyMap<number, TypeInfo>): AssetViewNode[] {
  return nodes.map((node) => {
    const type = types.get(node.typeId);
    return {
      itemId: node.itemId,
      typeName: type?.name ?? `Type ${node.typeId}`,
      name: node.name,
      quantity: node.quantity,
      flag: flagLabel(node.locationFlag),
      isBlueprintCopy: node.isBlueprintCopy,
      volume: (type?.volume ?? 0) * node.quantity,
      children: toViewNodes(node.children, types),
    };
  });
}

export function sumVolume(nodes: AssetViewNode[]): number {
  let total = 0;
  for (const node of nodes) total += node.volume + sumVolume(node.children);
  return total;
}

/**
 * Substring filter over type name and custom name. A node is kept when it matches (with all of its
 * children, so an opened ship stays whole) or when any descendant matches (so the match stays
 * reachable). A blank query returns the input array unchanged.
 */
export function filterAssetTree(nodes: AssetViewNode[], query: string): AssetViewNode[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return nodes;
  const out: AssetViewNode[] = [];
  for (const node of nodes) {
    const self = node.typeName.toLowerCase().includes(needle) || (node.name ?? "").toLowerCase().includes(needle);
    const children = filterAssetTree(node.children, query);
    if (self) out.push(node);
    else if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/view/assets.test.ts && npm run typecheck`
Expected: PASS (13 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the pure asset tree builder, view conversion and filter

Rows with location_type='item' nest under their parent item_id; roots are
grouped by location id and carry their raw location_type so the page never
asks locationLabel to name an item id (item ids share classifyLocation's
player-structure range).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: The SDE group reader and the batched map readers (**new — phase 2 and 3a do not provide these**)

Spec §7 groups the skill sheet by `sde_groups` (category 16), but `src/lib/sde/repo.ts` has **no group
reader at all**. It also has only single-id `getSolarSystem`/`getStation`, and the pages must batch.
This task adds four readers to the phase-2 repo. Nothing else in the plan may invent SDE reads.

`getGroups(ids)` is the reader the Skills page consumes (Task 8). `listGroups(categoryId)` is its
category-wide sibling, added in the same pass because the two belong together; it is covered by the
DB test here.

**Files:**
- Modify: `src/lib/sde/repo.ts`
- Test: `tests/db/sde-repo.test.ts` (modify)

**Interfaces:**
- Consumes (phase 2, already in the repo, verbatim):
```ts
// src/lib/sde/repo.ts
export interface SdeSolarSystem {
  id: number; constellationId: number | null; regionId: number | null;
  name: string | null; securityStatus: number | null; securityClass: string | null;
}
export interface SdeStation { id: number; solarSystemId: number | null; typeId: number | null; ownerId: number | null; operationId: number | null }
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>
export async function getSolarSystem(id: number): Promise<SdeSolarSystem | null>
export async function getStation(id: number): Promise<SdeStation | null>
```
  and the phase-2 table `sde_groups (id int PK, category_id int, name text, published boolean, icon_id int, …)`
  declared in `src/lib/sde/ddl.ts`.
- Produces:
```ts
export interface SdeGroup { id: number; categoryId: number | null; name: string | null; published: boolean | null }
export function getGroups(ids: number[]): Promise<Map<number, SdeGroup>>;
export function listGroups(categoryId: number): Promise<SdeGroup[]>;          // name-ascending
export function getSolarSystems(ids: number[]): Promise<Map<number, SdeSolarSystem>>;
export function getStations(ids: number[]): Promise<Map<number, SdeStation>>;
```

- [ ] **Step 1: Write the failing test**

In `tests/db/sde-repo.test.ts`, extend the import list at the top of the file to:
```ts
import {
  getSdeMeta, getType, getTypes, searchTypes, getTypeAttributes, getTypeEffects,
  getSkillRequirements, getSolarSystem, getRegion, getStation,
  getGroups, listGroups, getSolarSystems, getStations,
} from "../../src/lib/sde/repo.js";
```

and append these two `describe` blocks to the end of the file:
```ts
describe("groups", () => {
  it("reads many groups at once, skipping unknown ids", async () => {
    const groups = await getGroups([255, 1216, 25, 999999]);
    expect(groups.size).toBe(3);
    expect(groups.get(255)).toMatchObject({ id: 255, categoryId: 16, name: "Gunnery" });
    expect(groups.get(1216)!.name).toBe("Engineering");
    expect(groups.get(1216)!.categoryId).toBe(16);
    expect(groups.get(25)!.categoryId).toBe(6);            // Frigate — a ship group, not a skill group
    expect(await getGroups([])).toEqual(new Map());
  });

  it("lists a whole category name-ascending", async () => {
    const skills = await listGroups(16);
    expect(skills.length).toBeGreaterThan(20);
    expect(skills.every((g) => g.categoryId === 16)).toBe(true);
    const names = skills.map((g) => g.name);
    expect(names).toContain("Gunnery");
    expect(names).toContain("Spaceship Command");
    // Name-ascending. Asserted as a relative order, not against JS's .sort(): Postgres' collation
    // and UTF-16 code-point order disagree about spaces and hyphens.
    expect(names.indexOf("Gunnery")).toBeLessThan(names.indexOf("Spaceship Command"));
    expect(await listGroups(999999)).toEqual([]);
  });
});

describe("batched map lookups", () => {
  it("reads many solar systems at once", async () => {
    const systems = await getSolarSystems([30000142, 30000144, 30009999]);
    expect(systems.size).toBe(2);
    expect(systems.get(30000142)!.name).toBe("Jita");
    expect(systems.get(30000142)!.securityStatus).toBeCloseTo(0.9459, 4);
    expect(systems.get(30000144)!.name).toBe("Perimeter");
    expect(await getSolarSystems([])).toEqual(new Map());
  });

  it("reads many stations at once", async () => {
    const stations = await getStations([60003760, 60000361, 60009999]);
    expect(stations.size).toBe(2);
    expect(stations.get(60003760)!.solarSystemId).toBe(30000142);
    expect(stations.get(60000361)!.solarSystemId).toBe(30000142);
    expect(await getStations([])).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/sde-repo.test.ts`
Expected: FAIL — `getGroups is not a function` (and the same for the other three).

- [ ] **Step 3: Add the four readers to `src/lib/sde/repo.ts`**

Add this interface next to `SdeType` at the top of the file:
```ts
export interface SdeGroup { id: number; categoryId: number | null; name: string | null; published: boolean | null }
```

Add this constant next to `TYPE_COLS`:
```ts
const GROUP_COLS = `id, category_id AS "categoryId", name, published`;
```

Append these four functions to the end of the file:
```ts
/** Batch group lookup — the Skills page groups the sheet by sde_groups (spec §7). */
export async function getGroups(ids: number[]): Promise<Map<number, SdeGroup>> {
  if (ids.length === 0) return new Map();
  const { rows } = await getPool().query<SdeGroup>(
    `SELECT ${GROUP_COLS} FROM sde_groups WHERE id = ANY($1::int[])`, [ids]);
  return new Map(rows.map((r) => [r.id, r]));
}

/** Every group in a category, name-ascending — category 16 is Skills. */
export async function listGroups(categoryId: number): Promise<SdeGroup[]> {
  const { rows } = await getPool().query<SdeGroup>(
    `SELECT ${GROUP_COLS} FROM sde_groups WHERE category_id = $1 ORDER BY name`, [categoryId]);
  return rows;
}

/** Batch solar-system lookup: pages resolve every system on the page in one query. */
export async function getSolarSystems(ids: number[]): Promise<Map<number, SdeSolarSystem>> {
  if (ids.length === 0) return new Map();
  const { rows } = await getPool().query<SdeSolarSystem>(
    `SELECT id, constellation_id AS "constellationId", region_id AS "regionId", name,
            security_status AS "securityStatus", security_class AS "securityClass"
     FROM sde_solar_systems WHERE id = ANY($1::int[])`, [ids]);
  return new Map(rows.map((r) => [r.id, r]));
}

/** Batch NPC-station lookup. Station ids are 60000000–69999999, so int[] is safe. */
export async function getStations(ids: number[]): Promise<Map<number, SdeStation>> {
  if (ids.length === 0) return new Map();
  const { rows } = await getPool().query<SdeStation>(
    `SELECT id, solar_system_id AS "solarSystemId", type_id AS "typeId",
            owner_id AS "ownerId", operation_id AS "operationId"
     FROM sde_stations WHERE id = ANY($1::int[])`, [ids]);
  return new Map(rows.map((r) => [r.id, r]));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker compose -f compose.dev.yml up -d
npx vitest run tests/db/sde-repo.test.ts && npm run typecheck
```
Expected: PASS (all pre-existing tests plus the four new ones), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add group and batched map readers to the SDE repo

The Skills page groups by sde_groups (category 16) and every phase-3 page has
to resolve its systems and stations in one query rather than per row, neither
of which the phase-2 repo could do.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: Batched, Postgres-only name and location helpers (**new — phase 3a provides only single-id `locationLabel`**)

Phase 3a's `locationLabel(id)` costs two queries per id, so a wallet page with 100 transaction rows
would issue hundreds. This task adds the batched forms and makes the single-id function delegate to
them, so there is exactly one implementation and the phase-3a `tests/db/name-label.test.ts`
assertions keep passing unchanged.

`displayNames(ids)` is the page-side party-name lookup: it reads `universe_names` only. It never
calls ESI — the `wallet` job already resolved every party id through `resolveNames` (phase 3a
Task 15), so by render time the rows are cached.

**Files:**
- Modify: `src/lib/names/label.ts`, `src/lib/names/index.ts`
- Test: `tests/db/name-label.test.ts` (modify)

**Interfaces:**
- Consumes (phase 3a, verbatim):
```ts
// src/lib/db/names.ts
getName(id: number): Promise<UniverseName | null>
getNames(ids: number[]): Promise<UniverseName[]>
getStructure(id: number): Promise<StructureRow | null>
getStructures(ids: number[]): Promise<StructureRow[]>
interface UniverseName { id: number; category: string; name: string | null; updatedAt: Date }
interface StructureRow { id: number; name: string | null; solarSystemId: number | null; typeId: number | null; ownerId: number | null; forbidden: boolean; updatedAt: Date }

// src/lib/names/ranges.ts
export type LocationKind = "station" | "structure" | "system" | "unknown"
export function classifyLocation(id: number): LocationKind      // >= 1e12 => "structure"
export function unknownStructureLabel(id: number): string       // "Unknown structure (1035…)"

// src/lib/names/label.ts (phase 3a — replaced here by a delegating one-liner)
export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }
export async function locationLabel(id: number): Promise<LocationLabel>
```
  and Task 3 `getSolarSystems(ids)`, `getStations(ids)`.
- Produces:
```ts
export function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>;   // 4 queries, any input size
export function displayNames(ids: number[]): Promise<Map<number, string>>;            // 1 query; only ids with a cached name
```
  both re-exported from `src/lib/names/index.ts`.

- [ ] **Step 1: Write the failing test**

In `tests/db/name-label.test.ts`, change the import of the module under test to:
```ts
import { locationLabel, locationLabels, displayNames } from "../../src/lib/names/label.js";
```

and append these two `describe` blocks to the end of the file:
```ts
describe("locationLabels", () => {
  it("labels systems, stations and structures in one pass", async () => {
    await putNames([
      { id: 60003760, category: "station", name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" },
    ]);
    await putStructure({ id: 1035466617946, name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false });
    const labels = await locationLabels([30000142, 60003760, 1035466617946, 42]);
    expect(labels.get(30000142)).toEqual({ name: "Jita", solarSystemId: 30000142, kind: "system" });
    expect(labels.get(60003760)!.name).toBe("Jita IV - Moon 4 - Caldari Navy Assembly Plant");
    expect(labels.get(60003760)!.solarSystemId).toBe(30000142);
    expect(labels.get(1035466617946)).toEqual({ name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, kind: "structure" });
    expect(labels.get(42)).toEqual({ name: "Unknown location (42)", solarSystemId: null, kind: "unknown" });
  });

  it("degrades exactly like locationLabel and deduplicates its input", async () => {
    const labels = await locationLabels([60009999, 60009999, 1099999999999, 30009999]);
    expect(labels.size).toBe(3);
    expect(labels.get(60009999)).toEqual({ name: "Unknown station (60009999)", solarSystemId: null, kind: "station" });
    expect(labels.get(1099999999999)).toEqual({ name: "Unknown structure (1099…)", solarSystemId: null, kind: "structure" });
    expect(labels.get(30009999)).toEqual({ name: "Unknown system (30009999)", solarSystemId: 30009999, kind: "system" });
  });

  it("returns an empty map for an empty or junk list", async () => {
    expect(await locationLabels([])).toEqual(new Map());
    expect(await locationLabels([0, -1])).toEqual(new Map());
  });
});

describe("displayNames", () => {
  it("returns only the ids universe_names has a name for", async () => {
    await putNames([
      { id: 1000035, category: "corporation", name: "Caldari Navy" },
      { id: 669539978, category: "character", name: "TrilliumONE" },
      { id: 777, category: "unknown", name: null },
    ]);
    const names = await displayNames([1000035, 669539978, 777, 888]);
    expect(names.get(1000035)).toBe("Caldari Navy");
    expect(names.get(669539978)).toBe("TrilliumONE");
    expect(names.has(777)).toBe(false);        // cached as unresolvable
    expect(names.has(888)).toBe(false);        // never seen
  });

  it("returns an empty map for an empty list", async () => {
    expect(await displayNames([])).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/db/name-label.test.ts`
Expected: FAIL — `locationLabels is not a function`.

- [ ] **Step 3: Replace `src/lib/names/label.ts` with the batched implementation**

Replace the whole file with:
```ts
import { getNames, getStructures } from "../db/names.js";
import { getSolarSystems, getStations } from "../sde/repo.js";
import { classifyLocation, unknownStructureLabel, type LocationKind } from "./ranges.js";

export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }

/** Positive integers only: 0 and negatives are never real ESI ids and must not reach a query. */
function usable(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

/**
 * Read-only helper for pages: Postgres only, never ESI, and exactly four queries however many ids
 * arrive. Degrades to a readable placeholder instead of throwing (spec §9).
 *
 * Caller contract: only pass ids that really are locations. Asset `item_id`s live in the same
 * >= 1e12 range as player structures, so a nested asset row's `location_id` passed in here would
 * come back as "Unknown structure (…)" — see `buildAssetTree`'s `locationType`.
 */
export async function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>> {
  const out = new Map<number, LocationLabel>();
  const wanted = usable(ids);
  if (wanted.length === 0) return out;

  const systemIds = wanted.filter((id) => classifyLocation(id) === "system");
  const stationIds = wanted.filter((id) => classifyLocation(id) === "station");
  const structureIds = wanted.filter((id) => classifyLocation(id) === "structure");

  const [systems, stations, named, structures] = await Promise.all([
    getSolarSystems(systemIds),
    getStations(stationIds),
    getNames(stationIds),          // NPC station names live in universe_names, not in the SDE
    getStructures(structureIds),
  ]);
  const nameById = new Map(named.map((n) => [n.id, n.name]));
  const structureById = new Map(structures.map((s) => [s.id, s]));

  for (const id of wanted) {
    switch (classifyLocation(id)) {
      case "system": {
        const system = systems.get(id);
        out.set(id, { name: system?.name ?? `Unknown system (${id})`, solarSystemId: id, kind: "system" });
        break;
      }
      case "station": {
        out.set(id, {
          name: nameById.get(id) ?? `Unknown station (${id})`,
          solarSystemId: stations.get(id)?.solarSystemId ?? null,
          kind: "station",
        });
        break;
      }
      case "structure": {
        const structure = structureById.get(id);
        const name = structure && !structure.forbidden && structure.name ? structure.name : unknownStructureLabel(id);
        out.set(id, { name, solarSystemId: structure?.solarSystemId ?? null, kind: "structure" });
        break;
      }
      default:
        out.set(id, { name: `Unknown location (${id})`, solarSystemId: null, kind: "unknown" });
    }
  }
  return out;
}

/** The single-id form phase 3a defined; one implementation, so the two can never disagree. */
export async function locationLabel(id: number): Promise<LocationLabel> {
  const labels = await locationLabels([id]);
  return labels.get(id) ?? { name: `Unknown location (${id})`, solarSystemId: null, kind: "unknown" };
}

/**
 * id -> name for anything the sync jobs cached in `universe_names` (wallet parties, station names).
 * Postgres only: the wallet job already ran `resolveNames` over every party id, so a miss here means
 * "not synced yet", not "ask ESI".
 */
export async function displayNames(ids: number[]): Promise<Map<number, string>> {
  const wanted = usable(ids);
  const out = new Map<number, string>();
  if (wanted.length === 0) return out;
  for (const row of await getNames(wanted)) {
    if (row.name !== null) out.set(row.id, row.name);
  }
  return out;
}
```

- [ ] **Step 4: Re-export the two helpers from `src/lib/names/index.ts`**

Replace the `export { locationLabel, ... }` line near the bottom of `src/lib/names/index.ts` with:
```ts
export { locationLabel, locationLabels, displayNames, type LocationLabel } from "./label.js";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/db/name-label.test.ts tests/names && npm run typecheck`
Expected: PASS — the four phase-3a `locationLabel` tests still pass through the new delegation, plus the five new ones; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add batched locationLabels and displayNames for the pages

Four queries for any number of ids, with the single-id locationLabel delegating
so the two forms cannot disagree. displayNames reads universe_names only — the
wallet job has already resolved every party id, and a page never calls ESI.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: Warm the location cache the clones card and the transactions table read (**new — modifies two phase-3a jobs**)

Pages read only Postgres, so anything they label has to be in `universe_names` / `structures` first.
Phase 3a's `location` job resolves the docked location and its `assets` job resolves the asset roots,
but nothing resolves **jump-clone and home-clone locations** (Skills page, spec §7) or **wallet
transaction `location_id`s** (Wallet page, spec §7). Without this task both render
`Unknown station (60003760)`.

**Files:**
- Modify: `src/worker/jobs/clones.ts`, `src/worker/jobs/wallet.ts`
- Test: `tests/worker/clones.test.ts` (modify), `tests/worker/wallet.test.ts` (modify)

**Interfaces:**
- Consumes (phase 3a, verbatim):
```ts
// src/worker/jobs/clones.ts
export interface ClonesJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceClones: (characterId: number, w: ClonesWrite) => Promise<number>;
}
export function createClonesJob(deps: ClonesJobDeps): CharacterSyncJob;
export const clonesJob: CharacterSyncJob;

// src/worker/jobs/wallet.ts
export interface WalletJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  saveWallet: (characterId: number, w: WalletWrite) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}
export function createWalletJob(deps: WalletJobDeps): CharacterSyncJob;

// src/lib/names/index.ts
resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>>
```
- Produces: `ClonesJobDeps` and `WalletJobDeps` each gain
```ts
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
```

- [ ] **Step 1: Write the failing tests**

In `tests/worker/clones.test.ts`, replace the `harness` function with:
```ts
function harness(scopes: string[] = ALL) {
  const writes: ClonesWrite[] = [];
  const paths: string[] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const deps: ClonesJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceClones: async (_id, w) => { writes.push(w); return 8; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/clones")) return { data: esiFixture("clones") };
      if (path.endsWith("/implants")) return { data: esiFixture("implants") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createClonesJob(deps), esi, writes, paths, resolved };
}
```

and append these three tests to the `describe("clones job", …)` block:
```ts
  it("resolves the home station and every jump-clone location so the page can label them", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toEqual([{ ids: [60003760, 60008494, 1035466617946], characterId: CID }]);
  });
  it("asks for nothing when there are no clone locations", async () => {
    const h = harness();
    h.esi.get = vi.fn(async (path: string) =>
      path.endsWith("/clones") ? { data: { jump_clones: [] } } : { data: [] });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toEqual([]);
  });
  it("asks for nothing when the clones scope is missing", async () => {
    const h = harness(["esi-clones.read_implants.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toEqual([]);
  });
```

In `tests/worker/wallet.test.ts`, add `resolveLocations` to the deps object of the existing harness —
alongside the `resolveNames: async (ids) => { resolved.push(ids); return new Map(); }` line, add:
```ts
    resolveLocations: async (ids: number[], characterId: number) => { resolvedPlaces.push({ ids, characterId }); return new Map(); },
```
declaring `const resolvedPlaces: { ids: number[]; characterId: number }[] = [];` next to `resolved`
and returning it from the harness. Then append this test to the `describe("wallet job", …)` block:
```ts
  it("resolves every transaction location so the wallet page can label it", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolvedPlaces).toHaveLength(1);
    expect(h.resolvedPlaces[0].characterId).toBe(CID);
    expect(h.resolvedPlaces[0].ids).toContain(60003760);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/worker/clones.test.ts tests/worker/wallet.test.ts`
Expected: FAIL — typecheck/runtime error `resolveLocations` is not part of `ClonesJobDeps`, and the new assertions see empty arrays.

- [ ] **Step 3: Add the dependency to `src/worker/jobs/clones.ts`**

Add the import next to the existing ones:
```ts
import { resolveLocations } from "../../lib/names/index.js";
```

Change `ClonesJobDeps` to:
```ts
export interface ClonesJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceClones: (characterId: number, w: ClonesWrite) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}
```

Replace the final `return deps.replaceClones(characterId, { clones, implants });` with:
```ts
      const written = await deps.replaceClones(characterId, { clones, implants });

      // The Skills page labels the home station and every jump clone's location, and pages never
      // call ESI — so those names have to be in Postgres before the page renders.
      if (clones !== null) {
        const places = new Set<number>();
        if (clones.homeLocationId !== null) places.add(clones.homeLocationId);
        for (const c of clones.jumpClones) if (c.locationId !== null) places.add(c.locationId);
        if (places.size > 0) await deps.resolveLocations([...places], characterId);
      }
      return written;
```

and change the default export to:
```ts
export const clonesJob: CharacterSyncJob = createClonesJob({ getCharacter, replaceClones, resolveLocations });
```

- [ ] **Step 4: Add the dependency to `src/worker/jobs/wallet.ts`**

Change the `resolveNames` import to:
```ts
import { resolveLocations, resolveNames } from "../../lib/names/index.js";
```

Change `WalletJobDeps` to:
```ts
export interface WalletJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  saveWallet: (characterId: number, w: WalletWrite) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}
```

Replace the party-resolution block at the end of `run` with:
```ts
      const parties = new Set<number>();
      for (const j of journal) {
        for (const id of [j.first_party_id, j.second_party_id]) if (typeof id === "number" && id > 0) parties.add(id);
      }
      for (const t of transactions) if (t.client_id > 0) parties.add(t.client_id);
      await deps.resolveNames([...parties]);

      // Transactions show where they happened, and the wallet page cannot call ESI for the name.
      const places = new Set<number>();
      for (const t of transactions) if (t.location_id > 0) places.add(t.location_id);
      if (places.size > 0) await deps.resolveLocations([...places], characterId);
      return written;
```

and change the default export to:
```ts
export const walletJob: CharacterSyncJob = createWalletJob({ getCharacter, saveWallet, resolveNames, resolveLocations });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/worker && npm run typecheck`
Expected: PASS (every worker test, including the pre-existing clones/wallet ones), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Cache the clone and transaction location names the pages read

The Skills clones card and the wallet transactions table label locations, and
pages read only Postgres — so the clones and wallet jobs now resolve those ids
the same way the location and assets jobs already do.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: The Overview

Spec §7: one card per character (all characters, not just the active one) with portrait, name,
corp · alliance, wallet balance, location (system with security colour, docked-at label, ship type +
name, online dot), training, total SP, last sync and the phase-1 re-authorise badge.

This task also adds the shared Midnight classes (`--warn`, `.sec-*`, `.online-dot`, `.num`) the later
page tasks reuse.

**Files:**
- Create: `src/app/components/CharacterCard.tsx`, `tests/components/character-card.test.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes (phase 1/2/3a, verbatim):
```ts
// src/lib/db/characters.ts
export interface Character {
  id: number; name: string; accountId: number | null;
  corporationId: number | null; corporationName: string | null;
  allianceId: number | null; allianceName: string | null;
  refreshTokenEnc: string; scopes: string[]; tokenStatus: "ok" | "needs_reauth"; lastLoginAt: Date | null;
}
export async function listCharacters(): Promise<Character[]>

// src/lib/db/sync-runs.ts
export interface SyncRunSummary { job: string; characterId: number | null; startedAt: Date; finishedAt: Date | null; status: "running" | "ok" | "error"; rows: number | null; error: string | null }
export async function latestRuns(): Promise<SyncRunSummary[]>

// src/lib/db/character-wallet.ts
getWallet(characterId: number): Promise<WalletRow | null>
interface WalletRow { characterId: number; balance: number; updatedAt: Date }

// src/lib/db/character-location.ts
getLocation(characterId: number): Promise<LocationRow | null>
interface LocationInput {
  solarSystemId: number | null; stationId: number | null; structureId: number | null;
  shipItemId: number | null; shipTypeId: number | null; shipName: string | null;
  online: boolean | null; lastLogin: Date | null; lastLogout: Date | null;
}
interface LocationRow extends LocationInput { characterId: number; updatedAt: Date }

// src/lib/db/character-skills.ts
getSkillSummary(characterId: number): Promise<SkillSummary | null>
listSkillQueue(characterId: number): Promise<SkillQueueRow[]>        // ordered by queuePosition
interface SkillSummary { characterId: number; totalSp: number; unallocatedSp: number | null; updatedAt: Date }
interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}

// src/lib/sde/repo.ts
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>          // SdeType.name: string | null

// src/lib/view/characters.ts
export function portraitUrl(id: number, size: 64 | 128 | 256 = 64): string
```
  plus Task 3 `getSolarSystems(ids)`, Task 4 `locationLabels(ids)`, Task 1 `isk`/`sp`/`relativeTime`/`secClass`/`secText`/`trainingLabel`.
- Produces:
```ts
export interface OverviewCard {
  id: number; name: string; corp: string; needsReauth: boolean;
  balance: string | null;                                   // "1,234,567.89 ISK"
  system: { name: string; sec: string; secClass: string } | null;
  dockedAt: string | null;
  ship: string | null;                                      // "Rifter — Scarlet Dart"
  online: boolean | null;                                   // null = the online scope is missing
  training: string;                                         // "Caldari Frigate V · finishes in 3 h" | "Queue empty" | "Not synced"
  totalSp: string | null;                                   // "47.4M SP"
  lastSync: string;                                         // "2 min ago" | "never"
}
export function CharacterCard({ card }: { card: OverviewCard }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing test**

Create `tests/components/character-card.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CharacterCard, type OverviewCard } from "../../src/app/components/CharacterCard.js";

const full: OverviewCard = {
  id: 669539978,
  name: "TrilliumONE",
  corp: "Caldari Navy · Northern Coalition",
  needsReauth: false,
  balance: "1,234,567.89 ISK",
  system: { name: "Jita", sec: "0.9", secClass: "sec-high" },
  dockedAt: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  ship: "Rifter — Scarlet Dart",
  online: true,
  training: "Caldari Frigate V · finishes in 3 h 12 m",
  totalSp: "47.4M SP",
  lastSync: "2 m ago",
};

describe("CharacterCard", () => {
  it("shows the balance, location, ship, training, SP and last sync", () => {
    render(<CharacterCard card={full} />);
    expect(screen.getByRole("heading", { name: /TrilliumONE/ })).toBeInTheDocument();
    expect(screen.getByText("Caldari Navy · Northern Coalition")).toBeInTheDocument();
    expect(screen.getByText("1,234,567.89 ISK")).toBeInTheDocument();
    expect(screen.getByText("Jita")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toHaveClass("sec-high");
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(screen.getByText("Rifter — Scarlet Dart")).toBeInTheDocument();
    expect(screen.getByText("Caldari Frigate V · finishes in 3 h 12 m")).toBeInTheDocument();
    expect(screen.getByText("47.4M SP")).toBeInTheDocument();
    expect(screen.getByText("2 m ago")).toBeInTheDocument();
  });

  it("shows the online dot only when the online scope produced a value", () => {
    const { rerender, container } = render(<CharacterCard card={full} />);
    expect(container.querySelector(".online-dot.on")).not.toBeNull();
    rerender(<CharacterCard card={{ ...full, online: false }} />);
    expect(container.querySelector(".online-dot")).not.toBeNull();
    expect(container.querySelector(".online-dot.on")).toBeNull();
    rerender(<CharacterCard card={{ ...full, online: null }} />);
    expect(container.querySelector(".online-dot")).toBeNull();
  });

  it("shows the re-authorise badge for a broken token", () => {
    render(<CharacterCard card={{ ...full, needsReauth: true }} />);
    expect(screen.getByText("re-authorise")).toHaveClass("needs_reauth");
  });

  it("degrades to placeholders before the first sync", () => {
    render(<CharacterCard card={{
      ...full, balance: null, system: null, dockedAt: null, ship: null, online: null,
      training: "Not synced", totalSp: null, lastSync: "never",
    }} />);
    expect(screen.getAllByText("Not synced yet")).toHaveLength(2);   // wallet and location
    expect(screen.getAllByText("—")).toHaveLength(2);                // ship and total SP
    expect(screen.getByText("Not synced")).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/character-card.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/components/CharacterCard.js"`.

- [ ] **Step 3: Write `src/app/components/CharacterCard.tsx`**

```tsx
import { portraitUrl } from "../../lib/view/characters.js";

export interface OverviewCard {
  id: number;
  name: string;
  corp: string;
  needsReauth: boolean;
  balance: string | null;
  system: { name: string; sec: string; secClass: string } | null;
  dockedAt: string | null;
  ship: string | null;
  /** null when the token lacks esi-location.read_online.v1 — spec §9 says show nothing, not "offline". */
  online: boolean | null;
  training: string;
  totalSp: string | null;
  lastSync: string;
}

const NOT_SYNCED = <span className="faint">Not synced yet</span>;
const DASH = <span className="faint">—</span>;

export function CharacterCard({ card }: { card: OverviewCard }) {
  return (
    <div className="card ov-card">
      <div className="ov-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portraitUrl(card.id, 128)} alt="" className="ov-portrait" />
        <div>
          <h3 className="ov-name">
            {card.name}
            {card.online === null ? null : (
              <span className={`online-dot${card.online ? " on" : ""}`} title={card.online ? "Online" : "Offline"} />
            )}
          </h3>
          <p className="ov-corp">{card.corp}</p>
          {card.needsReauth ? <span className="badge needs_reauth">re-authorise</span> : null}
        </div>
      </div>
      <dl className="ov-rows">
        <div className="ov-row"><dt>Wallet</dt><dd>{card.balance ?? NOT_SYNCED}</dd></div>
        <div className="ov-row"><dt>Location</dt><dd>
          {card.system === null ? NOT_SYNCED : (<>
            <span className={card.system.secClass}>{card.system.sec}</span>{" "}
            <span>{card.system.name}</span>
            {card.dockedAt === null ? null : <span className="muted"> · {card.dockedAt}</span>}
          </>)}
        </dd></div>
        <div className="ov-row"><dt>Ship</dt><dd>{card.ship ?? DASH}</dd></div>
        <div className="ov-row"><dt>Training</dt><dd>{card.training}</dd></div>
        <div className="ov-row"><dt>Total SP</dt><dd>{card.totalSp ?? DASH}</dd></div>
        <div className="ov-row"><dt>Last sync</dt><dd className="muted">{card.lastSync}</dd></div>
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`**

```tsx
import { listCharacters } from "../lib/db/characters.js";
import { latestRuns } from "../lib/db/sync-runs.js";
import { getWallet } from "../lib/db/character-wallet.js";
import { getLocation } from "../lib/db/character-location.js";
import { getSkillSummary, listSkillQueue } from "../lib/db/character-skills.js";
import { getSolarSystems, getTypes } from "../lib/sde/repo.js";
import { locationLabels } from "../lib/names/index.js";
import { isk, relativeTime, secClass, secText, sp, trainingLabel } from "../lib/view/format.js";
import { CharacterCard, type OverviewCard } from "./components/CharacterCard.js";

export default async function Overview() {
  const [characters, runs] = await Promise.all([listCharacters(), latestRuns()]);
  const now = new Date();

  // Four repo reads per character, all in flight at once; the id -> name lookups below are then
  // batched across every character so the page never queries inside a row loop.
  const rows = await Promise.all(characters.map(async (character) => {
    const [wallet, location, summary, queue] = await Promise.all([
      getWallet(character.id),
      getLocation(character.id),
      getSkillSummary(character.id),
      listSkillQueue(character.id),
    ]);
    return { character, wallet, location, summary, head: queue[0] ?? null };
  }));

  const typeIds = new Set<number>();
  const systemIds = new Set<number>();
  const placeIds = new Set<number>();
  for (const row of rows) {
    if (row.location?.shipTypeId != null) typeIds.add(row.location.shipTypeId);
    if (row.location?.solarSystemId != null) systemIds.add(row.location.solarSystemId);
    // Exactly one of station/structure is set when docked, neither when in space.
    const docked = row.location?.stationId ?? row.location?.structureId ?? null;
    if (docked !== null) placeIds.add(docked);
    if (row.head !== null) typeIds.add(row.head.skillId);
  }
  const [types, systems, places] = await Promise.all([
    getTypes([...typeIds]),
    getSolarSystems([...systemIds]),
    locationLabels([...placeIds]),
  ]);

  const cards: OverviewCard[] = rows.map(({ character, wallet, location, summary, head }) => {
    const lastRun = runs
      .filter((r) => r.characterId === character.id)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
    const system = location?.solarSystemId == null ? null : systems.get(location.solarSystemId) ?? null;
    const docked = location?.stationId ?? location?.structureId ?? null;
    const shipType = location?.shipTypeId == null ? null : types.get(location.shipTypeId)?.name ?? null;
    const headName = head === null ? null : types.get(head.skillId)?.name ?? `Skill ${head.skillId}`;
    return {
      id: character.id,
      name: character.name,
      corp: `${character.corporationName ?? "—"}${character.allianceName ? ` · ${character.allianceName}` : ""}`,
      needsReauth: character.tokenStatus === "needs_reauth",
      balance: wallet === null ? null : isk(wallet.balance),
      system: location?.solarSystemId == null ? null : {
        name: system?.name ?? `Unknown system (${location.solarSystemId})`,
        sec: secText(system?.securityStatus ?? null),
        secClass: secClass(system?.securityStatus ?? null),
      },
      dockedAt: docked === null ? null : places.get(docked)?.name ?? null,
      ship: shipType === null ? null : `${shipType}${location?.shipName ? ` — ${location.shipName}` : ""}`,
      online: location?.online ?? null,
      // "Not synced" means the skills job has never written a summary; an empty queue is different.
      training: summary === null ? "Not synced"
        : trainingLabel(head === null || headName === null ? null
          : { skillName: headName, finishedLevel: head.finishedLevel, finishDate: head.finishDate }, now),
      totalSp: summary === null ? null : sp(summary.totalSp),
      lastSync: relativeTime(lastRun?.startedAt ?? null, now),
    };
  });

  return (<>
    <h1 className="page-title">Overview</h1>
    <p className="page-sub">{cards.length} character{cards.length === 1 ? "" : "s"} authorised</p>
    <div className="card-grid overview">
      {cards.map((card) => <CharacterCard key={card.id} card={card} />)}
    </div>
    {cards.length === 0
      ? <div className="card coming-soon">No characters yet — use the menu top-right to add one.</div>
      : null}
  </>);
}
```

- [ ] **Step 5: Add the shared tokens and the Overview classes to `src/app/globals.css`**

In the `:root` block, immediately after the `--neg: #f76d7a;` line, add:
```css
  --warn: #f2b03d;
```

Append to the end of the file:
```css

/* ---------- Overview cards (phase 3) ---------- */
.card-grid.overview { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
.ov-card { display: flex; flex-direction: column; gap: 14px; }
.ov-head { display: flex; gap: 14px; align-items: center; }
.ov-portrait { width: 64px; height: 64px; border-radius: 12px; border: 1px solid var(--divider); }
.ov-name { margin: 0; display: flex; align-items: center; gap: 8px; font-family: var(--font-poppins), sans-serif; font-size: 18px; font-weight: 600; }
.ov-corp { margin: 2px 0 6px; font-size: 13px; color: var(--muted); }
.ov-rows { margin: 0; display: grid; gap: 6px; }
.ov-row { display: grid; grid-template-columns: 86px 1fr; gap: 10px; align-items: baseline; }
.ov-row dt { font-size: 12px; color: var(--faint); }
.ov-row dd { margin: 0; font-size: 13px; color: var(--text); }

/* Shared by every phase-3 page. */
.online-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dim); display: inline-block; }
.online-dot.on { background: var(--pos); box-shadow: 0 0 6px rgba(52, 211, 153, 0.6); }
.sec-high { color: var(--pos); }
.sec-low { color: var(--warn); }
.sec-null { color: var(--neg); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.card-stack { display: grid; gap: 20px; }
```

- [ ] **Step 6: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS across the suite, typecheck clean, `next build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Build the real Overview from the synced character data

One card per character with balance, location and its security colour, docked-at
label, ship, online dot, training head, total SP and last sync. Every id -> name
lookup is batched across all characters into a single query per kind.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: The Skills page — summary card, attributes and the training queue

Spec §7 first half: summary card (total SP, unallocated SP, attributes with implant bonuses computed
as `base + Σ implant attribute bonus` using `sde_type_attributes` 175–179, remap info) and the
training-queue table with a progress bar on the head entry.

**Files:**
- Create: `src/lib/view/skills.ts`, `src/app/skills/SkillSummaryCard.tsx`, `src/app/skills/QueueTable.tsx`
- Modify: `src/app/skills/page.tsx` (currently a `ComingSoon` stub), `src/app/globals.css`
- Test: `tests/view/skills.test.ts`, `tests/components/skill-summary.test.tsx`, `tests/components/queue-table.test.tsx`

**Interfaces:**
- Consumes (phase 3a / phase 2, verbatim):
```ts
// src/lib/db/character-skills.ts
getSkillSummary(characterId: number): Promise<SkillSummary | null>
listSkillQueue(characterId: number): Promise<SkillQueueRow[]>        // ordered by queuePosition
getAttributes(characterId: number): Promise<AttributesRow | null>
interface SkillSummary { characterId: number; totalSp: number; unallocatedSp: number | null; updatedAt: Date }
interface SkillQueueRow {
  queuePosition: number; skillId: number; finishedLevel: number;
  startDate: Date | null; finishDate: Date | null;
  levelStartSp: number | null; levelEndSp: number | null; trainingStartSp: number | null;
}
interface AttributesInput {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonusRemaps: number | null; lastRemapDate: Date | null; accruedRemapCooldownDate: Date | null;
}
interface AttributesRow extends AttributesInput { characterId: number; updatedAt: Date }

// src/lib/db/character-clones.ts
listImplants(characterId: number): Promise<number[]>                 // active clone, ordered by typeId

// src/lib/sde/repo.ts
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>
export async function getTypeAttributes(typeId: number): Promise<Map<number, number>>   // attributeId -> value
```
  plus Task 1 `sp`/`roman`/`relativeTime`/`trainingLabel`, `pickActive`, `NoCharacter`, and phase-1
  `readSession(): Promise<SessionPayload | null>` with `SessionPayload { activeCharacterId: number | null; iat: number }`
  and `listCharacters()`.
- Produces:
```ts
// src/lib/view/skills.ts
export const SKILL_CATEGORY_ID = 16;
export type AttributeKey = "charisma" | "intelligence" | "memory" | "perception" | "willpower";
export const ATTRIBUTE_BONUS_ATTR: Record<AttributeKey, number>;   // 175..179
export const ATTRIBUTE_LABEL: Record<AttributeKey, string>;
export interface AttributeView { key: AttributeKey; label: string; base: number; bonus: number; total: number }
export function attributeViews(base: Record<AttributeKey, number>, implantAttributes: ReadonlyMap<number, number>[]): AttributeView[];
export function queueProgress(entry: { startDate: Date | null; finishDate: Date | null }, now: Date): number;   // 0..1

// src/app/skills/SkillSummaryCard.tsx
export interface SkillSummaryProps {
  totalSp: string | null; unallocatedSp: string | null;
  attributes: AttributeView[];
  bonusRemaps: number | null; lastRemap: string | null; remapAvailable: string | null;
}
export function SkillSummaryCard(props: SkillSummaryProps): React.JSX.Element;

// src/app/skills/QueueTable.tsx
export interface QueueEntryView {
  position: number; skill: string; level: string;
  start: string; finish: string; progress: number | null;   // progress only on the head entry
}
export function QueueTable({ entries }: { entries: QueueEntryView[] }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/view/skills.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { attributeViews, queueProgress, ATTRIBUTE_BONUS_ATTR, SKILL_CATEGORY_ID } from "../../src/lib/view/skills.js";

describe("attributeViews", () => {
  const base = { charisma: 20, intelligence: 24, memory: 21, perception: 20, willpower: 21 };

  it("uses dogma attributes 175..179 for the five bonuses", () => {
    expect(ATTRIBUTE_BONUS_ATTR).toEqual({ charisma: 175, intelligence: 176, memory: 177, perception: 178, willpower: 179 });
    expect(SKILL_CATEGORY_ID).toBe(16);
  });

  it("adds every implant's bonus on top of the base value", () => {
    const views = attributeViews(base, [
      new Map([[176, 4]]),              // +4 INT hardwiring
      new Map([[176, 1], [177, 3]]),    // +1 INT, +3 MEM
    ]);
    const int = views.find((v) => v.key === "intelligence")!;
    expect(int).toEqual({ key: "intelligence", label: "Intelligence", base: 24, bonus: 5, total: 29 });
    expect(views.find((v) => v.key === "memory")!.total).toBe(24);
    expect(views.find((v) => v.key === "charisma")!).toEqual({ key: "charisma", label: "Charisma", base: 20, bonus: 0, total: 20 });
  });

  it("returns all five attributes in a stable order with no implants", () => {
    expect(attributeViews(base, []).map((v) => v.key))
      .toEqual(["charisma", "intelligence", "memory", "perception", "willpower"]);
    expect(attributeViews(base, []).every((v) => v.bonus === 0)).toBe(true);
  });
});

describe("queueProgress", () => {
  const start = new Date("2026-08-30T12:00:00Z");
  const finish = new Date("2026-08-31T12:00:00Z");

  it("measures the head entry against the wall clock", () => {
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-08-30T18:00:00Z"))).toBeCloseTo(0.25, 6);
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-08-31T00:00:00Z"))).toBeCloseTo(0.5, 6);
  });

  it("clamps outside the window", () => {
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-08-29T00:00:00Z"))).toBe(0);
    expect(queueProgress({ startDate: start, finishDate: finish }, new Date("2026-09-05T00:00:00Z"))).toBe(1);
  });

  it("reads zero for a paused entry, which ESI sends with no dates at all", () => {
    expect(queueProgress({ startDate: null, finishDate: null }, new Date())).toBe(0);
    expect(queueProgress({ startDate: start, finishDate: null }, new Date())).toBe(0);
  });

  it("reads one for a zero-length window rather than dividing by zero", () => {
    expect(queueProgress({ startDate: start, finishDate: start }, new Date())).toBe(1);
  });
});
```

Create `tests/components/skill-summary.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillSummaryCard } from "../../src/app/skills/SkillSummaryCard.js";

const attributes = [
  { key: "charisma" as const, label: "Charisma", base: 20, bonus: 0, total: 20 },
  { key: "intelligence" as const, label: "Intelligence", base: 24, bonus: 5, total: 29 },
  { key: "memory" as const, label: "Memory", base: 21, bonus: 3, total: 24 },
  { key: "perception" as const, label: "Perception", base: 20, bonus: 0, total: 20 },
  { key: "willpower" as const, label: "Willpower", base: 21, bonus: 0, total: 21 },
];

describe("SkillSummaryCard", () => {
  it("shows the totals, every attribute and the implant bonuses", () => {
    render(<SkillSummaryCard totalSp="47.4M SP" unallocatedSp="210k SP" attributes={attributes}
      bonusRemaps={2} lastRemap="9 months ago" remapAvailable="in 45 days" />);
    expect(screen.getByText("47.4M SP")).toBeInTheDocument();
    expect(screen.getByText("210k SP")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("+5")).toHaveClass("attr-bonus");
    expect(screen.getByText("+3")).toHaveClass("attr-bonus");
    expect(screen.queryByText("+0")).toBeNull();          // no bonus, no clutter
    expect(screen.getByText(/2 bonus remaps/)).toBeInTheDocument();
    expect(screen.getByText(/last remap 9 months ago/i)).toBeInTheDocument();
    expect(screen.getByText(/next remap in 45 days/i)).toBeInTheDocument();
  });

  it("degrades before the first sync", () => {
    render(<SkillSummaryCard totalSp={null} unallocatedSp={null} attributes={[]}
      bonusRemaps={null} lastRemap={null} remapAvailable={null} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Intelligence")).toBeNull();
  });
});
```

Create `tests/components/queue-table.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueTable } from "../../src/app/skills/QueueTable.js";

const entries = [
  { position: 1, skill: "Caldari Frigate", level: "V", start: "2026-08-30 12:00", finish: "2026-08-31 18:30", progress: 0.42 },
  { position: 2, skill: "Gunnery", level: "III", start: "—", finish: "—", progress: null },
];

describe("QueueTable", () => {
  it("lists the queue and draws a progress bar on the head entry only", () => {
    const { container } = render(<QueueTable entries={entries} />);
    expect(screen.getByText("Caldari Frigate")).toBeInTheDocument();
    expect(screen.getByText("V")).toBeInTheDocument();
    expect(screen.getByText("2026-08-31 18:30")).toBeInTheDocument();
    const bars = container.querySelectorAll(".progress-fill");
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute("style")).toContain("42%");
    expect(screen.getAllByText("—")).toHaveLength(2);    // the paused entry's two dates
  });

  it("shows the empty state when the queue is empty", () => {
    render(<QueueTable entries={[]} />);
    expect(screen.getByText(/nothing in the training queue/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/skills.test.ts tests/components/skill-summary.test.tsx tests/components/queue-table.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/skills.js"`.

- [ ] **Step 3: Write `src/lib/view/skills.ts`**

```ts
/** sde_categories.id for Skills — the Skills page shows nothing outside it (spec §7). */
export const SKILL_CATEGORY_ID = 16;

export type AttributeKey = "charisma" | "intelligence" | "memory" | "perception" | "willpower";

/** charismaBonus … willpowerBonus in sde_type_attributes, in the order EVE numbers them. */
export const ATTRIBUTE_BONUS_ATTR: Record<AttributeKey, number> = {
  charisma: 175, intelligence: 176, memory: 177, perception: 178, willpower: 179,
};

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  charisma: "Charisma", intelligence: "Intelligence", memory: "Memory",
  perception: "Perception", willpower: "Willpower",
};

const ORDER: AttributeKey[] = ["charisma", "intelligence", "memory", "perception", "willpower"];

export interface AttributeView { key: AttributeKey; label: string; base: number; bonus: number; total: number }

/**
 * base + Σ implant attribute bonus (spec §7). `implantAttributes` is one `getTypeAttributes(typeId)`
 * map per implant on the active clone; an implant with no relevant attribute contributes zero.
 */
export function attributeViews(
  base: Record<AttributeKey, number>,
  implantAttributes: ReadonlyMap<number, number>[],
): AttributeView[] {
  return ORDER.map((key) => {
    const attributeId = ATTRIBUTE_BONUS_ATTR[key];
    let bonus = 0;
    for (const attributes of implantAttributes) bonus += attributes.get(attributeId) ?? 0;
    return { key, label: ATTRIBUTE_LABEL[key], base: base[key], bonus, total: base[key] + bonus };
  });
}

/**
 * 0–1 progress of a queue entry by wall clock. SP-based progress would need the character's live SP,
 * which ESI only refreshes on login; the dates are exact. A paused entry has no dates and reads 0.
 */
export function queueProgress(entry: { startDate: Date | null; finishDate: Date | null }, now: Date): number {
  if (entry.startDate === null || entry.finishDate === null) return 0;
  const window = entry.finishDate.getTime() - entry.startDate.getTime();
  if (window <= 0) return 1;
  const done = (now.getTime() - entry.startDate.getTime()) / window;
  return Math.min(1, Math.max(0, done));
}
```

- [ ] **Step 4: Write `src/app/skills/SkillSummaryCard.tsx`**

```tsx
import type { AttributeView } from "../../lib/view/skills.js";

export interface SkillSummaryProps {
  totalSp: string | null;
  unallocatedSp: string | null;
  attributes: AttributeView[];
  bonusRemaps: number | null;
  lastRemap: string | null;
  remapAvailable: string | null;
}

export function SkillSummaryCard({ totalSp, unallocatedSp, attributes, bonusRemaps, lastRemap, remapAvailable }: SkillSummaryProps) {
  if (totalSp === null && attributes.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Summary</h2>
        <p className="faint">Not synced yet — the skills job runs hourly.</p>
      </div>
    );
  }
  const remap = [
    bonusRemaps === null ? null : `${bonusRemaps} bonus remap${bonusRemaps === 1 ? "" : "s"}`,
    lastRemap === null ? null : `last remap ${lastRemap}`,
    remapAvailable === null ? null : `next remap ${remapAvailable}`,
  ].filter((part): part is string => part !== null);
  return (
    <div className="card">
      <h2 className="card-title">Summary</h2>
      <div className="stat-row">
        <div><span className="stat-label">Total SP</span><span className="stat-value">{totalSp ?? "—"}</span></div>
        <div><span className="stat-label">Unallocated SP</span><span className="stat-value">{unallocatedSp ?? "—"}</span></div>
      </div>
      <div className="attr-grid">
        {attributes.map((a) => (
          <div key={a.key} className="attr">
            <span className="attr-label">{a.label}</span>
            <div>
              <span className="attr-total">{a.total}</span>
              {a.bonus > 0 ? <span className="attr-bonus">+{a.bonus}</span> : null}
            </div>
          </div>
        ))}
      </div>
      {remap.length > 0 ? <p className="faint" style={{ marginBottom: 0 }}>{remap.join(" · ")}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/app/skills/QueueTable.tsx`**

```tsx
export interface QueueEntryView {
  position: number;
  skill: string;
  level: string;
  start: string;
  finish: string;
  /** Only the head entry gets a bar; every other row is `null`. */
  progress: number | null;
}

export function QueueTable({ entries }: { entries: QueueEntryView[] }) {
  if (entries.length === 0) return <p className="faint">Nothing in the training queue.</p>;
  return (
    <table className="table">
      <thead><tr><th>#</th><th>Skill</th><th>Level</th><th>Start</th><th>Finish</th><th>Progress</th></tr></thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.position}>
            <td className="muted">{e.position}</td>
            <td>{e.skill}</td>
            <td>{e.level}</td>
            <td className="muted">{e.start}</td>
            <td className="muted">{e.finish}</td>
            <td>
              {e.progress === null ? null : (
                <div className="progress" role="progressbar" aria-valuenow={Math.round(e.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-fill" style={{ width: `${Math.round(e.progress * 100)}%` }} />
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 6: Replace `src/app/skills/page.tsx`**

```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getAttributes, getSkillSummary, listSkillQueue } from "../../lib/db/character-skills.js";
import { listImplants } from "../../lib/db/character-clones.js";
import { getTypeAttributes, getTypes } from "../../lib/sde/repo.js";
import { pickActive } from "../../lib/view/characters.js";
import { relativeTime, roman, sp } from "../../lib/view/format.js";
import { attributeViews, queueProgress } from "../../lib/view/skills.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { SkillSummaryCard } from "./SkillSummaryCard.js";
import { QueueTable, type QueueEntryView } from "./QueueTable.js";

/** "2026-08-31 18:30" — the timestamp format the settings tables already use. */
function stamp(date: Date | null): string {
  return date === null ? "—" : date.toISOString().replace("T", " ").slice(0, 16);
}

export default async function SkillsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skills" />;

  const now = new Date();
  const [summary, attributes, queue, implantIds] = await Promise.all([
    getSkillSummary(character.id),
    getAttributes(character.id),
    listSkillQueue(character.id),
    listImplants(character.id),
  ]);

  // One types query for the queue's skills and the implants; one dogma query per implant (a clone
  // holds at most ten), never one per row.
  const types = await getTypes([...new Set([...queue.map((q) => q.skillId), ...implantIds])]);
  const implantAttributes = await Promise.all(implantIds.map((id) => getTypeAttributes(id)));

  const entries: QueueEntryView[] = queue.map((q, index) => ({
    position: q.queuePosition + 1,
    skill: types.get(q.skillId)?.name ?? `Skill ${q.skillId}`,
    level: roman(q.finishedLevel),
    start: stamp(q.startDate),
    finish: stamp(q.finishDate),
    progress: index === 0 ? queueProgress(q, now) : null,
  }));

  return (<>
    <h1 className="page-title">Skills</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <SkillSummaryCard
        totalSp={summary === null ? null : sp(summary.totalSp)}
        unallocatedSp={summary?.unallocatedSp == null ? null : sp(summary.unallocatedSp)}
        attributes={attributes === null ? [] : attributeViews(attributes, implantAttributes)}
        bonusRemaps={attributes?.bonusRemaps ?? null}
        lastRemap={attributes?.lastRemapDate == null ? null : relativeTime(attributes.lastRemapDate, now)}
        remapAvailable={attributes?.accruedRemapCooldownDate == null ? null : relativeTime(attributes.accruedRemapCooldownDate, now)}
      />
      <div className="card">
        <h2 className="card-title">Training queue</h2>
        <QueueTable entries={entries} />
      </div>
    </div>
  </>);
}
```

- [ ] **Step 7: Append the Skills classes to `src/app/globals.css`**

```css

/* ---------- Skills (phase 3) ---------- */
.stat-row { display: flex; flex-wrap: wrap; gap: 32px; margin-bottom: 18px; }
.stat-label { display: block; font-size: 12px; color: var(--faint); }
.stat-value { font-family: var(--font-poppins), sans-serif; font-size: 20px; font-weight: 600; color: var(--text); }
.attr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 14px; }
.attr { background: var(--raised); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
.attr-label { display: block; font-size: 12px; color: var(--faint); }
.attr-total { font-family: var(--font-poppins), sans-serif; font-size: 18px; font-weight: 600; }
.attr-bonus { margin-left: 6px; font-size: 12px; color: var(--accent); }
.progress { height: 6px; min-width: 80px; border-radius: 99px; background: var(--raised); overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); }
```

- [ ] **Step 8: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS, typecheck clean, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the Skills summary card and the training queue

Attributes show base + implant bonus from sde_type_attributes 175-179, read
with one dogma query per implant, and the head queue entry carries a wall-clock
progress bar. A paused queue has no dates at all and renders dashes.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: The Skills page — grouped skill sheet with level boxes, and the clones card

Spec §7 second half: skills grouped by `sde_groups` (category 16), each group collapsible with its
group SP, each skill showing name, five level boxes (trained; active dimmer when lower) and SP; plus
a clones card with the active implants (names + attribute bonus), the jump clones (location label +
implants) and the home location.

**Files:**
- Create: `src/app/skills/SkillGroups.tsx` (`"use client"`), `src/app/skills/ClonesCard.tsx`
- Modify: `src/lib/view/skills.ts`, `src/app/skills/page.tsx`, `src/app/globals.css`
- Test: `tests/view/skills.test.ts` (modify), `tests/components/skill-groups.test.tsx`, `tests/components/clones-card.test.tsx`

**Interfaces:**
- Consumes (phase 3a / Task 3 / Task 4, verbatim):
```ts
// src/lib/db/character-skills.ts
listSkills(characterId: number): Promise<SkillRow[]>                 // ordered by skillId
interface SkillRow { skillId: number; trainedLevel: number; activeLevel: number; skillpoints: number }

// src/lib/db/character-clones.ts
listImplants(characterId: number): Promise<number[]>                 // active clone, ordered by typeId
getClones(characterId: number): Promise<CloneState | null>
interface CloneHome {
  homeLocationId: number | null; homeLocationType: string | null;
  lastCloneJumpDate: Date | null; lastStationChangeDate: Date | null;
}
interface JumpCloneRow { jumpCloneId: number; locationId: number | null; locationType: string | null; name: string | null; implants: number[] }
interface CloneState extends CloneHome { characterId: number; updatedAt: Date; jumpClones: JumpCloneRow[] }

// src/lib/sde/repo.ts (Task 3)
export interface SdeGroup { id: number; categoryId: number | null; name: string | null; published: boolean | null }
export function getGroups(ids: number[]): Promise<Map<number, SdeGroup>>;

// src/lib/names/index.ts (Task 4)
export function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>;
export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }
```
  plus Task 7 `attributeViews`/`queueProgress`/`ATTRIBUTE_BONUS_ATTR`/`ATTRIBUTE_LABEL`/`SKILL_CATEGORY_ID`.
- Produces:
```ts
// src/lib/view/skills.ts (added)
export interface SkillView { skillId: number; name: string; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillGroupView { groupId: number; name: string; groupSp: number; skills: SkillView[] }
export function groupSkills(
  skills: SkillRow[],
  types: ReadonlyMap<number, { name: string | null; groupId: number | null }>,
  groups: ReadonlyMap<number, { name: string | null; categoryId: number | null }>,
): SkillGroupView[];
export function implantBonusLabel(attributes: ReadonlyMap<number, number>): string | null;   // "+5 Intelligence"

// src/app/skills/SkillGroups.tsx
export interface SkillGroupProps { groupId: number; name: string; groupSp: string; skills: { skillId: number; name: string; trainedLevel: number; activeLevel: number; sp: string }[] }
export function SkillGroups({ groups }: { groups: SkillGroupProps[] }): React.JSX.Element;

// src/app/skills/ClonesCard.tsx
export interface ImplantView { typeId: number; name: string; bonus: string | null }
export interface JumpCloneView { jumpCloneId: number; label: string; name: string | null; implants: string[] }
export function ClonesCard({ home, implants, jumpClones }: { home: string | null; implants: ImplantView[]; jumpClones: JumpCloneView[] }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/view/skills.test.ts`:
```ts
import { groupSkills, implantBonusLabel } from "../../src/lib/view/skills.js";
import type { SkillRow } from "../../src/lib/db/character-skills.js";

describe("groupSkills", () => {
  const skills: SkillRow[] = [
    { skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 },   // Gunnery, group 255
    { skillId: 3301, trainedLevel: 4, activeLevel: 3, skillpoints: 45255 },    // Small Hybrid Turret, group 255
    { skillId: 3426, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 },   // CPU Management, group 1216
    { skillId: 587, trainedLevel: 1, activeLevel: 1, skillpoints: 10 },        // Rifter — a ship, not a skill
    { skillId: 999999, trainedLevel: 1, activeLevel: 1, skillpoints: 10 },     // not in the SDE at all
  ];
  const types = new Map([
    [3300, { name: "Gunnery", groupId: 255 }],
    [3301, { name: "Small Hybrid Turret", groupId: 255 }],
    [3426, { name: "CPU Management", groupId: 1216 }],
    [587, { name: "Rifter", groupId: 25 }],
  ]);
  const groups = new Map([
    [255, { name: "Gunnery", categoryId: 16 }],
    [1216, { name: "Engineering", categoryId: 16 }],
    [25, { name: "Frigate", categoryId: 6 }],
  ]);

  it("groups by sde_groups, sums group SP and sorts by name", () => {
    const grouped = groupSkills(skills, types, groups);
    expect(grouped.map((g) => g.name)).toEqual(["Engineering", "Gunnery"]);
    expect(grouped[1].groupSp).toBe(301255);
    expect(grouped[1].skills.map((s) => s.name)).toEqual(["Gunnery", "Small Hybrid Turret"]);
    expect(grouped[1].skills[1]).toEqual({ skillId: 3301, name: "Small Hybrid Turret", trainedLevel: 4, activeLevel: 3, skillpoints: 45255 });
  });

  it("drops anything outside category 16 and anything the SDE has never heard of", () => {
    const grouped = groupSkills(skills, types, groups);
    expect(grouped.flatMap((g) => g.skills).map((s) => s.skillId)).not.toContain(587);
    expect(grouped.flatMap((g) => g.skills).map((s) => s.skillId)).not.toContain(999999);
  });

  it("returns nothing for an unsynced sheet", () => {
    expect(groupSkills([], types, groups)).toEqual([]);
  });
});

describe("implantBonusLabel", () => {
  it("names the attribute an implant boosts", () => {
    expect(implantBonusLabel(new Map([[176, 5]]))).toBe("+5 Intelligence");
    expect(implantBonusLabel(new Map([[179, 3], [9, 100]]))).toBe("+3 Willpower");
  });
  it("returns null for an implant that boosts none of the five", () => {
    expect(implantBonusLabel(new Map([[9, 100]]))).toBeNull();
    expect(implantBonusLabel(new Map())).toBeNull();
  });
});
```

Create `tests/components/skill-groups.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillGroups } from "../../src/app/skills/SkillGroups.js";

const groups = [
  {
    groupId: 255, name: "Gunnery", groupSp: "301k SP",
    skills: [
      { skillId: 3300, name: "Gunnery", trainedLevel: 5, activeLevel: 5, sp: "256k SP" },
      { skillId: 3301, name: "Small Hybrid Turret", trainedLevel: 4, activeLevel: 3, sp: "45k SP" },
    ],
  },
  { groupId: 1216, name: "Engineering", groupSp: "256k SP", skills: [{ skillId: 3426, name: "CPU Management", trainedLevel: 5, activeLevel: 5, sp: "256k SP" }] },
];

describe("SkillGroups", () => {
  it("starts collapsed, showing each group's name and SP", () => {
    render(<SkillGroups groups={groups} />);
    expect(screen.getByRole("button", { name: /Gunnery/ })).toBeInTheDocument();
    expect(screen.getByText(/301k SP/)).toBeInTheDocument();
    expect(screen.queryByText("Small Hybrid Turret")).toBeNull();
  });

  it("expands one group at a time on click and collapses it again", () => {
    render(<SkillGroups groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Gunnery/ }));
    expect(screen.getByText("Small Hybrid Turret")).toBeInTheDocument();
    expect(screen.queryByText("CPU Management")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Gunnery/ }));
    expect(screen.queryByText("Small Hybrid Turret")).toBeNull();
  });

  it("draws five level boxes per skill, dimming the levels that are trained but not active", () => {
    const { container } = render(<SkillGroups groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Gunnery/ }));
    const rows = container.querySelectorAll(".level-boxes");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll(".level-box")).toHaveLength(5);
    expect(rows[0].querySelectorAll(".level-box.active")).toHaveLength(5);   // trained 5, active 5
    expect(rows[1].querySelectorAll(".level-box.active")).toHaveLength(3);   // active 3
    expect(rows[1].querySelectorAll(".level-box.trained")).toHaveLength(1);  // level 4 trained, not active
  });

  it("shows the empty state for an unsynced sheet", () => {
    render(<SkillGroups groups={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});
```

Create `tests/components/clones-card.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClonesCard } from "../../src/app/skills/ClonesCard.js";

describe("ClonesCard", () => {
  it("shows the home location, active implants with bonuses and every jump clone", () => {
    render(<ClonesCard
      home="Jita IV - Moon 4 - Caldari Navy Assembly Plant"
      implants={[
        { typeId: 9899, name: "Ocular Filter - Basic", bonus: "+3 Perception" },
        { typeId: 9941, name: "Zainou 'Gnome' Shield Management", bonus: null },
      ]}
      jumpClones={[
        { jumpCloneId: 1001, label: "Amarr VIII - Emperor Family Academy", name: "Amarr medical", implants: ["Ocular Filter - Basic"] },
        { jumpCloneId: 1002, label: "Unknown structure (1035…)", name: null, implants: [] },
      ]} />);
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
    expect(screen.getAllByText("Ocular Filter - Basic").length).toBeGreaterThan(0);   // active implant + jump clone 1001
    expect(screen.getByText("+3 Perception")).toBeInTheDocument();
    expect(screen.getByText("Zainou 'Gnome' Shield Management")).toBeInTheDocument();
    expect(screen.getByText("Amarr medical")).toBeInTheDocument();
    expect(screen.getByText("Unknown structure (1035…)")).toBeInTheDocument();
    expect(screen.getByText(/no implants/i)).toBeInTheDocument();
  });

  it("degrades before the clones job has run", () => {
    render(<ClonesCard home={null} implants={[]} jumpClones={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/skills.test.ts tests/components/skill-groups.test.tsx tests/components/clones-card.test.tsx`
Expected: FAIL — `groupSkills is not a function` and unresolved imports for the two components.

- [ ] **Step 3: Add `groupSkills` and `implantBonusLabel` to `src/lib/view/skills.ts`**

Add this import at the top of the file:
```ts
import type { SkillRow } from "../db/character-skills.js";
```

Append to the end of the file:
```ts
export interface SkillView { skillId: number; name: string; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillGroupView { groupId: number; name: string; groupSp: number; skills: SkillView[] }

/**
 * Groups the skill sheet by sde_groups, keeping only category 16 (Skills) — a character row can
 * carry a type the SDE has since dropped, and injected skills occasionally arrive with a group that
 * is not a skill group. Groups and their skills are sorted by name so the page order is stable.
 */
export function groupSkills(
  skills: SkillRow[],
  types: ReadonlyMap<number, { name: string | null; groupId: number | null }>,
  groups: ReadonlyMap<number, { name: string | null; categoryId: number | null }>,
): SkillGroupView[] {
  const byGroup = new Map<number, SkillGroupView>();
  for (const skill of skills) {
    const type = types.get(skill.skillId);
    const groupId = type?.groupId ?? null;
    if (groupId === null) continue;
    const group = groups.get(groupId);
    if (group === undefined || group.categoryId !== SKILL_CATEGORY_ID) continue;
    let view = byGroup.get(groupId);
    if (view === undefined) {
      view = { groupId, name: group.name ?? `Group ${groupId}`, groupSp: 0, skills: [] };
      byGroup.set(groupId, view);
    }
    view.groupSp += skill.skillpoints;
    view.skills.push({
      skillId: skill.skillId, name: type?.name ?? `Skill ${skill.skillId}`,
      trainedLevel: skill.trainedLevel, activeLevel: skill.activeLevel, skillpoints: skill.skillpoints,
    });
  }
  const out = [...byGroup.values()];
  for (const group of out) group.skills.sort((a, b) => a.name.localeCompare(b.name));
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** "+5 Intelligence" for an attribute implant, null for anything else (a hardwiring, a booster). */
export function implantBonusLabel(attributes: ReadonlyMap<number, number>): string | null {
  for (const key of ORDER) {
    const value = attributes.get(ATTRIBUTE_BONUS_ATTR[key]);
    if (value !== undefined && value !== 0) return `+${value} ${ATTRIBUTE_LABEL[key]}`;
  }
  return null;
}
```

- [ ] **Step 4: Write `src/app/skills/SkillGroups.tsx`**

```tsx
"use client";
import { useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

export interface SkillGroupProps {
  groupId: number;
  name: string;
  groupSp: string;
  skills: { skillId: number; name: string; trainedLevel: number; activeLevel: number; sp: string }[];
}

/** Five boxes: solid up to the active level, dim for levels trained but not currently active. */
function LevelBoxes({ trained, active }: { trained: number; active: number }) {
  return (
    <span className="level-boxes" aria-label={`Trained level ${trained}, active level ${active}`}>
      {[1, 2, 3, 4, 5].map((level) => (
        <span key={level} className={`level-box${level <= active ? " active" : level <= trained ? " trained" : ""}`} />
      ))}
    </span>
  );
}

export function SkillGroups({ groups }: { groups: SkillGroupProps[] }) {
  const [open, setOpen] = useState<number[]>([]);
  if (groups.length === 0) return <p className="faint">Not synced yet — the skills job runs hourly.</p>;
  const toggle = (groupId: number) =>
    setOpen((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  return (
    <div>
      {groups.map((group) => {
        const expanded = open.includes(group.groupId);
        return (
          <div key={group.groupId} className="skill-group">
            <button type="button" className="group-toggle" aria-expanded={expanded} onClick={() => toggle(group.groupId)}>
              {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <span>{group.name}</span>
              <span className="group-sp">{group.skills.length} skills · {group.groupSp}</span>
            </button>
            {expanded ? (
              <table className="table">
                <tbody>
                  {group.skills.map((skill) => (
                    <tr key={skill.skillId}>
                      <td>{skill.name}</td>
                      <td><LevelBoxes trained={skill.trainedLevel} active={skill.activeLevel} /></td>
                      <td className="muted num">{skill.sp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/app/skills/ClonesCard.tsx`**

```tsx
export interface ImplantView { typeId: number; name: string; bonus: string | null }
export interface JumpCloneView { jumpCloneId: number; label: string; name: string | null; implants: string[] }

export function ClonesCard({ home, implants, jumpClones }: { home: string | null; implants: ImplantView[]; jumpClones: JumpCloneView[] }) {
  if (home === null && implants.length === 0 && jumpClones.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Clones</h2>
        <p className="faint">Not synced yet — the clones job runs every six hours.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2 className="card-title">Clones</h2>
      <p className="faint">Home station</p>
      <p style={{ marginTop: 0 }}>{home ?? "—"}</p>
      <p className="faint">Active clone implants</p>
      {implants.length === 0 ? <p style={{ marginTop: 0 }} className="muted">No implants plugged in.</p> : (
        <ul className="clone-list">
          {implants.map((implant) => (
            <li key={implant.typeId}>
              {implant.name}
              {implant.bonus === null ? null : <span className="attr-bonus">{implant.bonus}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="faint">Jump clones</p>
      {jumpClones.length === 0 ? <p style={{ marginTop: 0 }} className="muted">No jump clones.</p> : (
        <ul className="clone-list">
          {jumpClones.map((clone) => (
            <li key={clone.jumpCloneId}>
              <div>{clone.name ?? clone.label}</div>
              {clone.name === null ? null : <div className="muted">{clone.label}</div>}
              <div className="faint">{clone.implants.length === 0 ? "No implants" : clone.implants.join(", ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace `src/app/skills/page.tsx` with the complete page**

```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getAttributes, getSkillSummary, listSkillQueue, listSkills } from "../../lib/db/character-skills.js";
import { getClones, listImplants } from "../../lib/db/character-clones.js";
import { getGroups, getTypeAttributes, getTypes } from "../../lib/sde/repo.js";
import { locationLabels } from "../../lib/names/index.js";
import { pickActive } from "../../lib/view/characters.js";
import { relativeTime, roman, sp } from "../../lib/view/format.js";
import { attributeViews, groupSkills, implantBonusLabel, queueProgress } from "../../lib/view/skills.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { SkillSummaryCard } from "./SkillSummaryCard.js";
import { QueueTable, type QueueEntryView } from "./QueueTable.js";
import { SkillGroups, type SkillGroupProps } from "./SkillGroups.js";
import { ClonesCard, type ImplantView, type JumpCloneView } from "./ClonesCard.js";

/** "2026-08-31 18:30" — the timestamp format the settings tables already use. */
function stamp(date: Date | null): string {
  return date === null ? "—" : date.toISOString().replace("T", " ").slice(0, 16);
}

export default async function SkillsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skills" />;

  const now = new Date();
  const [summary, attributes, queue, skills, implantIds, clones] = await Promise.all([
    getSkillSummary(character.id),
    getAttributes(character.id),
    listSkillQueue(character.id),
    listSkills(character.id),
    listImplants(character.id),
    getClones(character.id),
  ]);

  // One types query for every id on the page: sheet skills, queue skills, active implants and every
  // jump clone's implants. Then one groups query, one dogma query per implant (at most ten) and one
  // locationLabels pass for the home station plus every jump clone.
  const jumpImplantIds = (clones?.jumpClones ?? []).flatMap((c) => c.implants);
  const types = await getTypes([...new Set([
    ...skills.map((s) => s.skillId), ...queue.map((q) => q.skillId), ...implantIds, ...jumpImplantIds,
  ])]);
  const groupIds = [...new Set([...types.values()].map((t) => t.groupId).filter((id): id is number => id !== null))];
  const placeIds = [
    ...(clones?.homeLocationId == null ? [] : [clones.homeLocationId]),
    ...(clones?.jumpClones ?? []).map((c) => c.locationId).filter((id): id is number => id !== null),
  ];
  const [groups, implantAttributes, places] = await Promise.all([
    getGroups(groupIds),
    Promise.all(implantIds.map((id) => getTypeAttributes(id))),
    locationLabels(placeIds),
  ]);

  const entries: QueueEntryView[] = queue.map((q, index) => ({
    position: q.queuePosition + 1,
    skill: types.get(q.skillId)?.name ?? `Skill ${q.skillId}`,
    level: roman(q.finishedLevel),
    start: stamp(q.startDate),
    finish: stamp(q.finishDate),
    progress: index === 0 ? queueProgress(q, now) : null,
  }));

  const groupProps: SkillGroupProps[] = groupSkills(skills, types, groups).map((group) => ({
    groupId: group.groupId,
    name: group.name,
    groupSp: sp(group.groupSp),
    skills: group.skills.map((skill) => ({
      skillId: skill.skillId, name: skill.name,
      trainedLevel: skill.trainedLevel, activeLevel: skill.activeLevel, sp: sp(skill.skillpoints),
    })),
  }));

  const implants: ImplantView[] = implantIds.map((typeId, index) => ({
    typeId,
    name: types.get(typeId)?.name ?? `Type ${typeId}`,
    bonus: implantBonusLabel(implantAttributes[index]),
  }));

  const jumpClones: JumpCloneView[] = (clones?.jumpClones ?? []).map((clone) => ({
    jumpCloneId: clone.jumpCloneId,
    label: clone.locationId === null ? "Unknown location" : places.get(clone.locationId)?.name ?? "Unknown location",
    name: clone.name,
    implants: clone.implants.map((typeId) => types.get(typeId)?.name ?? `Type ${typeId}`),
  }));

  return (<>
    <h1 className="page-title">Skills</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <SkillSummaryCard
        totalSp={summary === null ? null : sp(summary.totalSp)}
        unallocatedSp={summary?.unallocatedSp == null ? null : sp(summary.unallocatedSp)}
        attributes={attributes === null ? [] : attributeViews(attributes, implantAttributes)}
        bonusRemaps={attributes?.bonusRemaps ?? null}
        lastRemap={attributes?.lastRemapDate == null ? null : relativeTime(attributes.lastRemapDate, now)}
        remapAvailable={attributes?.accruedRemapCooldownDate == null ? null : relativeTime(attributes.accruedRemapCooldownDate, now)}
      />
      <div className="card">
        <h2 className="card-title">Training queue</h2>
        <QueueTable entries={entries} />
      </div>
      <div className="card">
        <h2 className="card-title">Skills</h2>
        <SkillGroups groups={groupProps} />
      </div>
      <ClonesCard
        home={clones?.homeLocationId == null ? null : places.get(clones.homeLocationId)?.name ?? null}
        implants={implants}
        jumpClones={jumpClones}
      />
    </div>
  </>);
}
```

- [ ] **Step 7: Append the group/level-box/clone classes to `src/app/globals.css`**

```css
.skill-group { border-top: 1px solid var(--hairline); }
.skill-group:first-child { border-top: 0; }
.group-toggle { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 0; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer; text-align: left; }
.group-toggle:hover { color: var(--accent); }
.group-sp { margin-left: auto; font-size: 12px; color: var(--faint); }
.level-boxes { display: inline-flex; gap: 3px; }
.level-box { width: 10px; height: 10px; border-radius: 2px; border: 1px solid var(--border-hi); }
.level-box.trained { background: rgba(77, 141, 255, 0.32); border-color: var(--accent); }
.level-box.active { background: var(--accent); border-color: var(--accent); }
.clone-list { list-style: none; margin: 0 0 14px; padding: 0; display: grid; gap: 10px; }
.clone-list li { background: var(--raised); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 13px; }
```

- [ ] **Step 8: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS, typecheck clean, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the grouped skill sheet and the clones card

Skills group by sde_groups category 16 with collapsible groups, group SP and
five level boxes per skill (dim for trained-but-not-active). The clones card
labels the home station and every jump clone from the cache the clones job warms.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 9: The Assets page

Spec §7: a locations list (label, item count, total volume from `sde_types.volume × quantity`), each
expandable into a tree; nested rows show the type name, quantity, a readable flag, a BPC badge and
any custom name; a filter box over type names; locations sorted by item count.

**⚠ ID-range hazard (again).** Only roots whose `locationType` is **not** `"item"` may go through
`locationLabels` — asset `item_id`s are `>= 1e12` and `classifyLocation` would call them player
structures. An orphan item-rooted location is labelled `Container <id>` locally instead.

**Files:**
- Create: `src/app/assets/AssetsBrowser.tsx` (`"use client"`)
- Modify: `src/app/assets/page.tsx` (currently a `ComingSoon` stub), `src/app/globals.css`
- Test: `tests/components/assets-browser.test.tsx`

**Interfaces:**
- Consumes (phase 3a / Task 2 / Task 3 / Task 4, verbatim):
```ts
// src/lib/db/character-assets.ts
listAssets(characterId: number): Promise<AssetRow[]>                 // ordered by itemId
interface AssetRow {
  itemId: number; typeId: number; quantity: number; locationId: number;
  locationType: string; locationFlag: string; isSingleton: boolean; isBlueprintCopy: boolean; name: string | null;
}

// src/lib/sde/repo.ts
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>   // SdeType has name: string | null, volume: number | null

// src/lib/view/assets.ts (Task 2)
export function buildAssetTree(rows: AssetRow[]): AssetLocation[];
export function toViewNodes(nodes: AssetNode[], types: ReadonlyMap<number, TypeInfo>): AssetViewNode[];
export function sumVolume(nodes: AssetViewNode[]): number;
export function filterAssetTree(nodes: AssetViewNode[], query: string): AssetViewNode[];
export interface AssetLocation { locationId: number; locationType: string; itemCount: number; nodes: AssetNode[] }
export interface AssetViewNode { itemId: number; typeName: string; name: string | null; quantity: number; flag: string; isBlueprintCopy: boolean; volume: number; children: AssetViewNode[] }
export interface AssetViewLocation { locationId: number; label: string; itemCount: number; volume: number; nodes: AssetViewNode[] }

// src/lib/names/index.ts (Task 4)
export function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>;
```
  plus Task 1 `grouped`, `pickActive`, `NoCharacter`.
- Produces:
```ts
export function AssetsBrowser({ locations }: { locations: AssetViewLocation[] }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing test**

Create `tests/components/assets-browser.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssetsBrowser } from "../../src/app/assets/AssetsBrowser.js";
import type { AssetViewLocation } from "../../src/lib/view/assets.js";

const locations: AssetViewLocation[] = [
  {
    locationId: 60003760, label: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", itemCount: 3, volume: 27294,
    nodes: [
      {
        itemId: 1035000000001, typeName: "Rifter", name: "Scarlet Dart", quantity: 1,
        flag: "Hangar", isBlueprintCopy: false, volume: 27289,
        children: [
          { itemId: 2001, typeName: "Gyrostabilizer II", name: null, quantity: 1, flag: "Low slot 1", isBlueprintCopy: false, volume: 5, children: [] },
        ],
      },
      { itemId: 2002, typeName: "Rifter Blueprint", name: null, quantity: 1, flag: "Hangar", isBlueprintCopy: true, volume: 0.01, children: [] },
    ],
  },
  {
    locationId: 60008494, label: "Amarr VIII - Emperor Family Academy", itemCount: 1, volume: 1.2,
    nodes: [{ itemId: 3001, typeName: "Tritanium", name: null, quantity: 120, flag: "Hangar", isBlueprintCopy: false, volume: 1.2, children: [] }],
  },
];

describe("AssetsBrowser", () => {
  it("lists locations with their item count and volume, collapsed", () => {
    render(<AssetsBrowser locations={locations} />);
    expect(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ })).toBeInTheDocument();
    expect(screen.getByText(/3 items · 27,294 m³/)).toBeInTheDocument();
    expect(screen.getByText(/1 item · 1.2 m³/)).toBeInTheDocument();
    expect(screen.queryByText("Rifter")).toBeNull();
  });

  it("expands a location into its tree, nesting fitted modules under the ship", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.click(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ }));
    expect(screen.getByText("Rifter")).toBeInTheDocument();
    expect(screen.getByText("Scarlet Dart")).toBeInTheDocument();
    expect(screen.getByText("Gyrostabilizer II")).toBeInTheDocument();
    expect(screen.getByText("Low slot 1")).toBeInTheDocument();
    expect(screen.getByText("BPC")).toHaveClass("bpc");
    expect(screen.queryByText("Tritanium")).toBeNull();
  });

  it("collapses a container without losing the rest of the tree", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.click(screen.getByRole("button", { name: /Caldari Navy Assembly Plant/ }));
    fireEvent.click(screen.getByRole("button", { name: /collapse Rifter/i }));
    expect(screen.queryByText("Gyrostabilizer II")).toBeNull();
    expect(screen.getByText("Rifter")).toBeInTheDocument();
  });

  it("filters by type name across every location and auto-expands the matches", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: "gyro" } });
    expect(screen.getByText("Gyrostabilizer II")).toBeInTheDocument();
    expect(screen.getByText("Rifter")).toBeInTheDocument();               // kept as the ancestor
    expect(screen.queryByRole("button", { name: /Emperor Family Academy/ })).toBeNull();
  });

  it("says so when the filter matches nothing", () => {
    render(<AssetsBrowser locations={locations} />);
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: "zzz" } });
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });

  it("shows the empty state before the first sync", () => {
    render(<AssetsBrowser locations={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/assets-browser.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/assets/AssetsBrowser.js"`.

- [ ] **Step 3: Write `src/app/assets/AssetsBrowser.tsx`**

```tsx
"use client";
import { useMemo, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { filterAssetTree, type AssetViewLocation, type AssetViewNode } from "../../lib/view/assets.js";
import { grouped } from "../../lib/view/format.js";

/** "27,294 m³" / "1.2 m³" — whole numbers grouped, small volumes to one decimal. */
function volume(m3: number): string {
  return `${m3 >= 10 ? grouped(Math.round(m3)) : String(Math.round(m3 * 10) / 10)} m³`;
}

function ItemRow({ node, depth, collapsed, onToggle }: {
  node: AssetViewNode; depth: number; collapsed: Set<number>; onToggle: (itemId: number) => void;
}) {
  const open = !collapsed.has(node.itemId);
  return (<>
    <li className="tree-row" style={{ paddingLeft: depth * 18 }}>
      {node.children.length === 0
        ? <span className="tree-toggle" aria-hidden="true" />
        : (
          <button type="button" className="tree-toggle" aria-label={`${open ? "collapse" : "expand"} ${node.typeName}`} onClick={() => onToggle(node.itemId)}>
            {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </button>
        )}
      <span>{node.typeName}</span>
      {node.name === null ? null : <span className="muted">{node.name}</span>}
      {node.isBlueprintCopy ? <span className="badge bpc">BPC</span> : null}
      {node.quantity > 1 ? <span className="muted">×{grouped(node.quantity)}</span> : null}
      <span className="tree-flag">{node.flag}</span>
    </li>
    {open ? node.children.map((child) => (
      <ItemRow key={child.itemId} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
    )) : null}
  </>);
}

export function AssetsBrowser({ locations }: { locations: AssetViewLocation[] }) {
  const [query, setQuery] = useState("");
  const [openLocations, setOpenLocations] = useState<number[]>([]);
  // Items default to expanded so a docked ship shows its fitted modules; this is the opt-out set.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const filtering = query.trim() !== "";
  const shown = useMemo(() => {
    if (!filtering) return locations;
    return locations
      .map((location) => ({ ...location, nodes: filterAssetTree(location.nodes, query) }))
      .filter((location) => location.nodes.length > 0);
  }, [locations, query, filtering]);

  if (locations.length === 0) return <p className="faint">Not synced yet — the assets job runs hourly.</p>;

  const toggleLocation = (id: number) =>
    setOpenLocations((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const toggleItem = (itemId: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });

  return (
    <div>
      <label className="faint" htmlFor="asset-filter">Filter by name</label>
      <input id="asset-filter" className="filter-input" type="search" value={query}
        placeholder="Gyrostabilizer, Tritanium, …" onChange={(e) => setQuery(e.target.value)} />
      {shown.length === 0 ? <p className="faint">Nothing matches “{query.trim()}”.</p> : null}
      {shown.map((location) => {
        // While filtering every surviving location is open — hiding a match would be useless.
        const open = filtering || openLocations.includes(location.locationId);
        return (
          <div key={location.locationId}>
            <button type="button" className="loc-toggle" aria-expanded={open} onClick={() => toggleLocation(location.locationId)}>
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <span>{location.label}</span>
              <span className="loc-meta">
                {location.itemCount} item{location.itemCount === 1 ? "" : "s"} · {volume(location.volume)}
              </span>
            </button>
            {open ? (
              <ul className="tree">
                {location.nodes.map((node) => (
                  <ItemRow key={node.itemId} node={node} depth={0} collapsed={collapsed} onToggle={toggleItem} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/app/assets/page.tsx`**

```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { listAssets } from "../../lib/db/character-assets.js";
import { getTypes } from "../../lib/sde/repo.js";
import { locationLabels } from "../../lib/names/index.js";
import { pickActive } from "../../lib/view/characters.js";
import { buildAssetTree, sumVolume, toViewNodes, type AssetViewLocation } from "../../lib/view/assets.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { AssetsBrowser } from "./AssetsBrowser.js";

export default async function AssetsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Assets" />;

  // One query for the character's assets (spec §7), one for every type on the page, one for the
  // location names.
  const rows = await listAssets(character.id);
  const tree = buildAssetTree(rows);
  const [types, places] = await Promise.all([
    getTypes([...new Set(rows.map((r) => r.typeId))]),
    // Only real places: an item-rooted location id is an item_id, and item ids share
    // classifyLocation's >= 1e12 player-structure range.
    locationLabels(tree.filter((l) => l.locationType !== "item").map((l) => l.locationId)),
  ]);

  const locations: AssetViewLocation[] = tree.map((location) => {
    const nodes = toViewNodes(location.nodes, types);
    return {
      locationId: location.locationId,
      label: location.locationType === "item"
        ? `Container ${location.locationId}`
        : places.get(location.locationId)?.name ?? `Location ${location.locationId}`,
      itemCount: location.itemCount,
      volume: sumVolume(nodes),
      nodes,
    };
  });

  return (<>
    <h1 className="page-title">Assets</h1>
    <p className="page-sub">{character.name} · {rows.length} item{rows.length === 1 ? "" : "s"} in {locations.length} location{locations.length === 1 ? "" : "s"}</p>
    <div className="card"><AssetsBrowser locations={locations} /></div>
  </>);
}
```

- [ ] **Step 5: Append the assets classes to `src/app/globals.css`**

```css

/* ---------- Assets (phase 3) ---------- */
.filter-input { display: block; width: 100%; max-width: 320px; margin: 6px 0 16px; padding: 8px 10px; background: var(--raised); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font: inherit; }
.filter-input:focus { outline: none; border-color: var(--accent); }
.loc-toggle { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 0; background: none; border: 0; border-top: 1px solid var(--hairline); color: var(--text); font: inherit; cursor: pointer; text-align: left; }
.loc-toggle:hover { color: var(--accent); }
.loc-meta { margin-left: auto; font-size: 12px; color: var(--faint); }
.tree { list-style: none; margin: 0 0 12px; padding: 0; }
.tree-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; font-size: 13px; }
.tree-toggle { width: 14px; padding: 0; background: none; border: 0; color: var(--faint); font: inherit; cursor: pointer; }
.tree-toggle:hover { color: var(--accent); }
.tree-flag { margin-left: auto; font-size: 12px; color: var(--faint); }
.badge.bpc { background: rgba(94, 176, 255, 0.14); color: var(--accent-2); }
```

- [ ] **Step 6: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS, typecheck clean, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the Assets page with an expandable, filterable tree

One query per character; the tree is assembled by the pure builder and only
non-item roots are sent to locationLabels, because asset item ids share
classifyLocation's player-structure id range.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 10: Wallet view rows and the `GET /api/characters/[id]/wallet` route

Spec §8: `GET /api/characters/[id]/wallet?kind=journal|transactions&offset=N`, session-guarded by
`proxy.ts`, 100 rows, **the same shapes as the page**. That "same shapes" requirement is why the row
builders live in one module that both the page (Task 11) and this route call.

Party names come from `displayNames` (Postgres only) — the `wallet` job already resolved every party
id through `resolveNames`, and neither a page nor this route may call ESI.

**Files:**
- Create: `src/lib/view/wallet.ts`, `src/app/api/characters/[id]/wallet/route.ts`
- Test: `tests/view/wallet.test.ts`, `tests/api/wallet-route.test.ts`, `tests/proxy.test.ts` (modify)

**Interfaces:**
- Consumes (phase 1 / 3a / Task 3 / Task 4, verbatim):
```ts
// src/lib/db/character-wallet.ts
getWallet(characterId: number): Promise<WalletRow | null>
listJournal(characterId: number, opts?: { limit?: number; offset?: number }): Promise<JournalRow[]>        // newest first, default limit 100
listTransactions(characterId: number, opts?: { limit?: number; offset?: number }): Promise<TransactionRow[]> // newest first, default limit 100
interface WalletRow { characterId: number; balance: number; updatedAt: Date }
interface JournalRow {
  id: number; date: Date; refType: string; description: string;
  amount: number | null; balance: number | null; reason: string | null;
  contextId: number | null; contextIdType: string | null;
  firstPartyId: number | null; secondPartyId: number | null;
  tax: number | null; taxReceiverId: number | null;
}
interface TransactionRow {
  transactionId: number; date: Date; typeId: number; quantity: number; unitPrice: number;
  clientId: number | null; locationId: number | null; isBuy: boolean; isPersonal: boolean; journalRefId: number | null;
}

// src/lib/db/characters.ts
export async function getCharacter(id: number): Promise<Character | null>

// src/lib/api/json.ts
export function parseId(raw: string): number | null

// src/lib/sde/repo.ts
export async function getTypes(ids: number[]): Promise<Map<number, SdeType>>

// src/lib/names/label.ts (Task 4)
export function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>>;
export function displayNames(ids: number[]): Promise<Map<number, string>>;
```
  plus Task 1 `isk`, `grouped`, `refTypeLabel`.
- Produces:
```ts
// src/lib/view/wallet.ts
export const WALLET_PAGE_SIZE = 100;
export interface JournalView {
  id: number; date: string; refType: string; description: string;
  amount: string | null; sign: "pos" | "neg" | ""; balance: string | null;
  firstParty: string | null; secondParty: string | null;
}
export interface TransactionView {
  transactionId: number; date: string; side: "Buy" | "Sell"; typeName: string;
  quantity: string; unitPrice: string; total: string; location: string;
}
export function stamp(date: Date): string;
export function toJournalViews(rows: JournalRow[], names: ReadonlyMap<number, string>): JournalView[];
export function toTransactionViews(rows: TransactionRow[], types: ReadonlyMap<number, { name: string | null }>, places: ReadonlyMap<number, { name: string }>): TransactionView[];
export function loadJournalViews(characterId: number, offset?: number): Promise<JournalView[]>;
export function loadTransactionViews(characterId: number, offset?: number): Promise<TransactionView[]>;

// src/app/api/characters/[id]/wallet/route.ts
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse>;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/view/wallet.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stamp, toJournalViews, toTransactionViews, WALLET_PAGE_SIZE } from "../../src/lib/view/wallet.js";
import type { JournalRow, TransactionRow } from "../../src/lib/db/character-wallet.js";

const journal: JournalRow[] = [
  {
    id: 24_000_000_001, date: new Date("2026-08-31T18:30:12Z"), refType: "market_transaction",
    description: "Market transaction", amount: -4180.5, balance: 1234567.89, reason: null,
    contextId: 99, contextIdType: "market_transaction_id",
    firstPartyId: 669539978, secondPartyId: 2112625428, tax: null, taxReceiverId: null,
  },
  {
    id: 24_000_000_002, date: new Date("2026-08-31T17:00:00Z"), refType: "brand_new_ref_type_2027",
    description: "", amount: null, balance: null, reason: null,
    contextId: null, contextIdType: null, firstPartyId: null, secondPartyId: 888, tax: null, taxReceiverId: null,
  },
  {
    id: 24_000_000_003, date: new Date("2026-08-31T16:00:00Z"), refType: "player_donation",
    description: "gift", amount: 1000000, balance: 1238748.39, reason: "thanks",
    contextId: null, contextIdType: null, firstPartyId: 2112625428, secondPartyId: 669539978, tax: null, taxReceiverId: null,
  },
];

const names = new Map([[669539978, "TrilliumONE"], [2112625428, "Caldari Navy"]]);

describe("toJournalViews", () => {
  it("formats the date, humanises the ref type and signs the amount", () => {
    const [first] = toJournalViews(journal, names);
    expect(first).toEqual({
      id: 24_000_000_001, date: "2026-08-31 18:30", refType: "Market transaction",
      description: "Market transaction", amount: "-4,180.50 ISK", sign: "neg", balance: "1,234,567.89 ISK",
      firstParty: "TrilliumONE", secondParty: "Caldari Navy",
    });
    expect(toJournalViews(journal, names)[2].sign).toBe("pos");
  });

  it("survives a row with no amount, no parties and a ref type nobody has seen", () => {
    const [, second] = toJournalViews(journal, names);
    expect(second.amount).toBeNull();
    expect(second.balance).toBeNull();
    expect(second.sign).toBe("");
    expect(second.refType).toBe("Brand new ref type 2027");
    expect(second.firstParty).toBeNull();
    expect(second.secondParty).toBe("ID 888");     // synced but not yet named
  });

  it("returns nothing for no rows", () => {
    expect(toJournalViews([], names)).toEqual([]);
    expect(WALLET_PAGE_SIZE).toBe(100);
    expect(stamp(new Date("2026-08-31T18:30:12Z"))).toBe("2026-08-31 18:30");
  });
});

const transactions: TransactionRow[] = [
  {
    transactionId: 7_000_000_001, date: new Date("2026-08-31T18:30:12Z"), typeId: 34,
    quantity: 1000, unitPrice: 4.18, clientId: 2112625428, locationId: 60003760,
    isBuy: true, isPersonal: true, journalRefId: 24_000_000_001,
  },
  {
    transactionId: 7_000_000_002, date: new Date("2026-08-31T12:00:00Z"), typeId: 999999,
    quantity: 1, unitPrice: 250000, clientId: null, locationId: null,
    isBuy: false, isPersonal: true, journalRefId: null,
  },
];

describe("toTransactionViews", () => {
  it("names the type and the location and multiplies out the total", () => {
    const [first] = toTransactionViews(
      transactions,
      new Map([[34, { name: "Tritanium" }]]),
      new Map([[60003760, { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" }]]),
    );
    expect(first).toEqual({
      transactionId: 7_000_000_001, date: "2026-08-31 18:30", side: "Buy", typeName: "Tritanium",
      quantity: "1,000", unitPrice: "4.18 ISK", total: "4,180.00 ISK",
      location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
    });
  });

  it("degrades for an unknown type and a missing location", () => {
    const [, second] = toTransactionViews(transactions, new Map(), new Map());
    expect(second.typeName).toBe("Type 999999");
    expect(second.location).toBe("—");
    expect(second.side).toBe("Sell");
  });
});
```

Create `tests/api/wallet-route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock factories are hoisted above every other statement, so the spies they close over must be
// created with vi.hoisted or they are still in the temporal dead zone when the factory runs.
const { getCharacter, loadJournalViews, loadTransactionViews } = vi.hoisted(() => ({
  getCharacter: vi.fn(), loadJournalViews: vi.fn(), loadTransactionViews: vi.fn(),
}));

vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/view/wallet.js", () => ({ loadJournalViews, loadTransactionViews }));

const { GET } = await import("../../src/app/api/characters/[id]/wallet/route.js");

const CID = 669539978;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (query: string) => new NextRequest(`https://eve.plasma66.com/api/characters/${CID}/wallet${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "TrilliumONE" } : null));
  loadJournalViews.mockResolvedValue([{ id: 1, date: "2026-08-31 18:30", refType: "Market transaction", description: "", amount: null, sign: "", balance: null, firstParty: null, secondParty: null }]);
  loadTransactionViews.mockResolvedValue([{ transactionId: 2, date: "2026-08-31 18:30", side: "Buy", typeName: "Tritanium", quantity: "1,000", unitPrice: "4.18 ISK", total: "4,180.00 ISK", location: "Jita" }]);
});

describe("GET /api/characters/[id]/wallet", () => {
  it("returns journal rows at the requested offset", async () => {
    const res = await GET(request("?kind=journal&offset=100"), ctx(String(CID)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rows: [expect.objectContaining({ refType: "Market transaction" })] });
    expect(loadJournalViews).toHaveBeenCalledWith(CID, 100);
    expect(loadTransactionViews).not.toHaveBeenCalled();
  });

  it("returns transaction rows and defaults the offset to zero", async () => {
    const res = await GET(request("?kind=transactions"), ctx(String(CID)));
    expect(res.status).toBe(200);
    expect(loadTransactionViews).toHaveBeenCalledWith(CID, 0);
  });

  it("rejects a bad kind, a bad offset and a bad id", async () => {
    expect((await GET(request("?kind=ledger"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request(""), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?kind=journal&offset=-1"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?kind=journal&offset=abc"), ctx(String(CID)))).status).toBe(400);
    expect((await GET(request("?kind=journal"), ctx("nope"))).status).toBe(400);
    expect(loadJournalViews).not.toHaveBeenCalled();
  });

  it("404s for a character that does not exist", async () => {
    const res = await GET(request("?kind=journal"), ctx("12345"));
    expect(res.status).toBe(404);
    expect(loadJournalViews).not.toHaveBeenCalled();
  });
});
```

Append to the `describe("isPublicPath", …)` block in `tests/proxy.test.ts`:
```ts
  it("guards the wallet JSON route like every other API route", () => {
    expect(isPublicPath("/api/characters/669539978/wallet?kind=journal&offset=100")).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/view/wallet.test.ts tests/api/wallet-route.test.ts tests/proxy.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/view/wallet.js"` (the proxy assertion already passes, since nothing lists that path as public).

- [ ] **Step 3: Write `src/lib/view/wallet.ts`**

```ts
import { listJournal, listTransactions, type JournalRow, type TransactionRow } from "../db/character-wallet.js";
import { displayNames, locationLabels } from "../names/label.js";
import { getTypes } from "../sde/repo.js";
import { refTypeLabel } from "./enums.js";
import { grouped, isk } from "./format.js";

/** Spec §8: the page and the "show more" route both hand out 100 rows at a time. */
export const WALLET_PAGE_SIZE = 100;

export interface JournalView {
  id: number;
  date: string;
  refType: string;
  description: string;
  amount: string | null;
  /** "" when there is no amount — the ESI field is optional despite being the point of the record. */
  sign: "pos" | "neg" | "";
  balance: string | null;
  firstParty: string | null;
  secondParty: string | null;
}

export interface TransactionView {
  transactionId: number;
  date: string;
  side: "Buy" | "Sell";
  typeName: string;
  quantity: string;
  unitPrice: string;
  total: string;
  location: string;
}

/** "2026-08-31 18:30" — matches the settings tables, and survives JSON as a plain string. */
export function stamp(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function party(id: number | null, names: ReadonlyMap<number, string>): string | null {
  if (id === null) return null;
  return names.get(id) ?? `ID ${id}`;
}

export function toJournalViews(rows: JournalRow[], names: ReadonlyMap<number, string>): JournalView[] {
  return rows.map((row) => ({
    id: row.id,
    date: stamp(row.date),
    refType: refTypeLabel(row.refType),
    description: row.description,
    amount: row.amount === null ? null : isk(row.amount),
    sign: row.amount === null || row.amount === 0 ? "" : row.amount > 0 ? "pos" : "neg",
    balance: row.balance === null ? null : isk(row.balance),
    firstParty: party(row.firstPartyId, names),
    secondParty: party(row.secondPartyId, names),
  }));
}

export function toTransactionViews(
  rows: TransactionRow[],
  types: ReadonlyMap<number, { name: string | null }>,
  places: ReadonlyMap<number, { name: string }>,
): TransactionView[] {
  return rows.map((row) => ({
    transactionId: row.transactionId,
    date: stamp(row.date),
    side: row.isBuy ? "Buy" : "Sell",
    typeName: types.get(row.typeId)?.name ?? `Type ${row.typeId}`,
    quantity: grouped(row.quantity),
    unitPrice: isk(row.unitPrice),
    total: isk(row.unitPrice * row.quantity),
    location: row.locationId === null ? "—" : places.get(row.locationId)?.name ?? `Location ${row.locationId}`,
  }));
}

/** One page of journal rows plus one batched name lookup. Postgres only — never ESI. */
export async function loadJournalViews(characterId: number, offset = 0): Promise<JournalView[]> {
  const rows = await listJournal(characterId, { limit: WALLET_PAGE_SIZE, offset });
  const ids = new Set<number>();
  for (const row of rows) {
    if (row.firstPartyId !== null) ids.add(row.firstPartyId);
    if (row.secondPartyId !== null) ids.add(row.secondPartyId);
  }
  return toJournalViews(rows, await displayNames([...ids]));
}

/** One page of transactions plus one getTypes and one locationLabels pass. */
export async function loadTransactionViews(characterId: number, offset = 0): Promise<TransactionView[]> {
  const rows = await listTransactions(characterId, { limit: WALLET_PAGE_SIZE, offset });
  const [types, places] = await Promise.all([
    getTypes([...new Set(rows.map((r) => r.typeId))]),
    locationLabels(rows.map((r) => r.locationId).filter((id): id is number => id !== null)),
  ]);
  return toTransactionViews(rows, types, places);
}
```

- [ ] **Step 4: Write `src/app/api/characters/[id]/wallet/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../../lib/db/characters.js";
import { parseId } from "../../../../../lib/api/json.js";
import { loadJournalViews, loadTransactionViews } from "../../../../../lib/view/wallet.js";

type Ctx = { params: Promise<{ id: string }> };

/** Absent offset means the first page; anything that is not a non-negative integer is a 400. */
function parseOffset(raw: string | null): number | null {
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const kind = req.nextUrl.searchParams.get("kind");
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  if (id === null || offset === null || (kind !== "journal" && kind !== "transactions")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(id)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Same builders the page uses, so the rows the client appends match the ones already on screen.
  const rows = kind === "journal" ? await loadJournalViews(id, offset) : await loadTransactionViews(id, offset);
  return NextResponse.json({ rows });
}
```

The route needs no `proxy.ts` change: `isPublicPath` allow-lists `/login`, `/api/health`, `/auth/`,
`/_next/` and two static files, so `/api/characters/[id]/wallet` is session-guarded already — the
new proxy test pins that.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/view/wallet.test.ts tests/api tests/proxy.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the wallet view rows and the wallet JSON route

One module builds the journal and transaction rows, so the page and the
"show more" route hand out identical shapes. Party names come from the
universe_names cache the wallet job fills; neither path calls ESI.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 11: The Wallet page and the "Show more" tables

Spec §7: balance; journal (latest 100, newest first: date, humanised ref type, first/second party
names, amount coloured by sign with `.pos`/`.neg`, balance); transactions (latest 100: date,
buy/sell, type name, quantity, unit price, total, location label); a "Show more" button that reveals
the next 100 client-side from the Task-10 route.

**Files:**
- Create: `src/app/wallet/WalletTables.tsx` (`"use client"`)
- Modify: `src/app/wallet/page.tsx` (currently a `ComingSoon` stub), `src/app/globals.css`
- Test: `tests/components/wallet-tables.test.tsx`

**Interfaces:**
- Consumes (Task 10 and phase 3a, verbatim):
```ts
// src/lib/view/wallet.ts (Task 10)
export const WALLET_PAGE_SIZE = 100;
export interface JournalView {
  id: number; date: string; refType: string; description: string;
  amount: string | null; sign: "pos" | "neg" | ""; balance: string | null;
  firstParty: string | null; secondParty: string | null;
}
export interface TransactionView {
  transactionId: number; date: string; side: "Buy" | "Sell"; typeName: string;
  quantity: string; unitPrice: string; total: string; location: string;
}
export function loadJournalViews(characterId: number, offset?: number): Promise<JournalView[]>;
export function loadTransactionViews(characterId: number, offset?: number): Promise<TransactionView[]>;

// src/lib/db/character-wallet.ts
getWallet(characterId: number): Promise<WalletRow | null>
interface WalletRow { characterId: number; balance: number; updatedAt: Date }
```
  plus Task 1 `isk`, `pickActive`, `NoCharacter`, and the route `GET /api/characters/[id]/wallet?kind=…&offset=…` → `{ rows }`.
- Produces:
```ts
export function JournalTable({ characterId, initial }: { characterId: number; initial: JournalView[] }): React.JSX.Element;
export function TransactionsTable({ characterId, initial }: { characterId: number; initial: TransactionView[] }): React.JSX.Element;
```

- [ ] **Step 1: Write the failing test**

Create `tests/components/wallet-tables.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalTable, TransactionsTable } from "../../src/app/wallet/WalletTables.js";
import type { JournalView, TransactionView } from "../../src/lib/view/wallet.js";

const CID = 669539978;

function journalRow(id: number, sign: "pos" | "neg" | "" = "neg"): JournalView {
  return {
    id, date: "2026-08-31 18:30", refType: "Market transaction", description: "",
    amount: sign === "" ? null : "-4,180.50 ISK", sign, balance: "1,234,567.89 ISK",
    firstParty: "TrilliumONE", secondParty: "Caldari Navy",
  };
}
function transactionRow(id: number): TransactionView {
  return {
    transactionId: id, date: "2026-08-31 18:30", side: "Buy", typeName: "Tritanium",
    quantity: "1,000", unitPrice: "4.18 ISK", total: "4,180.00 ISK",
    location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
  };
}

const hundred = Array.from({ length: 100 }, (_, i) => journalRow(i + 1));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { vi.restoreAllMocks(); });

describe("JournalTable", () => {
  it("colours the amount by sign and names both parties", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1), { ...journalRow(2), sign: "pos", amount: "1,000,000.00 ISK" }]} />);
    expect(screen.getByText("-4,180.50 ISK")).toHaveClass("neg");
    expect(screen.getByText("1,000,000.00 ISK")).toHaveClass("pos");
    expect(screen.getAllByText("TrilliumONE")).toHaveLength(2);
    expect(screen.getAllByText("Market transaction")).toHaveLength(2);
  });

  it("renders a row with no amount without a colour class", () => {
    const { container } = render(<JournalTable characterId={CID} initial={[journalRow(1, "")]} />);
    expect(container.querySelectorAll(".pos, .neg")).toHaveLength(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("hides Show more when the first page is short", () => {
    render(<JournalTable characterId={CID} initial={[journalRow(1)]} />);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("appends the next 100 rows from the API and stops when the page is short", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [journalRow(101), journalRow(102)] }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<JournalTable characterId={CID} initial={hundred} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(103));   // header + 102
    expect(fetchMock).toHaveBeenCalledWith(`/api/characters/${CID}/wallet?kind=journal&offset=100`);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("reports a failed request instead of silently doing nothing", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<JournalTable characterId={CID} initial={hundred} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText(/could not load more/i)).toHaveClass("neg"));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("shows the empty state before the first sync", () => {
    render(<JournalTable characterId={CID} initial={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});

describe("TransactionsTable", () => {
  it("shows side, type, quantity, prices and location", () => {
    render(<TransactionsTable characterId={CID} initial={[transactionRow(1)]} />);
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("4.18 ISK")).toBeInTheDocument();
    expect(screen.getByText("4,180.00 ISK")).toBeInTheDocument();
    expect(screen.getByText(/Caldari Navy Assembly Plant/)).toBeInTheDocument();
  });

  it("asks the API for the transactions page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<TransactionsTable characterId={CID} initial={Array.from({ length: 100 }, (_, i) => transactionRow(i + 1))} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/characters/${CID}/wallet?kind=transactions&offset=100`));
  });

  it("shows the empty state before the first sync", () => {
    render(<TransactionsTable characterId={CID} initial={[]} />);
    expect(screen.getByText(/not synced yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/wallet-tables.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/app/wallet/WalletTables.js"`.

- [ ] **Step 3: Write `src/app/wallet/WalletTables.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { JournalView, TransactionView } from "../../lib/view/wallet.js";
// Mirrors WALLET_PAGE_SIZE in src/lib/view/wallet.ts. A value import from that module would pull the
// Postgres client into the browser bundle (it imports the wallet repo), so the constant is repeated here.
const WALLET_PAGE_SIZE = 100;

const DASH = "—";

/** Fetches one more page from the Task-10 route. The route hands back the same view shapes. */
async function fetchPage<T>(characterId: number, kind: "journal" | "transactions", offset: number): Promise<T[]> {
  const res = await fetch(`/api/characters/${characterId}/wallet?kind=${kind}&offset=${offset}`);
  if (!res.ok) throw new Error(`could not load more (${res.status})`);
  const body = (await res.json()) as { rows: T[] };
  return body.rows;
}

/** Shared "show more" state machine: a full page implies there may be another one. */
function usePaged<T>(characterId: number, kind: "journal" | "transactions", initial: T[]) {
  const [rows, setRows] = useState<T[]>(initial);
  const [done, setDone] = useState(initial.length < WALLET_PAGE_SIZE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function more(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const next = await fetchPage<T>(characterId, kind, rows.length);
      setRows([...rows, ...next]);
      if (next.length < WALLET_PAGE_SIZE) setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { rows, done, busy, error, more };
}

function ShowMore({ done, busy, error, onClick }: { done: boolean; busy: boolean; error: string | null; onClick: () => void }) {
  return (<>
    {done ? null : (
      <button type="button" className="show-more" disabled={busy} onClick={onClick}>
        {busy ? "Loading…" : "Show more"}
      </button>
    )}
    {error === null ? null : <p className="neg">{error}</p>}
  </>);
}

export function JournalTable({ characterId, initial }: { characterId: number; initial: JournalView[] }) {
  const { rows, done, busy, error, more } = usePaged<JournalView>(characterId, "journal", initial);
  if (rows.length === 0) return <p className="faint">Not synced yet — the wallet job runs hourly.</p>;
  return (<>
    <table className="table">
      <thead><tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="muted">{row.date}</td>
            <td>{row.refType}</td>
            <td>{row.firstParty ?? DASH}</td>
            <td>{row.secondParty ?? DASH}</td>
            <td className="num">{row.amount === null ? DASH : <span className={row.sign}>{row.amount}</span>}</td>
            <td className="num muted">{row.balance ?? DASH}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <ShowMore done={done} busy={busy} error={error} onClick={more} />
  </>);
}

export function TransactionsTable({ characterId, initial }: { characterId: number; initial: TransactionView[] }) {
  const { rows, done, busy, error, more } = usePaged<TransactionView>(characterId, "transactions", initial);
  if (rows.length === 0) return <p className="faint">Not synced yet — the wallet job runs hourly.</p>;
  return (<>
    <table className="table">
      <thead><tr><th>Date</th><th>Side</th><th>Item</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Total</th><th>Location</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.transactionId}>
            <td className="muted">{row.date}</td>
            <td className={row.side === "Buy" ? "neg" : "pos"}>{row.side}</td>
            <td>{row.typeName}</td>
            <td className="num">{row.quantity}</td>
            <td className="num">{row.unitPrice}</td>
            <td className="num">{row.total}</td>
            <td className="muted">{row.location}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <ShowMore done={done} busy={busy} error={error} onClick={more} />
  </>);
}
```

- [ ] **Step 4: Replace `src/app/wallet/page.tsx`**

```tsx
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getWallet } from "../../lib/db/character-wallet.js";
import { pickActive } from "../../lib/view/characters.js";
import { isk } from "../../lib/view/format.js";
import { loadJournalViews, loadTransactionViews } from "../../lib/view/wallet.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { JournalTable, TransactionsTable } from "./WalletTables.js";

export default async function WalletPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Wallet" />;

  const [wallet, journal, transactions] = await Promise.all([
    getWallet(character.id),
    loadJournalViews(character.id),
    loadTransactionViews(character.id),
  ]);

  return (<>
    <h1 className="page-title">Wallet</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <div className="card">
        <h2 className="card-title">Balance</h2>
        <span className="stat-value">{wallet === null ? "Not synced yet" : isk(wallet.balance)}</span>
      </div>
      <div className="card">
        <h2 className="card-title">Journal</h2>
        <JournalTable characterId={character.id} initial={journal} />
      </div>
      <div className="card">
        <h2 className="card-title">Transactions</h2>
        <TransactionsTable characterId={character.id} initial={transactions} />
      </div>
    </div>
  </>);
}
```

- [ ] **Step 5: Append the wallet classes to `src/app/globals.css`**

```css

/* ---------- Wallet (phase 3) ---------- */
.show-more { margin-top: 12px; padding: 8px 16px; background: var(--raised); border: 1px solid var(--border-hi); border-radius: 8px; color: var(--text); font: inherit; cursor: pointer; }
.show-more:hover { border-color: var(--accent); color: var(--accent); }
.show-more[disabled] { opacity: 0.6; cursor: default; }
```

- [ ] **Step 6: Run the tests and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS across the whole suite, typecheck clean, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOM'
Add the Wallet page with journal, transactions and Show more

The server renders the first 100 of each; the client appends further pages from
GET /api/characters/[id]/wallet, which returns the same row shapes. A failed
request says so rather than silently doing nothing.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
```

---

### Task 12: Deploy phase 3 to the VM and record acceptance

This is the acceptance for **all of phase 3** — 3a's seven sync jobs and 3b's four pages plus the
wallet route. No Ansible or env changes: the existing `eve` role rsyncs the repo, rebuilds the image,
runs `npm run migrate` (which now applies the phase-3 tables from `db/schema.sql`) and restarts the
app and worker.

**⚠ Operator action, before acceptance can be complete.** Phase 3 added two scopes,
`esi-universe.read_structures.v1` and `esi-location.read_online.v1`. They must be enabled on the
application at <https://developers.eveonline.com> and then **every character must log in again**
(Settings → the character's re-authorise link), because scope grants are immutable per refresh
token. `deploy/README.md` (phase 3a Task 18) documents this. **Expected symptoms until that
happens:** the jobs all still finish `ok`, but `/universe/structures/{id}` and `/online` are skipped —
so any citadel reads as `Unknown structure (1035…)` on the Overview, Skills clones card, Assets and
Wallet, and `character_location.online` stays `NULL`, which hides the Overview's online dot. That is
correct behaviour, not a failure (spec §3, §9).

**Files:**
- Modify: none (an empty acceptance commit records the outcome).

**Interfaces:**
- Consumes: Tasks 1–11 of this plan and Tasks 1–18 of the 3a plan, all committed on `feature/phase3-character-sync`.
- Produces: `https://eve.plasma66.com` serving the four phase-3 pages from live data, and `ok` rows in `sync_runs` for all seven character jobs.

- [ ] **Step 1: Confirm the branch is clean and green**

```bash
cd /home/daniel/AI/Plasma/EVE
git status --short
docker compose -f compose.dev.yml up -d
npm test && npm run typecheck && npm run build
```
Expected: no uncommitted changes; every test passes; `tsc --noEmit` clean; `next build` succeeds.

- [ ] **Step 2: Deploy**

```bash
cd deploy/ansible && script -qc "ansible-playbook site.yml --tags eve" /dev/null
```
Expected: play recap with `failed=0`. The image rebuild takes a few minutes on the VM.
(`script -qc … /dev/null` gives Ansible the TTY it wants; without it the playbook can abort on
non-blocking stdio.)

- [ ] **Step 3: Confirm the containers came back and the site is healthy**

```bash
ssh daniel@10.5.5.150 'docker ps --format "{{.Names}} {{.Status}}"'
ssh daniel@10.5.5.150 'docker logs --tail 60 eve-worker'
curl -sS https://eve.plasma66.com/api/health
```
Expected: `eve-app`, `eve-worker`, `eve-postgres`, `traefik` all `Up`; the worker log shows
`[worker] started` and the first character jobs beginning; health returns `{"ok":true,"db":true}`.

- [ ] **Step 4: Poll until every character has an `ok` run for all seven jobs**

The character jobs are staggered and the slowest interval that matters here is 1 h, so "within two
ticks" means the first two passes of the scheduler. **Do not use a foreground `sleep`** — re-issue
this roughly once a minute (the Monitor tool with an until-condition is the tidy way) until it
prints **nothing**:

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select c.name, j.job, coalesce(r.status, 'missing')
  from characters c
  cross join (values ('character-info'),('skills'),('clones'),('fittings'),('assets'),('wallet'),('location')) as j(job)
  left join lateral (
    select s.status from sync_runs s
    where s.job = j.job and s.character_id = c.id
    order by s.started_at desc limit 1
  ) r on true
  where coalesce(r.status, 'missing') <> 'ok'
  order by c.name, j.job\""
```
Expected eventually: **empty output** — every character × every job has a latest run of `ok`.
While it is still working you will see `missing` and `running` rows. If a row settles on `error`,
read the message and the worker log:
```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"select job, character_id, error from sync_runs where status='error' order by started_at desc limit 10\""
ssh daniel@10.5.5.150 'docker logs --tail 200 eve-worker'
```

- [ ] **Step 5: Spot-check the tables the pages read**

```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"
  select character_id, count(*) from character_skills group by 1 order by 1;
  select character_id, total_sp, unallocated_sp from character_skill_summary order by 1;
  select character_id, balance from character_wallet order by 1;
  select character_id, solar_system_id, station_id, structure_id, ship_type_id, ship_name, online from character_location order by 1;
  select character_id, count(*) from character_assets group by 1 order by 1;
  select character_id, count(*) from character_wallet_journal group by 1 order by 1;
  select count(*) from universe_names; select count(*) from structures\""
```
Expected: a `character_skills` count in the low thousands per character (a real capsuleer has
1 000–2 000 rows); `character_wallet.balance` a plausible ISK figure; `character_location` naming a
solar system, with exactly one of `station_id`/`structure_id` set when docked and `online` **NULL**
until the operator action of Step 8; a non-zero asset count; a non-zero journal count; `universe_names`
populated with the party and station names the wallet and assets jobs resolved.

- [ ] **Step 6: Verify the wallet JSON route is session-guarded and works**

```bash
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' 'https://eve.plasma66.com/api/characters/1/wallet?kind=journal'
```
Expected: `307 https://eve.plasma66.com/login` — the proxy redirects an unauthenticated request, exactly
like `/settings`. (The authenticated path is exercised by the browser check in Step 7.)

- [ ] **Step 7: Verify the UI (Daniel, in a browser on the tailnet)**

1. `https://eve.plasma66.com/` — every character card shows a wallet balance, a solar system with a
   security number in the right colour, a docked-at label or nothing when in space, ship type — ship
   name, the training head (`Skill V · finishes in …`) or `Queue empty`, total SP, and a last-sync
   time from the last few minutes. No card says "not synced yet" for wallet or location.
2. `https://eve.plasma66.com/skills` — the summary card's total SP matches the in-game skill sheet
   for that character; attributes show the implant bonuses; the queue's head row has a progress bar;
   expanding a skill group shows five level boxes per skill; the clones card names the home station.
3. `https://eve.plasma66.com/assets` — locations are sorted by item count; expanding the location the
   character is docked in shows the current ship with its **fitted modules nested underneath it**;
   the filter box narrows to a matching module and keeps its ship as the parent; a BPC shows the badge.
4. `https://eve.plasma66.com/wallet` — the balance matches the Overview; the journal shows recent
   entries with humanised ref types, both party names, and green/red amounts; the transactions table
   shows type, quantity, unit price, total and a location; if there are more than 100 rows, **Show
   more** appends the next 100 without a page reload.
5. `https://eve.plasma66.com/settings` — the Sync status table lists all seven character jobs plus
   `sde-update`, every one `ok`.

Record the outcome (pass, or exactly what failed) in this task's commit message.

- [ ] **Step 8: Operator action — enable the two scopes and re-authorise**

1. At <https://developers.eveonline.com>, open the application and enable
   `esi-universe.read_structures.v1` and `esi-location.read_online.v1`. **A login attempt asking for a
   scope the application does not have is rejected by EVE SSO and surfaces as `/login?error=sso`, so
   do this first.**
2. In Settings, use each character's re-authorise link and complete the SSO flow. Four characters.
3. Wait one `location` tick (15 min) and one `assets` tick (1 h), then re-check:
```bash
ssh daniel@10.5.5.150 "docker exec eve-postgres psql -U eve -d eve -Atc \"select character_id, online from character_location order by 1; select id, name, forbidden from structures order by id limit 10\""
```
Expected: `online` is now `t`/`f` rather than empty, and `structures` has named rows (a `forbidden`
row is legitimate — the character is not on that citadel's ACL). The Overview then shows the online
dot and citadel names replace `Unknown structure (…)`.

- [ ] **Step 9: Commit the acceptance and merge**

```bash
cd /home/daniel/AI/Plasma/EVE
git commit --allow-empty -m "$(cat <<'EOM'
Deploy phase 3 (character sync) to the VM and record acceptance

Acceptance: within two ticks all <n> characters had ok runs for all seven jobs
(character-info, skills, clones, fittings, assets, wallet, location);
character_skills <count> rows/character, character_wallet balances present,
character_location naming a system and ship; Overview, /skills, /assets and
/wallet all render live data and the wallet Show more route returns its next
page. Operator action: the two new scopes were enabled on the developer-portal
application and all characters re-authorised, after which online status and
structure names started syncing.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOM
)"
git checkout main && git merge --no-ff feature/phase3-character-sync
```

---

## Self-review

**1. Spec coverage (§7, §8, and the §10 items this plan owns)**

| Spec requirement | Where |
|---|---|
| §7 pages are server components reading Postgres through repos | T6, T7/T8, T9, T11 — no page calls ESI or our own API |
| §7 interactive bits are small client components | T8 `SkillGroups`, T9 `AssetsBrowser`, T11 `WalletTables` — the only three `"use client"` files |
| §7 Midnight tokens only; Tabler icons | Global Constraints; CSS blocks in T6/T7/T8/T9/T11; `IconChevronDown/Right` in T8/T9 |
| §7 ISK `1,234,567.89 ISK`, SP `12.3M SP`, relative times | T1 `isk`/`sp`/`relativeTime` + unit tests |
| §7 active character = `session.activeCharacterId`, else the first | T1 `pickActive` + tests; used by T7/T8, T9, T11 |
| §7 Overview: portrait, name, corp · alliance | T6 `CharacterCard` |
| §7 Overview: wallet balance | T6 (`getWallet` → `isk`) |
| §7 Overview: system name + `sec-high\|sec-low\|sec-null` by ≥ 0.5 / > 0 / ≤ 0 | T1 `secClass`/`secText` (rounded to 1 dp) + T6 |
| §7 Overview: docked-at label, ship type + name, online dot when known | T6 (`locationLabels`, `getTypes`, `online === null` hides the dot) |
| §7 Overview: training head `Skill V · finishes in 3 h`, "Queue empty", "Not synced" | T1 `trainingLabel` + T6 (`summary === null` ⇒ "Not synced") |
| §7 Overview: total SP, last sync, re-authorise badge | T6 |
| §7 Skills: summary card total SP, unallocated SP | T7 `SkillSummaryCard` |
| §7 Skills: attributes `base + Σ implant bonus` via `sde_type_attributes` 175–179 | T7 `attributeViews` + `getTypeAttributes` per implant, unit-tested |
| §7 Skills: remap info | T7 (`bonusRemaps`, `lastRemapDate`, `accruedRemapCooldownDate`) |
| §7 Skills: queue table (position, skill name, level, start/finish, head progress bar) | T7 `QueueTable` + `queueProgress` |
| §7 Skills: groups from `sde_groups` category 16, collapsible, group SP | T3 `getGroups`, T8 `groupSkills` + `SkillGroups` |
| §7 Skills: five level boxes, active dimmer when lower; skill SP | T8 `LevelBoxes` + component test |
| §7 Skills: clones card — active implants with attribute bonus, jump clones with location label and implants, home location | T8 `ClonesCard` + `implantBonusLabel`; the labels exist because T5 warms the cache |
| §7 Assets: locations list with label, item count, total volume (`volume × quantity`) | T2 `buildAssetTree`/`sumVolume`, T9 page |
| §7 Assets: tree with `location_type='item'` nesting; custom names | T2 + T9 |
| §7 Assets: row = type name, quantity, readable flag, BPC badge | T1 `flagLabel`, T2 `toViewNodes`, T9 `AssetsBrowser` |
| §7 Assets: filter box over type names; locations sorted by item count | T2 `filterAssetTree`, T9; `buildAssetTree` sorts by `itemCount` desc |
| §7 Assets: one query per character, tree in `src/lib/view/assets.ts`, pure and unit-tested | T2 + T9 (`listAssets` once, then one `getTypes` and one `locationLabels`) |
| §7 Wallet: balance | T11 |
| §7 Wallet: journal latest 100 newest first, date, humanised ref type, party names, `.pos`/`.neg` amount, balance | T1 `refTypeLabel`, T10 `toJournalViews`, T11 `JournalTable` |
| §7 Wallet: transactions latest 100 — date, buy/sell, type name, qty, unit price, total, location label | T10 `toTransactionViews`, T11 `TransactionsTable` |
| §7 Wallet: "Show more" reveals the next 100 client-side from the JSON route | T11 `usePaged` + `ShowMore` |
| §7 Settings › Sync status unchanged; Static data card unchanged | Nothing in this plan touches `src/app/settings/**` — phase 3a Task 17 is what makes the table list all seven jobs |
| §8 `GET /api/characters/[id]/wallet?kind=…&offset=N`, session-guarded, 100 rows, same shapes, no write routes | T10 route + route test + the `isPublicPath` assertion; `WALLET_PAGE_SIZE = 100`; the page and the route share `toJournalViews`/`toTransactionViews` |
| §10 unit: assets tree builder, flag/ref_type humanisers, ISK/SP/relative-time formatters | T2, T1 |
| §10 component: Overview card, Skills group/level boxes, Assets tree expand/filter, Wallet tables | T6, T8 (+ T7 queue), T9, T11 |
| §10 no network in tests | Route test mocks the repo modules; "Show more" test mocks `globalThis.fetch` |
| §10 acceptance on the VM (all seven jobs `ok` within two ticks; the four pages) | T12 |

**Gaps found and closed inside this plan** (all three are work phase 3a does not do, and each is
labelled **new** in its task heading):

1. **No group reader.** `src/lib/sde/repo.ts` had no way to read `sde_groups`, which §7's skill
   grouping requires — **T3** adds `getGroups(ids)` (consumed by T8) and its category-wide sibling
   `listGroups(categoryId)`.
2. **No batched readers.** `getSolarSystem`/`getStation`/`locationLabel` are single-id, so the wallet
   page would have issued hundreds of queries — **T3** adds `getSolarSystems`/`getStations` and **T4**
   adds `locationLabels`/`displayNames`, with `locationLabel` delegating so the two cannot diverge.
3. **Two unwarmed name caches.** Phase 3a resolves docked locations (`location` job) and asset roots
   (`assets` job) but not clone locations or wallet transaction locations, so the Skills clones card
   and the transactions table would have read `Unknown station (…)` forever — **T5** adds
   `resolveLocations` to the `clones` and `wallet` jobs.

`listGroups(categoryId)` is the one export added here that no page consumes yet; it is covered by the
T3 DB test and is the reader the phase-6 skill planner will use. It is deliberate, not an oversight.

**2. Placeholder scan**

No "TBD", "TODO", "similar to Task N", "add error handling", or prose standing in for code. Every
code step contains the complete file or the complete, exactly-located replacement block. Three values
are filled in at execution time and only the VM can supply them: `<n>` and `<count>` in T12's
acceptance commit message.

**3. Type consistency against the phase-3a interfaces**

- Row types are consumed verbatim and never redeclared: `AssetRow` (T2, T9), `SkillRow`/`SkillQueueRow`/`SkillSummary`/`AttributesRow` (T6–T8), `JournalRow`/`TransactionRow`/`WalletRow` (T6, T10), `CloneState`/`JumpCloneRow` (T8), `LocationRow` (T6), `Character`/`SyncRunSummary` (T6).
- `TypeInfo { name: string | null; volume: number | null }` (T2) is a structural subset of phase-2 `SdeType`, and `toViewNodes` takes a `ReadonlyMap` so `Map<number, SdeType>` is assignable. The same trick is used for `groupSkills`' `types`/`groups` parameters and `toTransactionViews`' `types`/`places`.
- `SdeGroup { id; categoryId; name; published }` (T3) is what `getGroups` returns and what `groupSkills` (T8) destructures — `categoryId` is compared against `SKILL_CATEGORY_ID = 16` in one place only.
- `LocationLabel { name; solarSystemId; kind }` is phase 3a's type, unchanged; `locationLabels` returns a map of it and `toTransactionViews` needs only `{ name: string }` from it.
- `AttributesRow` is passed straight into `attributeViews(base: Record<AttributeKey, number>, …)`; its five attribute fields are `number`, and its extra fields are irrelevant to a `Record` of a fixed key union.
- `ClonesJobDeps` and `WalletJobDeps` each gain exactly one member with the same signature as phase 3a's `resolveLocations` (`(locationIds: number[], characterId: number) => Promise<unknown>`), matching the `LocationJobDeps` member phase 3a already defines.
- Names used across tasks match: `pickActive` (T1 → T7/T8/T9/T11), `flagLabel` (T1 → T2), `grouped` (T1 → T9/T10), `isk` (T1 → T6/T10/T11), `sp` (T1 → T6/T7/T8), `trainingLabel` (T1 → T6), `buildAssetTree`/`toViewNodes`/`sumVolume`/`filterAssetTree` (T2 → T9), `getGroups` (T3 → T8), `locationLabels` (T4 → T6/T8/T9/T10), `displayNames` (T4 → T10), `attributeViews`/`queueProgress` (T7 → T8), `groupSkills`/`implantBonusLabel` (T8), `WALLET_PAGE_SIZE`/`JournalView`/`TransactionView`/`loadJournalViews`/`loadTransactionViews` (T10 → T11 and the route).
- Component prop types are exported from the component that owns them and imported by the page that builds them: `OverviewCard` (T6), `QueueEntryView` (T7), `SkillGroupProps`/`ImplantView`/`JumpCloneView` (T8), `AssetViewLocation` (T2, used by T9).

**4. Ambiguities in the spec that this plan resolves**

- **§7 says the wallet's party names come from name resolution, and §1 says pages read only Postgres.**
  Resolved in favour of §1: the page and the route use `displayNames` (a `universe_names` read), not
  `resolveNames`, because the `wallet` job has already resolved every party id (phase 3a Task 15). A
  party the job has not yet named renders as `ID <id>` rather than blocking a render on an ESI call.
- **§7's "Show more" URL omits `kind`; §8 includes it.** §8 wins — one route, `kind` required, `offset`
  optional and defaulting to 0.
- **Progress bar semantics.** §7 does not say what the head entry's bar measures. It is wall clock
  between `start_date` and `finish_date`; SP-based progress would need live SP, which ESI refreshes
  only on login. A paused entry (no dates at all) reads 0.
- **Level boxes.** "trained; active shown dimmer when lower" is rendered as: solid up to
  `active_skill_level`, dim from there up to `trained_skill_level`, empty above.
- **Security rounding.** `secClass` rounds to one decimal before comparing, so 0.45 is high-sec —
  matching what the client displays rather than the raw float.
- **Volume unit.** Location volume uses `sde_types.volume` (unpackaged) × quantity, summed over the
  whole subtree, and is displayed in m³ — grouped whole numbers at ≥ 10 m³, one decimal below.
- **`classifyLocation` vs asset `item_id`s.** Both live in the `>= 1e12` range, so `buildAssetTree`
  records each root's raw `location_type` and the Assets page sends only non-`"item"` roots to
  `locationLabels`; an orphan item-rooted group is labelled `Container <id>` locally.
- **"Not synced" vs "Queue empty".** The Overview distinguishes them by whether
  `character_skill_summary` has a row, not by whether the queue is empty — a genuinely empty queue is
  a real state.
