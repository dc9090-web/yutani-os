import { getPool } from "../db/client.js";

export interface SdeType {
  id: number; groupId: number | null; name: string | null; description: string | null; published: boolean | null;
  marketGroupId: number | null; metaGroupId: number | null; metaLevel: number | null; techLevel: number | null;
  mass: number | null; volume: number | null; packagedVolume: number | null; capacity: number | null;
  basePrice: number | null; iconId: number | null; graphicId: number | null; raceId: number | null;
  factionId: number | null; portionSize: number | null; variationParentTypeId: number | null;
}
export interface SdeMetaCounts { types: number; dogmaAttributes: number; dogmaEffects: number; solarSystems: number }
export interface SdeMeta { buildNumber: number; releaseDate: Date; importedAt: Date; counts: SdeMetaCounts }
export interface SdeGroup { id: number; categoryId: number | null; name: string | null; published: boolean | null }
export interface SdeSolarSystem {
  id: number; constellationId: number | null; regionId: number | null;
  name: string | null; securityStatus: number | null; securityClass: string | null;
}
export interface SdeRegion { id: number; name: string | null }
export interface SdeStation {
  id: number; solarSystemId: number | null; typeId: number | null; ownerId: number | null; operationId: number | null;
}
export interface SdeTypeEffect { effectId: number; isDefault: boolean | null }
export interface SdeSkillRequirement { skillTypeId: number; level: number }
export interface SdeTypeBonus {
  idx: number; kind: "skill" | "role" | "misc" | null; skillTypeId: number | null;
  importance: number | null; bonus: number | null; bonusText: string | null; unitId: number | null;
}

const TYPE_COLS = `id, group_id AS "groupId", name, description, published,
  market_group_id AS "marketGroupId", meta_group_id AS "metaGroupId", meta_level AS "metaLevel",
  tech_level AS "techLevel", mass, volume, packaged_volume AS "packagedVolume", capacity,
  base_price AS "basePrice", icon_id AS "iconId", graphic_id AS "graphicId", race_id AS "raceId",
  faction_id AS "factionId", portion_size AS "portionSize",
  variation_parent_type_id AS "variationParentTypeId"`;

const GROUP_COLS = `id, category_id AS "categoryId", name, published`;

/** requiredSkill / requiredSkillLevel attribute pairs. */
const SKILL_ATTRIBUTE_PAIRS: readonly [number, number][] = [
  [182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288],
];

export async function getSdeMeta(): Promise<SdeMeta | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ buildNumber: number; releaseDate: Date; importedAt: Date }>(
    `SELECT build_number AS "buildNumber", release_date AS "releaseDate", imported_at AS "importedAt"
     FROM sde_meta WHERE id = 1`);
  if (!rows[0]) return null;
  const { rows: counts } = await pool.query<Record<keyof SdeMetaCounts, string>>(
    `SELECT (SELECT count(*) FROM sde_types)            AS "types",
            (SELECT count(*) FROM sde_dogma_attributes) AS "dogmaAttributes",
            (SELECT count(*) FROM sde_dogma_effects)    AS "dogmaEffects",
            (SELECT count(*) FROM sde_solar_systems)    AS "solarSystems"`);
  return {
    buildNumber: rows[0].buildNumber,
    releaseDate: rows[0].releaseDate,
    importedAt: rows[0].importedAt,
    counts: {
      types: Number(counts[0].types),
      dogmaAttributes: Number(counts[0].dogmaAttributes),
      dogmaEffects: Number(counts[0].dogmaEffects),
      solarSystems: Number(counts[0].solarSystems),
    },
  };
}

export async function getType(id: number): Promise<SdeType | null> {
  const { rows } = await getPool().query<SdeType>(`SELECT ${TYPE_COLS} FROM sde_types WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getTypes(ids: number[]): Promise<Map<number, SdeType>> {
  if (ids.length === 0) return new Map();
  const { rows } = await getPool().query<SdeType>(
    `SELECT ${TYPE_COLS} FROM sde_types WHERE id = ANY($1::int[])`, [ids]);
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Case-insensitive substring search over published types, name-ascending.
 * `strpos` rather than ILIKE so a query containing `%` or `_` is matched literally.
 */
export async function searchTypes(query: string, opts: { categoryId?: number; limit?: number } = {}): Promise<SdeType[]> {
  const { rows } = await getPool().query<SdeType>(
    `SELECT ${TYPE_COLS} FROM sde_types t
     WHERE t.published
       AND strpos(lower(t.name), lower($1)) > 0
       AND ($2::int IS NULL OR t.group_id IN (SELECT id FROM sde_groups WHERE category_id = $2))
     ORDER BY t.name
     LIMIT $3`,
    [query, opts.categoryId ?? null, opts.limit ?? 20]);
  return rows;
}

export async function getTypeAttributes(typeId: number): Promise<Map<number, number>> {
  const { rows } = await getPool().query<{ attribute_id: number; value: number | null }>(
    "SELECT attribute_id, value FROM sde_type_attributes WHERE type_id = $1", [typeId]);
  const out = new Map<number, number>();
  for (const r of rows) if (r.value !== null) out.set(r.attribute_id, r.value);
  return out;
}

export async function getTypeEffects(typeId: number): Promise<SdeTypeEffect[]> {
  const { rows } = await getPool().query<SdeTypeEffect>(
    `SELECT effect_id AS "effectId", is_default AS "isDefault"
     FROM sde_type_effects WHERE type_id = $1 ORDER BY effect_id`, [typeId]);
  return rows;
}

/** Skill requirements live in typeDogma as attribute pairs; the values are floats, so round them. */
export async function getSkillRequirements(typeId: number): Promise<SdeSkillRequirement[]> {
  const attrs = await getTypeAttributes(typeId);
  const out: SdeSkillRequirement[] = [];
  for (const [skillAttr, levelAttr] of SKILL_ATTRIBUTE_PAIRS) {
    const skill = attrs.get(skillAttr);
    const level = attrs.get(levelAttr);
    if (skill === undefined || level === undefined) continue;
    const skillTypeId = Math.round(skill);
    if (skillTypeId <= 0) continue;
    out.push({ skillTypeId, level: Math.round(level) });
  }
  return out;
}

export async function getSolarSystem(id: number): Promise<SdeSolarSystem | null> {
  const { rows } = await getPool().query<SdeSolarSystem>(
    `SELECT id, constellation_id AS "constellationId", region_id AS "regionId", name,
            security_status AS "securityStatus", security_class AS "securityClass"
     FROM sde_solar_systems WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getRegion(id: number): Promise<SdeRegion | null> {
  const { rows } = await getPool().query<SdeRegion>("SELECT id, name FROM sde_regions WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function getStation(id: number): Promise<SdeStation | null> {
  const { rows } = await getPool().query<SdeStation>(
    `SELECT id, solar_system_id AS "solarSystemId", type_id AS "typeId",
            owner_id AS "ownerId", operation_id AS "operationId"
     FROM sde_stations WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

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

/**
 * A hull's traits (spec §4): the per-skill bonuses first, in the SDE's own order, then role and misc
 * bonuses. `bonus_text` is CCP's English string and still carries `showinfo` anchors — see
 * `bonusLabel` in `src/lib/view/ships.ts` for the display side.
 */
export async function getTypeBonuses(typeId: number): Promise<SdeTypeBonus[]> {
  const { rows } = await getPool().query<SdeTypeBonus>(
    `SELECT idx, kind, skill_type_id AS "skillTypeId", importance, bonus,
            bonus_text AS "bonusText", unit_id AS "unitId"
     FROM sde_type_bonuses WHERE type_id = $1 ORDER BY idx`, [typeId]);
  return rows;
}

export interface SdeBrowseType {
  id: number; name: string | null; groupId: number | null; categoryId: number | null;
  marketGroupId: number | null; metaGroupId: number | null; metaLevel: number | null;
}
export interface BrowseOptions { q?: string; categoryIds?: number[]; marketGroupId?: number; limit?: number }
export interface SdeMarketGroup { id: number; parentId: number | null; name: string | null; hasTypes: boolean | null }

/**
 * The fitting designer's item browser (spec §4). Distinct from `searchTypes`, which the Skills page
 * uses and whose signature must not change. Published types only; name-ascending.
 */
export async function browseTypes(opts: BrowseOptions): Promise<SdeBrowseType[]> {
  const { rows } = await getPool().query<SdeBrowseType>(
    `SELECT t.id, t.name, t.group_id AS "groupId", g.category_id AS "categoryId",
            t.market_group_id AS "marketGroupId", t.meta_group_id AS "metaGroupId",
            t.meta_level AS "metaLevel"
     FROM sde_types t LEFT JOIN sde_groups g ON g.id = t.group_id
     WHERE t.published
       AND ($1::text IS NULL OR strpos(lower(t.name), lower($1)) > 0)
       AND ($2::int[] IS NULL OR g.category_id = ANY($2::int[]))
       AND ($3::int IS NULL OR t.market_group_id = $3)
     ORDER BY t.name, t.id
     LIMIT $4`,
    [opts.q ?? null, opts.categoryIds ?? null, opts.marketGroupId ?? null, opts.limit ?? 50]);
  return rows;
}

/** The whole market-group tree — 2,106 rows the client assembles into parents and children. */
export async function listMarketGroups(): Promise<SdeMarketGroup[]> {
  const { rows } = await getPool().query<SdeMarketGroup>(
    `SELECT id, parent_id AS "parentId", name, has_types AS "hasTypes"
     FROM sde_market_groups ORDER BY id`);
  return rows;
}

/** metaGroupId → "Tech II" etc., for the badge on a browser row. */
export async function getMetaGroups(): Promise<Map<number, string>> {
  const { rows } = await getPool().query<{ id: number; name: string | null }>(
    "SELECT id, name FROM sde_meta_groups ORDER BY id");
  return new Map(rows.filter((r) => r.name !== null).map((r) => [r.id, r.name as string]));
}

/** Lower-cased name → type id, for EFT import (spec §5: exact, case-insensitive). */
export async function getTypesByNames(names: string[]): Promise<Map<string, number>> {
  const wanted = [...new Set(names.map((n) => n.trim().toLowerCase()))].filter((n) => n !== "");
  if (wanted.length === 0) return new Map();
  const { rows } = await getPool().query<{ key: string; id: number }>(
    `SELECT lower(name) AS key, id FROM sde_types WHERE lower(name) = ANY($1::text[])`, [wanted]);
  return new Map(rows.map((r) => [r.key, r.id]));
}
