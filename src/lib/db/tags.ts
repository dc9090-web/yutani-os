import { getPool } from "./client.js";

export interface Tag { id: number; name: string }

export async function listTags(): Promise<Tag[]> {
  const { rows } = await getPool().query<Tag>("SELECT id, name FROM character_tags ORDER BY name");
  return rows;
}

export async function createTag(name: string): Promise<Tag> {
  const { rows } = await getPool().query<Tag>(
    "INSERT INTO character_tags (name) VALUES ($1) RETURNING id, name", [name]);
  return rows[0];
}

export async function deleteTag(id: number): Promise<void> {
  await getPool().query("DELETE FROM character_tags WHERE id = $1", [id]);
}

/** One query for the whole overview grid — names pre-sorted so callers never re-sort per row. */
export async function tagsByCharacter(): Promise<Map<number, string[]>> {
  const { rows } = await getPool().query<{ characterId: string; name: string }>(
    `SELECT m.character_id AS "characterId", t.name
     FROM character_tag_map m JOIN character_tags t ON t.id = m.tag_id
     ORDER BY m.character_id, t.name`);
  const byChar = new Map<number, string[]>();
  for (const row of rows) {
    const id = Number(row.characterId);
    const list = byChar.get(id);
    if (list) list.push(row.name); else byChar.set(id, [row.name]);
  }
  return byChar;
}

/** Wholesale replace, transactional like `fits.ts`'s `writeItems` — the map row set is what it is
 *  after this call, no partial state on the way. */
export async function setCharacterTags(characterId: number, tagIds: number[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM character_tag_map WHERE character_id = $1", [characterId]);
    if (tagIds.length > 0) {
      await client.query(
        `INSERT INTO character_tag_map (character_id, tag_id)
         SELECT $1, * FROM unnest($2::int[])`,
        [characterId, tagIds]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
