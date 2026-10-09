import { IconTargetOff } from "@tabler/icons-react";
import type { FitSheetView, EntryView, RangeBand, RangeCells } from "../../lib/view/fit-sheet.js";
import { roman } from "../../lib/view/format.js";
import { Gauge } from "./Gauge.js";
import { ShipStats } from "./ShipStats.js";

/** The Optimal and Falloff cells: blank for a row that is not ammo, a dash for a figure ammo does not have. */
function RangeCols({ range }: { range: RangeCells | null }) {
  return (<>
    <span className="num sheet-range">{range === null ? "" : range.optimal ?? "—"}</span>
    <span className="num sheet-range">{range === null ? "" : range.falloff ?? "—"}</span>
  </>);
}

/** Short / Medium / Long as a three-tick meter with the word, every pill the same width; a target-off glyph marks ammo that out-ranges the lock. */
function RangePill({ band }: { band: RangeBand | null }) {
  if (band === null) return <span />;
  return (
    <span className={`range-pill level-${band.level}`} data-desc={band.desc}>
      <i /><i /><i />
      <span className="range-pill-label">{band.label}</span>
      {/* Reaches further than the ship can lock: the pill still says Long, the glyph says why that matters. */}
      {band.beyond ? <IconTargetOff size={11} className="range-pill-beyond" aria-label="Further than this ship can lock" /> : null}
    </span>
  );
}

/** `icons` is off for the unknown-types list: the image server has nothing for a type the SDE lacks. */
function EntryList({ entries, icons = true }: { entries: EntryView[]; icons?: boolean }) {
  return (
    <ul className="entry-list sheet-entries">
      {entries.map((entry) => (
        <li key={entry.key}>
          <span className="sheet-entry" data-desc={entry.desc ?? undefined}>
            {icons ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="module-icon" src={`https://images.evetech.net/types/${entry.typeId}/icon?size=32`} alt="" />
            ) : null}
            <span className="sheet-entry-name">{entry.name}</span>
            {entry.nickname === null ? null : <span className="sheet-entry-nick">{entry.nickname}</span>}
            {entry.quantity === 1 ? null : <span className="sheet-entry-qty">×{entry.quantity}</span>}
          </span>
          <RangeCols range={entry.range} />
          <RangePill band={entry.band} />
        </li>
      ))}
    </ul>
  );
}

/** Spec §4's fit sheet. Every value here was computed on the server by `buildFitSheet`. */
export function FitSheet({ view }: { view: FitSheetView }) {
  const cargoCount = view.cargo.ammo.length + view.cargo.other.length;
  const holdEmpty = cargoCount === 0 && view.drones.length === 0;
  return (
    <div className="fit-sheet">
      <div className="card fit-head fit-sheet-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.renderUrl} alt="" className="fit-render" />
        <div className="fit-head-text">
          <h1 className="page-title">{view.title}</h1>
          <div className="ship-type-pills fit-head-pills">
            <span className="pill hull">{view.ship.typeName}</span>
            {view.ship.raceName === null ? null : <span className="pill">{view.ship.raceName}</span>}
            {view.ship.groupName === null ? null : <span className="pill">{view.ship.groupName}</span>}
          </div>
          <p className="fit-head-loc">
            {view.location.system === null ? null : (<>
              <span className={view.location.system.secClass}>{view.location.system.sec}</span> {view.location.system.name}
            </>)}
            {view.location.place === null ? null : (
              <span className="ov-station">{view.location.system === null ? "" : " · "}{view.location.place}</span>
            )}
            {view.location.note === null ? null : (
              <span className="faint">{view.location.system === null && view.location.place === null ? "" : " · "}{view.location.note}</span>
            )}
          </p>
        </div>
      </div>

      {view.skillsSynced ? null : (
        <p className="card banner fit-sheet-banner">
          No skills synced yet — every skill is treated as level 0, so these numbers are worst case.
        </p>
      )}

      <div className="fit-sheet-main">
        <div className="card">
          <h2 className="card-title">Modules</h2>
          <div className="sheet-slot-head" aria-hidden="true">
            <span>Module</span><span>Optimal</span><span>Falloff</span><span>State</span>
          </div>
          {/* A slot kind the hull doesn't have (subsystems on a frigate) is noise, not information. */}
          {view.slots.filter((column) => column.total > 0 || column.rows.length > 0).map((column) => {
            const over = column.used > column.total;
            const empty = column.total - column.used;
            return (
              <section key={column.slot} className="slot-section">
                <h3 className="slot-section-title">
                  {column.title} <span className={`slot-count${over ? " over" : ""}`}>{column.used} / {column.total}</span>
                </h3>
                <ul className="sheet-slot-list">
                  {column.rows.map((row) => (
                    <li key={row.key} className="sheet-slot-row">
                      <span className="sheet-mod" data-desc={row.desc ?? undefined}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="module-icon" src={`https://images.evetech.net/types/${row.typeId}/icon?size=32`} alt="" />
                        <span className="sheet-mod-name">{row.name}</span>
                        {row.charge === null || row.chargeTypeId === null ? null : (<>
                          {/* The ammo sits under its weapon: thumbnail in the icon column, name in the name column. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="charge-icon" src={`https://images.evetech.net/types/${row.chargeTypeId}/icon?size=32`} alt="" />
                          <span className="sheet-mod-charge" data-desc={row.chargeDesc ?? undefined}>{row.charge}</span>
                        </>)}
                      </span>
                      <RangeCols range={row.range} />
                      <span className={`state-pill ${row.state.toLowerCase()}`}>{row.state}</span>
                    </li>
                  ))}
                  {empty > 0 ? (
                    <li className="sheet-slot-row sheet-slot-empty">
                      <span className="faint">{empty} empty slot{empty === 1 ? "" : "s"}</span>
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="card">
          <h2 className="card-title">Cargo &amp; drones</h2>
          {holdEmpty ? <p className="faint">Nothing in the cargo hold or drone bay.</p> : (
            <>
              <div className="sheet-entry-head" aria-hidden="true">
                <span>Item</span><span>Optimal</span><span>Falloff</span><span>Range</span>
              </div>
              {view.drones.length === 0 ? null : <><h3 className="slot-title">Drone bay</h3><EntryList entries={view.drones} /></>}
              {cargoCount === 0 ? null : (<>
                <h3 className="slot-title">Cargo</h3>
                {/* Ammunition first, then a break, then everything else in the hold. */}
                {view.cargo.ammo.length === 0 ? null : <EntryList entries={view.cargo.ammo} />}
                {view.cargo.ammo.length > 0 && view.cargo.other.length > 0
                  ? <div className="sheet-entry-break" aria-hidden="true"><span>other cargo</span></div> : null}
                {view.cargo.other.length === 0 ? null : <EntryList entries={view.cargo.other} />}
              </>)}
            </>
          )}
          {view.unknown.length === 0 ? null : (
            <>
              <h3 className="slot-title">Unknown types</h3>
              <p className="faint">The static data does not know these types, so they are excluded from the calculation.</p>
              <EntryList entries={view.unknown} icons={false} />
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
      </div>

      <aside className="fit-sheet-side">
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

        <ShipStats stats={view.stats} />

        <div className={`card${view.problems.length === 0 ? "" : " card-problems"}`}>
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
          <ul className="value-list">
            {view.value.lines.map((line) => (
              <li key={line.label}><span>{line.label}</span><span className="num">{line.value}</span></li>
            ))}
            <li className="value-total"><span>Total</span><span className="num">{view.value.total}</span></li>
          </ul>
          {view.value.unpriced === null ? null : <p className="faint">{view.value.unpriced}</p>}
        </div>
      </aside>

      <div className="card fit-sheet-foot">
        <h2 className="card-title">Ship bonuses</h2>
        {view.bonuses.length === 0 ? <p className="faint">This hull has no listed bonuses.</p> : (
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
        )}
      </div>
    </div>
  );
}
