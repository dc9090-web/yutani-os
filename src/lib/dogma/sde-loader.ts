/**
 * The engine's only I/O module: builds a plain DogmaData out of the phase-2 sde_* tables.
 *
 * Everything else under src/lib/dogma is isomorphic and takes DogmaData as an argument, so phase 5
 * can run the same engine in the browser against a snapshot fetched over HTTP.
 */
import { getPool } from "../db/client.js";
import {
  COLUMN_ATTRS, CUSTOM_EFFECT_MODIFIERS, EFFECT, ONLINE_EFFECT_CATEGORY_ID, REQUIRED_SKILL_ATTRS,
  domainFromSde, operatorFromSde, stateForEffectCategory,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaEffect, type DogmaGroup, type DogmaType,
  type EffectId, type GroupId, type Modifier, type ModifierFunc, type TypeId,
} from "./data.js";

interface BaseData {
  attributes: Map<AttrId, DogmaAttribute>;
  effects: Map<EffectId, DogmaEffect>;
  groups: Map<GroupId, DogmaGroup>;
}

interface AttributeRow {
  id: number; name: string | null; default_value: number | null;
  stackable: boolean | null; high_is_good: boolean | null;
  max_attribute_id: number | null; min_attribute_id: number | null;
}
interface EffectRow { id: number; effect_category_id: number | null; fitting_usage_chance_attribute_id: number | null }
interface ModifierRow {
  effect_id: number; domain: string | null; func: string | null;
  modified_attribute_id: number | null; modifying_attribute_id: number | null;
  operation: number | null; skill_type_id: number | null; group_id: number | null;
}
interface GroupRow { id: number; name: string | null; category_id: number | null }
interface TypeRow {
  id: number; group_id: number | null; category_id: number | null; name: string | null;
  mass: number | null; capacity: number | null; volume: number | null; radius: number | null;
}

/** EffectStopper is deliberately absent — those rows suppress other effects and are dropped. */
const MODIFIER_FUNCS: ReadonlySet<string> = new Set<ModifierFunc>([
  "ItemModifier", "LocationModifier", "LocationGroupModifier",
  "LocationRequiredSkillModifier", "OwnerRequiredSkillModifier",
]);

/**
 * skillEffect, carried by every skill type. One of its two modifier rows (skill points → skill level,
 * operation 9) is already dropped as unsupported by `operatorFromSde` (research §2.3). The other row —
 * ItemModifier(280 skillLevel ← 276 skillPoints, ModAdd) — survives that filter, but `skillPoints` is
 * never populated in typeDogma (it defaults to 0), so it always adds zero: a real no-op, just one the
 * engine would otherwise still gather and report on every skill's `explain()`/`activeModifiers()`.
 * Dropped entirely — from `data.effects` and from every type's effects map — rather than left in as
 * dead weight.
 */
const SKILL_EFFECT_ID = 132;

let basePromise: Promise<BaseData> | null = null;
const typeCache = new Map<TypeId, DogmaType>();
const missingTypes = new Set<TypeId>();

/** Tests only: drops the process-wide memo so a fresh import is picked up. */
export function resetDogmaCache(): void {
  basePromise = null;
  typeCache.clear();
  missingTypes.clear();
}

/**
 * The requested types plus the transitive closure of their requiredSkillN attributes; attributes,
 * effects and groups are shared with every other caller in this process.
 */
export async function loadDogmaData(typeIds: TypeId[]): Promise<DogmaData> {
  const base = await loadBase();
  const types = await loadTypes(typeIds);
  return { attributes: base.attributes, effects: base.effects, groups: base.groups, types };
}

function loadBase(): Promise<BaseData> {
  if (!basePromise) {
    basePromise = readBase().catch((e: unknown) => {
      basePromise = null;                 // a failed load must not poison the process
      throw e;
    });
  }
  return basePromise;
}

async function readBase(): Promise<BaseData> {
  const pool = getPool();
  const { rows: attrRows } = await pool.query<AttributeRow>(
    `SELECT id, name, default_value, stackable, high_is_good, max_attribute_id, min_attribute_id
     FROM sde_dogma_attributes`);
  const attributes = new Map<AttrId, DogmaAttribute>();
  for (const r of attrRows) {
    // bool(None) === false: mirror EOS's row.get() semantics rather than inventing a default.
    const attr: DogmaAttribute = {
      id: r.id, name: r.name, defaultValue: r.default_value ?? 0,
      stackable: r.stackable ?? false, highIsGood: r.high_is_good ?? false,
    };
    if (r.max_attribute_id !== null) attr.maxAttributeId = r.max_attribute_id;
    if (r.min_attribute_id !== null) attr.minAttributeId = r.min_attribute_id;
    attributes.set(attr.id, attr);
  }

  const { rows: effectRows } = await pool.query<EffectRow>(
    "SELECT id, effect_category_id, fitting_usage_chance_attribute_id FROM sde_dogma_effects");
  const effects = new Map<EffectId, DogmaEffect>();
  for (const r of effectRows) {
    if (r.id === SKILL_EFFECT_ID) continue;     // dropped entirely — see SKILL_EFFECT_ID
    // The SDE files `online` as effectCategoryID 1 (active); the client treats it as online.
    const categoryId = r.id === EFFECT.online ? ONLINE_EFFECT_CATEGORY_ID : r.effect_category_id;
    const state = stateForEffectCategory(categoryId);
    if (state === null) continue;         // categories 3 (area) and 6 (dungeon) have no state
    const effect: DogmaEffect = { id: r.id, categoryId: categoryId ?? 0, state, modifiers: [] };
    if (r.fitting_usage_chance_attribute_id !== null) {
      effect.fittingUsageChanceAttrId = r.fitting_usage_chance_attribute_id;
    }
    effects.set(effect.id, effect);
  }

  const { rows: modRows } = await pool.query<ModifierRow>(
    `SELECT effect_id, domain, func, modified_attribute_id, modifying_attribute_id,
            operation, skill_type_id, group_id
     FROM sde_dogma_effect_modifiers ORDER BY effect_id, idx`);
  for (const r of modRows) {
    const effect = effects.get(r.effect_id);
    if (!effect) continue;
    const modifier = toModifier(r);
    if (modifier) effect.modifiers.push(modifier);
  }

  // 3773 and 3774 carry no modifierInfo at all; both reference engines hand-code them.
  for (const [effectId, modifiers] of CUSTOM_EFFECT_MODIFIERS) {
    const effect = effects.get(effectId);
    if (effect && effect.modifiers.length === 0) effect.modifiers.push(...modifiers.map((m) => ({ ...m })));
  }

  const { rows: groupRows } = await pool.query<GroupRow>("SELECT id, name, category_id FROM sde_groups");
  const groups = new Map<GroupId, DogmaGroup>(
    groupRows.map((r) => [r.id, { id: r.id, name: r.name, categoryId: r.category_id ?? 0 }]));

  return { attributes, effects, groups };
}

function toModifier(r: ModifierRow): Modifier | null {
  if (r.func === null || !MODIFIER_FUNCS.has(r.func)) return null;     // EffectStopper and anything new
  const domain = domainFromSde(r.domain);
  if (domain === null) return null;                                     // targetID / target / structureID
  const operation = operatorFromSde(r.operation);
  if (operation === null) return null;                                  // operation 9 and unknown ints
  if (r.modified_attribute_id === null || r.modifying_attribute_id === null) return null;
  const modifier: Modifier = {
    func: r.func as ModifierFunc,
    domain,
    modifiedAttrId: r.modified_attribute_id,
    modifyingAttrId: r.modifying_attribute_id,
    operation,
  };
  if (r.group_id !== null) modifier.groupId = r.group_id;
  if (r.skill_type_id !== null) modifier.skillTypeId = r.skill_type_id;
  return modifier;
}

async function loadTypes(requested: TypeId[]): Promise<Map<TypeId, DogmaType>> {
  const resolved = new Map<TypeId, DogmaType>();
  const seen = new Set<TypeId>();
  let frontier: TypeId[] = [];
  for (const id of requested) if (!seen.has(id)) { seen.add(id); frontier.push(id); }

  while (frontier.length > 0) {
    const toFetch = frontier.filter((id) => !typeCache.has(id) && !missingTypes.has(id));
    if (toFetch.length > 0) await readTypes(toFetch);
    const next: TypeId[] = [];
    for (const id of frontier) {
      const type = typeCache.get(id);
      if (!type) continue;              // unknown to this SDE build — the caller renders it as unknown
      resolved.set(id, type);
      for (const skillId of requiredSkillIds(type)) {
        if (seen.has(skillId)) continue;
        seen.add(skillId);
        next.push(skillId);
      }
    }
    frontier = next;
  }
  return resolved;
}

function requiredSkillIds(type: DogmaType): TypeId[] {
  const out: TypeId[] = [];
  for (const [skillAttr] of REQUIRED_SKILL_ATTRS) {
    const value = type.attrs.get(skillAttr);
    if (value === undefined || value <= 0) continue;
    out.push(Math.round(value));        // typeDogma values are always floats
  }
  return out;
}

async function readTypes(ids: TypeId[]): Promise<void> {
  const pool = getPool();
  const { rows: typeRows } = await pool.query<TypeRow>(
    `SELECT t.id, t.group_id, g.category_id, t.name, t.mass, t.capacity, t.volume, t.radius
     FROM sde_types t LEFT JOIN sde_groups g ON g.id = t.group_id
     WHERE t.id = ANY($1::int[])`, [ids]);
  const { rows: attrRows } = await pool.query<{ type_id: number; attribute_id: number; value: number | null }>(
    "SELECT type_id, attribute_id, value FROM sde_type_attributes WHERE type_id = ANY($1::int[])", [ids]);
  const { rows: effectRows } = await pool.query<{ type_id: number; effect_id: number; is_default: boolean | null }>(
    "SELECT type_id, effect_id, is_default FROM sde_type_effects WHERE type_id = ANY($1::int[])", [ids]);

  const built = new Map<TypeId, DogmaType>();
  for (const r of typeRows) {
    built.set(r.id, {
      id: r.id, groupId: r.group_id ?? 0, categoryId: r.category_id ?? 0, name: r.name,
      attrs: new Map<AttrId, number>(), effects: new Map<EffectId, boolean>(),
    });
  }
  for (const r of attrRows) {
    const type = built.get(r.type_id);
    if (type && r.value !== null) type.attrs.set(r.attribute_id, r.value);
  }
  // mass/capacity/volume/radius live on sde_types, not in typeDogma — but a dogma value wins.
  for (const r of typeRows) {
    const type = built.get(r.id);
    if (!type) continue;
    for (const [attrId, column] of COLUMN_ATTRS) {
      const value = r[column];
      if (value !== null && !type.attrs.has(attrId)) type.attrs.set(attrId, value);
    }
  }
  for (const r of effectRows) {
    if (r.effect_id === SKILL_EFFECT_ID) continue;     // dropped entirely — see SKILL_EFFECT_ID
    const type = built.get(r.type_id);
    if (type) type.effects.set(r.effect_id, r.is_default ?? false);
  }
  for (const id of ids) {
    const type = built.get(id);
    if (type) typeCache.set(id, type); else missingTypes.add(id);
  }
}
