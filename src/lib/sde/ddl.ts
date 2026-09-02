/**
 * The single source of truth for the sde_* DDL.
 *
 * `scripts/migrate.ts` applies sdeDdl("public"); the importer applies sdeDdl("sde_import") to
 * build a staging copy, so the live and staging shapes cannot drift. `sde_meta` is emitted only
 * for `public` — the staging schema never holds provenance.
 *
 * There are deliberately no foreign keys: reference data is swapped wholesale on import.
 *
 * Contract: nothing may reference sde_* objects (no views, FKs or materialised views) — query
 * them, never depend on them. import.ts drops and replaces every sde_* table wholesale on each
 * run; anything defined on top of them (a view, an FK pointing at them) would be dropped with the
 * old table before the new one takes its place.
 */

export const SDE_TABLES = [
  "sde_categories",
  "sde_groups",
  "sde_types",
  "sde_races",
  "sde_market_groups",
  "sde_meta_groups",
  "sde_dogma_units",
  "sde_dogma_attribute_categories",
  "sde_dogma_attributes",
  "sde_dogma_effects",
  "sde_dogma_effect_modifiers",
  "sde_type_attributes",
  "sde_type_effects",
  "sde_type_bonuses",
  "sde_regions",
  "sde_constellations",
  "sde_solar_systems",
  "sde_stations",
  "sde_alpha_skills",
  "sde_skill_plans",
] as const;

export type SdeTableName = (typeof SDE_TABLES)[number];

const TABLE_BODIES: Record<SdeTableName, string> = {
  sde_categories: `
    id        int PRIMARY KEY,
    name      text,
    published boolean,
    icon_id   int`,
  sde_groups: `
    id                     int PRIMARY KEY,
    category_id            int,
    name                   text,
    published              boolean,
    icon_id                int,
    anchorable             boolean,
    anchored               boolean,
    fittable_non_singleton boolean,
    use_base_price         boolean`,
  sde_types: `
    id                        int PRIMARY KEY,
    group_id                  int,
    name                      text,
    description               text,
    published                 boolean,
    market_group_id           int,
    meta_group_id             int,
    meta_level                int,
    tech_level                int,
    race_id                   int,
    faction_id                int,
    icon_id                   int,
    graphic_id                int,
    mass                      float8,
    volume                    float8,
    packaged_volume           float8,
    capacity                  float8,
    radius                    float8,
    base_price                float8,
    portion_size              int,
    variation_parent_type_id  int`,
  sde_races: `
    id   int PRIMARY KEY,
    name text`,
  sde_market_groups: `
    id          int PRIMARY KEY,
    parent_id   int,
    name        text,
    description text,
    has_types   boolean,
    icon_id     int`,
  sde_meta_groups: `
    id          int PRIMARY KEY,
    name        text,
    icon_suffix text`,
  sde_dogma_units: `
    id           int PRIMARY KEY,
    name         text,
    display_name text,
    description  text`,
  sde_dogma_attribute_categories: `
    id          int PRIMARY KEY,
    name        text,
    description text`,
  sde_dogma_attributes: `
    id                int PRIMARY KEY,
    name              text,
    display_name      text,
    description       text,
    category_id       int,
    unit_id           int,
    data_type         int,
    default_value     float8,
    high_is_good      boolean,
    stackable         boolean,
    published         boolean,
    display_when_zero boolean,
    icon_id           int,
    max_attribute_id  int,
    min_attribute_id  int`,
  sde_dogma_effects: `
    id                                 int PRIMARY KEY,
    name                               text,
    display_name                       text,
    description                        text,
    effect_category_id                 int,
    is_offensive                       boolean,
    is_assistance                      boolean,
    is_warp_safe                       boolean,
    disallow_auto_repeat               boolean,
    published                          boolean,
    duration_attribute_id              int,
    discharge_attribute_id             int,
    range_attribute_id                 int,
    falloff_attribute_id               int,
    tracking_speed_attribute_id        int,
    resistance_attribute_id            int,
    fitting_usage_chance_attribute_id  int`,
  sde_dogma_effect_modifiers: `
    effect_id              int NOT NULL,
    idx                    int NOT NULL,
    domain                 text,
    func                   text,
    modified_attribute_id  int,
    modifying_attribute_id int,
    operation              int,
    skill_type_id          int,
    group_id               int,
    stopped_effect_id      int,
    PRIMARY KEY (effect_id, idx)`,
  sde_type_attributes: `
    type_id      int NOT NULL,
    attribute_id int NOT NULL,
    value        float8,
    PRIMARY KEY (type_id, attribute_id)`,
  sde_type_effects: `
    type_id    int NOT NULL,
    effect_id  int NOT NULL,
    is_default boolean,
    PRIMARY KEY (type_id, effect_id)`,
  sde_type_bonuses: `
    type_id       int NOT NULL,
    idx           int NOT NULL,
    kind          text CHECK (kind IN ('skill', 'role', 'misc')),
    skill_type_id int,
    importance    int,
    bonus         float8,
    bonus_text    text,
    unit_id       int,
    PRIMARY KEY (type_id, idx)`,
  sde_regions: `
    id   int PRIMARY KEY,
    name text`,
  sde_constellations: `
    id        int PRIMARY KEY,
    region_id int,
    name      text`,
  sde_solar_systems: `
    id               int PRIMARY KEY,
    constellation_id int,
    region_id        int,
    name             text,
    security_status  float8,
    security_class   text`,
  sde_stations: `
    id             int PRIMARY KEY,
    solar_system_id int,
    type_id        int,
    owner_id       int,
    operation_id   int`,
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
};

const INDEXES: { name: string; table: SdeTableName; expr: string }[] = [
  { name: "sde_types_group_idx", table: "sde_types", expr: "(group_id)" },
  { name: "sde_types_market_group_idx", table: "sde_types", expr: "(market_group_id)" },
  { name: "sde_types_name_lower_idx", table: "sde_types", expr: "(lower(name))" },
  { name: "sde_groups_category_idx", table: "sde_groups", expr: "(category_id)" },
  { name: "sde_type_attributes_attribute_idx", table: "sde_type_attributes", expr: "(attribute_id)" },
  { name: "sde_solar_systems_region_idx", table: "sde_solar_systems", expr: "(region_id)" },
  { name: "sde_stations_system_idx", table: "sde_stations", expr: "(solar_system_id)" },
];

const META_DDL = `CREATE TABLE IF NOT EXISTS public.sde_meta (
    id           int PRIMARY KEY CHECK (id = 1),
    build_number int NOT NULL,
    release_date timestamptz NOT NULL,
    imported_at  timestamptz NOT NULL DEFAULT now()
  )`;

/**
 * Idempotent DDL for the sde_* tables in `schema`. Index names are unqualified because a
 * Postgres index always lives in its table's schema, and they travel with the table on
 * `ALTER TABLE … SET SCHEMA` — which is exactly what the importer's swap relies on.
 */
export function sdeDdl(schema: string): string[] {
  const out: string[] = [];
  if (schema === "public") out.push(META_DDL);
  for (const table of SDE_TABLES) {
    out.push(`CREATE TABLE IF NOT EXISTS ${schema}.${table} (${TABLE_BODIES[table]}\n  )`);
  }
  for (const idx of INDEXES) {
    out.push(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${schema}.${idx.table} ${idx.expr}`);
  }
  return out;
}
