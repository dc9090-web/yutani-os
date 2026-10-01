import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getAttributes, getSkillSummary, listSkillQueue, listSkills } from "../../lib/db/character-skills.js";
import { listImplants } from "../../lib/db/character-clones.js";
import { listPlans } from "../../lib/db/skill-plans.js";
import { getGroups, getTypeAttributes, getTypes, listCareerPlans } from "../../lib/sde/repo.js";
import { summarisePlans } from "../../lib/skills/load.js";
import { overviewCharacters, pickActive } from "../../lib/view/characters.js";
import { getConfig } from "../../lib/config.js";
import { countdown, duration, sp, stamp, typeDescription } from "../../lib/view/format.js";
import { attributeViews, groupSkills, liveQueue, queueProgress } from "../../lib/view/skills.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { SkillSummaryCard } from "./SkillSummaryCard.js";
import { QueueCountdown } from "./QueueCountdown.js";
import { QueueTable, type QueueEntryView } from "./QueueTable.js";
import { SkillTabs } from "./SkillTabs.js";
import { TrainedSkills, type TrainedSkillGroupProps } from "./TrainedSkills.js";
import { PlansCard, type PlanListRow } from "./PlansCard.js";
import { TrainingOverview } from "./TrainingOverview.js";
import { getLocation } from "../../lib/db/character-location.js";
import { trainingQueueView } from "../../lib/view/training-overview.js";

export default async function SkillsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skills" />;

  const now = new Date();
  const [summary, attributes, storedQueue, skills, implantIds, storedPlans, templates] = await Promise.all([
    getSkillSummary(character.id),
    getAttributes(character.id),
    listSkillQueue(character.id),
    listSkills(character.id),
    listImplants(character.id),
    listPlans(character.id),
    listCareerPlans(),
  ]);
  const queue = liveQueue(storedQueue, now);

  // The Training overview reads each configured character's queue, summary (synced or not) and
  // online flag — three repo reads per character, all in flight together, like the Overview page.
  const others = await Promise.all(overviewCharacters(characters, getConfig().overviewCharacterIds).map(async (c) => {
    const [otherQueue, otherSummary, location] = c.id === character.id
      ? [storedQueue, summary, await getLocation(c.id)]
      : await Promise.all([listSkillQueue(c.id), getSkillSummary(c.id), getLocation(c.id)]);
    return { id: c.id, name: c.name, online: location?.online ?? null, synced: otherSummary !== null, queue: liveQueue(otherQueue, now) };
  }));

  // One types query for every id on the page: sheet skills, every character's queue skills and the
  // active implants (for the attribute panel's bonus). Then one groups query and one dogma query
  // per implant (at most ten).
  const types = await getTypes([...new Set([
    ...skills.map((s) => s.skillId), ...others.flatMap((o) => o.queue.map((q) => q.skillId)), ...implantIds,
  ])]);
  const skillNames = new Map([...types].map(([id, t]) => [id, t.name ?? `Skill ${id}`]));
  const overview = others.map((o) => trainingQueueView(o, skillNames, now));
  const groupIds = [...new Set([...types.values()].map((t) => t.groupId).filter((id): id is number => id !== null))];
  const [groups, implantAttributes] = await Promise.all([
    getGroups(groupIds),
    Promise.all(implantIds.map((id) => getTypeAttributes(id))),
  ]);

  // Each queue entry trains one level of a skill, so the level it starts from is always one below
  // the level it finishes at — true for the head entry currently training and for every level of
  // the same skill queued behind it, without needing the character's (possibly stale) skill sheet.
  const entries: QueueEntryView[] = queue.map((q, index) => {
    // Time still to train: the head entry counts from now, a queued one from its (future) start.
    const remainingMs = q.startDate !== null && q.finishDate !== null
      ? q.finishDate.getTime() - Math.max(q.startDate.getTime(), now.getTime())
      : null;
    return {
      position: q.queuePosition + 1,
      skill: types.get(q.skillId)?.name ?? `Skill ${q.skillId}`,
      desc: typeDescription(types.get(q.skillId)?.description),
      trainedLevel: Math.max(0, q.finishedLevel - 1),
      targetLevel: q.finishedLevel,
      remaining: remainingMs === null ? "—" : duration(remainingMs),
      progress: index === 0 ? queueProgress(q, now) : null,
    };
  });

  const finalFinish = queue.length > 0 ? queue[queue.length - 1].finishDate : null;
  const queueEtaMs = finalFinish === null ? null : finalFinish.getTime() - now.getTime();

  const groupProps: TrainedSkillGroupProps[] = groupSkills(skills, types, groups).map((group) => ({
    groupId: group.groupId,
    name: group.name,
    groupSp: sp(group.groupSp),
    skills: group.skills.map((skill) => ({
      skillId: skill.skillId, name: skill.name,
      // The SDE's skill blurb carries the per-level bonus ("2% bonus to … per skill level"), so it
      // is the hover text on both this tab and the queue — the same pattern as the fit sheet.
      desc: typeDescription(types.get(skill.skillId)?.description),
      trainedLevel: skill.trainedLevel, activeLevel: skill.activeLevel,
    })),
  }));

  const planRows: PlanListRow[] = (await summarisePlans(storedPlans)).map((plan) => ({
    id: plan.id,
    name: plan.name,
    entries: plan.entryCount,
    remaining: duration(plan.totalMs),
    doneAt: stamp(plan.doneAt),
  }));

  return (<>
    <h1 className="page-title">Skills</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <SkillSummaryCard
        totalSp={summary === null ? null : sp(summary.totalSp)}
        unallocatedSp={summary?.unallocatedSp == null ? null : sp(summary.unallocatedSp)}
        attributes={attributes === null ? [] : attributeViews(attributes, implantAttributes)}
      />
      <TrainingOverview characters={overview} />
      <div className="card">
        <SkillTabs
          queue={<>
            {entries.length > 0 ? (
              <QueueCountdown
                finishAt={finalFinish === null ? null : finalFinish.getTime()}
                initial={queueEtaMs === null ? "—" : countdown(queueEtaMs)}
              />
            ) : null}
            <QueueTable entries={entries} />
          </>}
          trained={<TrainedSkills groups={groupProps} />}
        />
      </div>
      <PlansCard
        characterId={character.id}
        plans={planRows}
        templates={templates.map((t) => ({ id: t.id, name: t.name ?? `Plan ${t.id}` }))}
      />
    </div>
  </>);
}
