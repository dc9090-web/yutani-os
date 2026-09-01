import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import {
  replaceSkills, type AttributesInput, type SkillQueueRow, type SkillRow, type SkillsWrite,
} from "../../lib/db/character-skills.js";

export const SKILLS_INTERVAL_MS = 60 * 60 * 1000;
export const SKILLS_RETRY_MS = 10 * 60 * 1000;
const SKILLS_SCOPE = "esi-skills.read_skills.v1";        // also covers /attributes
const QUEUE_SCOPE = "esi-skills.read_skillqueue.v1";

interface EsiSkill { skill_id: number; trained_skill_level: number; active_skill_level: number; skillpoints_in_skill: number }
interface EsiSkills { total_sp: number; unallocated_sp?: number; skills: EsiSkill[] }
interface EsiQueueEntry {
  skill_id: number; finished_level: number; queue_position: number;
  start_date?: string; finish_date?: string;
  level_start_sp?: number; level_end_sp?: number; training_start_sp?: number;
}
interface EsiAttributes {
  charisma: number; intelligence: number; memory: number; perception: number; willpower: number;
  bonus_remaps?: number; last_remap_date?: string; accrued_remap_cooldown_date?: string;
}

export interface SkillsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceSkills: (characterId: number, w: SkillsWrite) => Promise<number>;
  now?: () => number;
}

const date = (v: string | undefined): Date | null => (v === undefined ? null : new Date(v));
const nullable = (v: number | undefined): number | null => (v === undefined ? null : v);

function toQueueRow(e: EsiQueueEntry): SkillQueueRow {
  return {
    queuePosition: e.queue_position, skillId: e.skill_id, finishedLevel: e.finished_level,
    startDate: date(e.start_date), finishDate: date(e.finish_date),
    levelStartSp: nullable(e.level_start_sp), levelEndSp: nullable(e.level_end_sp),
    trainingStartSp: nullable(e.training_start_sp),
  };
}

function toAttributes(a: EsiAttributes): AttributesInput {
  return {
    charisma: a.charisma, intelligence: a.intelligence, memory: a.memory,
    perception: a.perception, willpower: a.willpower,
    bonusRemaps: nullable(a.bonus_remaps), lastRemapDate: date(a.last_remap_date),
    accruedRemapCooldownDate: date(a.accrued_remap_cooldown_date),
  };
}

/**
 * CCP: "/skills can be out-of-date if the character hasn't logged in since one or more skills
 * completed training … entries that are in the past need to be applied on top of this list."
 * Without this a character who trained overnight shows stale skills indefinitely.
 */
export function applyQueueOverlay(skills: SkillRow[], queue: SkillQueueRow[], nowMs: number): SkillRow[] {
  const bySkill = new Map(skills.map((s) => [s.skillId, { ...s }]));
  for (const q of [...queue].sort((a, b) => a.queuePosition - b.queuePosition)) {
    if (q.finishDate === null || q.finishDate.getTime() > nowMs) continue;
    const current = bySkill.get(q.skillId) ?? { skillId: q.skillId, trainedLevel: 0, activeLevel: 0, skillpoints: 0 };
    bySkill.set(q.skillId, {
      skillId: q.skillId,
      trainedLevel: q.finishedLevel,
      activeLevel: Math.max(current.activeLevel, q.finishedLevel),
      skillpoints: q.levelEndSp ?? current.skillpoints,
    });
  }
  return [...bySkill.values()].sort((a, b) => a.skillId - b.skillId);
}

export function createSkillsJob(deps: SkillsJobDeps): CharacterSyncJob {
  const now = deps.now ?? Date.now;
  return {
    name: "skills",
    intervalMs: SKILLS_INTERVAL_MS,
    retryMs: SKILLS_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      const canSkills = hasScope(character, SKILLS_SCOPE);
      const canQueue = hasScope(character, QUEUE_SCOPE);
      if (!canSkills && !canQueue) return 0;

      // The queue comes first: the overlay needs it, and /skillqueue is a bare array, not paginated.
      const queue = canQueue
        ? (await esi.get<EsiQueueEntry[]>(`/characters/${characterId}/skillqueue`, { characterId })).data.map(toQueueRow)
        : null;

      let summary: SkillsWrite["summary"] = null;
      let skills: SkillRow[] | null = null;
      let attributes: AttributesInput | null = null;
      if (canSkills) {
        const sheet = (await esi.get<EsiSkills>(`/characters/${characterId}/skills`, { characterId })).data;
        const attrs = (await esi.get<EsiAttributes>(`/characters/${characterId}/attributes`, { characterId })).data;
        summary = { totalSp: sheet.total_sp, unallocatedSp: nullable(sheet.unallocated_sp) };
        skills = applyQueueOverlay(sheet.skills.map((s) => ({
          skillId: s.skill_id, trainedLevel: s.trained_skill_level,
          activeLevel: s.active_skill_level, skillpoints: s.skillpoints_in_skill,
        })), queue ?? [], now());
        attributes = toAttributes(attrs);
      }
      return deps.replaceSkills(characterId, { summary, skills, queue, attributes });
    },
  };
}

export const skillsJob: CharacterSyncJob = createSkillsJob({ getCharacter, replaceSkills });
