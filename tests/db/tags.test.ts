import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createTag, deleteTag, listTags, setCharacterTags, tagsByCharacter } from "../../src/lib/db/tags.js";

let pool: Pool;
const CID = 669539978;
const CID2 = 95465499;

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });
beforeEach(async () => {
  await pool.query("TRUNCATE character_tags RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE characters CASCADE");
  await pool.query(
    `INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'TrilliumONE', 'enc'), ($2, 'Second', 'enc')`,
    [CID, CID2]);
});

describe("the tags repo", () => {
  it("creates and lists tags ordered by name", async () => {
    await createTag("Scanner");
    await createTag("Miner");
    expect((await listTags()).map((t) => t.name)).toEqual(["Miner", "Scanner"]);
  });

  it("round-trips a tag", async () => {
    const created = await createTag("Hauler");
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Hauler");
    const [found] = await listTags();
    expect(found).toEqual(created);
  });

  it("rejects a duplicate name via the unique constraint", async () => {
    await createTag("Miner");
    await expect(createTag("Miner")).rejects.toMatchObject({ code: "23505" });
  });

  it("deletes a tag", async () => {
    const tag = await createTag("Temp");
    await deleteTag(tag.id);
    expect(await listTags()).toEqual([]);
  });

  it("assigns tags wholesale and reads them back sorted, one query for every character", async () => {
    const miner = await createTag("Miner");
    const scanner = await createTag("Scanner");
    const hauler = await createTag("Hauler");
    await setCharacterTags(CID, [scanner.id, miner.id]);
    await setCharacterTags(CID2, [hauler.id]);
    const byChar = await tagsByCharacter();
    expect(byChar.get(CID)).toEqual(["Miner", "Scanner"]);
    expect(byChar.get(CID2)).toEqual(["Hauler"]);
  });

  it("replaces a character's tags wholesale", async () => {
    const miner = await createTag("Miner");
    const scanner = await createTag("Scanner");
    await setCharacterTags(CID, [miner.id]);
    await setCharacterTags(CID, [scanner.id]);
    expect((await tagsByCharacter()).get(CID)).toEqual(["Scanner"]);
  });

  it("clears a character's tags when given an empty list", async () => {
    const miner = await createTag("Miner");
    await setCharacterTags(CID, [miner.id]);
    await setCharacterTags(CID, []);
    expect((await tagsByCharacter()).get(CID)).toBeUndefined();
  });

  it("cascades the tag map when a character is deleted", async () => {
    const miner = await createTag("Miner");
    await setCharacterTags(CID, [miner.id]);
    await pool.query("DELETE FROM characters WHERE id = $1", [CID]);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM character_tag_map WHERE character_id = $1", [CID]);
    expect(rows[0].n).toBe(0);
  });

  it("cascades the tag map when a tag is deleted", async () => {
    const miner = await createTag("Miner");
    await setCharacterTags(CID, [miner.id]);
    await deleteTag(miner.id);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM character_tag_map WHERE character_id = $1", [CID]);
    expect(rows[0].n).toBe(0);
  });
});
