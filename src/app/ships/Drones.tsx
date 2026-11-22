"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { DroneSheetView, StatRowView } from "../../lib/view/fit-sheet.js";
import { launchedSummary, launchedTotals, roomFor, type Launched } from "../../lib/view/drones.js";
import { grouped } from "../../lib/view/format.js";

const DASH = "—";
const dps = (value: number): string => grouped(value.toFixed(1));

interface DroneState {
  control: DroneSheetView | null;
  launched: Launched;
  setCount: (typeId: number, count: number) => void;
  /** Turrets and launchers; with no drone bay this is the whole of the fit's DPS. */
  weaponDps: number;
  weaponVolley: number;
}
const DroneContext = createContext<DroneState | null>(null);

function useDrones(): DroneState {
  const state = useContext(DroneContext);
  if (state === null) throw new Error("drone figures must sit inside a DroneProvider");
  return state;
}

/**
 * Holds which drones are launched (redesign hand-off, PAGES.md §5 "Drone selector"). Everything that
 * depends on it — the DPS key figure, the Offense panel, the Drones panel — reads it from here, so
 * changing the selection moves all of them together. `control` is null for a hull with no drone bay.
 */
export function DroneProvider({ control, weaponDps, weaponVolley, children }: { control: DroneSheetView | null; weaponDps: number; weaponVolley: number; children: ReactNode }) {
  const [launched, setLaunched] = useState<Launched>(control?.launched ?? {});
  const setCount = (typeId: number, count: number) => setLaunched((current) => ({ ...current, [typeId]: count }));
  return <DroneContext.Provider value={{ control, launched, setCount, weaponDps, weaponVolley }}>{children}</DroneContext.Provider>;
}

function useTotals() {
  const { control, launched, weaponDps, weaponVolley } = useDrones();
  const out = control === null ? { dps: 0, volley: 0, active: 0, bandwidthUsed: 0 } : launchedTotals(control, launched);
  return { weaponDps, droneDps: out.dps, totalDps: weaponDps + out.dps, volley: weaponVolley + out.volley, active: out.active, bandwidthUsed: out.bandwidthUsed };
}

/** The DPS key figure: the total, and under it what the weapons and the drones each contribute. */
export function DpsFigure() {
  const { weaponDps, droneDps, totalDps } = useTotals();
  return (<>
    <span className="sd-key-value">{totalDps > 0 ? dps(totalDps) : DASH}</span>
    <span className="sd-key-note">
      {totalDps > 0 ? `${dps(weaponDps)} weapons · ${dps(droneDps)} drones` : "Nothing fitted deals damage"}
    </span>
  </>);
}

/** The Offense panel: total DPS in the header, then weapons, drones and one full volley. */
export function OffensePanel({ note }: { note: string | null }) {
  const { weaponDps, droneDps, totalDps, volley } = useTotals();
  const rows: StatRowView[] = [
    { label: "Weapons", value: weaponDps > 0 ? `${dps(weaponDps)} dps` : DASH },
    { label: "Drones", value: droneDps > 0 ? `${dps(droneDps)} dps` : DASH },
    { label: "Volley", value: volley > 0 ? `${grouped(Math.round(volley))} HP` : DASH },
  ];
  return (
    <section className="yo-card sd-card" aria-label="Offense">
      <div className="sd-card-head">
        <h2 className="sd-card-title">Offense</h2>
        <span className="sd-headline">{totalDps > 0 ? `${dps(totalDps)} DPS` : DASH}</span>
      </div>
      <dl className="sd-rows">
        {rows.map((row) => <div key={row.label} className="sd-row"><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
      {note === null ? null : <p className="sd-note">{note}</p>}
    </section>
  );
}

/**
 * The Drones panel: a dropdown listing only the drone types in this ship's bay, each with minus and
 * plus steppers. A type's limit is the lowest of what is in the bay, the bandwidth left and the
 * pilot's drone control limit; several types can be out together.
 */
export function DronesPanel() {
  const { control, launched, setCount } = useDrones();
  const [open, setOpen] = useState(true);
  if (control === null) return null;
  const totals = launchedTotals(control, launched);
  return (
    <section className="yo-card sd-card" aria-label="Drones">
      <div className="sd-card-head">
        <h2 className="sd-card-title">Drones</h2>
        <span className="sd-headline">{dps(totals.dps)} DPS</span>
      </div>
      {control.types.length === 0 ? <p className="yo-empty">No drones in the bay.</p> : (
        <div className="sd-drone-select">
          <span id="drone-select-label" className="yo-label">Drones launched</span>
          <button type="button" className="sd-drone-toggle" aria-expanded={open} aria-labelledby="drone-select-label drone-select-summary" onClick={() => setOpen(!open)}>
            <span id="drone-select-summary" className="sd-drone-summary">{launchedSummary(control, launched)}</span>
            <svg aria-hidden="true" data-open={open || undefined} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3" /></svg>
          </button>
          {open ? (
            <div className="sd-drone-menu">
              {control.types.map((type) => {
                const count = launched[type.typeId] ?? 0;
                const room = roomFor(control, launched, type);
                return (
                  <div key={type.typeId} className="sd-drone-row">
                    <div className="sd-drone-id">
                      <span className="sd-drone-name">{type.name}</span>
                      <span className="sd-drone-meta">{type.inBay} in bay · {grouped(type.bandwidth)} Mbit/s · {type.dpsEach.toFixed(1)} dps each</span>
                    </div>
                    <button type="button" className="sd-step" aria-label={`One fewer ${type.name}`} disabled={count === 0} onClick={() => setCount(type.typeId, count - 1)}>−</button>
                    <span className="sd-drone-count" aria-live="polite">{count} <span className="sd-drone-max">/ {count + room}</span></span>
                    <button type="button" className="sd-step" aria-label={`One more ${type.name}`} disabled={room === 0} onClick={() => setCount(type.typeId, count + 1)}>+</button>
                  </div>
                );
              })}
              <span className="sd-drone-hint">Only drones in this ship&rsquo;s drone bay are listed. The limit per drone follows the ship&rsquo;s bandwidth and your drone control limit.</span>
            </div>
          ) : null}
        </div>
      )}
      <dl className="sd-rows">
        <div className="sd-row"><dt>Launched</dt><dd>{totals.active}{control.maxActive === null ? "" : ` / ${control.maxActive}`} drone{totals.active === 1 && control.maxActive === null ? "" : "s"}</dd></div>
        <div className="sd-row"><dt>Bandwidth</dt><dd>{grouped(totals.bandwidthUsed)} / {grouped(control.bandwidth)} Mbit/s</dd></div>
        <div className="sd-row"><dt>Control range</dt><dd>{control.controlRange}</dd></div>
        <div className="sd-row"><dt>Drone bay</dt><dd>{control.bay}</dd></div>
      </dl>
    </section>
  );
}
