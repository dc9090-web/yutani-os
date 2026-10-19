import { getPool } from "./client.js";

/** The Multiview tab's characters, in display order; empty when it has never been set up. */
export async function listMultiview(): Promise<number[]> {
  const { rows } = await getPool().query<{ characterId: string }>(
    `SELECT character_id AS "characterId" FROM multiview_characters ORDER BY position`);
  return rows.map((r) => Number(r.characterId));
}

/** Wholesale replace, transactional like `tags.ts`'s `setCharacterTags` — position is the index. */
export async function setMultiview(characterIds: number[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM multiview_characters");
    if (characterIds.length > 0) {
      await client.query(
        `INSERT INTO multiview_characters (character_id, position)
         SELECT id, ord - 1 FROM unnest($1::bigint[]) WITH ORDINALITY AS t(id, ord)`,
        [characterIds]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
