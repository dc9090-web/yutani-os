"use client";
import { useState } from "react";
import Link from "next/link";
import type { GaugeView, ShipCardView } from "../../lib/view/ships.js";
import { shipRenderUrl } from "../../lib/view/fit-sheet.js";
import { roman } from "../../lib/view/format.js";
import { Chevron } from "../components/Disclosure.js";
import { LevelBlocks, filledBlocks } from "../components/LevelBlocks.js";
import { SegBar } from "../components/SegBar.js";

function Fitting({ view }: { view: GaugeView }) {
  return (
    <div className="sp-gauge">
      <div className="sp-gauge-top">
        <span className="yo-label">{view.label}</span>
        <span className={`sp-gauge-text${view.over ? " yo-bad" : ""}`}>{view.text}{view.over ? " · over" : ""}</span>
      </div>
      <SegBar value={view.percent / 100} tone={view.over ? "bad" : "default"} label={`${view.label} ${Math.round(view.percent)}% used${view.over ? ", over" : ""}`} />
    </div>
  );
}

/** The pilot's mastery of the hull: five blocks and a Roman numeral, or a dash when the SDE has none. */
export function Mastery({ level }: { level: number | null }) {
  return (
    <span className="sp-mastery">
      Mastery
      {level === null ? <span className="sp-mastery-level" title="The SDE has no mastery data for this hull">—</span> : (<>
        <LevelBlocks states={filledBlocks(level)} label={`Mastery level ${level} of 5`} />
        <span className="sp-mastery-level">{level === 0 ? "0" : roman(level)}</span>
      </>)}
    </span>
  );
}

/**
 * One fitted ship or saved fit (redesign hand-off, `Ships.dc.html`, "Panels" layout): a full-width
 * panel — identity, the four headline stats, CPU and powergrid, then value, skill status, mastery
 * and a Modules button that opens the weapons and modules along the bottom.
 */
export function ShipPanel({ card }: { card: ShipCardView }) {
  const [open, setOpen] = useState(false);
  const computed = card.cpu !== null && card.power !== null;
  const kind = [card.groupName, card.raceName].filter((part) => part !== null).join(" · ");
  const stats = card.stats;
  // "Stable 43%" / "Lasts 12m 40s": the word goes in the label, the figure in the cell.
  const capWord = stats === null || stats.capOk === null ? null : stats.capOk ? "Stable" : "Lasts";
  return (
    <article className="sp-panel">
      <div className="sp-main">
        <div className="sp-identity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shipRenderUrl(card.typeId)} alt="" className="yo-tile sp-render" loading="lazy" />
          <div className="sp-id">
            {kind === "" ? null : <span className="yo-label">{kind}</span>}
            <h2 className="sp-title">
              <Link href={card.href} className="sp-hull">{card.typeName}</Link>
              {card.name === null || card.name === card.typeName ? null : <span className="sp-name">{card.name}</span>}
            </h2>
            <span className="sp-station" title={card.location}>{card.location}</span>
          </div>
        </div>
        {!computed ? <p className="sp-error yo-bad">{card.error ?? "Could not compute"}</p> : (<>
          {stats === null ? null : (
            <dl className="sp-stats">
              <div className="sp-stat"><dt className="yo-label">DPS</dt><dd>{stats.dps}</dd></div>
              <div className="sp-stat"><dt className="yo-label">EHP</dt><dd>{stats.ehp}</dd></div>
              <div className="sp-stat"><dt className="yo-label">Speed{stats.propKind === null ? "" : ` · ${stats.propKind}`}</dt><dd>{stats.velocity}</dd></div>
              <div className="sp-stat">
                <dt className="yo-label" title={capWord === null ? undefined : `Capacitor: ${capWord.toLowerCase()}`}>Cap{capWord === null ? "" : ` · ${capWord}`}</dt>
                <dd className={stats.capOk === null ? undefined : stats.capOk ? "yo-good" : "yo-bad"}>
                  {capWord === null ? stats.cap : stats.cap.slice(capWord.length + 1)}
                </dd>
              </div>
            </dl>
          )}
          <div className="sp-fitting">
            <Fitting view={card.cpu!} />
            <Fitting view={card.power!} />
          </div>
          <div className="sp-side">
            <span className="sp-value">{card.value === null ? "—" : card.value.replace(/ ISK$/, "")} <span className="sp-value-unit">ISK</span></span>
            <span className={`sp-skills ${card.missingSkills > 0 ? "yo-bad" : "yo-good"}`}>
              <span className="sp-dot" aria-hidden="true" />
              {card.missingSkills > 0 ? `${card.missingSkills} missing skill${card.missingSkills === 1 ? "" : "s"}` : "All skills trained"}
            </span>
            <Mastery level={card.mastery} />
            <button type="button" className="sp-modules-btn" aria-expanded={open} data-open={open || undefined} onClick={() => setOpen(!open)}>
              Modules {card.weapons.length}
              <Chevron open={open} />
            </button>
          </div>
        </>)}
      </div>
      {computed && open ? (
        <div className="sp-modules">
          <span className="yo-label">Weapons and modules{card.unpriced === null ? null : <span className="sp-unpriced"> · {card.unpriced}</span>}</span>
          {card.weapons.length === 0 ? <span className="sp-none">No weapons or modules listed</span> : (
            <ul className="sp-module-list">
              {card.weapons.map((w) => {
                const detail = [w.charge, w.range].filter((x) => x !== null).join(" · ");
                return (
                  <li key={w.key}>
                    <span className="sp-module-name">{w.count > 1 ? `${w.count}× ` : ""}{w.name}</span>
                    {detail === "" ? null : <span className="sp-module-detail">{detail}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}
