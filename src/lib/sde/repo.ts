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

const TYPE_COLS = `id, group_id AS "groupId", name, description, published,
  market_group_id AS "marketGroupId", meta_group_id AS "metaGroupId", meta_level AS "metaLevel",
  tech_level AS "techLevel", mass, volume, packaged_volume AS "packagedVolume", capacity,
  base_price AS "basePrice", icon_id AS "iconId", graphic_id AS "graphicId", race_id AS "raceId",
  faction_id AS "factionId", portion_size AS "portionSize",
  variation_parent_type_id AS "variationParentTypeId"`;

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
