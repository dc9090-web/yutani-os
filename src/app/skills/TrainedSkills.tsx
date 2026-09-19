export interface TrainedSkillGroupProps {
  groupId: number;
  name: string;
  groupSp: string;
  /** `desc` is the skill's SDE description as hover text (`typeDescription()`); null when the SDE has none. */
  skills: { skillId: number; name: string; desc: string | null; trainedLevel: number; activeLevel: number }[];
}

/**
 * Five boxes: solid up to the active level, dim for levels trained but not currently active (alpha
 * clone downgrade, an Expert System boost gone). The two are equal for almost every skill, in which
 * case the label collapses to the design hand-back's plain "Level N" — the fuller "Trained level X,
 * active level Y" only shows up when there is something to explain.
 */
function LevelBoxes({ trained, active }: { trained: number; active: number }) {
  const label = trained === active ? `Level ${active}` : `Trained level ${trained}, active level ${active}`;
  return (
    <span className="level-boxes" aria-label={label}>
      {[1, 2, 3, 4, 5].map((level) => (
        <span key={level} className={`level-box${level <= active ? " active" : level <= trained ? " trained" : ""}`} />
      ))}
    </span>
  );
}

/**
 * The Skills page's "Trained skills" tab (design hand-back): every group always expanded, in a
 * multi-column layout — `.skill-group-list` > `.skill-group-flat` > `.group-head` + `.skill-grid` >
 * `.skill-cell`. Replaces the old collapsible `SkillGroups` rendering on this page; that component
 * is left in place (its own tests still pass) since nothing else uses it yet.
 */
export function TrainedSkills({ groups }: { groups: TrainedSkillGroupProps[] }) {
  if (groups.length === 0) return <p className="faint">Not synced yet — the skills job runs hourly.</p>;
  return (
    <div className="skill-group-list">
      {groups.map((group) => (
        <div key={group.groupId} className="skill-group-flat">
          <div className="group-head">
            <span>{group.name}</span>
            <span className="group-sp">{group.skills.length} skills · {group.groupSp}</span>
          </div>
          <div className="skill-grid">
            {group.skills.map((skill) => (
              <div key={skill.skillId} className="skill-cell">
                <span data-desc={skill.desc ?? undefined}>{skill.name}</span>
                <LevelBoxes trained={skill.trainedLevel} active={skill.activeLevel} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
