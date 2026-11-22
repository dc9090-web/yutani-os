# `/api/v1` — responses and their shapes

Every file here is a full response body for an **invented** account (three characters named
"Example Pilot …", ids below the range EVE gives players, `pilot@example.com`). They are written by
`npm run api:fixtures` and checked by `tests/api/v1/contract.test.ts`, so they are what the site
returns today. A client can decode these files and run on them with no server.

File for a path: drop `/api/v1/`, turn `wallet?kind=X&…` into `wallet-X`, add `.json`.
`/api/v1/characters/9000001/wallet?kind=journal&offset=0&limit=500` → `characters/9000001/wallet-journal.json`.

The three characters cover the cases: **9000001** has everything synced and is training (its stored
queue still holds one entry that finished before the fixture's clock); **9000002** has a paused
queue, no wallet yet and a token that needs re-authorising; **9000003** has nothing synced at all.
The fixture clock (`generatedAt`) is `2026-03-14T12:00:00.000Z`.

## Rules for every route

- **Auth.** `Authorization: Bearer <token>`. Without a valid one: `401 { "error": "unauthorised" }`.
  A 401 means sign in again (the token was revoked, or the account left the allow-list).
- **Envelope.** `200 { "data": …, "generatedAt": "<ISO-8601 UTC>" }`. Errors are `{ "error": "<code>" }`:
  `400 bad-id` (an id that is not a positive integer), `400 bad-request` (a bad query value),
  `404 not-found` (a character the site does not hold, or a ship that character does not have).
- **ETag.** Every GET sends a strong `ETag`. Send it back as `If-None-Match` and an unchanged
  resource answers `304` with no body. The tag covers `data` only, and does **not** change because
  time passed — only when the stored data behind the resource changes.
- **Unknown fields.** The site adds fields freely. Ignore what you do not know.
- **Strings are finished.** Show them as they are. The one exception is next.

### Clock-derived fields

Some fields were worked out against the server's clock at `generatedAt`: a countdown, a progress
bar, which queue entry is in training. A saved copy of them goes stale, and because the ETag
ignores the clock a fresh fetch may never come. **Do not show these from a saved copy. Recompute
them** from the raw fields listed beside each one below (marked ⏱). Three small functions cover all
of it; port them from `src/lib/view/format.ts` and `src/lib/view/skills.ts` with their tests
(`tests/view/format.test.ts`, `tests/view/skills.test.ts`):

```ts
/** A stored queue entry. Timestamps are ISO-8601 UTC; both are null on a paused queue. */
interface RawQueueEntry {
  skillId: number;
  skill: string;                 // "Drone Interfacing"
  level: number;                 // the level this entry finishes at
  label: string;                 // "Drone Interfacing V"
  startAt: string | null;
  finishAt: string | null;
  levelStartSp: number | null;
  levelEndSp: number | null;
  trainingStartSp: number | null;
}

// liveQueue: drop entries that have finished. A paused entry (finishAt null) is never dropped.
live = queue.filter(q => q.finishAt === null || q.finishAt > now)

// The head is live[0]. It is "in training" only when its finishAt is not null.

// queueProgress(entry, now) → 0..1 through the level
if (startAt === null || finishAt === null) return 0
window = finishAt - startAt;            if (window <= 0) return 1
stint  = clamp01((now - startAt) / window)
if (any SP bound is null || levelEndSp <= levelStartSp) return stint
sp = trainingStartSp + stint * (levelEndSp - trainingStartSp)
return clamp01((sp - levelStartSp) / (levelEndSp - levelStartSp))

// duration(ms) → "5d 6h 45m" | "42m" | "< 1m" | "0m"
if (ms <= 0) "0m";  minutes = round(ms / 60000);  if (minutes === 0) "< 1m"
days = floor(minutes / 1440), hours = floor(minutes % 1440 / 60), rest = minutes % 60
parts: "{days}d" if days > 0, "{hours}h" if hours > 0,
       "{rest}m" if rest > 0 or no part yet — rest zero-padded to 2 digits when a part precedes it

// Time left on a queue entry: the head counts from now, a later entry from its own start.
remaining = (startAt && finishAt) ? duration(finishAt - max(startAt, now)) : "—"
```

A raw `queue` is the queue **as stored**, finished entries included: what counts as finished
depends on when you read it. The `data` you fetched was built from the live part of it.

---

## `GET /api/v1/sync` — `sync.json`

Everything the phone should hold and each resource's current tag. Fetch every `path` whose `etag`
differs from the one you stored (the listed tag equals the `ETag` header that GET returns); delete
what is no longer listed. Paths are complete — use them as they are.

```ts
interface SyncData { resources: { path: string; etag: string }[] }
```

Listed: `me`, `characters`, `overview`, `training-overview`, and per character `skills`,
`training`, `clones`, `assets`, `wallet` (the balance), `wallet?kind=journal&offset=0&limit=500`,
`wallet?kind=transactions&offset=0&limit=500`, `ships`, and one `ships/asset/{itemId}` or
`ships/fit/{fittingId}` per card on the Ships screen.

## `POST /api/v1/auth/google` and `DELETE /api/v1/auth/session` (no fixture)

```
POST /api/v1/auth/google      { "idToken": "<Google ID token for the WEB client ID>", "deviceName": "Pixel 9" }
  200 { "token": "<bearer token, shown once>", "email": "pilot@example.com" }
  400 { "error": "bad-request" }    idToken missing, or deviceName not 1–80 characters
  401 { "error": "invalid-token" }  the ID token did not verify
  403 { "error": "not-allowed" }    the Google account is not on the site's allow-list

DELETE /api/v1/auth/session   (bearer)  →  204; the token no longer works
```

## `GET /api/v1/me` — `me.json`

```ts
interface Me { email: string; ownerInitials: string | null; apiVersion: 1 }
```

## `GET /api/v1/characters` — `characters.json`

The character switcher, in the site's order.

```ts
interface CharactersData { characters: CharacterOption[] }
interface CharacterOption {
  id: number; name: string;
  tag: string | null;          // "MAIN" / "ALT": the account's name in capitals
  sp: string | null;           // "112.5M", null until skills sync
  needsReauth: boolean;
}
```

Portraits: `https://images.evetech.net/characters/{id}/portrait?size=128`.

## `GET /api/v1/overview` — `overview.json`

```ts
interface OverviewData { summary: OverviewSummary; cards: OverviewCard[] }

interface OverviewSummary {
  wallet: string | null;       // "1.28B", unit "ISK" beside it
  totalSp: string | null;      // "5.1M", unit "SP" beside it
  queuesActive: number;        // ⏱ cards whose live head has finishAt in the future
  queuesTotal: number;
  next: { time: string; name: string } | null;
                               // ⏱ the soonest-finishing live head across the cards:
                               //   time = duration(finishAt - now), name = that card's name
}

interface OverviewCard {
  id: number; name: string;
  corp: string;                // "Corporation · Alliance"
  race: string | null;
  needsReauth: boolean;
  balance: string | null;      // whole ISK, grouped, no unit
  system: Sec | null;
  dockedAt: string | null;
  ship: { typeId: number; typeName: string; groupName: string | null } | null;
  online: boolean | null;      // null = unknown; show nothing, not "offline"
  training: OverviewTraining;  // ⏱ raw: trainingRaw
  trainingRaw: { synced: boolean; queue: RawQueueEntry[] };
  totalSp: string | null;
  accountTag: string | null;
  tags: string[];
}

/** A solar system with its security status formatted and classed for colour. */
interface Sec { name: string; sec: string; secClass: "sec-high" | "sec-low" | "sec-null" }

type OverviewTraining =
  | { active: true; skill: string; time: string; percent: number }
  | { active: false; label: string };
```

⏱ `training`, from `trainingRaw`:

```
!synced                 → { active: false, label: "Not synced" }
head = live[0]; none    → { active: false, label: "Queue empty" }
head.finishAt === null  → { active: true, skill: head.label, time: "paused", percent: 0 }
otherwise               → { active: true, skill: head.label,
                            time: duration(head.finishAt - now),
                            percent: round(queueProgress(head, now) * 100) }
```

## `GET /api/v1/training-overview` — `training-overview.json`

Skills › Overview: the chosen characters' queues, in the saved order.

```ts
interface TrainingOverviewData {
  characters: TrainingOverviewCharacter[];
  all: { id: number; name: string }[];   // every character (the site's chooser uses it)
}

interface TrainingOverviewCharacter {
  id: number; name: string; online: boolean | null;
  status: TrainingQueueStatus;  // ⏱
  progress: number | null;      // ⏱ 0–1, head entry; null unless training
  count: number;                // ⏱ live.length
  rows: TrainingQueueRow[];     // ⏱ the first 10 live entries
  truncated: boolean;           // ⏱ live.length > rows.length
  synced: boolean;              // raw
  queue: RawQueueEntry[];       // raw
}

type TrainingQueueStatus =
  | { kind: "eta"; text: string } | { kind: "paused" } | { kind: "empty" } | { kind: "notSynced" };

interface TrainingQueueRow {
  position: number; skill: string;
  trainedLevel: number; targetLevel: number;
  training: boolean;
  remaining: string;
}
```

⏱ from `synced` and `queue`:

```
active = live[0] exists && live[0].finishAt !== null;  last = live[live.length - 1]
status   = !synced ? notSynced : live is empty ? empty
         : (!active || last.finishAt === null) ? paused
         : { kind: "eta", text: duration(last.finishAt - now) }
progress = active ? queueProgress(live[0], now) : null
rows[i]  = { position: i + 1, skill: q.skill, trainedLevel: max(0, q.level - 1), targetLevel: q.level,
             training: i === 0 && active, remaining: (see "Time left") }
```

## `GET /api/v1/characters/{id}/skills` — `characters/{id}/skills.json`

The Skills tab: the grouped sheet with the live queue laid over it.

```ts
interface SkillsData {
  groups: SheetGroup[];
  queueLength: number;          // ⏱ live.length
  queue: RawQueueEntry[];       // raw
}
interface SheetGroup {
  groupId: number; name: string;
  groupSp: string;              // "6.1M"
  queued: number;               // ⏱ sum of its skills' queued
  skills: SheetSkill[];
}
interface SheetSkill {
  skillId: number; name: string; desc: string | null;
  level: number;                // ⏱ levels shown as trained
  activeLevel: number;          // ⏱ min(trainedActiveLevel, level)
  queued: number;               // ⏱ levels shown as queued above `level`
  training: boolean;            // ⏱ the first queued level is the one in training
  trainedLevel: number;         // raw: the stored sheet
  trainedActiveLevel: number;   // raw
}
```

⏱ per skill, from `trainedLevel`, `trainedActiveLevel` and the live queue (`sheetGroups` in
`src/lib/view/skills.ts`, cases in `tests/view/skills.test.ts`):

```
ahead    = levels of live entries for this skillId that are > trainedLevel
level    = ahead is empty ? trainedLevel : max(trainedLevel, min(ahead) - 1)
queued   = number of distinct values in ahead
training = queued > 0 && live[0].finishAt !== null && live[0].skillId === skillId
```

## `GET /api/v1/characters/{id}/training` — `characters/{id}/training.json`

The Training tab.

```ts
interface TrainingData {
  entries: QueueEntry[];        // ⏱ the live queue: drop an entry once its finishAt passes
  finishAt: string | null;      // raw: when the last entry finishes
  eta: string;                  // ⏱ countdown to finishAt — "22d 9h 0m 0s", "Queue complete", or "—"
}
interface QueueEntry {
  position: number;             // ⏱ 1-based place among the live entries
  skillId: number; skill: string; desc: string | null;
  targetLevel: number;
  remaining: string;            // ⏱ see "Time left"
  progress: number | null;      // ⏱ queueProgress, on the first live entry when it has dates; else null
  startAt: string | null;       // raw
  finishAt: string | null;      // raw
  levelStartSp: number | null;  // raw
  levelEndSp: number | null;    // raw
  trainingStartSp: number | null; // raw
}
```

`eta` ticks every second on the site: `countdown(ms)` is `"{d}d {h}h {m}m {s}s"` from whole
seconds, `"Queue complete"` at or below zero, `"—"` when `finishAt` is null.

## `GET /api/v1/characters/{id}/clones` — `characters/{id}/clones.json`

Nothing here depends on the clock.

```ts
interface ClonesData {
  synced: boolean;
  home: Place | null;
  active: Clone;
  locations: CloneLocation[];        // most clones first
  lastCloneJumpAt: string | null;    // raw timestamp; the site shows no cooldown from it
}
interface Place { name: string; kind: "station" | "structure" | "system" | "unknown"; system: Sec | null }
interface Clone { implants: Implant[]; slots: boolean[] /* ten, true = taken */; used: number }
interface Implant { typeId: number; name: string; slot: number | null; bonus: string | null; desc: string | null }
interface CloneLocation { key: string; title: string; station: string | null; system: Sec | null; clones: JumpClone[] }
interface JumpClone extends Clone { jumpCloneId: number; code: string /* "JC 01" */; name: string | null }
```

Icons: `https://images.evetech.net/types/{typeId}/icon?size=32`.

## `GET /api/v1/characters/{id}/assets` — `characters/{id}/assets.json`

The whole tree. Searching and grouping are the client's, as they are in the browser
(`src/app/assets/AssetsBrowser.tsx`). No clock.

```ts
interface AssetsData {
  itemCount: number;
  locations: AssetLocation[];             // most items first; [0] is the "largest location"
  descriptions: Record<string, string>;   // typeId → hover text
}
interface AssetLocation {
  locationId: number; label: string; itemCount: number; volume: number;
  system: Sec | null;
  nodes: AssetNode[];
}
interface AssetNode {
  itemId: number; typeId: number; typeName: string; name: string | null; quantity: number;
  flag: string;                // readable: "Cargo hold"
  rawFlag: string;             // ESI's own: "Cargo", "HiSlot0", "DroneBay"
  isBlueprintCopy: boolean; isCharge: boolean;
  volume: number;              // already multiplied by quantity
  iconUrl: string;
  children: AssetNode[];
}
```

## `GET /api/v1/characters/{id}/wallet` — three resources

The balance is its own small resource, so a new balance does not re-send two 500-row lists and the
lists do not repeat it. No clock: every date is an absolute UTC stamp.

```
GET …/wallet                                        → WalletSummary   wallet.json
GET …/wallet?kind=journal&offset=0&limit=500        → WalletRows      wallet-journal.json
GET …/wallet?kind=transactions&offset=0&limit=500   → WalletRows      wallet-transactions.json
```

`offset` defaults to 0, `limit` to 100, at most 500; rows are newest first. Fewer rows than `limit`
means the list ends there. The sync list names only the first 500 of each; ask for
`offset=500&limit=500` and on for older rows (they need a connection).

```ts
interface WalletSummary { balance: string | null /* "1,284,503,217.44" */; balanceIsk: number | null }

interface WalletRows { kind: "journal" | "transactions"; offset: number; limit: number; rows: JournalRow[] | TransactionRow[] }

interface JournalRow {
  id: number;
  date: string;                 // "2026-03-14 10:42" UTC
  day: string; time: string;    // "2026-03-14", "10:42"
  refType: string; description: string;
  withParty: string | null;
  signedAmount: string | null;  // "+18,400,000.00" / "−662,400.00" (U+2212), no unit
  balanceText: string | null;
  sign: "pos" | "neg" | "";
  amount: string | null; balance: string | null;          // with " ISK"
  firstParty: string | null; secondParty: string | null;
}
interface TransactionRow {
  transactionId: number;
  date: string; day: string; time: string;
  side: "Buy" | "Sell";
  typeId: number; typeName: string; quantity: string;
  unitText: string; signedTotal: string;                  // no unit; the total is signed
  unitPrice: string; total: string;                       // with " ISK"
  location: string; system: Sec | null;
}
```

## `GET /api/v1/characters/{id}/ships` — `characters/{id}/ships.json`

No clock.

```ts
interface ShipsData { skillsSynced: boolean; ships: ShipCard[]; fits: ShipCard[] }

interface ShipCard {
  key: string;                  // "asset:{itemId}" or "fit:{fittingId}" → the detail route
  href: string;                 // the site's own page; ignore
  name: string | null; typeId: number; typeName: string;
  groupName: string | null; raceName: string | null;
  location: string;
  system?: Sec | null;          // may be absent as well as null (a saved fit has no place)
  stats: { dps: string; ehp: string; velocity: string; cap: string; capOk: boolean | null; propKind: "MWD" | "AB" | null } | null;
  cpu: Gauge | null; power: Gauge | null;
  missingSkills: number;
  weapons: { key: string; typeId: number; name: string; count: number; charge: string | null; range: string | null }[];
  value: string | null; valueRaw: number; unpriced: string | null;
  error: string | null;         // "Could not compute": stats, cpu and power are null
  mastery: number | null;       // 0–5
}
interface Gauge { label: string; unit: string; used: number; output: number; text: string; percent: number; over: boolean }
```

`skillsSynced: false` → show the site's banner: every skill counts as level 0, numbers are worst case.
Hull renders: `https://images.evetech.net/types/{typeId}/render?size=128`.

## `GET /api/v1/characters/{id}/ships/asset/{itemId}` and `…/ships/fit/{fittingId}`

`characters/{id}/ships/asset/{itemId}.json`, `characters/{id}/ships/fit/{fittingId}.json`. No clock.
`1040000000001` (asset) and `7001` (fit) are a Tristan with eight drones aboard.

```ts
type ShipDetailData = { kind: "ok"; view: FitSheet } | { kind: "error"; title: string };
// "error": the engine could not compute this fit. Show the title and "Could not compute".
```

### Drones — the one sum the client does

There is no drones parameter. `view.droneControl` is the site's `DroneLimits`
(`src/lib/view/drones.ts`, 43 lines, tests in `tests/view/ship-detail.test.ts`); port it:

```ts
interface DroneControl {
  types: { typeId: number; name: string; inBay: number; bandwidth: number; dpsEach: number; volleyEach: number }[];
  bandwidth: number;                  // Mbit/s the hull controls
  maxActive: number | null;           // drones the pilot controls at once
  launched: Record<string, number>;   // typeId → count the screen opens with
  controlRange: string;               // "40.0 km"
  bay: string;                        // "40 / 40 m³"
}

// launchedTotals(control, launched)
for each type: n = min(launched[typeId] ?? 0, inBay)
  dps += n * dpsEach; volley += n * volleyEach; active += n; bandwidthUsed += n * bandwidth

// roomFor(control, launched, type): how many more of `type` may go out
min(inBay - launched[type], maxActive === null ? ∞ : maxActive - active,
    bandwidth > 0 ? floor((control.bandwidth - bandwidthUsed + 1e-9) / type.bandwidth) : ∞), floored at 0

// What follows the selection (src/app/ships/Drones.tsx):
total DPS = view.weapons.dps + dps        total volley = view.weapons.volley + volley
```

`droneControl` is null for a hull with no drone bay; `weapons` is then the whole of the DPS.
DPS shows with one decimal, grouped; volley as a whole number with "HP".

### The sheet

```ts
interface FitSheet {
  title: string; typeId: number; typeName: string; renderUrl: string; skillsSynced: boolean;
  ship: { typeName: string; groupName: string | null; raceName: string | null };
  location: { system: Sec | null; place: string | null; note: string | null };
  mastery: number | null;
  key: { ehp: KeyFigure; speed: KeyFigure; capacitor: KeyFigure; lock: KeyFigure; align: KeyFigure };
  weapons: { dps: number; volley: number };
  droneControl: DroneControl | null;
  stats: ShipStats;
  repairs: { label: string; value: string; idle: boolean }[];
  bonuses: { skill: string | null; level: number | null; text: string }[];
  gauges: Gauge[];
  counters: { label: string; used: number; total: number; over: boolean }[];
  slots: SlotColumn[];
  problems: { kind: string; label: string; text: string }[];
  missing: { skillTypeId: number; name: string; have: number; need: number }[];
  ammo: AmmoRow[];
  consumables: { key: string; typeId: number; name: string; desc: string | null;
                 kind: "capBooster" | "paste" | "booster" | "burstCharge" | "filament";
                 effect: string; use: string | null }[];
  cargo: Entry[]; drones: Entry[]; unfittable: Entry[]; unknown: Entry[];
  value: { total: string; totalShort: string; lines: { label: string; value: string }[]; unpriced: string | null };
  skillGaps: { name: string; skills: { skillTypeId: number; name: string; level: number; effect: string | null; affects: string }[] }[];
}

interface KeyFigure { value: string; unit: string | null; note: string | null; tone: "good" | "bad" | null }

interface StatSection { title: string; headline: string; rows: { label: string; value: string }[]; note?: string | null }
interface ShipStats {
  capacitor: StatSection & { ok: boolean | null };
  offense: StatSection;               // the site redraws this one from the drone selection
  defense: StatSection & { recharge: string | null; layers: ResistRow[] };
  targeting: StatSection; navigation: StatSection; drones: StatSection;
  bays: { label: string; value: string }[];
}
interface ResistRow { layer: string; hp: string; note: string | null; ehp: string;
                      resists: [number, number, number, number] /* em, thermal, kinetic, explosive, whole % */ }

interface SlotColumn { slot: "high" | "mid" | "low" | "rig" | "subsystem"; title: string; used: number; total: number; rows: ModuleRow[] }
interface ModuleRow {
  quantity: number; key: string; name: string; typeId: number;
  charge: string | null; chargeTypeId: number | null; chargeAssumed: boolean;
  state: string; desc: string | null; chargeDesc: string | null;
  range: RangeCells | null;
}
interface RangeCells { optimal: string | null; falloff: string | null }   // null renders as a dash

interface AmmoRow {
  key: string; typeId: number; name: string; desc: string | null;
  loadedIn: number;
  dps: string | null; dpsDesc: string | null;
  range: RangeCells | null;
  band: { label: "Short" | "Medium" | "Long"; level: 1 | 2 | 3; beyond: boolean; desc: string } | null;
  damage: { types: { kind: "em" | "thermal" | "kinetic" | "explosive"; label: string; share: number }[]; desc: string } | null;
  order: number;
}
interface Entry { key: string; typeId: number; name: string; nickname: string | null; quantity: number; desc: string | null; value: string | null }
```

`problems[].kind` is one of `cpu`, `power`, `calibration`, `slot`, `hardpoint`, `rigSize`,
`shipRestriction`, `maxGroupFitted`, `skill` today (`src/lib/dogma/validate.ts`); treat one you do
not know as a plain warning.
