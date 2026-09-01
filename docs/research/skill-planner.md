# EVE Online skill-training mechanics — research for a TypeScript EVEMon-style planner

Researched 2026-09-01. Primary sources actually opened (not recalled):

| Tag | Source |
|---|---|
| `[SDE]` | Official CCP SDE, JSONL build **3484357** (2026-08-28). Index: `https://developers.eveonline.com/static-data/tranquility/latest.jsonl` → archive `https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-3484357-jsonl.zip` (99 MB zip of `*.jsonl`). Verified by extracting `types.jsonl`, `groups.jsonl`, `categories.jsonl`, `typeDogma.jsonl`, `dogmaAttributes.jsonl`, `characterAttributes.jsonl`, `cloneGrades.jsonl`, `skillPlans.jsonl`, `expertSystems.jsonl`. |
| `[HB]` | Hoboleaks SDE mirror `https://sde.hoboleaks.space/tq/dogmaattributes.json`, `.../clonestates.json` |
| `[EVEMON]` | `github.com/peterhaneve/evemon` @ `7a89038` (2021-03-17), cloned to `/tmp/evemon-src` |
| `[PYFA]` | `github.com/pyfa-org/Pyfa` @ HEAD, cloned to `/tmp/pyfa-src` |
| `[ESI]` | `https://esi.evetech.net/meta/openapi.json` (OpenAPI 3, title "EVE SKINR Ingenuity (ESI) - tranquility") |
| `[UNI]` | EVE University Wiki: `/Skills`, `/Attributes`, `/Skill_training`, `/Skills_and_learning`, `/Clone_states`, `/Implants`, `/EVE_University_Corporation_Skill_Plans` |
| `[CCP-NEWS]` | `https://www.eveonline.com/news/view/updates-to-skill-training` (2021-08-24) |

> ESI's live `/dogma/attributes/{id}` and `/universe/types/{id}` endpoints returned
> `{"error":"Timeout contacting tranquility"}` on every attempt during this session, so all dogma
> verification below was done against the SDE and the Hoboleaks mirror instead. Note also that the
> ESI base URL has moved: `https://esi.evetech.net/latest/...` now 404s; use the unversioned
> `https://esi.evetech.net/<path>` form from the OpenAPI `servers` block, and
> `https://esi.evetech.net/ui/` 301s to `https://developers.eveonline.com/api-explorer`.

---

## 1. Skill points per level

### The formula (VERIFIED, with a correction to the prompt)

```
SP_cumulative(rank, level) = ceil( 250 * rank * 2^(2.5 * (level - 1)) )
                           = ceil( 250 * rank * sqrt(32^(level - 1)) )
```

`rank` = the skill's *training time multiplier* = dogma attribute **275 `skillTimeConstant`**.

The `250 * multiplier * sqrt(32^(level-1))` shape in the prompt is **correct**; what matters is the
rounding mode, and it is **`ceil`, not `round` and not `floor`**.

### Rank-1 table — the prompt's 1414 is wrong; it is **1415**

| Level | exact `250·2^(2.5(L-1))` | correct (ceil) | prompt said |
|---|---|---|---|
| 1 | 250 | **250** | 250 ✓ |
| 2 | 1414.2135623… | **1415** | 1414 ✗ |
| 3 | 8000 | **8000** | 8000 ✓ |
| 4 | 45254.834… | **45255** | 45255 ✓ |
| 5 | 256000 | **256000** | 256000 ✓ |

How this was proven, rather than asserted: `[UNI]` publishes the maximum trained SP an Alpha clone
can hold as **19,669,072**. Summing `SP(rank, cap)` over the 175 skills in `cloneGrades.jsonl`
`[SDE]`, using each skill's own `skillTimeConstant` from `typeDogma.jsonl`:

| rounding | alpha total |
|---|---|
| `ceil`  | **19,669,072** ← exact match |
| `round` | 19,669,032 |
| `floor` | 19,668,988 |

So `ceil` is the game's behaviour and rank-1 level II is 1415 SP. `[EVEMON]`
`src/EVEMon.Common/Data/StaticSkill.cs:205 GetPointsRequiredForLevel` agrees (it hardcodes `1415`
for rank 1 and `Math.Ceiling` for level 4), and its own comment admits its cheap
`(int)(Rank * 1414.3f + 0.5f)` approximation "may have 1pt difference here and there, only on the
lv2 skills" — I confirmed it is wrong at rank 16 (it gives 22629, correct is 22628). **Do not port
EVEMon's lookup-table version. Use `ceil(250*rank*2**(2.5*(level-1)))` with exact arithmetic.**

Note 2^2.5 is irrational, so use a numerically safe form. In TS, `Math.ceil(250*rank*Math.pow(2, 2.5*(level-1)))`
is fine for all shipped ranks (max rank 16, max value 4,096,000 — far inside f64 exactness), but be
aware that `Math.pow(2,2.5)` = 5.656854249492381 and `250*16*5.656854249492381 = 22627.416998…`
rounds up cleanly. Levels 1/3/5 are exact integers (`250·rank`, `8000·rank`, `256000·rank`).

### SP for a single level (not cumulative)

```
SP_level_only(rank, L) = SP_cumulative(rank, L) - SP_cumulative(rank, L-1)   // SP_cumulative(*,0) = 0
```

### Rank distribution actually in the game `[SDE]`

511 published skills; ranks present: 1(×64), 2(×86), 3(×75), 4(×33), 5(×112), 6(×22), 7(×9),
8(×41), 9(×4), 10(×23), 11(×3), 12(×14), 14(×18), 16(×7). Total SP to train every published skill
to V = **641,792,000**.

---

## 2. Training rate

### Formula (VERIFIED)

```
SP_per_minute = primaryAttrEffective + secondaryAttrEffective / 2
SP_per_hour   = primaryAttrEffective * 60 + secondaryAttrEffective * 30
```

`[EVEMON]` `src/EVEMon.Common/Models/BaseCharacter.cs:120-126`:

```csharp
float primAttr = GetAttribute(skill.PrimaryAttribute).EffectiveValue;
float secondaryAttr = GetAttribute(skill.SecondaryAttribute).EffectiveValue;
return primAttr * 60.0f + secondaryAttr * 30.0f;
```

`effectiveValue = base + implantBonus` (+ booster bonus — see below); EVEMon models only
`base + implantBonus` (`CharacterAttributeScratchpad.UpdateEffectiveAttribute`).

Time is *not* quantised: `TimeSpan.FromHours(sp / spPerHour)` (`BaseCharacter.cs:315`).

### Dogma attribute IDs (ALL VERIFIED against `[SDE] dogmaAttributes.jsonl` and `[HB]`)

| ID | name | notes |
|---|---|---|
| 164 | `charisma` | |
| 165 | `intelligence` | |
| 166 | `memory` | |
| 167 | `perception` | |
| 168 | `willpower` | |
| 175 | `charismaBonus` | implant/booster modifier |
| 176 | `intelligenceBonus` | |
| 177 | `memoryBonus` | |
| 178 | `perceptionBonus` | |
| 179 | `willpowerBonus` | |
| 180 | `primaryAttribute` | value **is a dogma attribute ID in 164..168** — "Only refers to another dogma attribute" |
| 181 | `secondaryAttribute` | same |
| 275 | `skillTimeConstant` | the rank |
| 331 | `implantness` | implant slot number (1..10) |
| 330 | `boosterDuration` | ms |

Worked example from `typeDogma.jsonl` `[SDE]`, typeID 3300 (Gunnery):
`{180: 167.0, 181: 168.0, 275: 1.0}` → primary = Perception, secondary = Willpower, rank 1. ✓

**Gotcha:** these are floats in the SDE. Coerce with `Math.round()` before using as IDs/ranks.

**Second gotcha:** there is a *separate* `characterAttributes.jsonl` table in the SDE with keys
1=Intelligence, 2=Charisma, 3=Perception, 4=Memory, 5=Willpower. These are **not** the values stored
in attributes 180/181 — do not confuse the two ID spaces. 180/181 hold 164–168.

All 511 published skills have attribute 180 present `[SDE]` — no fallback needed.

### Base attributes (VERIFIED; the prompt's two descriptions are both right and consistent)

- Displayed baseline is **20 in each attribute except Charisma at 19**, total **99** `[UNI]`.
- Remap constraints: **min 17, max 27** per attribute `[UNI]`.
- Equivalently, and this is the form to implement: **floor 17 per attribute (5 × 17 = 85) plus
  14 free points to distribute, max +10 into any one attribute.**

`[EVEMON]` `src/EVEMon.Common/Constants/EveConstants.cs` states this exactly:

```csharp
public const int SpareAttributePointsOnRemap = 14;
public const int CharacterBaseAttributePoints = 17;
public const int MaxRemappablePointsPerAttribute = 10;
public const int MaxImplantPoints = 5;
public const int MaxSkillsInQueue = 50;          // STALE — now 150, see §6
public const int MaxAlphaSkillTraining = 5000000;
```

So a valid remap is any `(per, mem, wil, int, cha)` with each in `[0,10]` and summing to exactly 14;
final base = 17 + points. 85 + 14 = 99 ✓.

### Implants (VERIFIED from `[SDE]`, not just the wiki)

Filtering category 20 (Implant), published, having `implantness` (331) and exactly one of 175–179:

| `implantness` (slot) | attribute boosted | # published implant types |
|---|---|---|
| 1 | Perception | 62 |
| 2 | Memory | 61 |
| 3 | Willpower | 63 |
| 4 | Intelligence | 62 |
| 5 | Charisma | 60 |

Zero cross-contamination — the mapping is strict. Grades +1..+5: Limited (+1), Limited-Beta (+2),
Basic (+3), Standard (+4), Improved (+5) `[UNI]`; all require Cybernetics, higher grades need higher
Cybernetics levels (exact per-grade Cybernetics levels **UNVERIFIED** — `[UNI]` did not state them
on the page fetched; read them off `requiredSkill1Level` on the implant types in the SDE).

`[EVEMON]` `Enumerations/ImplantSlots.cs` labels the same mapping ("Slot 1 (Perception)" … "Slot 5
(Charisma)") and models 10 slots total. `ESI /characters/{id}/implants` returns a bare `int[]` of
typeIDs — you must join to `typeDogma` yourself to get slot + bonus.

### Boosters / Cerebral Accelerators (VERIFIED from `[SDE]`)

Accelerators are boosters carrying the *same* attributes 175–179, applied to **all five** attributes
equally, with `boosterDuration` (330) in **milliseconds**. Sample of published types:

| typeID | name | bonus (all 5 attrs) | duration |
|---|---|---|---|
| 2838 | Standard Cerebral Accelerator | +5 | (no 330 set) |
| 33111 | Prototype Cerebral Accelerator | +9 | (no 330 set) |
| 33087 | Advanced Cerebral Accelerator | +17 | (no 330 set) |
| 55826 | Expert Cerebral Accelerator | +8 | 1,080,000,000 ms = 12.5 days |
| 48582 | Master-at-Arms Cerebral Accelerator | +10 | 86,400,000 ms = 24 h |
| 49753 | Onslaught Accelerator | +10 | 259,200,000 ms = 72 h |

145 accelerator-ish published types exist. Range spans +1 (the "Skill Accelerator" event items) to
+17. That contradicts `[UNI]`'s "+3 to +12" / "+4 to +12" summaries — trust the SDE.

**UNVERIFIED:** whether accelerator bonuses stack additively on top of implant bonuses with no cap.
Every source and the dogma model imply plain addition into `effectiveValue`, and EVEMon does not
model boosters at all so it offers no evidence. Model it as additive but keep it swappable.

### Alpha vs Omega (VERIFIED)

```
SP_per_minute_alpha = 0.5 * (primary + secondary/2)
```

`[UNI]` states Omega `= P + 0.5·S`, Alpha `= 0.5·P + 0.25·S` — i.e. a flat ×0.5 multiplier.
`[EVEMON]` `Extensions/EnumExtensions.cs:139-141`:

```csharp
private const float trainingRateUnknown = 0.5f;
private const float trainingRateAlpha   = 0.5f;
private const float trainingRateOmega   = 1.0f;
```

applied as `GetOmegaSPPerHour(skill) * status.GetTrainingRate()`.

Alpha caps and restrictions:
- Skill **queue is disabled** once `trained SP + unallocated SP >= 5,000,000` `[UNI]`. Unallocated
  SP counts toward the 5M. You can still *inject* SP past it.
- The Alpha skill set is **175 skills**, verified by count in `cloneGrades.jsonl` `[SDE]`.
- Max trained SP from the Alpha set = **19,669,072** (computed above; matches `[UNI]`).
- Level caps within the Alpha set `[SDE]`: 9 skills capped at I, 28 at II, 59 at III, 56 at IV, 23 at V.
- Going Alpha does not destroy SP: non-Alpha skills become *inactive* — `trained_skill_level` stays,
  `active_skill_level` drops. `[UNI]`, and ESI models exactly this (§6).

---

## 3. Neural remaps

Rules (`[UNI]`, corroborated by `[EVEMON]`):
- **1 "accrued"/normal remap**, which **takes 365 days to replenish** after use.
- **2 bonus remaps** granted to new characters; **one-time, never replenish**.
- On remap you redistribute all 14 free points; **min 17 / max 27 per attribute**; you may not leave
  points unassigned.
- Implants are irrelevant to the remap itself (they're a separate additive layer).

ESI `/characters/{character_id}/attributes` `[ESI]` gives you everything needed:

```
intelligence, memory, perception, willpower, charisma   (int64, required)
bonus_remaps                     (int64)   — bonus remaps still available
last_remap_date                  (date-time) — includes bonus-remap usage
accrued_remap_cooldown_date      (date-time) — when the yearly remap is available again
```

**Critical gotcha (from `[EVEMON]` `Models/Character.cs:862-871`):**

```csharp
/// Attributes include current implants! Therefore, subtract the information
/// about current implants since those were fetched with Implants beforehand.
private void SetAttribute(EveAttribute attribute, int value)
    => m_attributes[(int)attribute].Base = value - CurrentImplants[attribute]?.Bonus ?? 0;
```

EVEMon treats the ESI `/attributes` numbers as **effective (implants included)** and subtracts the
implant bonuses to recover the base. The ESI schema description is silent on this. **Flag as
partially UNVERIFIED** — I could not test against a live character (ESI was timing out), but
EVEMon's behaviour is deliberate and commented, so implement it EVEMon's way and add a sanity check:
recovered base values must all land in `[17,27]` and sum to 99; if they don't, you subtracted when
you shouldn't have (or vice versa).

EVEMon also back-derives the last-remap timestamp as `accrued_remap_cooldown_date - 365 days`
(`Character.cs:848-850`) — a clean way to display "remap available in N days".

### How EVEMon computes the optimal remap (`Helpers/AttributesOptimizer.cs`)

It is a **brute-force enumeration of every legal point allocation**, not an analytic optimum:

```
for per in 0..10
  for wil in 0..(14-per), wil<=10
    for int in 0..(14-per-wil), int<=10
      for mem in 0..(14-per-wil-int), mem<=10
        cha = 14-per-wil-int-mem;  skip if cha > 10
        // ~14,641 combinations (comment says "less than 11^4")
```

For each candidate it resets a `CharacterScratchpad`, sets the five bases to `17 + points`, then
trains the plan's skill list in order, accumulating `TrainingTime`. Two early-exits prune the search:
bail out when the accumulated time exceeds `maxDuration`, and bail out when the candidate has
trained no more skills than the best-so-far *and* is already slower.

Selection rule: **maximise the number of skills trained inside `maxDuration` first; break ties by
minimum training time.** That "more skills first" rule is what makes the 1-year variant meaningful.

Three public entry points, matching `Enumerations/AttributeOptimizationStrategy.cs`:

| Strategy | Method | `maxDuration` |
|---|---|---|
| `RemappingPoints` | `OptimizeFromPlanAndRemappingPoints(plan)` — splits the plan at user-placed remap markers, optimises each segment independently | `TimeSpan.MaxValue` |
| `OneYearPlan` | `OptimizeFromFirstYearOfPlan(plan)` | **365 days** — the real-world "you only get one remap a year" constraint |
| `Character` | `OptimizeFromCharacter(character, plan)` — "what should I have remapped to, to have trained what I already know" | `MaxValue` |
| `ManualRemappingPointEdition` | user hand-edits a marker | — |

The remap-point splitting lives in `GetResultsFromRemappingPoints`: walk plan entries in order; when
an entry carries a `Remapping`, close the current `RemappingResult` and open a new one seeded from
the scratchpad's current state. Implants are folded in first via `plan.Character.After(plan.ChosenImplantSet)`.

For a TS port this is trivially fast — 14,641 candidates × plan length, and you can memoise
`SP_per_hour` per (skill, attribute-vector) since it depends only on the primary/secondary pair
(there are only 20 ordered pairs, so precompute a 20-entry rate table per candidate and the inner
loop becomes `sp / rate[pairIndex]`).

---

## 4. Skill prerequisites

### Dogma IDs — ALL SIX PAIRS VERIFIED `[SDE]` + `[HB]`

| skill # | type ID attr | level attr |
|---|---|---|
| 1 | **182** `requiredSkill1` | **277** `requiredSkill1Level` |
| 2 | **183** `requiredSkill2` | **278** `requiredSkill2Level` |
| 3 | **184** `requiredSkill3` | **279** `requiredSkill3Level` |
| 4 | **1285** `requiredSkill4` | **1286** `requiredSkill4Level` |
| 5 | **1289** `requiredSkill5` | **1287** `requiredSkill5Level` |
| 6 | **1290** `requiredSkill6` | **1288** `requiredSkill6Level` |

Every ID in the prompt is correct. **Note the non-obvious ordering for 5 and 6**: the *type* IDs are
1285/1289/1290 but the *level* IDs are 1286/1287/1288 — i.e. skill5's level is 1287, not 1289+1.
`[PYFA]` `gui/builtinItemStatsViews/attributeGrouping.py:3` builds the same set generatively:
`sum((["requiredSkill{}".format(x), "requiredSkill{}Level".format(x)] for x in range(1,7)), [])`.

Real example, typeID 3339 `[SDE]`:
`{180:167, 181:168, 182:3327, 183:33095, 275:8, 277:4, 278:3, 1047:0}` — rank 8, requires skill
3327 at level 4 and skill 33095 at level 3.

Prereqs apply to **any** type (ships, modules, ammo), not just skills — that is how "skills for this
fit" works.

### Recursive expansion

`[EVEMON]` `Extensions/StaticSkillLevelEnumerableExtensions.cs → FillDependencies` is the reference
algorithm. Its contract, from the doc comment: for *Eidetic Memory II* it returns
`{ Instant Recall I, II, III, IV, Eidetic Memory I, Eidetic Memory II }` — i.e. **a flat, ordered,
de-duplicated list of (skill, level) pairs in trainable order**.

```
fillDependencies(list, set, item /* (skill, level) */, includeRoots):
    if not set.has(skill, 1):
        for prereq in skill.prerequisites where prereq.skill != skill:
            fillDependencies(list, set, prereq, includeRoots = true)   // prereqs always fully included
        emit (skill, 1)                                                // level I implies all prereqs
    max = includeRoots ? item.level : item.level - 1
    for i in 2..max:
        if not set.has(skill, i): emit (skill, i)
```

Key properties to preserve in TS:
- The dedupe key is the **(skillId, level) pair**, not the skill — `SkillLevelSet`.
- Prerequisites are only expanded **once**, guarded by `set.has(skill, 1)`; higher levels of an
  already-seen skill are appended without re-walking prereqs. This is what keeps it near-linear.
- Prerequisites are recursed with `includeRoots = true` (you need the prereq *at its required level*),
  while the root item respects the caller's flag.
- Self-referencing prereqs are filtered (`prereq.Skill != skill`).
- Output order is already a valid training order (topological).

`[PYFA]` does the same thing more simply in `service/character.py:414-419 _trainSkillReqs` (recursive
`setLevel` on each unmet child) and `_checkRequirements` (recursive dict build for "what's missing
for this fit"). EVEMon's version is the one to port because it yields an ordered plan, not a set.

Plan-level semantics `[EVEMON]` `Models/Plan.cs:249-296 PlanTo`: raising a skill's planned level
adds the whole dependency closure; lowering it removes entries from level 5 downward but is floored
at `GetMinimumLevel(skill)` so you can never orphan something another entry depends on.

---

## 5. "One character per account trains at a time"

- **Default: exactly one character per account has an active skill queue.** To train a different
  character on that account you must switch, which pauses the other. (CCP support:
  `https://support.eveonline.com/hc/en-us/articles/203411052-Multiple-Character-Training` — returned
  403 to WebFetch, so this is from search-result excerpts of that page plus `[UNI]` `/Accounts` and
  `/Alternate_characters`.)
- **Multiple Character Training (MCT)** — a "Multiple Pilot Training Certificate", bought with PLEX
  from the New Eden Store or off the market, activates **30 days at a time** and grants **1
  additional simultaneous queue** per certificate. Two MCTs → 3 concurrent queues. Sold in 1/2/3/6/12/24
  packs. It does **not** speed up any individual character.
- Alpha accounts cannot multibox (cannot log two characters in simultaneously) `[UNI] /Clone_states`;
  this is a login restriction, separate from training.

### What this means for a 2-account / 4-character planner

Model the account, not just the character. Minimum viable model:

```ts
type Account = {
  id: string;
  omega: boolean;                    // gates the ×0.5 alpha multiplier on all its characters
  concurrentQueues: number;          // 1 + activeMctCount
  characters: CharacterId[];         // your 2 per account
};
```

The scheduling constraint is: **at any instant, at most `concurrentQueues` of an account's
characters may have a running queue.** With 2 accounts × 2 characters and no MCT you can train 2 of
your 4 characters at a time, and planning becomes an interleaving problem: given each character's
plan, choose which character holds the queue over each time interval. A useful planner feature is
therefore "training-time-share allocation" — e.g. show each character's completion date under
(a) exclusive training, (b) an even split, (c) a user-specified priority order. EVEMon has no
concept of this at all; it models one character in isolation. This is the main place your planner
should *not* copy EVEMon.

Note the Omega flag is per-*account*, so both characters on an unsubbed account train at Alpha rate
and are subject to the 5M cap independently.

---

## 6. The skill queue

### Limits — the prompt's "50 / 24h" numbers are OUT OF DATE

`[CCP-NEWS]` (2021-08-24, shipped September 2021), quoting directly:

> "The current limit of 50 skill entries in the queue will be increased to **150** for both Alpha and
> Omega clones."
>
> "The current restriction of the Alpha clone training queue allowing only the skills that would
> start training within the next 24h will also be **removed**."

Also from that post: each character can save up to **ten Personal Skill Plans**, and **skill plans
have no length limit**.

So the current state is:
- **Queue: 150 entries, Alpha and Omega alike.**
- **No 24-hour rule for anyone.** (It applied to Alphas before Sept 2021; before ~2014 a 24h rule
  applied to everyone.)
- The Alpha limiter that *does* still exist is the **5,000,000 SP** one: the queue is disabled once
  trained + unallocated SP reaches 5M `[UNI]`.

`[EVEMON]`'s `MaxSkillsInQueue = 50` is **stale** — the fork's last commit is March 2021, five months
before the change. Don't inherit it.

### ESI `/characters/{character_id}/skillqueue` — schema verified `[ESI]`

Array of objects. **Required: only `queue_position`, `skill_id`, `finished_level`.** Everything else
is optional and *is genuinely absent when the queue is paused*.

| field | type | meaning |
|---|---|---|
| `queue_position` | int64 **(req)** | 0-based position |
| `skill_id` | int64 **(req)** | skill typeID |
| `finished_level` | int64 **(req)** | the level this entry trains *to* |
| `start_date` | date-time | when this entry starts/resumes |
| `finish_date` | date-time | when it completes |
| `training_start_sp` | int64 | SP in the skill when *this entry* began training |
| `level_start_sp` | int64 | SP threshold at the start of `finished_level` |
| `level_end_sp` | int64 | SP threshold at the end of `finished_level` |

Endpoint description, verbatim: *"Entries that have their finish time in the past are completed, but
aren't updated in the `/skills` route yet. This will happen the next time the character logs in."*

`/characters/{id}/skills` returns `{ skills[], total_sp, unallocated_sp? }` where each skill is
`{ skill_id, trained_skill_level, active_skill_level, skillpoints_in_skill }` (all required). Note
`active_skill_level` "can differ from trained due to alpha status and/or active expert systems" —
that is the Alpha-lockout and Expert System mechanic surfacing in the API.

### Computing current SP mid-training

The linear interpolation, straight from `[EVEMON]` `Models/QueuedSkill.cs`:

```
rate_sp_per_hour = (level_end_sp - training_start_sp) / hours(finish_date - start_date)

currentSP = level_end_sp - hours(finish_date - now) * rate_sp_per_hour
currentSP = clamp(currentSP, training_start_sp, level_end_sp)
```

EVEMon's actual code (`QueuedSkill.CurrentSP`):

```csharp
int estimatedSP = (int)(EndSP - EndTime.Subtract(DateTime.UtcNow).TotalHours * SkillPointsPerHour);
return IsTraining ? Math.Max(estimatedSP, StartSP) : StartSP;
```

Notes for the port:
- Deriving the rate **from the dates**, rather than from attributes, is the robust move — it
  automatically absorbs implants, boosters, and the Alpha/Omega multiplier without you having to
  model them. EVEMon only falls back to that when the skill is unknown to its datafile; do it
  unconditionally.
- Guard `finish_date == start_date` (division by zero) — EVEMon returns rate 0.
- Only the entry at `queue_position == 0` is training. Later entries have future `start_date`s.
- **Paused queue**: CCP returns *empty* `start_date`/`finish_date`. EVEMon then simulates a
  "what if we started now" schedule, chaining each entry's computed duration
  (`QueuedSkill` ctor, `startTimeWhenPaused` ref parameter). Do the same or your UI shows blanks.
- **Reconciling `/skills` with `/skillqueue`** (`[EVEMON]` `Character.cs:876-931`): `/skills` is stale
  until login. Build a dict of queue entries that are completed-or-training, then for each `/skills`
  row take `max()` of level, SP and active level against the queue-derived values. Specifically:
  for a *completed* queue entry use `queuedSkill.EndSP` and `queuedSkill.Level`; for the *training*
  entry use the interpolated `CurrentSP`. Without this, a character who hasn't logged in for a week
  shows a week-old skill sheet.
- Total SP for the character = `/skills.total_sp` plus the same correction, plus `unallocated_sp`
  if you want the injectable pool.

---

## 7. Plan import / export formats

### `.emp` — EVEMon Plan (VERIFIED from source)

**`.emp` is gzip-compressed UTF-8 XML.** No container, no header — just `GZipStream` over the XML
string (`[EVEMON]` `Helpers/UIHelper.cs:184-186`, `PlanIOHelper.ImportFromXML` decompresses when the
filename ends `.emp`). The uncompressed payload is the identical XML that "Save as .xml" writes, so
`.emp` and `.xml` are the same schema.

Root is `<plan>` (`Serialization/Exportation/OutputPlan.cs`, `[XmlRoot("plan")]`), extending
`SerializablePlan`:

```xml
<plan revision="{int}" name="{string}" owner="{guid}" description="{string}">
  <sorting> ... PlanSorting ... </sorting>
  <entry skillID="{int}" skill="{name}" level="{1-5}" priority="{int, default 3}" type="{PlanEntryType}">
    <notes>...</notes>
    <group>...</group>            <!-- repeatable -->
    <remapping status="{RemappingPointStatus}"
               per="{long}" int="{long}" mem="{long}" wil="{long}" cha="{long}"
               description="..."/>
  </entry>
  <invalidEntry> ... </invalidEntry>
</plan>
```

Attribute names are exactly as shown (`[EVEMON]` `Serialization/Settings/SerializablePlanEntry.cs`,
`SerializablePlan.cs`, `SerializableRemappingPoint.cs`). Note the remap point is **nested inside the
entry it precedes**, and uses short attribute names `per/int/mem/wil/cha`.

There is a **second format, `.epb`** ("EVEMon Plans Backup") — also gzipped XML, root `<plans>`
(`OutputPlans`), containing multiple `<plan>` children with a top-level `revision`. Same
decompression path (`ImportPlansFromXML`).

Import accepts both compressed and uncompressed; `revision == 0` means the pre-2.x format and is
rejected with "no support".

### EVEMon plain-text export — "Skill Name V"

`PlanIOHelper.ExportAsText` builds lines as:

```
[optional "N. " index] <Skill Name> <ROMAN LEVEL> [ (2 days, 4 hours; Start: ...; Finish: ...; Cost: ... ISK) ]
```

- Level is rendered by `Skill.GetRomanFromInt(entry.Level)` → **Roman numerals** (`I`..`V`).
- **One line per skill *level***, not per skill — a plan to Gunnery III emits three lines.
- Remap markers are emitted as their own line: `***{remapping description}***`.
- Optional Forum (`[b]`/`[/b]`) or HTML (`<b>`, `<a onclick="CCPEVE.showInfo(id)">`) markup; a
  header (`Skill plan for {char}`) and a footer (`N unique skills, M skill levels; Total time: …;
  Completion: … UTC; Cost: … ISK`). All toggled by `PlanExportSettings`.
- The bare form — markup none, no numbering, no times — is the clean `Skill Name V` per line that
  everyone means by "EVEMon text format".

**Import is asymmetric:** this fork of EVEMon has **no plain-text plan importer**. `Plans > Import`
only reads `.emp`/`.xml`/`.epb`. The only paste-in-text path is `LoadoutImportationWindow`, which
takes an **EFT fitting** and derives the required skills (this is the documented Pyfa → EVEMon
route: Pyfa `Fit > To Clipboard` → EVEMon plan window → Loadout Import → Add to Plan). Older EVEMon
builds are widely described as having "Import Plan From File" for text; **UNVERIFIED** in this
codebase.

### In-game EVE "Skill Plan" — YES, it has a clipboard import, and here is the real format

In-game path: **Skills window → Skill plan area → hamburger menu → Import…** (and the same menu has
Copy-to-clipboard for export). `[UNI] /EVE_University_Corporation_Skill_Plans` confirms the hamburger
menu "allows a pilot to copy the contents of the skill plan to the clipboard… useful in exporting
the list of skills to third party tools, such as EVEMON."

The actual payload — from a real, working, community-published plan
(`github.com/TeaRiyang/skill-plan`, `the-magic-14-lv3.md`, exported from a Japanese client) — is
**one line per skill level, level as an ARABIC digit**, each name wrapped in EVE's localisation tag:

```
<localized hint="宇宙船操作">Spaceship Command*</localized> 1
<localized hint="航行技術">Navigation*</localized> 1
<localized hint="CPU管理">CPU Management*</localized> 1
<localized hint="CPU管理">CPU Management*</localized> 2
<localized hint="宇宙船操作">Spaceship Command*</localized> 2
```

Observations that matter for a parser/emitter:
- **Arabic digits, not Roman.** EVEMon's text export ("Gunnery V") is therefore **not** directly
  paste-compatible with the in-game importer.
- **One line per level**, repeated, **in training order** — same granularity as EVEMon's text export.
- `<localized hint="…">…</localized>` is the standard EVE localisation wrapper; the `hint` is the
  client-locale name and the body is the English name with a trailing `*`. On an English client the
  export is expected to be the plain `Skill Name N` form. Third-party tools (e.g.
  `github.com/Fridman86/Personal-Skill-Monitor`) advertise their clipboard export as
  "EVE Online game-importable format (`Skill Name Level`)", which corroborates that the bare form
  imports fine.
- **UNVERIFIED:** (a) that the importer tolerates the bare form with no `<localized>` wrapper — very
  likely, given the above, but I did not see it stated by CCP; (b) whether it also accepts Roman
  numerals; (c) the exact separator (space vs tab) and whether trailing `*` is required. Verify by
  round-tripping in the client before shipping an exporter.

**Recommended plan for your tool:** emit *two* text flavours — `Skill Name N` (in-game paste,
one line per level, arabic) and `Skill Name V` (EVEMon-compatible, roman) — plus read/write `.emp`
(gzip + the XML schema above) for full fidelity including remap points, priorities and notes.

### Pyfa

`[PYFA]` has **no skill-plan format at all**. It models a character's skill levels
(`eos/db/saveddata/skill.py`, table `characterSkills(characterID, itemID, _Skill__level)`), pulls
skills from ESI, and computes "skills required for this fit" recursively — but its interchange
format is EFT fittings, not skill plans. The Pyfa→EVEMon path is fitting-based, as above.

---

## 8. SDE fields you need

The modern SDE is **JSONL, one JSON object per line, `_key` is the primary key**. Get the build
number from `https://developers.eveonline.com/static-data/tranquility/latest.jsonl`
(`{"_key":"sde","buildNumber":3484357,"releaseDate":"2026-08-28T11:07:12Z"}`) and then download
`https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-{buildNumber}-jsonl.zip`.
The un-numbered `...-latest-jsonl.zip` URL returns **403** — you must substitute the build number.
(Tip used here: the zip's central directory is at the tail, so an HTTP range request on the last
~400 KB plus a per-entry range request lets you pull one 20 KB file without downloading all 99 MB.)

### Files that matter

| file | why |
|---|---|
| `types.jsonl` | `_key` (typeID), `name.{en,de,…}`, `groupID`, `published`, `description` |
| `groups.jsonl` | `_key`, `categoryID`, `name`, `published` — join to find skill groups |
| `categories.jsonl` | **`16` = "Skill"** (verified, `published: true`); `20` = "Implant" |
| `typeDogma.jsonl` | `dogmaAttributes: [{attributeID, value}]` — this is where 275/180/181/182…/1047 live |
| `dogmaAttributes.jsonl` | attribute metadata (`name`, `description`, `defaultValue`) |
| `cloneGrades.jsonl` | **the Alpha skill set** — see below |
| `characterAttributes.jsonl` | the 5 attributes' names/descriptions/icons (keys 1–5) for UI |
| `skillPlans.jsonl` | **CCP's own certified skill plans** — see below |
| `expertSystems.jsonl` | Expert Systems: `{_key, durationDays, internalName, retired, hidden, skillsGranted:[{typeID,level}]}` — explains `active_skill_level > trained_skill_level` |
| `certificates.jsonl`, `masteries.jsonl` | if you want certificate/mastery goals like EVEMon's |

### Identifying skills

```
skill types = types where groups[type.groupID].categoryID == 16
```

Counts at build 3484357: **588** types in category 16, **511 published**, spread over **25 groups**
(24 published). The unpublished group is **`505` "Fake Skills"** — exclude it. `[EVEMON]`
`DBConstants.FakeSkillsGroupID = 505` and `SkillCategoryID = 16` agree exactly.

Published skill groups include 255 Gunnery, 256 Missiles, 257 Spaceship Command, 258 Fleet Support,
266 Corporation Management, 268 Production, 269 Rigging, 270 Science, 272 Electronic Systems,
273 Drones, … (25 total).

### Per-skill fields to extract

```ts
type SdeSkill = {
  id: number;                      // types._key
  name: string;                    // types.name.en
  groupId: number;                 // types.groupID
  published: boolean;
  rank: number;                    // attr 275 skillTimeConstant   (int, not float)
  primaryAttr: 164|165|166|167|168;   // attr 180
  secondaryAttr: 164|165|166|167|168; // attr 181
  prereqs: { skillId: number; level: 1|2|3|4|5 }[];  // (182,277) (183,278) (184,279) (1285,1286) (1289,1287) (1290,1288)
  canNotBeTrainedOnTrial: boolean; // attr 1047
  basePrice?: number;              // types.basePrice — skillbook cost, for shopping lists
};
```

### `canNotBeTrainedOnTrial` (1047) — do NOT use it for Alpha

**213 published skills** have `1047 == 1` (Advanced Planetology, all four Titans, ORE Hauler,
Laboratory Operation, Starbase Defense Management, …). This is the **legacy trial-account** flag from
before the 2016 Alpha/Omega split. It is **not** the inverse of the Alpha set (which is 175 skills
allowed, out of 511). Keep it if you want, but the Alpha gate must come from `cloneGrades`.

### The Alpha skill set — `cloneGrades.jsonl` (this is where it is published)

```json
{"_key": 1, "name": "Alpha Caldari", "skills": [{"level": 5, "typeID": 3300}, ...]}
```

Four records: `_key` 1 = Alpha Caldari, 2 = Alpha Minmatar, 4 = Alpha Amarr, 8 = Alpha Gallente
(note the bitmask-style keys). **All four contain the identical 175-skill / identical-level map** —
I compared them programmatically, they are equal. CCP unified the racial Alpha sets in December 2017
and `[PYFA]` `db_update.py:308-340 processCloneGrades` still *asserts* they are equal
("`raise Exception('Alpha Clones not all equal')`") and then keeps only `alphaCloneID == 1`. Do the
same: read `_key == 1`, assert the others match, expose `alphaMaxLevel: Map<typeId, 1..5>`.

Mirrors, if you'd rather not pull the 99 MB zip:
- `https://sde.hoboleaks.space/tq/clonestates.json` — same data, `{cloneStateId: {skills: {typeId: level}, internalDescription}}`. This is what `[EVEMON]` `tools/XmlGenerator/Providers/HoboleaksAlphaSkills.cs` fetches at datafile-build time (it takes the `max` level across all four states — safe now that they're identical).
- `https://sde.hoboleaks.space/tq/dogmaattributes.json` — attribute metadata, keyed by ID as strings.

Derived facts worth caching: Alpha level caps are I×9, II×28, III×59, IV×56, V×23; max Alpha trained
SP = 19,669,072.

### `skillPlans.jsonl` — a bonus find

40 official CCP skill plans, e.g.:

```json
{"_key": 4, "careerPathID": 7, "factionID": 500002,
 "internalName": "Minmatar Soldier of Fortune - Faction Militia",
 "name": "Minmatar Militia Fighter",
 "description": {"en": "...", "de": "...", ...},
 "skillRequirements": [{"level": 1, "typeID": 3327}, ...],
 "milestones": [{"level": 3, "typeID": 3329}, ...]}
```

These are the in-game "Certified Skill Plans". Shipping them as starter templates is essentially
free, and `milestones` gives you natural progress checkpoints. `description` contains
`<a href="fitting:...">` links you'll want to strip or render.

---

## Summary of corrections to the brief

| # | Prompt said | Reality |
|---|---|---|
| 1 | rank-1 L2 = **1414** SP | **1415** — the formula rounds with `ceil`; proven against the published 19,669,072 Alpha total |
| 2 | attributes "base 17, min 17, max 27, 14 points" | Correct, and equivalent to the wiki's "20 each / 19 CHA / total 99". Both framings check out (5×17 + 14 = 99) |
| 2 | accelerators "+3 to +12" | SDE shows **+1 to +17**; `boosterDuration` (attr 330) is in ms |
| 6 | queue "max 50 entries / 24h for Alpha" | **150 entries for everyone since Sept 2021**; the Alpha 24h rule was **removed** at the same time. EVEMon's `MaxSkillsInQueue = 50` is stale |
| 7 | in-game paste format "Gunnery 5"? | **Confirmed Arabic digits, one line per level**, wrapped in `<localized hint="…">Name*</localized>` on non-English clients. EVEMon's text export uses **Roman** numerals and is therefore not directly paste-compatible |
| 8 | `canNotBeTrainedOnTrial` for Alpha restrictions | Wrong tool — it's the pre-2016 **trial** flag (213 skills). Alpha set = `cloneGrades.jsonl` (175 skills) |
| 4 | requiredSkill4..6 = 1285/1289/1290, levels 1286/1287/1288 | Correct — and note the deliberately scrambled pairing (skill5 → level 1287) |

## Things I could not verify

- **Whether ESI `/characters/{id}/attributes` includes implant bonuses.** EVEMon subtracts them, with
  an explicit comment saying they're included. ESI's own schema is silent and the live endpoint was
  timing out all session. Implement EVEMon's way, but assert `base ∈ [17,27]` and `sum == 99`.
- **Whether the in-game skill-plan importer accepts the bare `Skill Name N` form** (no `<localized>`
  wrapper), and whether it also accepts Roman numerals. Strong circumstantial evidence for the
  former; no evidence either way for the latter. Needs a client round-trip test.
- **Exact Cybernetics level required per implant grade (+1…+5).** Read it from `requiredSkill1Level`
  on the implant types rather than trusting any wiki summary.
- **Whether booster (accelerator) bonuses stack additively with implants, uncapped.** The dogma model
  says yes; nothing I read states it explicitly and EVEMon doesn't model boosters at all.
- **Whether older EVEMon releases had a plain-text plan importer.** The `peterhaneve` fork at
  `7a89038` does not.
- **CCP support article `203411052` (Multiple Character Training)** returned HTTP 403 to WebFetch;
  the MCT details above come from search excerpts of that page plus EVE University. The core claim
  (1 queue per account, +1 per MCT, 30-day increments) is consistent across all of them.
