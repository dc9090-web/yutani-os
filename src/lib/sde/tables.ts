import type { SdeTableName } from "./ddl.js";

export type SdePgType = "int" | "text" | "bool" | "float8" | "jsonb";
export interface SdeColumn { name: string; type: SdePgType }

export interface SdeTable {
  /** Target table, unqualified. */
  table: SdeTableName;
  /** Zip member base name, without the ".jsonl" suffix. */
  member: string;
  /** Column order — `map` must return values in exactly this order. */
  columns: SdeColumn[];
  /** One row for a 1:1 table, or an array of rows for a fan-out table (possibly empty). */
  map(record: Record<string, unknown>): unknown[] | unknown[][];
}

type Rec = Record<string, unknown>;

/**
 * The English value of an SDE field. Localised fields are `{de,en,es,fr,ja,ko,ru,zh}` objects, but
 * `dogmaAttributes.description`, `dogmaAttributeCategories.*`, every `name` on
 * attributes/effects/units, and `metaGroups.iconSuffix` are plain strings — both shapes land here.
 */
export function en(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const candidate = (value as Rec).en;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

/** SDE integers sometimes arrive as JSON floats (`182 → 3329.0`); round them. */
export function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}
export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
export function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * A jsonb column's value. `pg` serialises a `text[]`/`jsonb[]` parameter by escaping each element,
 * so handing it JSON strings is safe for any content — quotes, commas and backslashes included.
 */
export function json(value: unknown): string {
  return JSON.stringify(value);
}

function list(value: unknown): Rec[] {
  return Array.isArray(value) ? (value as Rec[]) : [];
}

function cols(spec: Record<string, SdePgType>): SdeColumn[] {
  return Object.entries(spec).map(([name, type]) => ({ name, type }));
}

export const SDE_TABLE_DEFS: readonly SdeTable[] = [
  {
    table: "sde_categories",
    member: "categories",
    columns: cols({ id: "int", name: "text", published: "bool", icon_id: "int" }),
    map: (r) => [int(r._key), en(r.name), bool(r.published), int(r.iconID)],
  },
  {
    table: "sde_groups",
    member: "groups",
    columns: cols({
      id: "int", category_id: "int", name: "text", published: "bool", icon_id: "int",
      anchorable: "bool", anchored: "bool", fittable_non_singleton: "bool", use_base_price: "bool",
    }),
    map: (r) => [
      int(r._key), int(r.categoryID), en(r.name), bool(r.published), int(r.iconID),
      bool(r.anchorable), bool(r.anchored), bool(r.fittableNonSingleton), bool(r.useBasePrice),
    ],
  },
  {
    table: "sde_types",
    member: "types",
    columns: cols({
      id: "int", group_id: "int", name: "text", description: "text", published: "bool",
      market_group_id: "int", meta_group_id: "int", meta_level: "int", tech_level: "int",
      race_id: "int", faction_id: "int", icon_id: "int", graphic_id: "int",
      mass: "float8", volume: "float8", packaged_volume: "float8", capacity: "float8",
      radius: "float8", base_price: "float8", portion_size: "int", variation_parent_type_id: "int",
    }),
    map: (r) => [
      int(r._key), int(r.groupID), en(r.name), en(r.description), bool(r.published),
      int(r.marketGroupID), int(r.metaGroupID), int(r.metaLevel), int(r.techLevel),
      int(r.raceID), int(r.factionID), int(r.iconID), int(r.graphicID),
      num(r.mass), num(r.volume), num(r.packagedVolume), num(r.capacity),
      num(r.radius), num(r.basePrice), int(r.portionSize), int(r.variationParentTypeID),
    ],
  },
  {
    table: "sde_races",
    member: "races",
    columns: cols({ id: "int", name: "text" }),
    map: (r) => [int(r._key), en(r.name)],
  },
  {
    table: "sde_market_groups",
    member: "marketGroups",
    columns: cols({ id: "int", parent_id: "int", name: "text", description: "text", has_types: "bool", icon_id: "int" }),
    map: (r) => [int(r._key), int(r.parentGroupID), en(r.name), en(r.description), bool(r.hasTypes), int(r.iconID)],
  },
  {
    table: "sde_meta_groups",
    member: "metaGroups",
    columns: cols({ id: "int", name: "text", icon_suffix: "text" }),
    map: (r) => [int(r._key), en(r.name), str(r.iconSuffix)],
  },
  {
    table: "sde_dogma_units",
    member: "dogmaUnits",
    columns: cols({ id: "int", name: "text", display_name: "text", description: "text" }),
    map: (r) => [int(r._key), en(r.name), en(r.displayName), en(r.description)],
  },
  {
    table: "sde_dogma_attribute_categories",
    member: "dogmaAttributeCategories",
    columns: cols({ id: "int", name: "text", description: "text" }),
    map: (r) => [int(r._key), en(r.name), en(r.description)],
  },
  {
    table: "sde_dogma_attributes",
    member: "dogmaAttributes",
    columns: cols({
      id: "int", name: "text", display_name: "text", description: "text", category_id: "int",
      unit_id: "int", data_type: "int", default_value: "float8", high_is_good: "bool",
      stackable: "bool", published: "bool", display_when_zero: "bool", icon_id: "int",
      max_attribute_id: "int", min_attribute_id: "int",
    }),
    map: (r) => [
      int(r._key), en(r.name), en(r.displayName), en(r.description), int(r.attributeCategoryID),
      int(r.unitID), int(r.dataType), num(r.defaultValue), bool(r.highIsGood),
      bool(r.stackable), bool(r.published), bool(r.displayWhenZero), int(r.iconID),
      int(r.maxAttributeID), int(r.minAttributeID),
    ],
  },
  {
    table: "sde_dogma_effects",
    member: "dogmaEffects",
    columns: cols({
      id: "int", name: "text", display_name: "text", description: "text", effect_category_id: "int",
      is_offensive: "bool", is_assistance: "bool", is_warp_safe: "bool", disallow_auto_repeat: "bool",
      published: "bool", duration_attribute_id: "int", discharge_attribute_id: "int",
      range_attribute_id: "int", falloff_attribute_id: "int", tracking_speed_attribute_id: "int",
      resistance_attribute_id: "int", fitting_usage_chance_attribute_id: "int",
    }),
    map: (r) => [
      int(r._key), en(r.name), en(r.displayName), en(r.description), int(r.effectCategoryID),
      bool(r.isOffensive), bool(r.isAssistance), bool(r.isWarpSafe), bool(r.disallowAutoRepeat),
      bool(r.published), int(r.durationAttributeID), int(r.dischargeAttributeID),
      int(r.rangeAttributeID), int(r.falloffAttributeID), int(r.trackingSpeedAttributeID),
      int(r.resistanceAttributeID), int(r.fittingUsageChanceAttributeID),
    ],
  },
  {
    table: "sde_dogma_effect_modifiers",
    member: "dogmaEffects",
    columns: cols({
      effect_id: "int", idx: "int", domain: "text", func: "text", modified_attribute_id: "int",
      modifying_attribute_id: "int", operation: "int", skill_type_id: "int", group_id: "int",
      stopped_effect_id: "int",
    }),
    // EffectStopper entries carry `effectID` instead of the attribute triple.
    map: (r) => list(r.modifierInfo).map((m, idx) => [
      int(r._key), idx, str(m.domain), str(m.func), int(m.modifiedAttributeID),
      int(m.modifyingAttributeID), int(m.operation), int(m.skillTypeID), int(m.groupID), int(m.effectID),
    ]),
  },
  {
    table: "sde_type_attributes",
    member: "typeDogma",
    columns: cols({ type_id: "int", attribute_id: "int", value: "float8" }),
    // `value` is always a JSON float in the SDE, even for IDs; stored as given.
    map: (r) => list(r.dogmaAttributes).map((a) => [int(r._key), int(a.attributeID), num(a.value)]),
  },
  {
    table: "sde_type_effects",
    member: "typeDogma",
    columns: cols({ type_id: "int", effect_id: "int", is_default: "bool" }),
    map: (r) => list(r.dogmaEffects).map((e) => [int(r._key), int(e.effectID), bool(e.isDefault)]),
  },
  {
    table: "sde_type_bonuses",
    member: "typeBonus",
    columns: cols({
      type_id: "int", idx: "int", kind: "text", skill_type_id: "int", importance: "int",
      bonus: "float8", bonus_text: "text", unit_id: "int",
    }),
    // idx is the ordinal within the type: every types[*]._value entry first (kind "skill",
    // skill_type_id = the list's _key), then roleBonuses, then miscBonuses, in file order.
    map: (r) => {
      const typeId = int(r._key);
      const out: unknown[][] = [];
      const push = (kind: "skill" | "role" | "misc", skillTypeId: number | null, b: Rec): void => {
        out.push([typeId, out.length, kind, skillTypeId, int(b.importance), num(b.bonus), en(b.bonusText), int(b.unitID)]);
      };
      for (const entry of list(r.types)) {
        const skillTypeId = int(entry._key);
        for (const b of list(entry._value)) push("skill", skillTypeId, b);
      }
      for (const b of list(r.roleBonuses)) push("role", null, b);
      for (const b of list(r.miscBonuses)) push("misc", null, b);
      return out;
    },
  },
  {
    table: "sde_regions",
    member: "mapRegions",
    columns: cols({ id: "int", name: "text" }),
    map: (r) => [int(r._key), en(r.name)],
  },
  {
    table: "sde_constellations",
    member: "mapConstellations",
    columns: cols({ id: "int", region_id: "int", name: "text" }),
    map: (r) => [int(r._key), int(r.regionID), en(r.name)],
  },
  {
    table: "sde_solar_systems",
    member: "mapSolarSystems",
    columns: cols({
      id: "int", constellation_id: "int", region_id: "int", name: "text",
      security_status: "float8", security_class: "text",
    }),
    map: (r) => [
      int(r._key), int(r.constellationID), int(r.regionID), en(r.name),
      num(r.securityStatus), str(r.securityClass),
    ],
  },
  {
    table: "sde_stations",
    member: "npcStations",
    columns: cols({ id: "int", solar_system_id: "int", type_id: "int", owner_id: "int", operation_id: "int" }),
    // npcStations carry no name — station names come from ESI in phase 3.
    map: (r) => [int(r._key), int(r.solarSystemID), int(r.typeID), int(r.ownerID), int(r.operationID)],
  },
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
];

const BY_NAME = new Map<SdeTableName, SdeTable>(SDE_TABLE_DEFS.map((d) => [d.table, d]));

export function tableDef(table: SdeTableName): SdeTable {
  const def = BY_NAME.get(table);
  if (!def) throw new Error(`no SdeTable definition for ${table}`);
  return def;
}
