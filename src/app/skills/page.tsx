import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getAttributes, getSkillSummary, listSkillQueue, listSkills } from "../../lib/db/character-skills.js";
import { getClones, listImplants } from "../../lib/db/character-clones.js";
import { listPlans } from "../../lib/db/skill-plans.js";
import { getGroups, getTypeAttributes, getTypes, listCareerPlans } from "../../lib/sde/repo.js";
import { summarisePlans } from "../../lib/skills/load.js";
import { locationLabels } from "../../lib/names/index.js";
import { pickActive } from "../../lib/view/characters.js";
import { duration, relativeTime, roman, sp, stamp } from "../../lib/view/format.js";
import { attributeViews, groupSkills, implantBonusLabel, queueProgress, remapAvailability } from "../../lib/view/skills.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { SkillSummaryCard } from "./SkillSummaryCard.js";
import { QueueTable, type QueueEntryView } from "./QueueTable.js";
import { SkillGroups, type SkillGroupProps } from "./SkillGroups.js";
import { ClonesCard, type ImplantView, type JumpCloneView } from "./ClonesCard.js";
import { PlansCard, type PlanListRow } from "./PlansCard.js";

export default async function SkillsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skills" />;

  const now = new Date();
  const [summary, attributes, queue, skills, implantIds, clones, storedPlans, templates] = await Promise.all([
    getSkillSummary(character.id),
    getAttributes(character.id),
    listSkillQueue(character.id),
    listSkills(character.id),
    listImplants(character.id),
    getClones(character.id),
    listPlans(character.id),
    listCareerPlans(),
  ]);

  // One types query for every id on the page: sheet skills, queue skills, active implants and every
  // jump clone's implants. Then one groups query, one dogma query per implant (at most ten) and one
  // locationLabels pass for the home station plus every jump clone.
  const jumpImplantIds = (clones?.jumpClones ?? []).flatMap((c) => c.implants);
  const types = await getTypes([...new Set([
    ...skills.map((s) => s.skillId), ...queue.map((q) => q.skillId), ...implantIds, ...jumpImplantIds,
  ])]);
  const groupIds = [...new Set([...types.values()].map((t) => t.groupId).filter((id): id is number => id !== null))];
  const placeIds = [
    ...(clones?.homeLocationId == null ? [] : [clones.homeLocationId]),
    ...(clones?.jumpClones ?? []).map((c) => c.locationId).filter((id): id is number => id !== null),
  ];
  const [groups, implantAttributes, places] = await Promise.all([
    getGroups(groupIds),
    Promise.all(implantIds.map((id) => getTypeAttributes(id))),
    locationLabels(placeIds),
  ]);

  const entries: QueueEntryView[] = queue.map((q, index) => ({
    position: q.queuePosition + 1,
    skill: types.get(q.skillId)?.name ?? `Skill ${q.skillId}`,
    level: roman(q.finishedLevel),
    start: stamp(q.startDate),
    finish: stamp(q.finishDate),
    progress: index === 0 ? queueProgress(q, now) : null,
  }));

  const groupProps: SkillGroupProps[] = groupSkills(skills, types, groups).map((group) => ({
    groupId: group.groupId,
    name: group.name,
    groupSp: sp(group.groupSp),
    skills: group.skills.map((skill) => ({
      skillId: skill.skillId, name: skill.name,
      trainedLevel: skill.trainedLevel, activeLevel: skill.activeLevel, sp: sp(skill.skillpoints),
    })),
  }));

  const planRows: PlanListRow[] = (await summarisePlans(storedPlans)).map((plan) => ({
    id: plan.id,
    name: plan.name,
    entries: plan.entryCount,
    remaining: duration(plan.totalMs),
    doneAt: stamp(plan.doneAt),
  }));

  const implants: ImplantView[] = implantIds.map((typeId, index) => ({
    typeId,
    name: types.get(typeId)?.name ?? `Type ${typeId}`,
    bonus: implantBonusLabel(implantAttributes[index]),
  }));

  const jumpClones: JumpCloneView[] = (clones?.jumpClones ?? []).map((clone) => ({
    jumpCloneId: clone.jumpCloneId,
    label: clone.locationId === null ? "Unknown location" : places.get(clone.locationId)?.name ?? "Unknown location",
    name: clone.name,
    implants: clone.implants.map((typeId) => types.get(typeId)?.name ?? `Type ${typeId}`),
  }));

  return (<>
    <h1 className="page-title">Skills</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <SkillSummaryCard
        totalSp={summary === null ? null : sp(summary.totalSp)}
        unallocatedSp={summary?.unallocatedSp == null ? null : sp(summary.unallocatedSp)}
        attributes={attributes === null ? [] : attributeViews(attributes, implantAttributes)}
        bonusRemaps={attributes?.bonusRemaps ?? null}
        lastRemap={attributes?.lastRemapDate == null ? null : relativeTime(attributes.lastRemapDate, now)}
        remapAvailable={attributes === null ? null : remapAvailability(attributes, now)}
      />
      <div className="card">
        <h2 className="card-title">Training queue</h2>
        <QueueTable entries={entries} />
      </div>
      <PlansCard
        characterId={character.id}
        plans={planRows}
        templates={templates.map((t) => ({ id: t.id, name: t.name ?? `Plan ${t.id}` }))}
      />
      <div className="card">
        <h2 className="card-title">Skills</h2>
        <SkillGroups groups={groupProps} />
      </div>
      <ClonesCard
        home={clones?.homeLocationId == null ? null : places.get(clones.homeLocationId)?.name ?? null}
        implants={implants}
        jumpClones={jumpClones}
      />
    </div>
  </>);
}
