"use client";
import { roman } from "../../lib/view/format.js";
import type { BonusView } from "../../lib/view/fit-sheet.js";
import type { EditorView } from "../../lib/fits/editor-view.js";
import { Gauge } from "../ships/Gauge.js";

/** Spec §4's stats panel: gauges, counters, problems, missing skills, value and hull bonuses. */
export function StatsPanel({ view, bonuses, skillsSynced }: {
  view: EditorView; bonuses: BonusView[]; skillsSynced: boolean;
}) {
  return (
    <div className="card-stack">
      {skillsSynced ? null : (
        <p className="card banner">
          No skills synced yet — every skill is treated as level 0, so these numbers are worst case.
        </p>
      )}

      <div className="card">
        <h2 className="card-title">Fitting</h2>
        {view.gauges.map((g) => <Gauge key={g.label} view={g} />)}
        <div className="counters">
          {view.counters.map((counter) => (
            <span key={counter.label} className={`counter${counter.over ? " over" : ""}`}>
              <span className="counter-label">{counter.label}</span>
              <span className="num">{counter.used} / {counter.total}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Problems</h2>
        {view.problems.length === 0 ? <p className="faint">No problems — this fit is legal.</p> : (
          <ul className="problem-list">
            {view.problems.map((problem, index) => (
              <li key={index}><span className="badge error">{problem.label}</span> {problem.text}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Missing skills</h2>
        {view.missing.length === 0 ? <p className="faint">Every skill for this fit is trained.</p> : (
          <table className="table">
            <thead><tr><th>Skill</th><th className="num">Have → need</th></tr></thead>
            <tbody>
              {view.missing.map((skill) => (
                <tr key={skill.skillTypeId}>
                  <td>{skill.name}</td>
                  <td className="num">{skill.have} → {skill.need}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Estimated value</h2>
        <p className="stat-value">{view.value.total}</p>
        {view.value.unpriced === null ? null : <p className="faint">{view.value.unpriced}</p>}
      </div>

      <div className="card">
        <h2 className="card-title">Ship bonuses</h2>
        {bonuses.length === 0 ? <p className="faint">This hull has no listed bonuses.</p> : (
          <ul className="bonus-list">
            {bonuses.map((bonus, index) => (
              <li key={index}>
                {bonus.skill === null ? null : (
                  <span className="bonus-skill">{bonus.skill} {roman(bonus.level ?? 0)}</span>
                )}
                <span>{bonus.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
