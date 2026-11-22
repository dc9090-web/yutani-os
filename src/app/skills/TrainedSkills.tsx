import { InfoButton, InfoGroup, InfoPanel } from "../components/Info.js";
import { LevelBlocks, skillBlocks } from "../components/LevelBlocks.js";
import { BlockLegend } from "./Legend.js";

export interface SheetSkillProps {
  skillId: number;
  name: string;
  /** The skill's SDE description for the info panel (`typeDescription()`); null when the SDE has none. */
  desc: string | null;
  level: number;
  activeLevel: number;
  queued: number;
  training: boolean;
  /** The stored sheet's levels, before the live queue was laid over them. */
  trainedLevel?: number;
  trainedActiveLevel?: number;
}
export interface SheetGroupProps {
  groupId: number;
  name: string;
  /** "6.1M" — the unit is added here. */
  groupSp: string;
  queued: number;
  skills: SheetSkillProps[];
}

function blockLabel(skill: SheetSkillProps): string {
  const base = skill.activeLevel === skill.level ? `Level ${skill.level} of 5` : `Trained level ${skill.level} of 5, active level ${skill.activeLevel}`;
  if (skill.queued === 0) return base;
  return `${base}, ${skill.training ? "training" : "queued"} to level ${skill.level + skill.queued}`;
}

/**
 * The Skills tab (redesign hand-off, `Skills.dc.html`, "All groups" layout): every skill group as a
 * full-width panel, skills four across. Each row is level blocks, the level digit, the name and an
 * info button that opens the skill's description inline. Queued levels are amber outlines; the one
 * in training is tinted, pulses and carries a TRAINING tag. Untrained skills are dimmed unless
 * queued.
 */
export function TrainedSkills({ groups, queueLength }: { groups: SheetGroupProps[]; queueLength: number }) {
  if (groups.length === 0) return <p className="yo-empty">Not synced yet — the skills job runs hourly.</p>;
  return (
    <InfoGroup>
      <BlockLegend untrained>
        <span className="yo-legend-end">{queueLength} level{queueLength === 1 ? "" : "s"} in queue</span>
      </BlockLegend>
      {groups.map((group) => (
        <section key={group.groupId} className="yo-card">
          <div className="yo-card-head is-ruled">
            <h2 className="yo-card-title">{group.name}</h2>
            <span className="yo-card-meta yo-mono">
              {group.skills.length} skill{group.skills.length === 1 ? "" : "s"} · {group.groupSp} SP
              {group.queued > 0 ? <span className="sk-queued"> · {group.queued} level{group.queued === 1 ? "" : "s"} queued</span> : null}
            </span>
          </div>
          <div className="sk-grid">
            {group.skills.map((skill) => {
              const id = `skill-${skill.skillId}`;
              return (
                <div key={skill.skillId} className="sk-cell">
                  <div className="sk-row">
                    <LevelBlocks states={skillBlocks(skill.level, skill.queued, skill.training)} label={blockLabel(skill)} />
                    <span className="sk-level" aria-hidden="true">{skill.level}</span>
                    <span className={`sk-name${skill.level === 0 && skill.queued === 0 ? " is-untrained" : ""}`} title={skill.name}>{skill.name}</span>
                    {skill.desc === null ? null : <InfoButton id={id} name={skill.name} />}
                    {skill.activeLevel < skill.level ? <span className="yo-flag is-muted">ACTIVE {skill.activeLevel}</span> : null}
                    {skill.training ? <span className="yo-flag">TRAINING</span> : null}
                  </div>
                  {skill.desc === null ? null : <InfoPanel id={id}>{skill.desc}</InfoPanel>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </InfoGroup>
  );
}
