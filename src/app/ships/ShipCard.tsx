import Link from "next/link";
import type { ShipCardView } from "../../lib/view/ships.js";
import { shipRenderUrl } from "../../lib/view/fit-sheet.js";
import { Gauge } from "./Gauge.js";

/** One fitted ship or saved fit. The whole card is the link to its sheet. */
export function ShipCard({ card }: { card: ShipCardView }) {
  const computed = card.cpu !== null && card.power !== null;
  return (
    <Link href={card.href} className="card ship-card">
      <div className="ship-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shipRenderUrl(card.typeId)} alt="" className="ship-render" />
        <div className="ship-id">
          {/* Hull chip first and loudest, then race + class beneath, then the pilot's own name. */}
          <div className="ship-type-pills">
            <span className="pill hull">{card.typeName}</span>
          </div>
          {card.raceName === null && card.groupName === null ? null : (
            <div className="ship-type-pills ship-class-pills">
              {card.raceName === null ? null : <span className="pill">{card.raceName}</span>}
              {card.groupName === null ? null : <span className="pill">{card.groupName}</span>}
            </div>
          )}
          <h2 className="ship-name">{card.name ?? card.typeName}</h2>
        </div>
      </div>
      <p className="ship-loc faint">{card.location}</p>
      {computed ? (
        <>
          {card.stats === null ? null : (
            <dl className="ship-stat-strip">
              <div className="ship-stat"><dt>DPS</dt><dd className="num">{card.stats.dps}</dd></div>
              <div className="ship-stat"><dt>EHP</dt><dd className="num">{card.stats.ehp}</dd></div>
              <div className="ship-stat"><dt>Speed{card.stats.propKind === null ? "" : ` · ${card.stats.propKind}`}</dt><dd className="num">{card.stats.velocity}</dd></div>
              <div className="ship-stat"><dt>Cap</dt><dd className={`num${card.stats.capOk === null ? "" : card.stats.capOk ? " pos" : " warn-text"}`}>{card.stats.cap}</dd></div>
            </dl>
          )}
          {card.weapons.length === 0 ? null : (
            <ul className="ship-weapons">
              {card.weapons.map((w) => (
                <li key={w.key}>
                  <span className="ship-weapon-name">{w.count > 1 ? `${w.count}× ` : ""}{w.name}</span>
                  {w.charge === null && w.range === null ? null : (
                    <span className="ship-weapon-ammo">{[w.charge, w.range].filter((x) => x !== null).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Gauge view={card.cpu!} />
          <Gauge view={card.power!} />
          <div className="ship-foot">
            <span className={card.missingSkills > 0 ? "badge error" : "faint"}>
              {card.missingSkills > 0
                ? `${card.missingSkills} missing skill${card.missingSkills === 1 ? "" : "s"}`
                : "All skills trained"}
            </span>
            <span className="num">{card.value}</span>
          </div>
          {card.unpriced === null ? null : <p className="faint ship-unpriced">{card.unpriced}</p>}
        </>
      ) : (
        <p className="neg">{card.error ?? "Could not compute"}</p>
      )}
    </Link>
  );
}
