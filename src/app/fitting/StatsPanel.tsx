"use client";
import { roman } from "../../lib/view/format.js";
import type { BonusView } from "../../lib/view/fit-sheet.js";
import type { EditorView } from "../../lib/fits/editor-view.js";
import { Gauge } from "../ships/Gauge.js";
import { ShipStats } from "../ships/ShipStats.js";

const DASH = "—";

/**
 * Spec §4's stats panel, reordered per the design hand-back (part D): Fitting (gauges, counters, the
 * estimated value merged in, and — Task 5b — a `.badge` in the title reporting capacitor stability) →
 * Ship stats (the fitting window's panel, shared with the fit sheet as `ShipStats`) → Problems
 * (red-tinted `.card-problems` with the count in the title) → Missing skills → Ship bonuses.
 */
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
        <h2 className="card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Fitting
          {view.perf.capStable === DASH ? null : (
            <span className={`badge ${view.perf.capStableOk ? "ok" : "warn"}`}>{view.perf.capStable}</span>
          )}
        </h2>
        {view.gauges.map((g) => <Gauge key={g.label} view={g} />)}
        <div className="counters">
          {view.counters.map((counter) => (
            <span key={counter.label} className={`counter${counter.over ? " over" : ""}`}>
              <span className="counter-label">{counter.label}</span>
              <span className="num">{counter.used} / {counter.total}</span>
            </span>
          ))}
        </div>
        <div className="fit-value">
          <span className="stat-label">Estimated value</span>
          <span className="stat-value">{view.value.total}</span>
          {view.value.unpriced === null ? null : <span className="faint">{view.value.unpriced}</span>}
        </div>
      </div>

      <ShipStats stats={view.stats} />

      <div className={`card${view.problems.length > 0 ? " card-problems" : ""}`}>
        <h2 className="card-title">
          Problems{view.problems.length > 0 ? <span className="neg"> {view.problems.length}</span> : null}
        </h2>
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
