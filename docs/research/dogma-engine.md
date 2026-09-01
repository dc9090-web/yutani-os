# Building a pure-TypeScript EVE dogma / fitting engine

Research notes for a Pyfa-modelled fitting engine. Target: phase-4 fitting validation
(CPU / PG / calibration / slots / hardpoints / missing skills), extensible to DPS & tank
without rewriting.

**Sources read directly (cloned locally, commit = HEAD as of 2026-09-01):**

| What | Where |
|---|---|
| Pyfa | `https://github.com/pyfa-org/Pyfa` → `/tmp/everef/pyfa` |
| EOS (standalone) | `https://github.com/pyfa-org/eos` → `/tmp/everef/eos` |
| EVE SDE (JSON, shipped inside Pyfa) | `/tmp/everef/pyfa/staticdata/fsd_built/` |
| Stacking penalty reference | <https://wiki.eveuniversity.org/Stacking_penalties> |

Every attribute ID, effect ID and formula below was **verified against the shipped SDE
JSON** or quoted from source, not recalled. Anything unverified is marked **UNVERIFIED**.

> **Headline recommendation.** Model the engine on **EOS**, not on Pyfa. Pyfa's engine is
> 2401 hand-written Python effect classes (`/tmp/everef/pyfa/eos/effects.py`, 43,800 lines)
> that call `boost()` / `multiply()` / `increase()` imperatively, with `stackingPenalties=True`
> hardcoded at 408 call sites. EOS is a *data-driven* interpreter of the SDE's `modifierInfo`
> field and is perhaps 600 lines of real logic. For a greenfield TS engine the data-driven
> route is dramatically less work and stays correct as CCP patches the SDE.

---

## 0. TL;DR for phase 4

Facts that massively narrow the phase-4 scope — all verified against the SDE:

1. **Only 4 operators ever touch fitting attributes.** Scanning all 3415 effects for
   modifiers whose `modifiedAttributeID` is `cpu(50)`, `power(30)`, `cpuOutput(48)` or
   `powerOutput(11)` yields only `preMul(0)`, `modAdd(2)`, `postMul(4)` and `postPercent(6)`.
   No division, no assignment. (Implement the rest anyway — it's ~10 lines — but you can't
   be blocked on them.)
2. **Slot counts and calibration are never modified by `modifierInfo` at all.** Zero effects
   in the entire SDE modify `hiSlots(14)`, `medSlots(13)`, `lowSlots(12)`, `rigSlots(1137)`,
   `turretSlotsLeft(102)`, `launcherSlotsLeft(101)`, `upgradeCapacity(1132)`, `upgradeCost(1153)`,
   `maxSubSystems(1367)`. They are static base attributes — **except** T3 subsystems, which
   need two hand-coded effects (see §5.4).
3. **Every fitting attribute has `stackable: 1`,** so the stacking penalty never applies to
   CPU/PG/calibration/slots. You can ship phase 4 with the penalty stubbed out — but
   implement it anyway (§3), because phase 5 (DPS/tank) needs it and it's 20 lines.
4. **No fitting attribute has a `maxAttributeID` / `minAttributeID`.** Attribute capping
   (§2.6) can be deferred entirely.
5. Skill-level scaling is **fully data-driven** — no special-casing needed (§4.1).

---

## 1. The fit tree / item model

### 1.1 Shape

EOS's model (`/tmp/everef/eos/eos/item/`) is the one to copy. Every item is a thin wrapper
over `(typeId, state)` plus a lazily-computed attribute map. The tree:

```
Fit
├── character                (Character)  ── skills[]      (Skill, has .level)
│                            └── implants[] / boosters[]
├── ship                     (Ship)
├── modules.high[] .med[] .low[]   (Module, each may hold one Charge)
├── rigs[]                   (Rig)
├── subsystems[]             (Subsystem)
├── drones[] / fighters[]
└── stance / mode            (T3 destroyer mode)
```

Pyfa's equivalent classes are one file each in `/tmp/everef/pyfa/eos/saveddata/`:
`fit.py`, `ship.py`, `module.py`, `character.py`, `implant.py`, `booster.py`, `drone.py`,
`fighter.py`, `mode.py`, `citadel.py`.

### 1.2 Which attributes live where — the two properties that drive everything

EOS gives each item class two class-level constants that entirely determine what a
`LocationModifier` / `OwnerRequiredSkillModifier` can reach. Reproduce this table exactly:

| Item class | `_modifier_domain` | `_owner_modifiable` | source |
|---|---|---|---|
| `Ship` | `None` | false | `eos/item/ship.py:41` |
| `Character` | `None` | false | `eos/item/character.py:42` |
| `Module` | `ship` | false | `eos/item/module.py:112` |
| `Rig` | `ship` | false | `eos/item/rig.py:40` |
| `Subsystem` | `ship` | false | `eos/item/subsystem.py:40` |
| `Stance` | `ship` | false | `eos/item/stance.py:42` |
| `Charge` | `ship` | **true** | `eos/item/charge.py:34` |
| `Implant` | `character` | false | `eos/item/implant.py:47` |
| `Booster` | `character` | false | `eos/item/booster.py:120` |
| `Skill` | `character` | false | `eos/item/skill.py:59` |
| `Drone` | `None` | **true** | `eos/item/drone.py:51` |
| `FighterSquad` | `None` | **true** | `eos/item/fighter_squad.py:116` |

Consequences worth internalising:

- **Ship and Character are in no domain bucket.** A `LocationModifier` with `domain: shipID`
  hits the *modules on* the ship, **not the ship itself**. To modify the ship you need
  `ItemModifier` + `domain: shipID` (which is exactly what CPU Management's effect 397 does).
- **Drones and fighters are reachable only via `OwnerRequiredSkillModifier`.** That is the
  classic "character skill boosts drones" path; a `LocationGroupModifier` on the ship can
  never see them.
- **Charges are `_owner_modifiable`**, which is how missile-damage skills reach missiles in
  launchers.

### 1.3 Module state

`/tmp/everef/pyfa/eos/const.py` (`FittingModuleState`) and `/tmp/everef/eos/eos/const/eos.py:32`:

| State | Pyfa value | EOS value |
|---|---|---|
| offline | −1 | 1 |
| online | 0 | 2 |
| active | 1 | 3 |
| overheated / overload | 2 | 4 |

EOS's values are **deliberately ascending so `>=` works**: an item in state *X* runs every
effect whose required state ≤ *X*. Use EOS's numbering, not Pyfa's.

A `Charge`'s state is not its own — `ContainerStateMixin.state` returns `self._container.state`
(`/tmp/everef/eos/eos/item/mixin/state.py`), i.e. a charge inherits the module's state.

### 1.4 The skill item — how level enters the calculation

This is the single most important modelling detail, and it is **pure data**, no special case:

```python
# /tmp/everef/eos/eos/item/skill.py:38-42
def __init__(self, type_id, level=0):
    super().__init__(type_id=type_id, state=State.offline)
    self.__level = level
    self.attrs._set_override_callback(
        AttrId.skill_level, (getattr, (self, 'level'), {}))
```

The skill's attribute **280 (`skillLevel`)** is overridden to return the character's trained
level. Everything else follows from the SDE (see §4.1). In TypeScript: when you build a
`Skill` item, seed its attribute map with `{280: trainedLevel}` and you are done.

> Pyfa does it differently and worse: `Skill.getModifiedItemAttr` returns the *raw* item
> attribute and never modifies it (`/tmp/everef/pyfa/eos/saveddata/character.py:405`), while
> the level multiply is done imperatively via a `skill='Skill Name'` kwarg threaded through
> `increase()` / `multiply()` / `boost()` into `__handleSkill`
> (`/tmp/everef/pyfa/eos/modifiedAttributeDict.py:455`). Do not copy this.

---

## 2. How effects apply

### 2.1 Raw SDE shape (this is what your TS parser consumes)

`dogmaeffects.0.json` — 3415 effects, 3198 of which have a `modifierInfo` array. Verified
field census across all modifiers (5147 total):

```
func:      ItemModifier 1792 | LocationRequiredSkillModifier 1609 | OwnerRequiredSkillModifier 909
           LocationGroupModifier 798 | LocationModifier 29 | EffectStopper 10
domain:    shipID 3587 | charID 1051 | itemID 220 | structureID 177 | otherID 55 | targetID 47 | target 10
operation: 6:3768 | 0:649 | 4:301 | 2:211 | 7:129 | 5:55 | -1:18 | 3:5 | 9:1 | (absent):10
fields:    domain, func, modifiedAttributeID, modifyingAttributeID, operation,
           skillTypeID (2518), groupID (798), effectID (10, EffectStopper only)
```

Per-`func` required fields:

| `func` | extra field | meaning |
|---|---|---|
| `ItemModifier` | — | affect the single item named by `domain` |
| `LocationModifier` | — | affect all items in `domain` (children only, **excluding** the domain item itself) |
| `LocationGroupModifier` | `groupID` | …filtered to that market/type group |
| `LocationRequiredSkillModifier` | `skillTypeID` | …filtered to items that *require* that skill |
| `OwnerRequiredSkillModifier` | `skillTypeID` | all items owned by the character requiring that skill, **domain-independent** |
| `EffectStopper` | `effectID` | suppress another effect (10 occurrences, all warp-scramble MWD blocking) |

**`modifyingAttributeID` is the magnitude source.** The modifier's value is the *fully
calculated* value of `modifyingAttributeID` **on the carrier item** — which recurses into the
same calculation machinery. That recursion is what makes skill-level chains work (§4.1).

### 2.2 `domain` → resolution

`/tmp/everef/eos/eos/eve_obj_builder/mod_builder/converter/mod_info.py:129`:

```python
conversion_map = {
    None:       ModDomain.self,
    'itemID':   ModDomain.self,
    'charID':   ModDomain.character,
    'shipID':   ModDomain.ship,
    'targetID': ModDomain.target,
    'otherID':  ModDomain.other}
```

- `self` / `itemID` → the carrier item itself.
- `charID` → `fit.character`.
- `shipID` → `fit.ship` for `ItemModifier`; the *ship domain bucket* (§1.2) for the en-masse filters.
- `otherID` → module↔charge sibling (`item._others`).
- `targetID` → **projected only**. Ignore for local fits; EOS splits `local_modifiers` vs
  `projected_modifiers` on `domain != target` (`eos/eve_obj/effect/effect.py:94`).
- **`structureID` (177 occurrences) has no EOS mapping at all** — EOS has 5 domains, not 6.
  Structure fitting is out of scope for phase 4; log-and-skip.

For the four en-masse filters, `self` is first resolved to an absolute domain: on a `Ship` it
becomes `ship`, on a `Character` it becomes `character`, anything else is an error
(`eos/calculator/affection.py:607`).

### 2.3 Operation codes — CCP → operator

**The brief's list is correct.** Verified against `mod_info.py:141`:

| SDE `operation` | operator | normalised form (`v` = raw source attr value) | applied as |
|---:|---|---|---|
| `-1` | preAssign | `v` | replace |
| `0` | preMul | `v - 1` | `acc *= 1 + n` |
| `1` | preDiv | `1/v - 1` | `acc *= 1 + n` |
| `2` | modAdd | `v` | `acc += n` |
| `3` | modSub | `-v` | `acc += n` |
| `4` | postMul | `v - 1` | `acc *= 1 + n` |
| `5` | postDiv | `1/v - 1` | `acc *= 1 + n` |
| `6` | postPercent | `v / 100` | `acc *= 1 + n` |
| `7` | postAssign | `v` | replace |

Notes from the SDE census:
- **`operation: 1` (preDiv) is never used** in the current SDE. `3` (modSub) is used 5 times.
- **`operation: 9` occurs exactly once**, on effect 132 `skillEffect`
  (`modifiedAttributeID: 280` from `modifyingAttributeID: 275 skillTimeConstant`). It is the
  skill-points→level computation. **Ignore it** — you set `skillLevel` directly from the
  character sheet, so effect 132 is a no-op for you.
- EOS renumbers these internally to a contiguous 1..10 enum so that *integer sort order equals
  operator precedence*, and inserts an EOS-only `post_mul_immune = 7` (used solely by the
  ancillary armour repairer) between `post_mul` and `post_div`. Copy that trick.

### 2.4 The calculation order

`/tmp/everef/eos/eos/calculator/map.py:207` `MutableAttrMap.__calculate`. Exact order:

1. **Seed the accumulator**: `typeAttrs[attrId]`, else `attribute.defaultValue`, else hard error.
2. **Gather** all modifiers affecting `(item, attrId)`; **normalise** each per the table above;
   multiply the normalised value by the effect's resistance factor (projected only, else 1).
3. **Decide penalisation** per modifier (§3) and bucket it into `stack[op]` or
   `stackPenalized[op]`.
4. **Collapse each penalised bucket** into a single reduced multiplier via the penalty chain,
   and push that back into `stack[op]`.
5. **Apply, in ascending operator order**:
   - `preAssign` → replace accumulator with `max()` (if `highIsGood`) or `min()` of candidates
   - `preMul`, `preDiv` → `acc *= 1 + n`
   - `modAdd`, `modSub` → `acc += n`
   - `postMul`, `postMulImmune`, `postDiv`, `postPercent` → `acc *= 1 + n`
   - `postAssign` → replace with `max()`/`min()`
6. **Cap** to `maxAttributeID`'s value, if defined (§2.6).
7. **Round to 2 dp** iff `attrId ∈ {cpu 50, power 30, cpuOutput 48, powerOutput 11}`.

Confirmed by EOS's own integration test `tests/integration/calculator/mod_operator/mixed/test_all_in.py`:

```python
expected_value = ((
    value_pre_ass * value_pre_mul / value_pre_div +
    value_mod_add - value_mod_sub) *
    value_post_mul / value_post_div * (1 + value_post_perc / 100))
```

Since all six multiplication-class operators reduce to the identical `acc *= 1 + n`, only the
**class boundaries** matter: `assign → multiply → add → multiply → assign`. Assignment
operators **overwrite**, so a `postAssign` discards everything computed before it.

Pyfa's order is the same modulo naming — `/tmp/everef/pyfa/eos/modifiedAttributeDict.py:407`:

```python
# We'll do stuff in the following order:
# preIncrease > multiplier > stacking penalized multipliers > postIncrease
```

### 2.5 Percent → multiplier

`postPercent` is `acc *= 1 + v/100`. Pyfa's `boost()` is the same thing spelled differently:

```python
# /tmp/everef/pyfa/eos/modifiedAttributeDict.py:575
def boost(self, attributeName, boostFactor, skill=None, **kwargs):
    if skill: boostFactor *= self.__handleSkill(skill)
    self.multiply(attributeName, 1 + boostFactor / 100.0, **kwargs)
```

So a source attribute of `-25` means `× 0.75`, and `+400` means `× 5.0`.

### 2.6 Capping — deferrable

EOS implements only an **upper** cap, from `dgmattribs.maxAttributeID`; the cap value is the
*fully modified* value of that attribute **on the same item**. Pyfa additionally implements
`minAttributeID`.

Verified in the shipped SDE: **only 29 attributes have `maxAttributeID` and only 8 have
`minAttributeID`.** None of them is fitting-related — they are resonances (capped by
`armorMaxDamageResonance` etc.), `maxVelocity` (by `speedLimit`), `maxTargetRange`
(by `maximumRangeCap`), `charge` (by `capacitorCapacity`), and a handful of AT-ship
constants. **Safe to skip entirely for phase 4**; needed for phase 5 tank (resonances).

### 2.7 Effect gating by state

Effect category (`dogmaeffects[].effectCategory`) maps to the minimum state at which the
effect runs — `/tmp/everef/eos/eos/eve_obj/effect/effect.py:111`:

| `effectCategory` | name | required state |
|---:|---|---|
| 0 | passive | offline |
| 1 | active | active |
| 2 | target | active |
| 3 | area | **unmapped** |
| 4 | online | online |
| 5 | overload | overload |
| 6 | dungeon | **unmapped** |
| 7 | system | offline |

Categories 3 and 6 have **no mapping and no guard** — EOS would raise `KeyError`. Filter them
out at build time. Census of the shipped SDE: category 0 → 2918 effects, 1 → 145, 2 → 120,
3 → 1, 4 → 98, 5 → 20, 6 → 4, 7 → 109.

On top of the state check, EOS's default `full_compliance` mode adds three rules
(`/tmp/everef/eos/eos/effect_status.py:106`) — **all three matter**:

1. An **offline-state** (passive/system) effect is suppressed if it declares a
   `fittingUsageChanceAttributeID`. (This is how booster side-effects are off by default.)
2. An **online-category** effect requires the item's own `online` effect (**ID 16**) to be
   running — not merely `state >= online`.
3. An **active/target-category** effect runs only if it is the type's `defaultEffect`
   (`typedogma[].dogmaEffects[].isDefault == 1`). So a module with several active effects
   fires exactly one.

---

## 3. Stacking penalties

### 3.1 The formula

Three independent implementations agree exactly.

**EOS** — `/tmp/everef/eos/eos/calculator/map.py:45` and `:349`:

```python
PENALTY_BASE = 1 / math.exp((1 / 2.67) ** 2)      # 0.8691199808003974

def __penalize_values(self, mod_values):
    chain_positive = []
    chain_negative = []
    for mod_value in mod_values:
        if mod_value >= 0:  chain_positive.append(mod_value)
        else:               chain_negative.append(mod_value)
    chain_positive.sort(reverse=True)   # strongest first
    chain_negative.sort()               # most negative first
    value = 1
    for penalization_chain in (chain_positive, chain_negative):
        chain_value = 1
        for pos, mod_value in enumerate(penalization_chain):
            if pos > 10:                # 12th modification and beyond ignored
                break
            chain_value *= 1 + mod_value * PENALTY_BASE ** (pos ** 2)
        value *= chain_value
    return value - 1
```

**Pyfa** — `/tmp/everef/pyfa/eos/modifiedAttributeDict.py:426-441` (and duplicated in `eos/calc.py:28`):

```python
l1 = [_val for _val in penalizedMultipliers if _val > 1]
l2 = [_val for _val in penalizedMultipliers if _val < 1]
abssort = lambda _val: -abs(_val - 1)
l1.sort(key=abssort)
l2.sort(key=abssort)
for l in (l1, l2):
    for i in range(len(l)):
        bonus = l[i]
        val *= 1 + (bonus - 1) * exp(- i ** 2 / 7.1289)
```

`7.1289 == 2.67²`, so `exp(-i²/7.1289) == exp(-(i/2.67)²) == PENALTY_BASE**(i²)`. Verified identical to 15 decimal places.

**EVE University wiki** states `S(u) = e^(-(u/2.67)²)`, *"the n-th modifier is multiplied by S(n-1)"* — i.e. index from 0, first modifier unpenalised. Its published table matches my computation exactly:

| position `i` | `exp(-(i/2.67)²)` | wiki |
|---:|---|---|
| 0 | 1.0000000000 | 100.0% |
| 1 | 0.8691199808 | 86.9% |
| 2 | 0.5705831435 | 57.1% |
| 3 | 0.2829551540 | 28.3% |
| 4 | 0.1059926497 | 10.6% |
| 5 | 0.0299911665 | 3.0% |
| 6 | 0.0064101831 | 0.6% |
| 7 | 0.0010349205 | 0.1% |

### 3.2 Reference TypeScript

```ts
const PENALTY_BASE = 1 / Math.exp((1 / 2.67) ** 2);   // 0.8691199808003974

/** Input & output are *reduced* multipliers: real multiplier = 1 + n. */
function penalizeValues(modValues: number[]): number {
  const pos: number[] = [], neg: number[] = [];
  for (const v of modValues) (v >= 0 ? pos : neg).push(v);
  pos.sort((a, b) => b - a);   // descending: strongest bonus first
  neg.sort((a, b) => a - b);   // ascending:  strongest penalty first
  let value = 1;
  for (const chain of [pos, neg]) {
    let chainValue = 1;
    for (let i = 0; i < chain.length; i++) {
      if (i > 10) break;                        // 12th and beyond dropped
      chainValue *= 1 + chain[i] * PENALTY_BASE ** (i * i);
    }
    value *= chainValue;
  }
  return value - 1;
}
```

Details that are easy to get wrong:

- **Positive and negative are two independent chains**, each with its own index starting at 0.
  A fit with three +10% and three −10% modules gets *two* full-strength first modifiers.
- **Zero goes in the positive chain** (`>= 0`).
- **Strongest first**, by magnitude of the *reduced* multiplier.
- **Hard truncation at index 10** (11 modifiers per chain); the 12th is dropped, not merely negligible.
- The penalty collapses a bucket into **one** reduced multiplier, which is then applied alongside
  the unpenalised ones.

### 3.3 Which operations are penalised

`/tmp/everef/eos/eos/calculator/map.py:56` — identical in EVEShipFit
(`/tmp/everef/dogma-engine/src/calculate/pass_3.rs:10`):

```
PENALIZABLE_OPERATORS = (preMul, postMul, postPercent, preDiv, postDiv)
```

`preAssign`, `modAdd`, `modSub`, `postAssign` are **never** penalised — which is the mechanical
basis for the wiki's rule that *"+1 warp core strength, +1000 structure HP"* don't penalise:
those are `modAdd`, and only percentage-style operators are in the penalisable set.

### 3.4 The exemption rule — exact

EOS (`map.py:277`) and EVEShipFit (`pass_2.rs:117`) implement **the same two/three-part
conjunction**. EOS's version:

```python
penalize = (
    not attr.stackable and
    affector_item._type.category_id not in PENALTY_IMMUNE_CATEGORY_IDS and
    mod_operator in PENALIZABLE_OPERATORS)
```

1. **The affectee attribute's `stackable` flag is 0.** From `dogmaattributes[].stackable`.
   `stackable: 1` (the default; 2616 of 2860 attributes) ⇒ **never penalised**.
2. **The affector (carrier) item's `categoryID` is not exempt.**
   `PENALTY_IMMUNE_CATEGORY_IDS = {ship 6, charge 8, skill 16, implant 20, subsystem 32}`
   (`/tmp/everef/eos/eos/calculator/map.py:48`; EVEShipFit `EXEMPT_PENALTY_CATEGORY_IDS = [6, 8, 16, 20, 32]`).
3. **The operator is penalisable** (§3.3).

This is exactly the wiki's *"skills, ship bonuses from ship skills, implants, hardwirings,
boosters … are not stacking penalized"* — **boosters are EVE category 20 (Implant)**, so they
fall out of the same constant. Note this is decided by the **source's** category, not the
target's, and it is **not** an effect-name or attribute-name test.

**Modules (category 7), drones (18), fighters (87) and rigs ARE penalised.** Rigs are category 7
modules, consistent with the wiki listing rigs as penalised.

> **Pyfa does it completely differently** and you should not copy it. Pyfa ignores the
> `stackable` flag entirely and instead hardcodes `stackingPenalties=True` at 408 call sites
> across its 2401 hand-written effect classes, with a free-text `penaltyGroup` string so that
> different groups penalise independently. EOS/EVEShipFit penalise **per operator bucket**
> instead — simpler, and derived from data.

### 3.5 `highIsGood`

`highIsGood` has **exactly one job** in EOS (verified by grep — one non-serialisation hit,
`map.py:321`): when several `preAssign` (or several `postAssign`) modifiers compete, pick
`max()` if `highIsGood` else `min()`.

It does **not** affect penalty chain membership — that is decided purely by the sign of the
normalised value. A −25% on a low-is-good attribute (a resonance) still lands in the *negative*
chain.

> **Divergence to decide:** EVEShipFit picks the assign winner by **absolute value**
> (`max_by(|x, y| x.abs().cmp(y.abs()))`, `pass_3.rs:130`), EOS by **plain** `max`/`min`.
> These differ for mixed-sign assigns. EOS's reading is the more conventional one.
> **UNVERIFIED** which matches the game client.

### 3.6 Test fixtures (real numbers)

From EOS's own `tests/integration/calculator/mod_operator/test_post_percent.py` —
base **100**, five `postPercent` modifiers `+20, +50, −90, −25, +400`:

- `stackable = true` → **67.5** exactly (`100 × 1.2 × 1.5 × 0.1 × 0.75 × 5.0`)
- `stackable = false` → **62.549783181488586**

Additional values computed from the verified implementation (base 100, penalised `postPercent`):

| Case | Result |
|---|---|
| one +10% | 110.0 |
| two +10% | **119.56031978880436** |
| three +10% | 126.38223009922673 |
| four +10% | 129.95828043757973 |
| five +10% | 131.3357426875382 |
| one −10% | 90.0 |
| two −10% | 82.17792017279642 |
| three −10% | 77.48898657086102 |
| +20% and +10% | 130.42943976960476 |

Note "two 10% modules" gives **119.56…**, not 121.

Penalty-immunity is covered by
`/tmp/everef/eos/tests/integration/calculator/mod_operator/penalty_immune/test_category.py`,
which applies +50% and +100% from each exempt category to a base of 100 and asserts **300**.

---

## 4. Skill-based ship bonuses & fitting skills

### 4.1 The two-effect pattern — how skill level multiplies a bonus

This is the crux, and it is **100% data-driven**. A skill-scaled bonus is *always two separate
effects on two different items*:

**(A) The scaling effect, carried by the SKILL.** `preMul` the bonus attribute by `skillLevel` (280):

```json
{"domain": "itemID", "func": "ItemModifier",
 "modifiedAttributeID": <bonusAttr>, "modifyingAttributeID": 280, "operation": 0}
```

**(B) The application effect, carried by the SHIP (or the skill itself).** `postPercent` the now
level-scaled bonus attribute onto the real target:

```json
{"domain": "shipID", "func": "ItemModifier"|"LocationGroupModifier"|"LocationRequiredSkillModifier",
 "modifiedAttributeID": <targetAttr>, "modifyingAttributeID": <bonusAttr>, "operation": 6}
```

Worked example — **CPU Management (typeID 3426)**, verified verbatim from the SDE:

```
typedogma[3426]: attr 280 skillLevel = 0.0 ; attr 424 cpuOutputBonus2 = 5.0
effect  368 gallenteFrigateSkillBoostCpuOutputBonus   (misnamed; it is the level scaler)
  {domain: itemID, ItemModifier, modified: 424, modifying: 280, operation: 0}   # preMul
effect  397 electronicsCpuOutputBonusPostPercentCpuOutputLocationShipGroupComputer
  {domain: shipID, ItemModifier, modified: 48,  modifying: 424, operation: 6}   # postPercent
```

At skill level 5: `cpuOutputBonus2 = 5.0 × 5 = 25.0`, then `ship.cpuOutput ×= (1 + 25/100) = ×1.25`.

**Nothing special is required in the engine.** Seed the `Skill` item's attribute 280 with the
trained level and the generic calculator produces the right answer — provided your
`modifyingAttributeID` lookup resolves the *fully calculated* value on the carrier, not the base
value. That recursion is the whole mechanism.

For a **hull** bonus, effect (A) lives on the *ship-class skill* (e.g. Caldari Cruiser 3334,
effect 520 `caldariCruiserSkillLevelPreMulShipBonusCCShip`, `domain: shipID`, preMul of attr 487
`shipBonusCC` by 280) and the bonus magnitude (`shipBonusCC = -5.0`) lives on the **hull**. Effect
(B) lives on the hull (e.g. Caracal 621 effect 5131 `shipMissileRofCC`, `LocationGroupModifier`
groupID 771/510/511, postPercent of attr 51 by 487).

> **Correction to the brief.** `skillTypeID` on a modifier does **not** tie the bonus to the pilot's
> ship-class skill. It is a *filter selecting which modules are affected*
> (`LocationRequiredSkillModifier` / `OwnerRequiredSkillModifier`). The level scaling is the
> separate `operation: 0` effect described above. Also, ship bonuses use `preMul(0)` + `postPercent(6)`
> — not `modAdd(2)`.

`/tmp/everef/pyfa/staticdata/phobos/traits.0.json` is **display text only** — 650 entries of
localised "5% bonus to …" strings, flattened to HTML by `db_update.py:342` and consumed only by
GUI code. Zero calculation role. Useful for a UI, useless for the engine.

### 4.2 Fitting skills — verified table

| Skill | typeID | bonus attr | value | scaler effect | application effect | target | scope |
|---|---:|---|---:|---:|---|---|---|
| CPU Management | **3426** | 424 `cpuOutputBonus2` | +5.0 | 368 | **397** | `cpuOutput` 48 | `ItemModifier` / shipID |
| Power Grid Management | **3413** | 313 `powerEngineeringOutputBonus` | +5.0 | 218 | **490** | `powerOutput` 11 | `ItemModifier` / shipID |
| Weapon Upgrades | **3318** | 310 `cpuNeedBonus` | −5.0 | 211 | **581** | `cpu` 50 | `LocationRequiredSkillModifier` skillTypeID **3300** Gunnery, **55033** Vorton Projector Operation |
| " | | | | | **677** | `cpu` 50 | skillTypeID **3319** Missile Launcher Operation |
| " | | | | | **675** | `cpu` 50 | skillTypeID **3421** Energy Pulse Weapons |
| " | | | | | **3519** | `cpu` 50 | `LocationGroupModifier` groupID **862** (bomb launchers) |
| Advanced Weapon Upgrades | **11207** | 323 `powerNeedBonus` | −2.0 | 246 | **1638** | `power` 30 | skillTypeIDs **3300**, **3319**, **55033** |
| " | | | | | **3520** | `power` 30 | skillTypeID **28073** Bomb Deployment |
| Electronics Upgrades | **3432** | 310 `cpuNeedBonus` | −5.0 | 211 | **212** | `cpu` 50 | skillTypeID **3432** (self-referential) |
| Energy Grid Upgrades | **3424** | 310 `cpuNeedBonus` | −5.0 | 211 | **396** | `cpu` 50 | skillTypeID **3424** (self-referential) |

So at all-5: CPU Management **+25% cpuOutput**, Power Grid Management **+25% powerOutput**,
Weapon Upgrades **−25% CPU** on gunnery/missile modules, Advanced Weapon Upgrades **−10% PG**
on gunnery/missile modules.

**Exhaustive check:** scanning all 3415 effects for `modifiedAttributeID ∈ {48, 11}` with
`domain: shipID` carried by a category-16 (skill) type yields **exactly two skills in the entire
SDE** — 3413 and 3426. A ship's CPU/PG *output* is fully determined by those two.

### 4.3 Rig / calibration skills — **REFUTED**

- **No effect anywhere in the SDE modifies `upgradeCapacity` (1132), `upgradeCost` (1153),
  `upgradeSlotsLeft` (1154) or `rigSize` (1547).** Calibration is not skill-modifiable at all.
- **Jury Rigging (26252) grants no bonus whatsoever.** Its typedogma has only `skillLevel` and
  prerequisites; its only effect is 132 `skillEffect`. It is a pure prerequisite gate.
- The specialised rigging skills (Armor Rigging 26253, Astronautics 26254, Drones 26255,
  Projectile 26257, Energy Weapon 26258, Hybrid 26259, Launcher 26260, Shield 26261) reduce the
  rig's **`drawback` (1138, default 10.0)** attribute — each carries `rigDrawbackBonus` (1139) = −10.0,
  scaler effect 2725, application effects 6697-6705 (`LocationGroupModifier`, postPercent onto 1138).
- `drawback` then feeds the rig's *own* penalty effects. Two of those are CPU-related:
  **2713 `drawbackCPUOutput`** (shipID/ItemModifier, attr 48 ← 1138, op 6) and
  **2714 `drawbackCPUNeedLaunchers`** (shipID/LocationRequiredSkillModifier, attr 50 ← 1138,
  op 6, skillTypeID 3319). So Drones Rigging / Launcher Rigging *indirectly* soften a CPU
  drawback — **via `drawback`, never via calibration.**

### 4.4 requiredSkill attributes — the ID trap

| n | skill attr | ID | level attr | ID |
|---|---|---:|---|---:|
| 1 | `requiredSkill1` | 182 | `requiredSkill1Level` | 277 |
| 2 | `requiredSkill2` | 183 | `requiredSkill2Level` | 278 |
| 3 | `requiredSkill3` | 184 | `requiredSkill3Level` | 279 |
| 4 | `requiredSkill4` | 1285 | `requiredSkill4Level` | 1286 |
| 5 | `requiredSkill5` | **1289** | `requiredSkill5Level` | **1287** |
| 6 | `requiredSkill6` | **1290** | `requiredSkill6Level` | **1288** |

**There are exactly 6, the IDs are non-contiguous, and for n=5/6 the level IDs are numerically
*below* the skill IDs.** Never derive `levelId = skillId + 1`. Confirmed independently in
`/tmp/everef/eos/eos/const/eve.py:100-111`.

**Use `requiredskillsfortypes.0.json` instead.** It is CCP's precomputed denormalisation,
`{typeID: {skillTypeID: level}}`, 9523 entries, carrying identical information:

```json
"621":  {"3334": 1}     // Caracal          → Caldari Cruiser I
"3318": {"3300": 2}     // Weapon Upgrades  → Gunnery II
"2048": {"3394": 4}     // Damage Control I → Hull Upgrades IV
```

**Both Pyfa and EOS use this file, not the attributes** (`/tmp/everef/pyfa/db_update.py:387`,
`/tmp/everef/eos/eos/data_handler/json_data_handler.py:83`). It also backs
`LocationRequiredSkillModifier` / `OwnerRequiredSkillModifier` resolution — i.e. Weapon Upgrades'
CPU reduction finds its targets through this table.

### 4.5 The SDE data-layer traps

1. **`mass`, `capacity`, `volume`, `radius` are top-level `types` columns, not dogma attributes.**
   You must inject them as attributes `4`, `38`, `161`, `162`. Both engines do this — EOS at
   `/tmp/everef/eos/eos/eve_obj_builder/normalizer.py:59`, Pyfa at `/tmp/everef/pyfa/db_update.py:232`:
   ```python
   for attrId, attrName in {4: 'mass', 38: 'capacity', 161: 'volume', 162: 'radius'}.items():
   ```
   **Values already present in `dogmaAttributes` take priority** over the column.
2. **`rigSlots` (1137) and `upgradeSlotsLeft` (1154) are duplicates** — both display as "Rig Slots"
   and hulls carry both. EOS uses **1137** as the capacity. Don't double-count.
3. `types.*.json` is 6 files and `typedogma.*.json` is 3; you must merge them all.

---

## 5. Phase-4 fitting validation

### 5.1 Verified attribute IDs

Every ID in the brief was checked against `dogmaattributes.0.json`. **All correct except
`canFitShipGroup1`, whose real name is `canFitShipGroup01`.**

| Name | ID | default | stackable | highIsGood | note |
|---|---:|---:|---:|---:|---|
| `cpu` | **50** | 0.0 | 1 | **0** | module CPU use |
| `power` | **30** | 0.0 | 1 | **0** | module PG use |
| `cpuOutput` | **48** | 0.0 | 1 | 1 | ship CPU output |
| `powerOutput` | **11** | 0.0 | 1 | 1 | ship PG output |
| `upgradeCapacity` | **1132** | 0.0 | 1 | 1 | ship calibration |
| `upgradeCost` | **1153** | 0.0 | 1 | 1 | rig calibration cost |
| `hiSlots` | **14** | 0.0 | 1 | 1 | |
| `medSlots` | **13** | 0.0 | 1 | 1 | |
| `lowSlots` | **12** | 0.0 | 1 | 1 | |
| `rigSlots` | **1137** | 0.0 | 1 | 1 | published 0 |
| `upgradeSlotsLeft` | **1154** | 0.0 | 1 | 1 | duplicate of 1137 — ignore |
| `maxSubSystems` | **1367** | 0.0 | 1 | 1 | |
| `serviceSlots` | **2056** | — | — | — | structures |
| `turretSlotsLeft` | **102** | 0.0 | 1 | 1 | holds the *total*, despite the name |
| `launcherSlotsLeft` | **101** | 0.0 | 1 | 1 | idem |
| `hiSlotModifier` | **1374** | 0.0 | 1 | 1 | subsystem |
| `medSlotModifier` | **1375** | 0.0 | 1 | 1 | subsystem |
| `lowSlotModifier` | **1376** | 0.0 | 1 | 1 | subsystem |
| `turretHardPointModifier` | **1368** | 0.0 | 1 | 1 | subsystem |
| `launcherHardPointModifier` | **1369** | 0.0 | 1 | 1 | subsystem |
| `rigSize` | **1547** | 0.0 | 1 | 1 | 1=small 2=med 3=large 4=XL (**UNVERIFIED** — neither repo hardcodes the mapping) |
| `drawback` | **1138** | **10.0** | 1 | 1 | |
| `maxGroupFitted` | **1544** | 0.0 | 1 | 1 | |
| `maxGroupOnline` | **978** | 0.0 | 1 | 1 | |
| `maxGroupActive` | **763** | 0.0 | 1 | 1 | |
| `subSystemSlot` | **1366** | 0.0 | 1 | 1 | |
| `isCapitalSize` | **1785** | — | — | — | |
| `skillLevel` | **280** | 0.0 | 1 | 1 | |
| `fitsToShipType` | **1380** | 0.0 | 1 | 1 | folds into the type set |

`canFitShipType1..12` = 1302, 1303, 1304, 1305, 1944, 2103, 2463, 2486, 2487, 2488, 2758, 5948
(1-digit, unpadded).
`canFitShipGroup01..20` = 1298-1301, 1872, 1879-1881, 2065, 2396, 2476-2485 (**2-digit, zero-padded**).

> EOS hardcodes only types 1-10 and predates 11/12. **Prefer Pyfa's prefix-match approach**
> (`attr.startswith("canFitShipType")`) — it is future-proof.

**Every attribute in this table is `stackable: 1`, so the stacking penalty never applies to any
of them.** And none has a `maxAttributeID` / `minAttributeID`.

### 5.2 Marker effect IDs

Slot and hardpoint membership is decided by the **presence of a marker effect**, all of which
have **no `modifierInfo`** — they are pure tags:

| Effect | ID | category | meaning |
|---|---:|---:|---|
| `loPower` | **11** | 0 | low slot |
| `hiPower` | **12** | 0 | high slot |
| `medPower` | **13** | 0 | mid slot |
| `online` | **16** | **1 (active)** | consumes CPU/PG — see §7 |
| `launcherFitted` | **40** | 0 | uses a launcher hardpoint |
| `turretFitted` | **42** | 0 | uses a turret hardpoint |
| `rigSlot` | **2663** | 0 | rig slot; consumes calibration |
| `subSystem` | **3772** | 0 | subsystem slot |
| `hardPointModifierEffect` | **3773** | 0 | subsystem hardpoint bonus (**no modifierInfo — hand-code**) |
| `slotModifier` | **3774** | 0 | subsystem slot bonus (**no modifierInfo — hand-code**) |
| `serviceSlot` | **6306** | 0 | structure service slot |

Pyfa's derivation, `/tmp/everef/pyfa/eos/saveddata/module.py:863` — **iteration order matters**
(rig wins if an item carries two markers):

```python
effectSlotMap = {"rigSlot": RIG, "loPower": LOW, "medPower": MED,
                 "hiPower": HIGH, "subSystem": SUBSYSTEM, "serviceSlot": SERVICE}
```

and hardpoints, `module.py:847`:

```python
effectHardpointMap = {"turretFitted": TURRET, "launcherFitted": MISSILE}
```

### 5.3 Resource summation

**Pyfa** — `/tmp/everef/pyfa/eos/saveddata/fit.py:1291`:

```python
@property
def calibrationUsed(self): return self.getItemAttrOnlineSum(self.modules, 'upgradeCost')
@property
def pgUsed(self):          return round(self.getItemAttrOnlineSum(self.modules, "power"), 2)
@property
def cpuUsed(self):         return round(self.getItemAttrOnlineSum(self.modules, "cpu"), 2)
```

where `getItemAttrOnlineSum` (`fit.py:1225`) gates on `mod.state >= FittingModuleState.ONLINE`.
Only `self.modules` is summed — drones, fighters and implants never consume CPU/PG.

**EOS** — `/tmp/everef/eos/eos/stats/register/resource/ship_regular.py:95`, keyed on the **effect**
that makes an item a consumer:

```python
class CalibrationRegister(ShipRegularResourceRegister):
    _output_attr_id = AttrId.upgrade_capacity   # 1132
    _use_effect_id  = EffectId.rig_slot         # 2663
    _use_attr_id    = AttrId.upgrade_cost       # 1153
class CpuRegister(RoundedShipRegularResourceRegister):
    _output_attr_id = AttrId.cpu_output; _use_effect_id = EffectId.online; _use_attr_id = AttrId.cpu
class PowergridRegister(RoundedShipRegularResourceRegister):
    _output_attr_id = AttrId.power_output; _use_effect_id = EffectId.online; _use_attr_id = AttrId.power
```

### 5.4 Slots & hardpoints — and the one thing you must hand-code

**Zero effects in the SDE modify any slot or hardpoint attribute** (verified by scanning all
3415 effects). They are static hull attributes — **except T3 subsystems**, whose effects 3773
and 3774 carry `modifierInfo: None`. Both engines hand-code them. EOS's version
(`/tmp/everef/eos/eos/eve_obj/custom/subsystem_slot_bonus/modifier.py`) — reproduce exactly:

| effect | operator | source attr (on subsystem) | target attr (on ship) |
|---|---|---|---|
| 3774 `slotModifier` | `modAdd` | `hiSlotModifier` 1374 | `hiSlots` 14 |
| 3774 | `modAdd` | `medSlotModifier` 1375 | `medSlots` 13 |
| 3774 | `modAdd` | `lowSlotModifier` 1376 | `lowSlots` 12 |
| 3773 `hardPointModifierEffect` | `modAdd` | `turretHardPointModifier` 1368 | `turretSlotsLeft` 102 |
| 3773 | `modAdd` | `launcherHardPointModifier` 1369 | `launcherSlotsLeft` 101 |

(all `ItemModifier`, `domain: shipID`, `aggregate: stack`)

Ship slot attribute map, `/tmp/everef/pyfa/eos/saveddata/fit.py:1254`:
LOW→`lowSlots`, MED→`medSlots`, HIGH→`hiSlots`, RIG→`rigSlots`, SUBSYSTEM→`maxSubSystems`,
SERVICE→`serviceSlots`, plus the six fighter-slot attributes.

Counting: `getSlotsUsed` counts non-dummy modules whose `slot` matches; `getSlotsFree` is
`int(shipTotal) - used` (`fit.py:1242`). Hardpoints: `getHardpointsUsed` counts modules whose
`hardpoint` matches, **regardless of state** — an offline turret still occupies a hardpoint
(`fit.py:1234`). EOS reaches the same result differently: `turretFitted`/`launcherFitted` are
category 0 (passive → offline state), so they run even offline.

EVEShipFit's TS layer carries a hard-coded fudge worth knowing about
(`/tmp/everef/esf-react/src/providers/StatisticsProvider/StatisticsProvider.tsx`):
`/* EVE Online changed from 5 subsystems to 4, but the attributes aren't changed to match this. */
if (statistics.slots.SubSystem === 5) statistics.slots.SubSystem = 4;`

### 5.5 Rig size & calibration

```python
# /tmp/everef/pyfa/eos/saveddata/module.py:703
if self.slot == FittingSlot.RIG:
    if self.getModifiedItemAttr("rigSize") != fit.ship.getModifiedItemAttr("rigSize"):
        return False
```

Exact equality. EOS uses **unmodified type attributes** and skips the check if either side lacks
`rigSize` (`/tmp/everef/eos/eos/restriction/restriction/rig_size.py:36`). EOS's reading is more
correct; Pyfa's `0 == 0` default is an accident that happens to be harmless.

### 5.6 canFitShipType / canFitShipGroup

`/tmp/everef/pyfa/eos/saveddata/fit.py:490`:

```python
fitsOnType.update([item.attributes[attr].value for attr in item.attributes if attr.startswith("canFitShipType")])
fitsOnGroup.update([item.attributes[attr].value for attr in item.attributes if attr.startswith("canFitShipGroup")])
if (len(fitsOnGroup) > 0 or len(fitsOnType) > 0) \
        and self.ship.item.group.ID not in fitsOnGroup \
        and self.ship.item.ID not in fitsOnType:
    return False
```

Semantics: union of all type-allowances and all group-allowances; **if the union is non-empty,
the ship must match at least one (type OR group)**. Uses raw/unmodified values.
`fitsToShipType` (1380) folds into the *type* set. EOS restricts this check to
`(ModuleHigh, ModuleMid, ModuleLow)` — rigs and subsystems exempt.

### 5.7 maxGroupFitted / Online / Active

- **`maxGroupFitted` (1544)** — Pyfa uses the **raw** attribute value, deliberately
  (`module.py:707`): *"use raw value, since it seems what EVE uses. Example is FAXes with their
  capacitor boosters, which have unmodified value of 10, and modified of 1, and you can actually
  fit multiples"*. It counts same-`groupID` modules at a different position and rejects if
  `current >= max`. State is irrelevant.
- **`maxGroupOnline` (978) / `maxGroupActive` (763)** — Pyfa's `canHaveState`
  (`module.py:755`) returns either `True` or a **demoted state**. Violations do not error;
  `/tmp/everef/pyfa/service/fit.py:468` silently demotes the module on fit load, which in turn
  *reduces CPU/PG usage*. Note Pyfa groups by group **name** here but by `groupID` for
  maxGroupFitted.
- EOS uses `groupID` and **modified** values throughout, with `quantity > max` (self included)
  (`/tmp/everef/eos/eos/restriction/restriction/max_group.py:108`). **This contradicts Pyfa on
  maxGroupFitted**; Pyfa's comment argues Pyfa matches the game. **UNVERIFIED** which is right.
- `moduleLimit` **does not exist** in the current SDE — historical, superseded by `maxGroupFitted`.

### 5.8 Missing skills

Neither engine reads `requiredSkillN` at runtime — both use `requiredskillsfortypes.0.json` (§4.4).

**Pyfa** — `/tmp/everef/pyfa/service/character.py:456` `checkRequirements(fit)`:
iterates `modules, drones, fighters, (ship,), appliedImplants, boosters`, checking both `.item`
and `.charge`. Two important behaviours:
- **Rigs are skipped entirely** (`if isinstance(thing, es_Module) and thing.slot == es_Slot.RIG: continue`).
- It **recurses into the missing skill's own prerequisites**, producing a nested tree suitable
  for a "you need X, which needs Y" UI.

**EOS** — `/tmp/everef/eos/eos/restriction/restriction/skill_requirement.py:31`, flat
(non-recursive), `EXCEPTIONS = (Rig,)`, emitting
`SkillRequirementErrorData(skill_type_id, level, required_level)` per unmet requirement.
An untrained skill yields `level = None`.

Neither blocks the fit — Pyfa shows a red icon with a tooltip (`gui/characterSelection.py:234`).

### 5.9 How validity is surfaced

**Pyfa never raises.** Over-CPU is *advisory only*:
- The resource gauge changes colour (`gui/pyfa_gauge.py:54`): ≤100% green, 100-101% yellow,
  101-103% orange, 103-105% red, >105% flat dark red. Bar width clamps at 100%.
- **CPU and PG never turn the label text red** — only hardpoints, active drones, fighter tubes
  and calibration do (`gui/builtinStatsViews/resourcesViewFull.py:303`).
- Module rows go red only when a *slot* is oversubscribed or a restriction was overridden
  (`gui/builtinViews/fittingView.py:768`).
- `Module.fits()` hard-rejects on add/replace, and is bypassable via `fit.ignoreRestrictions`.

**EOS aggregates properly, and this is the API shape to copy**
(`/tmp/everef/eos/eos/restriction/service.py:108`): each restriction raises
`RestrictionValidationError({item: ErrorData})`; the service pivots into
`{item: {Restriction: ErrorData}}` and raises one `ValidationError`. Entry point
`Fit.validate(skip_checks=())`. Comparison is `used <= output` — **no epsilon anywhere**
(grepped; the only `1e-06` in Pyfa is the Reactive Armor Hardener convergence loop).
The 2-dp rounding *is* the tolerance mechanism: it stops `250.00000000000003 > 250.0`.

EOS's 35 restrictions (`/tmp/everef/eos/eos/const/eos.py:142`) — for phase 4 you need:
`cpu=1, powergrid=2, calibration=3, high_slot=8, mid_slot=9, low_slot=10, rig_slot=11,
rig_size=12, subsystem_slot=13, subsystem_index=14, turret_slot=15, launcher_slot=16,
ship_type_group=19, max_group_fitted=21, max_group_online=22, max_group_active=23,
skill_requirement=24, state=27`.

Error payload shapes worth mirroring:
`ResourceErrorData(total_use, output, item_use)`, `SlotQuantityErrorData(used, total)`,
`MaxGroupErrorData(group_id, quantity, max_allowed_quantity)`, `RigSizeErrorData(size, allowed_size)`,
`ShipTypeGroupErrorData(ship_type_id, ship_group_id, allowed_type_ids, allowed_group_ids)`,
`SkillRequirementErrorData(skill_type_id, level, required_level)`.

---

## 6. Recommended TypeScript architecture

### 6.1 Prior art: EVEShipFit's `dogma-engine`

<https://github.com/EVEShipFit/dogma-engine> is the engine behind eveship.fit and is the
closest existing model. Findings:

- **Rust → WASM; there is no pure-TS dogma engine in the wild.** The whole crate is 2414 lines
  including CLI/EFT/WASM glue; the **calculation core is ~980 lines** and the operator+penalty
  kernel is ~120. It transliterates to TS almost mechanically — plain `f64` math,
  `BTreeMap<i32,_>` → `Map<number,_>`, one tagged union, one enum array.
- It already assumes **JS owns the data** — the WASM build calls back into `window` for every
  lookup. A TS port *removes* an FFI boundary.
- **It performs no validation at all.** No "not enough CPU", no slot check. CPU/PG are computed
  as ordinary dogma attributes via *synthetic patched effects*; calibration and slots are counted
  in the React app; the gauge silently clamps at 100%. This is the biggest functional gap vs Pyfa
  and precisely the part you have to build.
- Its CPU/PG trick is elegant and worth stealing: a patched `cpuPowerLoad` effect of category
  **online** does `modAdd` of `cpu`→`cpuLoad` on `shipID` for every module, so **offlining a module
  stops charging CPU for free** — the state gate does the work. A patched `cpuPowerFree` effect
  on the ship does `preAssign cpuOutput → cpuFree` then `modSub cpuLoad → cpuFree`.
- It handles **`modifierInfo` only** and never parses `dgmExpressions`; anything CCP hasn't
  migrated silently does nothing unless patched. It supports a **`skillTypeID: -1` wildcard** that
  does not exist in the SDE.
- It returns **full effect provenance** with every calculated attribute (operator, penalty flag,
  source object, source attribute) — which is what powers eveship.fit's "why is this number this
  number" panel. Strongly recommended; Pyfa has the same idea as `__affectedBy`.

### 6.2 What CCP actually documents — almost nothing

<https://docs.esi.evetech.net/docs/dogma.html> (now carrying a deprecation banner) explicitly
delegates to EOS:

> *"I will be using fitting calculation engine EOS to reference things that are not published by
> CCP, namely `operandID`s and their meaning, as well as the operators."*

and

> *"**Note:** more documentation on the various operators and functions need to be written."*

The **only** integer code stated on the page is `operator: 5 … defined as PostDiv`, and the only
arithmetic given is `PostPercent = val / 100 + 1`. **The pass order is not documented. The word
"stacking" does not appear on the page at all. Effect categories are not enumerated.**

So: the operator codes, calculation order and penalty math are **empirical**, derived from
EOS/Pyfa/EVEShipFit agreeing with each other and with observed in-game numbers. Treat the three
implementations as the spec. (**UNVERIFIED:** whether CCP's replacement site at
developers.eveonline.com adds an operator table — not fetched.)

### 6.3 Data structures

```ts
type AttrId = number; type TypeId = number; type EffectId = number; type GroupId = number;

interface AttributeMeta {            // from dogmaattributes.0.json
  id: AttrId; name: string; defaultValue: number;
  stackable: boolean;                // NB: bool(None) === false — mirror row.get() semantics
  highIsGood: boolean;
  maxAttributeId?: AttrId; minAttributeId?: AttrId;   // only 29 / 8 attrs; deferrable
}

const enum Domain { Self = 1, Character, Ship, Target, Other }
const enum AffecteeFilter { Item = 1, Domain, DomainGroup, DomainSkillRq, OwnerSkillRq }
// Ordered so that ascending numeric order === operator precedence.
const enum Operator {
  PreAssign = 1, PreMul, PreDiv, ModAdd, ModSub,
  PostMul, PostMulImmune, PostDiv, PostPercent, PostAssign,
}
const enum State { Offline = 1, Online, Active, Overload }   // ascending: `>=` gating

interface Modifier {
  affecteeFilter: AffecteeFilter;
  affecteeDomain: Domain;
  affecteeAttrId: AttrId;
  operator: Operator;
  affectorAttrId: AttrId;            // magnitude source on the CARRIER item
  extraArg?: GroupId | TypeId;       // groupID or skillTypeID
}

interface EffectMeta {
  id: EffectId; categoryId: number; state: State;
  modifiers: Modifier[];
  fittingUsageChanceAttrId?: AttrId; // suppresses passive effects (booster side-effects)
  resistAttrId?: AttrId;             // projected only
}

interface Item {
  typeId: TypeId; categoryId: number; groupId: GroupId;
  state: State;
  typeAttrs: Map<AttrId, number>;    // base values, incl. injected mass/capacity/volume/radius
  effects: Map<EffectId, { isDefault: boolean }>;
  charge?: Item;
  modifierDomain: Domain | null;     // §1.2
  ownerModifiable: boolean;          // §1.2
}
```

### 6.4 Pass order

Two viable shapes; both give identical results.

**(a) EOS-style — bucket then apply** (`/tmp/everef/eos/eos/calculator/map.py:207`):

```
seed accumulator ← typeAttrs[attr] ?? meta.defaultValue ?? throw
for each modifier affecting (item, attr):
    n = normalise(op, carrierItem.attr(modifier.affectorAttrId))   // recurses!
    n *= resistFactor                                              // 1 for local fits
    penalise = !meta.stackable
            && !PENALTY_IMMUNE_CATEGORIES.has(carrier.categoryId)
            && PENALIZABLE_OPERATORS.has(op)
    (penalise ? penalized : plain)[op].push(n)
for each op in penalized:  plain[op].push(penalizeValues(penalized[op]))
for each op in ascending numeric order:
    PreAssign|PostAssign  → acc = highIsGood ? max(vals) : min(vals)
    ModAdd|ModSub         → acc += each
    everything else       → acc *= 1 + each
cap to maxAttributeId's value if defined
if attr ∈ {50, 30, 48, 11}: acc = round2(acc)
```

**(b) EVEShipFit-style — outer loop over operators** (`pass_3.rs:56`). Same maths, keeps the
three value lists (`plain`, `penalizedPositive`, `penalizedNegative`) local to one operator.

Normalisation table (apply *before* bucketing, so the apply step is uniform):

| op | normalise `v` → | applied as |
|---|---|---|
| PreAssign / PostAssign | `v` | replace |
| PreMul / PostMul / PostMulImmune | `v - 1` | `acc *= 1 + n` |
| PreDiv / PostDiv | `1/v - 1` | `acc *= 1 + n` |
| ModAdd | `v` | `acc += n` |
| ModSub | `-v` | `acc += n` |
| PostPercent | `v / 100` | `acc *= 1 + n` |

**Pitfall:** `PreDiv`/`PostDiv` of `0` raises `ZeroDivisionError` in Python but silently yields
`Infinity` in JS. Guard explicitly. (Moot for phase 4 — division operators never touch fitting
attributes.)

### 6.5 Memoisation & invalidation

- Memoise per `(item, attrId)`. EOS stores a `CalculationPlaceholder` sentinel to detect cycles;
  Pyfa does the same (`modifiedAttributeDict.py` `__placehold`). Do the same — the
  `modifyingAttributeID` recursion *can* loop.
- Because the modifier magnitude is the *calculated* value of an attribute on the carrier,
  changing any attribute invalidates its dependents. EOS tracks this with a pub/sub graph;
  for a phase-4 UI, **just clear the whole memo on any fit mutation.** A fit is a few hundred
  attributes — recomputing it is microseconds, and the dependency bookkeeping is where both
  reference engines are most complex and most bug-prone.
- Keep the affector list per calculated attribute (`{operator, penalised, sourceItem, sourceAttr}`)
  so you can render an "affected by" panel. Both Pyfa (`__affectedBy`) and EVEShipFit do this.

### 6.6 Suggested module layout

```
src/lib/dogma/
  sde/loader.ts       # merge types.*.json + typedogma.*.json; inject 4/38/161/162
  sde/types.ts
  model/item.ts       # Item, Ship, Module, Charge, Rig, Subsystem, Skill, Implant, Drone
  model/fit.ts
  calc/normalise.ts
  calc/penalty.ts     # penalizeValues() — §3.2
  calc/attribute.ts   # the calculator — §6.4
  calc/affection.ts   # modifier → affectee-set resolution — §1.2 / §2.2
  effects/custom.ts   # hand-coded 3773 / 3774 — §5.4
  validate/resources.ts  validate/slots.ts  validate/skills.ts  validate/restrictions.ts
```

### 6.7 Unit testing

**Copy EOS's harness shape** (`/tmp/everef/eos/tests/integration/environment.py` + `testcase.py`):
a fake cache handler with `mkType` / `mkAttr` / `mkEffect` / `mkMod` builders and auto-allocated
IDs from 1 000 000, a base test case holding a `Fit`, and an assert-value + assert-no-warnings
pair. It gives hermetic, readable tests with no SDE dependency.

**But add the layer EOS lacks** — *nothing in either repo asserts a real ship's real numbers.*
EOS's 1452 tests are 100% synthetic (verified: no real type IDs anywhere), and **Pyfa's test
suite does not run at all** — there is no `conftest.py` in either repo, so every Pyfa test's
`DB`/`Saveddata`/`RifterFit` fixture is undefined, and `tox.ini` points at a `tests2/` directory
that does not exist.

#### Synthetic fixtures (from EOS's own tests)

| Fixture | Expected |
|---|---|
| base 100, postPercent `+20,+50,−90,−25,+400`, `stackable: true` | **67.5** |
| same, `stackable: false` | **62.549783181488586** |
| base 100, two penalised +10% | **119.56031978880436** |
| base 100, three penalised +10% | **126.38223009922673** |
| base 100, two penalised −10% | **82.17792017279642** |
| +50% and +100% from each of categories 6/8/16/20/32 onto base 100 | **300** (unpenalised) |
| all nine operators mixed | `((preAss*preMul/preDiv + modAdd − modSub) * postMul/postDiv * (1+postPerc/100))` |

#### Real-SDE fixtures (verified against the SDE and the EVE University wiki)

**Rifter, typeID 587** — base attributes:

```
cpuOutput(48)=130.0  powerOutput(11)=41.0
hiSlots(14)=3  medSlots(13)=3  lowSlots(12)=4  rigSlots(1137)=3
turretSlotsLeft(102)=3  launcherSlotsLeft(101)=2  upgradeCapacity(1132)=400.0
```

Cross-checked against <https://wiki.eveuniversity.org/Rifter> — "130 tf", "41 MW", 3/3/4,
3 small rigs, 3 turrets, 2 launchers, calibration 400. Exact match. The Rifter has **no CPU/PG
role bonus**, which makes it a clean fixture.

**Modules:**

| Name | typeID | groupID | cpu(50) | power(30) | required skills |
|---|---:|---:|---:|---:|---|
| 200mm AutoCannon II | 2889 | 55 | 9.0 | 4.0 | Small Projectile Turret 5, Gunnery 2, Small Autocannon Specialization 1 |
| Damage Control II | 2048 | 60 | 30.0 | 1.0 | Hull Upgrades 4 |
| Gyrostabilizer II | 519 | 59 | 30.0 | 1.0 | Weapon Upgrades 4 |
| 5MN Microwarpdrive II | 440 | 46 | 25.0 | 17.0 | High Speed Maneuvering 3 |
| Small Shield Extender II | 380 | 38 | 23.0 | 3.0 | Shield Upgrades 3 |
| Small Ancillary Armor Repairer | 33076 | 1199 | 5.0 | 5.0 | Repair Systems 1, Mechanics 1 |
| Small Projectile Collision Accelerator II | 31686 | 777 | *(none)* | *(none)* | `upgradeCost`=300, `rigSize`=1, `drawback`=10 |

**Skill-scaling fixture — Rifter at all-5.** Every step is data-derived, not hardcoded:

```
cpuOutputBonus2 (424) = 5.0 × skillLevel 5 = 25.0        # effect 368, preMul
cpuOutput   = 130.0 × (1 + 25.0/100) = 130.0 × 1.25 = 162.5     # effect 397, postPercent
powerEngineeringOutputBonus (313) = 5.0 × 5 = 25.0        # effect 218, preMul
powerOutput =  41.0 × (1 + 25.0/100) =  41.0 × 1.25 =  51.25    # effect 490, postPercent
```

Both are exact in IEEE-754 doubles (`.5`, `.25`) — `toBe()` works, no epsilon needed.

Use side at all-5:

```
cpuNeedBonus   (310) = −5 × 5 = −25  → gunnery-module cpu   × 0.75
powerNeedBonus (323) = −2 × 5 = −10  → gunnery-module power × 0.90
200mm AutoCannon II: cpu 9.0 → 6.75 ; power 4.0 → 3.60
```

**End-to-end candidate** — Rifter + 3× 200mm AutoCannon II + Damage Control II + Gyrostabilizer II,
all skills V:

```
cpu used   = 3×6.75 + 30 + 30 = 80.25  of 162.5
power used = 3×3.60 +  1 +  1 = 12.80  of  51.25
```

⚠ **UNVERIFIED against Pyfa itself.** The arithmetic follows directly from the SDE modifiers
above, but Pyfa could not be run (no working test harness). The `162.5` / `51.25` output figures
*are* independently verified. **Recommendation: install Pyfa once by hand and screenshot this fit
to lock the fixture down before building against it.**

**No published fit with exact CPU/PG numbers was found.** Candidates checked and rejected for
lacking transcribed figures: a Rifter fit-kitchen blog post, Pyfa issue #672, an EVE forums
thread on maxing PG/CPU, an EVE Workbench Rifter fit. The EVE University wiki's base numbers are
the best external anchor.

**Also worth porting:** the EFT-format regexes from `/tmp/everef/pyfa/service/port/eft.py:243`
(`importEft`), which are untested in Pyfa and have no fixture fits in either repo.

---

## 7. The `online` effect and module state vs. resource usage

**Offline modules consume no CPU and no powergrid.** All three engines agree on the outcome and
disagree on the mechanism — this matters, because they diverge at the edges.

### Pyfa — a plain state check

`/tmp/everef/pyfa/eos/saveddata/fit.py:1225`:

```python
@staticmethod
def getItemAttrOnlineSum(dict, attr):
    amount = 0
    for mod in dict:
        add = mod.getModifiedItemAttr(attr) if mod.state >= FittingModuleState.ONLINE else None
        if add is not None:
            amount += add
    return amount
```

**Pyfa has no handler for the `online` effect at all** — verified: neither `class Effect16` nor
`class Effect901` exists in `effects.py`. The `online` effect is a pure data marker; the saved
`state` integer alone decides consumption. Rigs default to `ONLINE`
(`/tmp/everef/pyfa/eos/saveddata/module.py:87`), which is why `calibrationUsed` — also using
`getItemAttrOnlineSum` — works.

### EOS — the `online` effect genuinely drives it

`CpuRegister._use_effect_id = EffectId.online` (16). An item is registered as a CPU consumer
only while the `online` effect is **running** on it, tracked by `EffectsStarted`/`EffectsStopped`
pub/sub messages. Whether `online` runs is resolved by
`/tmp/everef/eos/eos/effect_status.py:104`, which special-cases it: `online` is resolved *first*,
because every other online-category effect depends on it.

The net rule: **a module consumes CPU/PG iff `state >= online` AND its type carries the `online`
effect (16) AND it defines the `cpu`/`power` attribute.**

Curiosity: the `online` effect has `effectCategory: 1` (*active*) in the SDE, not 4 (*online*).
EOS's resolver handles this by special-casing effect 16 directly. EVEShipFit instead **patches
the data** (`/tmp/everef/esf-data/patches/onlineEffect.yaml`):

> *"The dogma data has an effect "online" that is in the "active" category. The EVE client
> internally does some magic here, but in our case, it should always be in the "online" category."*

Patching the category to 4 is the cleaner fix for a fresh implementation.

### EVEShipFit — state gating as data

One line (`/tmp/everef/dogma-engine/src/calculate/pass_3.rs:80`):

```rust
if effect.source_category > source.state { continue; }
```

with CPU/PG expressed as patched category-`online` effects doing `modAdd` of `cpu`→`cpuLoad`
(§6.1). Offlining a module stops charging CPU automatically.

### Divergences to decide explicitly

| Question | Pyfa | EOS | EVEShipFit |
|---|---|---|---|
| CPU/PG consumer gate | `state >= ONLINE` | `online` effect (16) running | patched online-category effect |
| **Calibration consumer gate** | `state >= ONLINE` | **`rig_slot` effect (2663) — any state, incl. offline** | TS layer, unconditional |
| A module with `cpu` but no `online` effect | **charged** | **not charged** | not charged |
| Per-module CPU/PG rounding | yes, 2 dp | no (sum only) | no |
| `maxGroupFitted` value | **raw** | modified | n/a |
| `maxGroup*` grouping key | name (Online/Active), groupID (Fitted) | groupID | n/a |
| `rigSize` value | modified, default 0 | raw type attr, skip if absent | n/a |
| Capital-module rule | `isCapitalSize` attr | `volume > 3500` | n/a |
| Over-CPU consequence | gauge colour only | `ValidationError` | gauge clamped at 100% |
| `canFitShipType` variants | prefix-match (all N) | hardcoded 1-10 | n/a |
| Assign winner among several | — | plain `max`/`min` | `max`/`min` **by absolute value** |

**Recommendation:** follow EOS everywhere except `maxGroupFitted`, where Pyfa's raw-value reading
has a specific in-game justification recorded in its source comment.

### Module state validity

`/tmp/everef/pyfa/eos/saveddata/module.py:732`:

```python
def isValidState(self, state):
    if state < -1 or state > 2: return False
    elif state >= ACTIVE and (not self.item.isType("active")
                              or self.getModifiedItemAttr('activationBlocked') > 0): return False
    elif state == OVERHEATED and not self.item.isType("overheat"): return False
    elif state > ONLINE and self.slot == FittingSlot.SYSTEM: return False
    else: return True
```

EOS derives `max_state` as the max over all the type's effect states
(`/tmp/everef/eos/eos/eve_obj/type/type.py:82`). EVEShipFit does the same plus a nice heuristic
(`pass_2.rs:184`): *"Any module that has a `capacitorNeed` (6), can be activated."*
Clamp the user-requested state to `max_state` on load.

---

## 8. Open questions / not verified

- **`rigSize` integer→size mapping** (1=small … 4=XL) is inferred; neither repo hardcodes it.
- **`maxGroupFitted`: raw vs modified attribute value** — Pyfa and EOS disagree; Pyfa's source
  comment claims Pyfa matches the game. Not tested against the client.
- **Assignment-operator winner selection** — EOS uses plain `max`/`min`, EVEShipFit uses
  max/min *by absolute value*. Differs only for mixed-sign assigns. Not tested against the client.
- **The end-to-end Rifter CPU/PG fixture in §6.7** is hand-derived, not confirmed by running Pyfa.
- **CCP's replacement docs site** (developers.eveonline.com) was not fetched; it may or may not
  document the operator table that the deprecated ESI page omits.
- **`chargeGroup0`** — Pyfa loops `range(5)` producing `chargeGroup0..4`; EOS uses explicit IDs
  604, 605, 606, **609**, **610** (note the 607/608 gap). Whether `chargeGroup0` exists is unconfirmed;
  treat EOS's five IDs as authoritative.
- **Small Projectile Collision Accelerator II (31686) has no `requiredSkillN` attributes and an
  empty `requiredskillsfortypes` entry** in this SDE build, contradicting the expectation that T2
  rigs require Projectile Weapon Rigging. Reported as-is from the data; worth re-checking against
  a newer SDE. (Moot for validation — both engines exempt rigs from skill checks anyway.)
- **`structureID` domain** (177 occurrences) has no EOS equivalent; structure fitting is out of
  scope and was not investigated.
- Effect categories **3 (area)** and **6 (dungeon)** have no state mapping in EOS and no guard —
  a latent `KeyError`. Filter them at build time.
- The pass order itself is **empirical**: CCP documents neither it nor the operator codes nor
  stacking penalties. Confidence comes only from three independent implementations agreeing.

## 9. Reference index

| Topic | File |
|---|---|
| Pyfa attribute calculator + penalty | `/tmp/everef/pyfa/eos/modifiedAttributeDict.py:335-453` |
| Pyfa standalone penalty helper | `/tmp/everef/pyfa/eos/calc.py:28` |
| Pyfa enums (slot/state/hardpoint) | `/tmp/everef/pyfa/eos/const.py` |
| Pyfa fit resources / slots / hardpoints | `/tmp/everef/pyfa/eos/saveddata/fit.py:1214-1302` |
| Pyfa module slot/hardpoint/fits() | `/tmp/everef/pyfa/eos/saveddata/module.py:661-881` |
| Pyfa recalculation pass order | `/tmp/everef/pyfa/eos/saveddata/fit.py:986-1111` |
| Pyfa missing-skills check | `/tmp/everef/pyfa/service/character.py:456` |
| Pyfa SDE→DB import (column→attr injection) | `/tmp/everef/pyfa/db_update.py:225-245` |
| Pyfa EFT importer | `/tmp/everef/pyfa/service/port/eft.py:243` |
| EOS calculator core | `/tmp/everef/eos/eos/calculator/map.py:207-385` |
| EOS affectee resolution | `/tmp/everef/eos/eos/calculator/affection.py` |
| EOS modifierInfo → modifier conversion | `/tmp/everef/eos/eos/eve_obj_builder/mod_builder/converter/mod_info.py` |
| EOS constants (AttrId/EffectId/TypeCategoryId) | `/tmp/everef/eos/eos/const/eve.py` |
| EOS operators/domains/filters/states | `/tmp/everef/eos/eos/const/eos.py` |
| EOS effect state gating | `/tmp/everef/eos/eos/effect_status.py:104-137` |
| EOS resource registers | `/tmp/everef/eos/eos/stats/register/resource/ship_regular.py` |
| EOS restrictions | `/tmp/everef/eos/eos/restriction/` |
| EOS custom subsystem slot modifiers | `/tmp/everef/eos/eos/eve_obj/custom/subsystem_slot_bonus/modifier.py` |
| EOS test harness | `/tmp/everef/eos/tests/integration/environment.py`, `testcase.py` |
| EVEShipFit operator + penalty kernel | `/tmp/everef/dogma-engine/src/calculate/pass_3.rs:7-184` |
| EVEShipFit penalty exemption | `/tmp/everef/dogma-engine/src/calculate/pass_2.rs:8-127` |
| EVEShipFit data patches | `/tmp/everef/esf-data/patches/*.yaml` |
| SDE (attributes/effects/types/typedogma) | `/tmp/everef/pyfa/staticdata/fsd_built/` |
