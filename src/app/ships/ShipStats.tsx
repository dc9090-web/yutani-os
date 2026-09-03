import type { ShipStatsView, StatSectionView } from "../../lib/view/fit-sheet.js";

const DAMAGE_TYPES = ["em", "thermal", "kinetic", "explosive"] as const;
const DAMAGE_LABELS = ["EM", "Th", "Kin", "Exp"] as const;

function Section({ section, badge, children }: { section: StatSectionView; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="stat-section">
      <h3 className="stat-section-head">
        <span>{section.title}</span>
        {badge ?? <span className="num stat-headline">{section.headline}</span>}
      </h3>
      {section.rows.length === 0 ? null : (
        <dl className="stat-rows">
          {section.rows.map((row) => (
            <div key={row.label} className="stat-row"><dt>{row.label}</dt><dd className="num">{row.value}</dd></div>
          ))}
        </dl>
      )}
      {children}
      {section.note ? <p className="stat-note faint">{section.note}</p> : null}
    </section>
  );
}

/** The fitting window's stats panel — capacitor, offense, defense, targeting, navigation, drones, bays. */
export function ShipStats({ stats }: { stats: ShipStatsView }) {
  const cap = stats.capacitor;
  return (
    <div className="card ship-stats">
      <h2 className="card-title">Ship stats</h2>
      <Section section={cap} badge={
        cap.ok === null ? <span className="num stat-headline">{cap.headline}</span>
          : <span className={`badge ${cap.ok ? "ok" : "warn"}`}>{cap.headline}</span>
      } />
      <Section section={stats.offense} />
      <Section section={stats.defense}>
        {stats.defense.recharge === null ? null : (
          <dl className="stat-rows"><div className="stat-row"><dt>Shield recharge</dt><dd className="num">{stats.defense.recharge}</dd></div></dl>
        )}
        {stats.defense.layers.length === 0 ? null : (
          <table className="resist-table">
            <thead>
              <tr>
                <th scope="col" className="resist-layer-head" aria-label="Layer" />
                {DAMAGE_TYPES.map((type, i) => <th key={type} scope="col" className={`resist-head ${type}`}>{DAMAGE_LABELS[i]}</th>)}
              </tr>
            </thead>
            <tbody>
              {stats.defense.layers.map((layer) => (
                <tr key={layer.layer}>
                  <th scope="row" className="resist-layer">
                    <span className="resist-layer-name">{layer.layer}</span>
                    <span className="num resist-hp">{layer.hp}</span>
                    {layer.note === null ? null : <span className="num resist-hp">{layer.note}</span>}
                  </th>
                  {layer.resists.map((pct, i) => (
                    <td key={DAMAGE_TYPES[i]} className={`resist-cell ${DAMAGE_TYPES[i]}`}>
                      <span className="resist-fill" style={{ width: `${pct}%` }} />
                      <span className="num resist-pct">{pct}%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section section={stats.targeting} />
      <Section section={stats.navigation} />
      <Section section={stats.drones} />
      <dl className="stat-rows stat-bays">
        {stats.bays.map((row) => (
          <div key={row.label} className="stat-row"><dt>{row.label}</dt><dd className="num">{row.value}</dd></div>
        ))}
      </dl>
    </div>
  );
}
