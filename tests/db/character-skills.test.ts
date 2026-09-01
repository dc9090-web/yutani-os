import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import {
  replaceSkills, getSkillSummary, listSkills, listSkillQueue, getAttributes,
  type SkillsWrite,
} from "../../src/lib/db/character-skills.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const write: SkillsWrite = {
  summary: { totalSp: 47382910, unallocatedSp: 210000 },
  skills: [
    { skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 },
    { skillId: 3327, trainedLevel: 4, activeLevel: 3, skillpoints: 45255 },
  ],
  queue: [
    { queuePosition: 0, skillId: 3426, finishedLevel: 4, startDate: new Date("2026-08-30T12:00:00Z"), finishDate: new Date("2026-08-31T18:30:00Z"), levelStartSp: 8000, levelEndSp: 45255, trainingStartSp: 8000 },
    { queuePosition: 1, skillId: 24311, finishedLevel: 3, startDate: null, finishDate: null, levelStartSp: null, levelEndSp: null, trainingStartSp: null },
  ],
  attributes: { charisma: 20, intelligence: 24, memory: 21, perception: 20, willpower: 21, bonusRemaps: 2, lastRemapDate: new Date("2025-11-14T09:12:33Z"), accruedRemapCooldownDate: null },
};

describe("character-skills repo", () => {
  it("writes summary, skills, queue and attributes and returns the row count", async () => {
    expect(await replaceSkills(CID, write)).toBe(6);            // 1 summary + 2 skills + 2 queue + 1 attributes
    expect(await getSkillSummary(CID)).toMatchObject({ characterId: CID, totalSp: 47382910, unallocatedSp: 210000 });
    expect(await listSkills(CID)).toEqual(write.skills);
    const queue = await listSkillQueue(CID);
    expect(queue.map((q) => q.queuePosition)).toEqual([0, 1]);
    expect(queue[1].startDate).toBeNull();
    expect(queue[1].finishDate).toBeNull();
    expect(queue[1].levelEndSp).toBeNull();
    expect(await getAttributes(CID)).toMatchObject({ intelligence: 24, bonusRemaps: 2, accruedRemapCooldownDate: null });
  });
  it("replaces wholesale: skills and queue entries that vanished are gone", async () => {
    await replaceSkills(CID, write);
    await replaceSkills(CID, { ...write, skills: [{ skillId: 3300, trainedLevel: 5, activeLevel: 5, skillpoints: 256000 }], queue: [] });
    expect((await listSkills(CID)).map((s) => s.skillId)).toEqual([3300]);
    expect(await listSkillQueue(CID)).toEqual([]);
  });
  it("leaves a section untouched when it was not synced (null)", async () => {
    await replaceSkills(CID, write);
    expect(await replaceSkills(CID, { summary: null, skills: null, queue: [], attributes: null })).toBe(0);
    expect((await listSkills(CID)).length).toBe(2);
    expect(await getAttributes(CID)).not.toBeNull();
    expect(await listSkillQueue(CID)).toEqual([]);
  });
  it("returns null and empty lists for a character that has never synced", async () => {
    expect(await getSkillSummary(CID)).toBeNull();
    expect(await getAttributes(CID)).toBeNull();
    expect(await listSkills(CID)).toEqual([]);
    expect(await listSkillQueue(CID)).toEqual([]);
  });
  it("stores unallocated_sp as null when the character has none", async () => {
    await replaceSkills(CID, { ...write, summary: { totalSp: 100, unallocatedSp: null } });
    expect((await getSkillSummary(CID))!.unallocatedSp).toBeNull();
  });
});
