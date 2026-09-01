/**
 * The planner's server-side glue. THIS IS THE ONLY MODULE UNDER src/lib/skills THAT TOUCHES
 * POSTGRES — everything else in this directory is pure and isomorphic. A "use client" component
 * must never import it; server components and API routes are its only callers.
 */
import { accountQueueEnds, getAttributes, listSkillQueue, listSkills } from "../db/character-skills.js";
import { listImplants } from "../db/character-clones.js";
import { getCharacter } from "../db/characters.js";
import type { PlanEntryRow, PlanRow } from "../db/skill-plans.js";
import { getAlphaSkills, getTypeAttributes, listPlanSkills } from "../sde/repo.js";
import {
  addAttributes, effectiveAttributes, implantBonuses, isLegalBase, type AttributeSet,
} from "./attributes.js";
import { buildCatalogue, catalogueFrom, type PlanSkill } from "./catalogue.js";
import { expandPlan, type ExpandedEntry } from "./expand.js";
import { currentSpInTraining } from "./sp.js";
import { planTimeline, type Timeline } from "./timeline.js";

/** EVE's displayed baseline: 20 everywhere except charisma at 19. 20*4 + 19 = 99. */
export const DEFAULT_BASE_ATTRIBUTES: AttributeSet =
  { charisma: 19, intelligence: 20, memory: 20, perception: 20, willpower: 20 };

/** Every trainable skill with its rank, attribute pair, prerequisites and Alpha cap. */
export async function loadSkillCatalogue(): Promise<PlanSkill[]> {
  const [rows, alpha] = await Promise.all([listPlanSkills(), getAlphaSkills()]);
  return buildCatalogue(rows, alpha);
}

export interface PlanContext {
  characterId: number; characterName: string;
  base: AttributeSet; implantBonus: AttributeSet; effective: AttributeSet;
  attributesSane: boolean;
  trained: Map<number, number>;
  partialSp: Map<number, number>;
  queued: Map<number, number>;
  queueEndsAt: Date | null;
  bonusRemaps: number | null;
  lastRemapDate: Date | null;
  accruedRemapCooldownDate: Date | null;
  synced: boolean;
}

export async function loadPlanContext(characterId: number): Promise<PlanContext> {
  const now = new Date();
  const [character, attributes, skills, queue, implantIds] = await Promise.all([
    getCharacter(characterId), getAttributes(characterId), listSkills(characterId),
    listSkillQueue(characterId), listImplants(characterId),
  ]);
  const implantAttributes = await Promise.all(implantIds.map((id) => getTypeAttributes(id)));

  const base: AttributeSet = attributes === null ? DEFAULT_BASE_ATTRIBUTES : {
    charisma: attributes.charisma, intelligence: attributes.intelligence, memory: attributes.memory,
    perception: attributes.perception, willpower: attributes.willpower,
  };
  const implantBonus = implantBonuses(implantAttributes);

  const trained = new Map<number, number>();
  const partialSp = new Map<number, number>();
  for (const skill of skills) {
    trained.set(skill.skillId, skill.trainedLevel);
    partialSp.set(skill.skillId, skill.skillpoints);
  }

  const queued = new Map<number, number>();
  let queueEndsAt: Date | null = null;
  for (const entry of queue) {
    const highest = queued.get(entry.skillId) ?? 0;
    if (entry.finishedLevel > highest) queued.set(entry.skillId, entry.finishedLevel);
    if (entry.finishDate !== null && (queueEndsAt === null || entry.finishDate > queueEndsAt)) {
      queueEndsAt = entry.finishDate;
    }
  }
  // ESI's /skills is stale until the character logs in, so the head entry's own dates give a
  // fresher SP figure for the skill it is training (EVEMon QueuedSkill.CurrentSP).
  const head = queue.find((q) => q.queuePosition === 0);
  if (head !== undefined) {
    const live = currentSpInTraining(head, now);
    if (live !== null && live > (partialSp.get(head.skillId) ?? 0)) partialSp.set(head.skillId, live);
  }

  return {
    characterId,
    characterName: character?.name ?? `Character ${characterId}`,
    base, implantBonus, effective: effectiveAttributes(base, implantAttributes),
    // Decision 4: spec §2 says the stored values exclude implants. Report a reading that cannot be
    // a legal base — never silently subtract, because that would hide the real problem.
    attributesSane: attributes === null || isLegalBase(base),
    trained, partialSp, queued, queueEndsAt,
    bonusRemaps: attributes?.bonusRemaps ?? null,
    lastRemapDate: attributes?.lastRemapDate ?? null,
    accruedRemapCooldownDate: attributes?.accruedRemapCooldownDate ?? null,
    synced: skills.length > 0,
  };
}

export interface AccountBlock { characterId: number; name: string; until: Date }

/** Spec §5: "Reacher-9 is training until <date> — this plan can't start before then". */
export async function accountTrainingBlock(
  characterId: number, now: Date = new Date(),
): Promise<AccountBlock | null> {
  const ends = await accountQueueEnds(characterId);
  const blocking = ends.filter((e) => e.endsAt.getTime() > now.getTime());
  if (blocking.length === 0) return null;
  const latest = blocking.reduce((a, b) => (b.endsAt > a.endsAt ? b : a));
  return { characterId: latest.characterId, name: latest.name, until: latest.endsAt };
}

export interface ComputeOptions { afterQueue?: boolean; remap?: AttributeSet | null; now?: Date }
export interface ComputedPlan {
  plan: PlanRow; context: PlanContext; catalogue: PlanSkill[];
  entries: ExpandedEntry[]; timeline: Timeline;
  attributes: AttributeSet;
  startAt: Date;
}

/**
 * The one place a plan turns into numbers. Spec §6: the server computes the timeline so the page
 * and the client agree — the editor recomputes locally only for instant feedback while editing,
 * using the very same pure functions on the very same catalogue.
 */
export async function computePlan(plan: PlanRow, opts: ComputeOptions = {}): Promise<ComputedPlan> {
  const now = opts.now ?? new Date();
  const [catalogue, context] = await Promise.all([
    loadSkillCatalogue(), loadPlanContext(plan.characterId),
  ]);
  const index = catalogueFrom(catalogue);

  const remap = opts.remap === undefined ? plan.remap : opts.remap;
  const attributes = addAttributes(remap ?? context.base, context.implantBonus);

  // A prerequisite level the queue will deliver counts as "will have" (spec §2).
  const known = new Map(context.trained);
  for (const [skillId, level] of context.queued) {
    if ((known.get(skillId) ?? 0) < level) known.set(skillId, level);
  }
  const entries = expandPlan(plan.entries, known, index);

  const startAt = opts.afterQueue === true && context.queueEndsAt !== null
    && context.queueEndsAt.getTime() > now.getTime()
    ? context.queueEndsAt
    : now;

  const timeline = planTimeline({
    entries, catalogue: index, attributes,
    trained: context.trained, queued: context.queued, partialSp: context.partialSp, startAt,
  });
  return { plan, context, catalogue, entries, timeline, attributes, startAt };
}

export interface PlanSummary {
  id: number; characterId: number; name: string; remap: AttributeSet | null;
  createdAt: Date; updatedAt: Date; entries: PlanEntryRow[];
  entryCount: number; totalSp: number; totalMs: number; doneAt: Date;
}

/**
 * The `/skills` Plans section and `GET /api/skill-plans`. Every plan in a list belongs to the same
 * character, so the catalogue and the context are read ONCE rather than once per plan.
 */
export async function summarisePlans(
  plans: readonly PlanRow[], opts: ComputeOptions = {},
): Promise<PlanSummary[]> {
  if (plans.length === 0) return [];
  const now = opts.now ?? new Date();
  const [catalogue, context] = await Promise.all([
    loadSkillCatalogue(), loadPlanContext(plans[0].characterId),
  ]);
  const index = catalogueFrom(catalogue);
  const known = new Map(context.trained);
  for (const [skillId, level] of context.queued) {
    if ((known.get(skillId) ?? 0) < level) known.set(skillId, level);
  }
  const startAt = opts.afterQueue === true && context.queueEndsAt !== null
    && context.queueEndsAt.getTime() > now.getTime() ? context.queueEndsAt : now;

  return plans.map((plan) => {
    const attributes = addAttributes(
      (opts.remap === undefined ? plan.remap : opts.remap) ?? context.base, context.implantBonus);
    const entries = expandPlan(plan.entries, known, index);
    const timeline = planTimeline({
      entries, catalogue: index, attributes,
      trained: context.trained, queued: context.queued, partialSp: context.partialSp, startAt,
    });
    return {
      id: plan.id, characterId: plan.characterId, name: plan.name, remap: plan.remap,
      createdAt: plan.createdAt, updatedAt: plan.updatedAt, entries: plan.entries,
      entryCount: entries.length, totalSp: timeline.totalSp, totalMs: timeline.totalMs,
      doneAt: timeline.doneAt,
    };
  });
}
