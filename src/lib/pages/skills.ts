import type { Character } from "../db/characters.js";
import { getSkillSummary, listSkillQueue, listSkills } from "../db/character-skills.js";
import { getLocation } from "../db/character-location.js";
import { listMultiview } from "../db/multiview.js";
import { getGroups, getTypes } from "../sde/repo.js";
import { getConfig } from "../config.js";
import { multiviewCharacters } from "../view/characters.js";
import { countdown, duration, sp, typeDescription } from "../view/format.js";
import { groupSkills, liveQueue, queueProgress, sheetGroups } from "../view/skills.js";
import { trainingQueueView, type TrainingQueueView } from "../view/training-overview.js";
import type { QueueEntryView } from "../../app/skills/QueueTable.js";
import type { SheetGroupProps } from "../../app/skills/TrainedSkills.js";
import { iso, rawQueue, type RawQueueEntry } from "./raw.js";

const nameMap = (types: ReadonlyMap<number, { name: string | null }>): Map<number, string> =>
  new Map([...types].map(([id, t]) => [id, t.name ?? `Skill ${id}`]));

export interface SkillsData {
  /**
   * Each skill's `level`, `activeLevel`, `queued` and `training`, and each group's `queued`, are
   * the sheet with the live queue laid over it (`sheetGroups`), so they move as queued levels
   * finish. Raw: the skill's `trainedLevel` / `trainedActiveLevel` and `queue` below.
   */
  groups: SheetGroupProps[];
  /** Entries in the live queue. Raw: `queue`. */
  queueLength: number;
  queue: RawQueueEntry[];
}

/** The Skills tab: the grouped skill sheet with the training queue laid over it. */
export async function loadSkills(characterId: number, now: Date): Promise<SkillsData> {
  const [storedQueue, skills] = await Promise.all([listSkillQueue(characterId), listSkills(characterId)]);
  const queue = liveQueue(storedQueue, now);
  const types = await getTypes([...new Set([...skills.map((s) => s.skillId), ...storedQueue.map((q) => q.skillId)])]);
  const groupIds = [...new Set([...types.values()].map((t) => t.groupId).filter((id): id is number => id !== null))];
  const groups = await getGroups(groupIds);

  const sheet = groupSkills(skills, types, groups);
  return {
    groups: sheetGroups(sheet, queue).map((group, groupIndex) => ({
      groupId: group.groupId,
      name: group.name,
      groupSp: sp(group.groupSp, false),
      queued: group.queued,
      skills: group.skills.map((skill, index) => ({
        ...skill,
        desc: typeDescription(types.get(skill.skillId)?.description),
        // `sheetGroups` keeps `groupSkills`' order, so the stored levels sit at the same index.
        trainedLevel: sheet[groupIndex].skills[index].trainedLevel,
        trainedActiveLevel: sheet[groupIndex].skills[index].activeLevel,
      })),
    })),
    queueLength: queue.length,
    queue: rawQueue(storedQueue, nameMap(types)),
  };
}

export interface TrainingData {
  /**
   * The live queue. `position`, `remaining` and `progress` are worked out against the clock, and an
   * entry leaves the list when it finishes. Raw: each entry's `startAt`, `finishAt` and SP bounds.
   */
  entries: QueueEntryView[];
  /** When the last entry finishes, ISO-8601 UTC; null for an empty or paused queue. */
  finishAt: string | null;
  /** `countdown()` to `finishAt` at the time of asking; "—" when there is nothing to count to. */
  eta: string;
}

/** The Training tab: the character's live queue, the head with its progress. */
export async function loadTraining(characterId: number, now: Date): Promise<TrainingData> {
  const queue = liveQueue(await listSkillQueue(characterId), now);
  const types = await getTypes([...new Set(queue.map((q) => q.skillId))]);

  // Only the head of an active queue is in training; a paused head has no finish date.
  const headActive = queue.length > 0 && queue[0].finishDate !== null;
  const entries: QueueEntryView[] = queue.map((q, index) => {
    // Time still to train: the head entry counts from now, a queued one from its (future) start.
    const remainingMs = q.startDate !== null && q.finishDate !== null
      ? q.finishDate.getTime() - Math.max(q.startDate.getTime(), now.getTime())
      : null;
    return {
      position: index + 1,
      skillId: q.skillId,
      skill: types.get(q.skillId)?.name ?? `Skill ${q.skillId}`,
      // The SDE's skill blurb carries the per-level bonus ("2% bonus to … per skill level").
      desc: typeDescription(types.get(q.skillId)?.description),
      targetLevel: q.finishedLevel,
      remaining: remainingMs === null ? "—" : duration(remainingMs),
      progress: index === 0 && headActive ? queueProgress(q, now) : null,
      startAt: iso(q.startDate), finishAt: iso(q.finishDate),
      levelStartSp: q.levelStartSp, levelEndSp: q.levelEndSp, trainingStartSp: q.trainingStartSp,
    };
  });

  const finalFinish = queue.length > 0 ? queue[queue.length - 1].finishDate : null;
  return {
    entries,
    finishAt: iso(finalFinish),
    eta: finalFinish === null ? "—" : countdown(finalFinish.getTime() - now.getTime()),
  };
}

/**
 * One character on Skills › Overview. `status`, `progress`, `count`, `rows` and `truncated` are
 * worked out against the clock (`trainingQueueView` over the live queue). Raw: `synced` and `queue`.
 */
export interface TrainingOverviewCharacter extends TrainingQueueView { synced: boolean; queue: RawQueueEntry[] }

export interface TrainingOverviewData {
  characters: TrainingOverviewCharacter[];
  /** Every character, for the editor that chooses which ones the tab shows. */
  all: { id: number; name: string }[];
}

/** Skills › Overview: every chosen character's queue, in the saved order. */
export async function loadTrainingOverview(characters: readonly Character[], now: Date): Promise<TrainingOverviewData> {
  const multiview = await listMultiview();
  // Three repo reads per character, all in flight together, like the Overview page.
  const chosen = await Promise.all(multiviewCharacters(characters, multiview, getConfig().overviewCharacterIds).map(async (c) => {
    const [stored, summary, location] = await Promise.all([listSkillQueue(c.id), getSkillSummary(c.id), getLocation(c.id)]);
    return { id: c.id, name: c.name, online: location?.online ?? null, synced: summary !== null, stored, queue: liveQueue(stored, now) };
  }));
  const names = nameMap(await getTypes([...new Set(chosen.flatMap((c) => c.stored.map((q) => q.skillId)))]));
  return {
    characters: chosen.map((c) => ({ ...trainingQueueView(c, names, now), synced: c.synced, queue: rawQueue(c.stored, names) })),
    all: characters.map((c) => ({ id: c.id, name: c.name })),
  };
}
