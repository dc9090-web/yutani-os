"use client";
import { useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

export interface SkillGroupProps {
  groupId: number;
  name: string;
  groupSp: string;
  skills: { skillId: number; name: string; trainedLevel: number; activeLevel: number; sp: string }[];
}

/** Five boxes: solid up to the active level, dim for levels trained but not currently active. */
function LevelBoxes({ trained, active }: { trained: number; active: number }) {
  return (
    <span className="level-boxes" aria-label={`Trained level ${trained}, active level ${active}`}>
      {[1, 2, 3, 4, 5].map((level) => (
        <span key={level} className={`level-box${level <= active ? " active" : level <= trained ? " trained" : ""}`} />
      ))}
    </span>
  );
}

export function SkillGroups({ groups }: { groups: SkillGroupProps[] }) {
  const [open, setOpen] = useState<number[]>([]);
  if (groups.length === 0) return <p className="faint">Not synced yet — the skills job runs hourly.</p>;
  const toggle = (groupId: number) =>
    setOpen((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  return (
    <div>
      {groups.map((group) => {
        const expanded = open.includes(group.groupId);
        return (
          <div key={group.groupId} className="skill-group">
            <button type="button" className="group-toggle" aria-expanded={expanded} onClick={() => toggle(group.groupId)}>
              {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <span>{group.name}</span>
              <span className="group-sp">{group.skills.length} skills · {group.groupSp}</span>
            </button>
            {expanded ? (
              <table className="table">
                <tbody>
                  {group.skills.map((skill) => (
                    <tr key={skill.skillId}>
                      <td>{skill.name}</td>
                      <td><LevelBoxes trained={skill.trainedLevel} active={skill.activeLevel} /></td>
                      <td className="muted num">{skill.sp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
