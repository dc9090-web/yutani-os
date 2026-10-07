"use client";
import { IconArrowDown, IconArrowUp, IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import type { PlanRowView } from "../../lib/view/plan.js";

export interface PlanTableProps {
  rows: PlanRowView[];
  /** Always a row's `entryIndex` — an index into the STORED entries, never a display index. */
  onMove(entryIndex: number, direction: -1 | 1): void;
  onRemove(entryIndex: number): void;
  onLevel(entryIndex: number, delta: -1 | 1): void;
}

export function PlanTable({ rows, onMove, onRemove, onLevel }: PlanTableProps) {
  if (rows.length === 0) return <p className="faint">No entries yet — add a skill to start planning.</p>;
  // The last STORED entry present, so "move down" is disabled on it and not on the last display row.
  const lastEntryIndex = rows.reduce((max, r) => Math.max(max, r.entryIndex ?? -1), -1);
  return (
    <table className="table plan-table">
      <thead>
        <tr>
          <th>#</th><th>Skill</th><th>Level</th><th>Rank</th><th>SP</th>
          <th>Time</th><th>Total</th><th>Done</th><th>Status</th><th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const name = `${row.skill} ${row.level}`;
          const at = row.entryIndex;
          return (
            <tr key={`${row.skillId}:${row.levelNumber}`} className={row.prereq ? "prereq" : undefined}>
              <td className="muted">{row.position}</td>
              <td>
                <span>{row.skill}</span>
                {row.prereq ? <span className="badge prereq-badge">prereq</span> : null}
                {row.alpha ? <span className="badge alpha">alpha</span> : null}
                {row.group === null ? null : <span className="faint plan-group">{row.group}</span>}
                {row.note === null ? null : <div className="faint">{row.note}</div>}
              </td>
              <td>{row.level}</td>
              <td className="num">{row.rank}</td>
              <td className="num">{row.sp}</td>
              <td className="num">{row.time}</td>
              <td className="num">{row.cumulative}</td>
              <td className="muted">{row.doneAt}</td>
              <td><span className={`badge ${row.status}`}>{row.statusLabel}</span></td>
              <td className="plan-actions">
                {at === null ? null : (<>
                  <button type="button" className="icon-btn" aria-label={`Lower ${name}`}
                          disabled={row.levelNumber <= 1} onClick={() => onLevel(at, -1)}>
                    <IconMinus size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Raise ${name}`}
                          disabled={row.levelNumber >= 5} onClick={() => onLevel(at, 1)}>
                    <IconPlus size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${name} up`}
                          disabled={at === 0} onClick={() => onMove(at, -1)}>
                    <IconArrowUp size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${name} down`}
                          disabled={at === lastEntryIndex} onClick={() => onMove(at, 1)}>
                    <IconArrowDown size={14} />
                  </button>
                  <button type="button" className="icon-btn danger" aria-label={`Remove ${name}`}
                          onClick={() => onRemove(at)}>
                    <IconTrash size={14} />
                  </button>
                </>)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
