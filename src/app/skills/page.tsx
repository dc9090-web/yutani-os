import Link from "next/link";
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadSkills, loadTraining, loadTrainingOverview } from "../../lib/pages/skills.js";
import { pickActive } from "../../lib/view/characters.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { Tabs } from "../components/Tabs.js";
import { QueueCountdown } from "./QueueCountdown.js";
import { QueueTable } from "./QueueTable.js";
import { TrainedSkills } from "./TrainedSkills.js";
import { TrainingOverview } from "./TrainingOverview.js";
import { BlockLegend } from "./Legend.js";

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
  const [overview, sheet, training] = await Promise.all([
    loadTrainingOverview(characters, now), loadSkills(character.id, now), loadTraining(character.id, now),
  ]);
  const { entries } = training;
  // The raw queues are for the phone; the tab draws only the finished view, so they stay server-side.
  const queues = overview.characters.map(({ queue: _queue, synced: _synced, ...view }) => view);

  const picker = <CharacterPicker characters={characters} activeId={character.id} />;

  return (
    <Tabs title="Skills" label="Skills views" tabs={[
      {
        id: "overview", label: "Overview",
        lead: <p className="page-sub">All characters</p>,
        content: <TrainingOverview characters={queues} all={overview.all} />,
      },
      {
        id: "skills", label: "Skills", lead: picker,
        content: <div className="sk-sheet"><TrainedSkills groups={sheet.groups} queueLength={sheet.queueLength} /></div>,
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
                    finishAt={training.finishAt === null ? null : Date.parse(training.finishAt)}
                    initial={training.eta}
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
