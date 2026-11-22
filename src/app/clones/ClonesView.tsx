import type { CloneLocationView, CloneView, ImplantView } from "../../lib/view/clones.js";
import { typeIconUrl } from "../../lib/view/assets.js";
import { Disclosure } from "../components/Disclosure.js";
import { InfoButton, InfoGroup, InfoPanel } from "../components/Info.js";
import { LevelBlocks } from "../components/LevelBlocks.js";

function SlotStrip({ clone }: { clone: CloneView }) {
  return <LevelBlocks states={clone.slots.map((taken) => (taken ? "filled" : "empty"))} label={`${clone.used} of 10 implant slots used`} />;
}

/** Implants in two columns: slot number, icon, name, info button, and the attribute bonus in teal. */
function ImplantList({ implants, scope, wide = false }: { implants: ImplantView[]; scope: string; wide?: boolean }) {
  return (
    <ul className={`cl-implants${wide ? " is-wide" : ""}`}>
      {implants.map((implant) => {
        const id = `${scope}-${implant.typeId}`;
        return (
          <li key={implant.typeId} className="cl-implant">
            <div className="cl-implant-row">
              <span className="cl-slot" title={implant.slot === null ? "Slot not known" : `Slot ${implant.slot}`}>{implant.slot ?? "–"}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={typeIconUrl(implant.typeId, false, false)} alt="" className="yo-tile cl-icon" loading="lazy" />
              <span className="cl-implant-name">{implant.name}</span>
              {implant.desc === null ? null : <InfoButton id={id} name={implant.name} />}
              <span className="cl-fill" aria-hidden="true" />
              {implant.bonus === null ? null : <span className="cl-bonus">{implant.bonus}</span>}
            </div>
            {implant.desc === null ? null : <InfoPanel id={id} className="cl-info">{implant.desc}</InfoPanel>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Clones page (redesign hand-off, `Clones.dc.html`, "List" layout): the active clone's panel,
 * then jump clones grouped by station, each a collapsible row with its ten-slot strip.
 */
export function ClonesView({ synced, home, active, locations }: {
  /** False until the clones job has written anything for this character. */
  synced: boolean;
  home: string | null;
  active: CloneView;
  locations: CloneLocationView[];
}) {
  if (!synced) {
    return (
      <section className="yo-card" aria-label="Clones">
        <p className="yo-empty">Not synced yet — the clones job runs every six hours.</p>
      </section>
    );
  }
  const cloneCount = locations.reduce((sum, location) => sum + location.clones.length, 0);
  return (
    <InfoGroup>
      <section className="yo-card cl-active" aria-label="Active clone">
        <div className="cl-active-head">
          <div className="cl-active-id">
            <div className="cl-active-title">
              <h2 className="yo-card-title">Active clone</h2>
              <span className="yo-tag is-main">ACTIVE</span>
            </div>
            <span className="yo-card-meta">{active.used === 0 ? "No implants fitted" : `${active.used} implant${active.used === 1 ? "" : "s"} fitted`}</span>
          </div>
          <div className="cl-fact">
            <span className="yo-label">Home station</span>
            <span className="cl-fact-value">{home ?? "—"}</span>
          </div>
          <div className="cl-fact is-slots">
            <span className="yo-label">Implant slots</span>
            <div className="cl-slots"><SlotStrip clone={active} /><span className="cl-slots-count">{active.used} / 10</span></div>
          </div>
        </div>
        {active.implants.length === 0 ? null : <ImplantList implants={active.implants} scope="active" wide />}
      </section>

      <section className="cl-jump" aria-label="Jump clones">
        <div className="yo-card-head">
          <h2 className="yo-card-title">Jump clones</h2>
          {cloneCount === 0 ? null : (
            <span className="yo-card-meta yo-mono">
              {cloneCount} clone{cloneCount === 1 ? "" : "s"} · {locations.length} station{locations.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {cloneCount === 0 ? <p className="yo-empty">No jump clones.</p> : locations.map((location, locationIndex) => (
          <div key={location.key} className="cl-location">
            <div className="cl-location-head">
              <h3 className="cl-location-title">{location.title}</h3>
              {location.station === null ? null : <span className="cl-location-station">{location.station}</span>}
              <span className="cl-location-count">{location.clones.length} clone{location.clones.length === 1 ? "" : "s"}</span>
            </div>
            <div className="cl-list">
              {location.clones.map((clone, cloneIndex) => (
                <Disclosure
                  key={clone.jumpCloneId} className="cl-clone" defaultOpen={locationIndex === 0 && cloneIndex === 0}
                  summary={<>
                    {/* Read out, unlike the artboard's: unnamed clones have nothing else to tell them apart. */}
                    <span className="cl-code">{clone.code}</span>
                    <span className={`cl-name${clone.name === null ? " is-unnamed" : ""}`}>{clone.name ?? "Unnamed clone"}</span>
                    <SlotStrip clone={clone} />
                    <span className="cl-used">{clone.used} / 10 slots</span>
                  </>}
                >
                  {clone.implants.length === 0
                    ? <p className="yo-empty">No implants</p>
                    : <ImplantList implants={clone.implants} scope={`jc-${clone.jumpCloneId}`} />}
                </Disclosure>
              ))}
            </div>
          </div>
        ))}
      </section>
    </InfoGroup>
  );
}
