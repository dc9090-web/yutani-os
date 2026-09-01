import type { FitSheetView, EntryView } from "../../lib/view/fit-sheet.js";
import { roman } from "../../lib/view/format.js";
import { AffectedBy } from "./AffectedBy.js";
import { Gauge } from "./Gauge.js";

function EntryList({ entries }: { entries: EntryView[] }) {
  return (
    <ul className="entry-list">
      {entries.map((entry) => (
        <li key={entry.key}>
          <span>{entry.name} ×{entry.quantity}</span>
          <span className="num muted">{entry.value ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Spec §4's fit sheet. Every value here was computed on the server by `buildFitSheet`. */
export function FitSheet({ view }: { view: FitSheetView }) {
  const holdEmpty = view.cargo.length === 0 && view.drones.length === 0;
  return (
    <div className="card-stack">
      <div className="card fit-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.renderUrl} alt="" className="fit-render" />
        <div>
          <h1 className="page-title">{view.title}</h1>
          <p className="page-sub">{view.typeName} · {view.subtitle}</p>
          <ul className="bonus-list">
            {view.bonuses.map((bonus, index) => (
              <li key={index}>
                {bonus.skill === null ? null : (
                  <span className="bonus-skill">{bonus.skill} {roman(bonus.level ?? 0)}</span>
                )}
                <span>{bonus.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {view.skillsSynced ? null : (
        <p className="card banner">
          No skills synced yet — every skill is treated as level 0, so these numbers are worst case.
        </p>
      )}

      <div className="card">
        <h2 className="card-title">Fitting</h2>
        {view.gauges.map((gauge) => <Gauge key={gauge.label} view={gauge} />)}
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
        <h2 className="card-title">Modules</h2>
        <div className="slot-cols">
          {view.slots.map((column) => (
            <div key={column.slot} className="slot-col">
              <h3 className="slot-title">{column.title} <span className="faint">{column.used} / {column.total}</span></h3>
              {column.rows.length === 0 ? <p className="faint">Empty</p> : (
                <table className="table">
                  <tbody>
                    {column.rows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="module-icon" src={`https://images.evetech.net/types/${row.typeId}/icon?size=32`} alt="" />
                          {row.name}
                          {row.charge === null ? null : <span className="charge faint"> · {row.charge}</span>}
                        </td>
                        <td className="num"><AffectedBy label="CPU" value={row.cpu} rows={row.cpuExplain} /></td>
                        <td className="num"><AffectedBy label="Powergrid" value={row.power} rows={row.powerExplain} /></td>
                        <td className="muted">{row.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
        <h2 className="card-title">Cargo &amp; drones</h2>
        {holdEmpty ? <p className="faint">Nothing in the cargo hold or drone bay.</p> : (
          <>
            {view.drones.length === 0 ? null : <><h3 className="slot-title">Drone bay</h3><EntryList entries={view.drones} /></>}
            {view.cargo.length === 0 ? null : <><h3 className="slot-title">Cargo</h3><EntryList entries={view.cargo} /></>}
          </>
        )}
        {view.unknown.length === 0 ? null : (
          <>
            <h3 className="slot-title">Unknown types</h3>
            <p className="faint">The static data does not know these types, so they are excluded from the calculation.</p>
            <EntryList entries={view.unknown} />
          </>
        )}
        {view.unfittable.length === 0 ? null : (
          <>
            <h3 className="slot-title">Not fitted</h3>
            <p className="faint">Saved with no slot, so the fitting window would not place them either.</p>
            <EntryList entries={view.unfittable} />
          </>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Estimated value</h2>
        <ul className="value-list">
          {view.value.lines.map((line) => (
            <li key={line.label}><span>{line.label}</span><span className="num">{line.value}</span></li>
          ))}
          <li className="value-total"><span>Total</span><span className="num">{view.value.total}</span></li>
        </ul>
        {view.value.unpriced === null ? null : <p className="faint">{view.value.unpriced}</p>}
      </div>
    </div>
  );
}
