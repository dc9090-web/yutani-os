import Link from "next/link";
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getSkillSummary, listSkillQueue, listSkills } from "../../lib/db/character-skills.js";
import { listMultiview } from "../../lib/db/multiview.js";
import { getGroups, getTypes } from "../../lib/sde/repo.js";
import { multiviewCharacters, pickActive } from "../../lib/view/characters.js";
import { getConfig } from "../../lib/config.js";
import { countdown, duration, sp, typeDescription } from "../../lib/view/format.js";
import { groupSkills, liveQueue, queueProgress, sheetGroups } from "../../lib/view/skills.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { Tabs } from "../components/Tabs.js";
import { QueueCountdown } from "./QueueCountdown.js";
import { QueueTable, type QueueEntryView } from "./QueueTable.js";
import { TrainedSkills, type SheetGroupProps } from "./TrainedSkills.js";
import { TrainingOverview } from "./TrainingOverview.js";
import { BlockLegend } from "./Legend.js";
import { getLocation } from "../../lib/db/character-location.js";
import { trainingQueueView } from "../../lib/view/training-overview.js";

/**
 * Skills (redesign hand-off, PAGES.md §2): three tabs beside the title. Overview — every chosen
 * character's queue, the default — then Skills and Training for the active character, picked with
 * the dropdown under the title. The old summary panel (total SP, unallocated SP, attributes) and
 * the Plans card are gone from this page at the owner's request; skill plans live at /skills/plans.
 */
export default async function SkillsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skills" />;

  const now = new Date();
  const [summary, storedQueue, skills, multiview] = await Promise.all([
    getSkillSummary(character.id),
    listSkillQueue(character.id),
    listSkills(character.id),
    listMultiview(),
  ]);
  const queue = liveQueue(storedQueue, now);

  // The Overview tab reads each chosen character's queue, summary (synced or not) and online flag —
  // three repo reads per character, all in flight together, like the Overview page.
  const others = await Promise.all(multiviewCharacters(characters, multiview, getConfig().overviewCharacterIds).map(async (c) => {
    const [otherQueue, otherSummary, location] = c.id === character.id
      ? [storedQueue, summary, await getLocation(c.id)]
      : await Promise.all([listSkillQueue(c.id), getSkillSummary(c.id), getLocation(c.id)]);
    return { id: c.id, name: c.name, online: location?.online ?? null, synced: otherSummary !== null, queue: liveQueue(otherQueue, now) };
  }));

  // One types query for every id on the page — sheet skills and every character's queue skills —
  // then one groups query.
  const types = await getTypes([...new Set([
    ...skills.map((s) => s.skillId), ...others.flatMap((o) => o.queue.map((q) => q.skillId)), ...queue.map((q) => q.skillId),
  ])]);
  const skillNames = new Map([...types].map(([id, t]) => [id, t.name ?? `Skill ${id}`]));
  const overview = others.map((o) => trainingQueueView(o, skillNames, now));
  const groupIds = [...new Set([...types.values()].map((t) => t.groupId).filter((id): id is number => id !== null))];
  const groups = await getGroups(groupIds);

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
    };
  });

  const finalFinish = queue.length > 0 ? queue[queue.length - 1].finishDate : null;
  const queueEtaMs = finalFinish === null ? null : finalFinish.getTime() - now.getTime();

  const groupProps: SheetGroupProps[] = sheetGroups(groupSkills(skills, types, groups), queue).map((group) => ({
    groupId: group.groupId,
    name: group.name,
    groupSp: sp(group.groupSp, false),
    queued: group.queued,
    skills: group.skills.map((skill) => ({ ...skill, desc: typeDescription(types.get(skill.skillId)?.description) })),
  }));

  const picker = <CharacterPicker characters={characters} activeId={character.id} />;

  return (
    <Tabs title="Skills" label="Skills views" tabs={[
      {
        id: "overview", label: "Overview",
        lead: <p className="page-sub">All characters</p>,
        content: <TrainingOverview characters={overview} all={characters.map((c) => ({ id: c.id, name: c.name }))} />,
      },
      {
        id: "skills", label: "Skills", lead: picker,
        content: <div className="sk-sheet"><TrainedSkills groups={groupProps} queueLength={queue.length} /></div>,
      },
      {
        id: "training", label: "Training", lead: picker,
        content: (
          <section className="yo-card tr-card" aria-label="Training queue">
            <div className="yo-card-head">
              <h2 className="yo-card-title">Training queue</h2>
              {entries.length === 0 ? null : (
                <span className="yo-card-meta">
                  {entries.length} skill{entries.length === 1 ? "" : "s"} · all trained in{" "}
                  <QueueCountdown
                    finishAt={finalFinish === null ? null : finalFinish.getTime()}
                    initial={queueEtaMs === null ? "—" : countdown(queueEtaMs)}
                  />
                </span>
              )}
            </div>
            <BlockLegend>
              <Link href="/skills/plans" className="yo-legend-end tr-plans">Skill plans</Link>
            </BlockLegend>
            <QueueTable entries={entries} />
          </section>
        ),
      },
    ]} />
  );
}
