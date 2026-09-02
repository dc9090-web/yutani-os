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
        <div>
          <h2 className="ship-name">{card.name ?? card.typeName}</h2>
          <p className="ship-type muted">{card.groupName ? `${card.groupName}, ${card.typeName}` : card.typeName}</p>
        </div>
      </div>
      <p className="ship-loc faint">{card.location}</p>
      {computed ? (
        <>
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
