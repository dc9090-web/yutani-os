import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getAttributes, getSkillSummary, listSkillQueue } from "../../lib/db/character-skills.js";
import { listImplants } from "../../lib/db/character-clones.js";
import { getTypeAttributes, getTypes } from "../../lib/sde/repo.js";
import { pickActive } from "../../lib/view/characters.js";
import { relativeTime, roman, sp } from "../../lib/view/format.js";
import { attributeViews, queueProgress } from "../../lib/view/skills.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { SkillSummaryCard } from "./SkillSummaryCard.js";
import { QueueTable, type QueueEntryView } from "./QueueTable.js";

/** "2026-08-31 18:30" — the timestamp format the settings tables already use. */
function stamp(date: Date | null): string {
  return date === null ? "—" : date.toISOString().replace("T", " ").slice(0, 16);
}

export default async function SkillsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skills" />;

  const now = new Date();
  const [summary, attributes, queue, implantIds] = await Promise.all([
    getSkillSummary(character.id),
    getAttributes(character.id),
    listSkillQueue(character.id),
    listImplants(character.id),
  ]);

  // One types query for the queue's skills and the implants; one dogma query per implant (a clone
  // holds at most ten), never one per row.
  const types = await getTypes([...new Set([...queue.map((q) => q.skillId), ...implantIds])]);
  const implantAttributes = await Promise.all(implantIds.map((id) => getTypeAttributes(id)));

  const entries: QueueEntryView[] = queue.map((q, index) => ({
    position: q.queuePosition + 1,
    skill: types.get(q.skillId)?.name ?? `Skill ${q.skillId}`,
    level: roman(q.finishedLevel),
    start: stamp(q.startDate),
    finish: stamp(q.finishDate),
    progress: index === 0 ? queueProgress(q, now) : null,
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
        remapAvailable={attributes?.accruedRemapCooldownDate == null ? null : relativeTime(attributes.accruedRemapCooldownDate, now)}
      />
      <div className="card">
        <h2 className="card-title">Training queue</h2>
        <QueueTable entries={entries} />
      </div>
    </div>
  </>);
}
