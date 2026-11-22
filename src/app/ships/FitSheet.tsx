import Link from "next/link";
import { IconTargetOff } from "@tabler/icons-react";
import type {
  AmmoRowView, ConsumableRowView, EntryView, FitSheetView, KeyFigureView, ModuleRowView, ShipStatsView, StatRowView,
} from "../../lib/view/fit-sheet.js";
import type { GaugeView } from "../../lib/view/ships.js";
import { roman } from "../../lib/view/format.js";
import { LevelBlocks, filledBlocks, skillBlocks } from "../components/LevelBlocks.js";
import { SegBar } from "../components/SegBar.js";
import { DpsFigure, DroneProvider, DronesPanel, OffensePanel } from "./Drones.js";

const iconUrl = (typeId: number): string => `https://images.evetech.net/types/${typeId}/icon?size=64`;

function KeyFigure({ label, figure }: { label: string; figure: KeyFigureView }) {
  return (
    <div className="sd-key">
      <span className="yo-label">{label}</span>
      <span className={`sd-key-value${figure.tone === null ? "" : ` yo-${figure.tone}`}`}>
        {figure.value}{figure.unit === null ? null : <span className="sd-key-unit"> {figure.unit}</span>}
      </span>
      {figure.note === null ? null : <span className="sd-key-note">{figure.note}</span>}
    </div>
  );
}

function StatCard({ title, headline, tone, rows, note }: { title: string; headline: string; tone?: "good" | "bad" | null; rows: StatRowView[]; note?: string | null }) {
  return (
    <section className="yo-card sd-card" aria-label={title}>
      <div className="sd-card-head">
        <h2 className="sd-card-title">{title}</h2>
        <span className={`sd-headline${tone == null ? "" : ` yo-${tone}`}`}>{headline}</span>
      </div>
      <dl className="sd-rows">
        {rows.map((row) => (
          <div key={row.label} className={`sd-row${row.label === "Total" ? " is-total" : ""}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>
        ))}
      </dl>
      {note == null ? null : <p className="sd-note">{note}</p>}
    </section>
  );
}

function FittingBar({ view }: { view: GaugeView }) {
  return (
    <div className="sd-gauge">
      <div className="sd-gauge-top">
        <span className="yo-label">{view.label}</span>
        <span className={`sd-gauge-text${view.over ? " yo-bad" : ""}`}>{view.text}{view.over ? " · over" : ""}</span>
      </div>
      <SegBar value={view.percent / 100} tone={view.over ? "bad" : "default"} label={`${view.label} ${Math.round(view.percent)}% used${view.over ? ", over" : ""}`} />
    </div>
  );
}

function ModuleRow({ row }: { row: ModuleRowView }) {
  const state = row.state.toUpperCase();
  return (
    <li className="sd-module">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="yo-tile sd-icon" src={iconUrl(row.typeId)} alt="" loading="lazy" />
      <span className="sd-qty">{row.quantity > 1 ? `${row.quantity}×` : ""}</span>
      <span className="sd-module-text">
        <span className="sd-module-name" data-desc={row.desc ?? undefined}>{row.name}</span>
        {row.charge === null ? null : (
          <span className="sd-module-charge" data-desc={row.chargeDesc ?? undefined}>
            {row.charge}{row.chargeAssumed ? " · best in cargo" : ""}
          </span>
        )}
      </span>
      <span className="sd-optimal">{row.range === null ? "" : row.range.optimal ?? "—"}</span>
      <span className="sd-falloff">{row.range === null ? "" : row.range.falloff ?? "—"}</span>
      <span className="sd-state"><span className={`yo-tag${state === "ACTIVE" ? " is-accent" : state === "OVERLOAD" ? " is-bad" : ""}${state === "OFFLINE" ? " is-dashed" : ""}`}>{state}</span></span>
    </li>
  );
}

function AmmoRow({ row }: { row: AmmoRowView }) {
  const main = row.damage?.types[0] ?? null;
  return (
    <li className="sd-ammo">
      <span className="sd-ammo-name" data-desc={[row.damage?.desc, row.desc].filter(Boolean).join("\n\n") || undefined}>{row.name}</span>
      <span className="sd-ammo-damage">
        {row.damage === null || main === null ? "—" : (<>
          {row.damage.types.map((type) => <span key={type.kind} className={`sd-swatch is-${type.kind}`} aria-hidden="true" />)}
          {row.damage.types.length === 1 ? main.label : row.damage.types.map((type) => type.label).join(" / ")}
        </>)}
      </span>
      {/* What every fitted weapon that takes the round would do with it; a dash for a round nothing fitted fires. */}
      <span className="sd-ammo-dps" data-desc={row.dpsDesc ?? undefined}>{row.dps ?? "—"}</span>
      <span className="sd-optimal">{row.range === null ? "—" : row.range.optimal ?? "—"}</span>
      <span className="sd-falloff">{row.range === null ? "—" : row.range.falloff ?? "—"}</span>
      <span className="sd-ammo-band" data-desc={row.band?.desc}>
        {row.band === null ? "" : row.band.label.toUpperCase()}
        {/* Reaches further than the ship can lock: still Long, the glyph says why that matters. */}
        {row.band?.beyond ? <IconTargetOff size={11} className="yo-bad" aria-label="Further than this ship can lock" /> : null}
      </span>
    </li>
  );
}

function ConsumableRow({ row }: { row: ConsumableRowView }) {
  return (
    <li className="sd-consumable">
      <span className="sd-consumable-name" data-desc={row.desc ?? undefined}>{row.name}</span>
      <span className="sd-consumable-effect">{row.effect}</span>
      {/* A dash when no fitted module takes it and it has no slot or duration to show. */}
      <span className="sd-consumable-use">{row.use ?? "—"}</span>
    </li>
  );
}

function Hold({ name, used, entries, note }: { name: string; used?: string; entries: EntryView[]; note?: string }) {
  return (
    <div className="sd-hold">
      <div className="sd-hold-head">
        <h3 className="sd-group-title">{name}</h3>
        {used === undefined ? null : <span className="sd-group-count">{used}</span>}
      </div>
      {note === undefined ? null : <p className="sd-hold-note">{note}</p>}
      <ul className="sd-list">
        {entries.map((entry) => (
          <li key={entry.key} className="sd-entry">
            <span className="sd-entry-name">
              <span data-desc={entry.desc ?? undefined}>{entry.name}</span>
              {entry.nickname === null ? null : <span className="sd-entry-nick"> {entry.nickname}</span>}
            </span>
            <span className="sd-entry-qty">{entry.quantity === 1 ? "" : `×${entry.quantity.toLocaleString("en-US")}`}</span>
            {/* Unit price × quantity; a dash for a type with no price. */}
            <span className="sd-entry-value">{entry.value ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Defense({ stats }: { stats: ShipStatsView }) {
  const defense = stats.defense;
  const total = defense.headline.replace(/ ehp$/i, "");
  return (
    <section className="yo-card sd-card" aria-label="Defense">
      <div className="sd-card-head">
        <h2 className="sd-card-title">Defense</h2>
        <span className="sd-headline">{total} <span className="sd-headline-unit">EHP</span></span>
      </div>
      {defense.layers.length === 0 ? <p className="yo-empty">No tank figures for this hull.</p> : (
        <div className="sd-resists" role="table" aria-label="Resistances by layer">
          <div role="row" className="sd-resist-row">
            <span role="columnheader" aria-label="Layer" />
            {["EM", "Therm", "Kin", "Exp", "EHP"].map((head) => <span key={head} role="columnheader" className="yo-label sd-resist-head">{head}</span>)}
          </div>
          {defense.layers.map((layer) => (
            <div key={layer.layer} role="row" className="sd-resist-row">
              <span role="rowheader" className="sd-layer">
                <span className="sd-layer-name">{layer.layer}</span>
                <span className="sd-layer-hp">{layer.hp}</span>
                {layer.note === null ? null : <span className="sd-layer-hp" title="Time to recharge from empty">{layer.note} recharge</span>}
              </span>
              {layer.resists.map((pct, index) => (
                <span key={index} role="cell" className="sd-resist">
                  <span className="sd-resist-pct">{pct}%</span>
                  <span className="sd-resist-track" aria-hidden="true"><span className={`sd-resist-fill is-${["em", "thermal", "kinetic", "explosive"][index]}`} style={{ width: `${pct}%` }} /></span>
                </span>
              ))}
              <span role="cell" className="sd-layer-ehp">{layer.ehp}</span>
            </div>
          ))}
          <div className="sd-resist-total">Total<span>{total} EHP</span></div>
        </div>
      )}
    </section>
  );
}

/**
 * Ship detail (redesign hand-off, `ShipDetail.dc.html`). Every value was computed on the server by
 * `buildFitSheet`; the one live part is the drone selector, whose choice feeds the DPS key figure
 * and the Offense panel through `DroneProvider`.
 */
export function FitSheet({ view }: { view: FitSheetView }) {
  const kind = [view.ship.groupName, view.ship.raceName].filter((part) => part !== null).join(" · ");
  const holdEmpty = view.cargo.length === 0 && view.drones.length === 0;
  const bay = (label: string): string | undefined => view.stats.bays.find((row) => row.label === label)?.value;
  const gapTotal = view.skillGaps.reduce((sum, group) => sum + group.skills.length, 0);
  const loc = view.location;
  const assumedNote = view.stats.offense.note ?? null;

  return (
    <DroneProvider control={view.droneControl} weaponDps={view.weapons.dps} weaponVolley={view.weapons.volley}>
      <div className="sd-page">
        <Link href="/ships" className="yo-back sd-back">All ships</Link>

        <section className="sd-summary" aria-label="Ship summary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.renderUrl} alt="" className="yo-tile sd-render" />
          <div className="sd-summary-id">
            {kind === "" ? null : <span className="yo-label">{kind}</span>}
            <h1 className="sd-title">
              {view.typeName}
              {view.title === view.typeName ? null : <span className="sd-fit-name">{view.title}</span>}
            </h1>
            <span className="sd-location">
              {loc.system === null ? null : (<>
                <span className={`sd-sec ${loc.system.secClass}`}>{loc.system.sec}</span> <span className="sd-system">{loc.system.name}</span>
              </>)}
              {loc.place === null ? null : <>{loc.system === null ? "" : " · "}{loc.place}</>}
              {loc.note === null ? null : <>{loc.system === null && loc.place === null ? "" : " · "}{loc.note}</>}
            </span>
            <span className="sd-mastery">
              Mastery
              {view.mastery === null ? <span className="sd-mastery-level">—</span> : (<>
                <LevelBlocks states={filledBlocks(view.mastery)} label={`Mastery level ${view.mastery} of 5`} />
                <span className="sd-mastery-level">{view.mastery === 0 ? "0" : roman(view.mastery)} of V</span>
              </>)}
            </span>
          </div>
          <div className="sd-summary-side">
            <span className="yo-label">Estimated value</span>
            <span className="sd-value">{view.value.totalShort.replace(/ ISK$/, "")} <span className="sd-value-unit">ISK</span></span>
            <div className="sd-flags">
              <span className={`sd-flag ${view.problems.length === 0 ? "yo-good" : "yo-bad"}`}>
                <span className="sd-dot" aria-hidden="true" />
                {view.problems.length === 0 ? "Fit is legal" : `${view.problems.length} problem${view.problems.length === 1 ? "" : "s"}`}
              </span>
              <span className={`sd-flag ${view.missing.length === 0 ? "yo-good" : "yo-bad"}`}>
                <span className="sd-dot" aria-hidden="true" />
                {view.missing.length === 0 ? "All skills trained" : `${view.missing.length} missing skill${view.missing.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
        </section>

        {view.skillsSynced ? null : (
          <p className="yo-banner">No skills synced yet — every skill is treated as level 0, so these numbers are worst case.</p>
        )}

        <section className="sd-keys" aria-label="Key figures">
          <div className="sd-key"><span className="yo-label">DPS</span><DpsFigure /></div>
          <KeyFigure label="EHP" figure={view.key.ehp} />
          <KeyFigure label="Speed" figure={view.key.speed} />
          <KeyFigure label="Capacitor" figure={view.key.capacitor} />
          <KeyFigure label="Lock range" figure={view.key.lock} />
          <KeyFigure label="Align time" figure={view.key.align} />
        </section>

        <div className="sd-columns">
          <div className="sd-main">
            {/* The summary's two flags stand in for these panels when all is well; when it is not, the detail is here. */}
            {view.problems.length === 0 ? null : (
              <section className="yo-card sd-card is-alert" aria-label="Problems">
                <h2 className="sd-card-title">Problems</h2>
                <ul className="sd-list">
                  {view.problems.map((problem, index) => (
                    <li key={index} className="sd-problem"><span className="yo-tag is-bad">{problem.label}</span><span>{problem.text}</span></li>
                  ))}
                </ul>
              </section>
            )}
            {view.missing.length === 0 ? null : (
              <section className="yo-card sd-card is-alert" aria-label="Missing skills">
                <div className="sd-card-head">
                  <h2 className="sd-card-title">Missing skills</h2>
                  <span className="sd-card-note">Trained level, then the level this fit needs</span>
                </div>
                <ul className="sd-list">
                  {view.missing.map((skill) => (
                    <li key={skill.skillTypeId} className="sd-missing">
                      <LevelBlocks states={skillBlocks(skill.have, skill.need - skill.have)} label={`Level ${skill.have} of 5, needs level ${skill.need}`} />
                      <span className="sd-missing-name">{skill.name}</span>
                      <span className="sd-missing-need yo-bad">{skill.have} → {skill.need}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="yo-card sd-card" aria-label="Modules">
              <h2 className="sd-card-title">Modules</h2>
              <div className="sd-module-head yo-label" aria-hidden="true">
                <span className="sd-module-text">Module</span><span className="sd-optimal">Optimal</span><span className="sd-falloff">Falloff</span><span className="sd-state">State</span>
              </div>
              {/* A slot kind the hull doesn't have (subsystems on a frigate) is noise, not information. */}
              {view.slots.filter((rack) => rack.total > 0 || rack.rows.length > 0).map((rack) => {
                const empty = rack.total - rack.used;
                return (
                  <div key={rack.slot} className="sd-rack">
                    <div className="sd-rack-head">
                      <h3 className="sd-group-title">{rack.title}</h3>
                      <span className={`sd-group-count${rack.used > rack.total ? " yo-bad" : ""}`}>{rack.used} / {rack.total}</span>
                    </div>
                    <ul className="sd-list">
                      {rack.rows.map((row) => <ModuleRow key={row.key} row={row} />)}
                      {empty > 0 ? <li className="sd-module is-empty">{empty} empty slot{empty === 1 ? "" : "s"}</li> : null}
                    </ul>
                  </div>
                );
              })}
            </section>

            {view.ammo.length === 0 ? null : (
              <section className="yo-card sd-card" aria-label="Ammunition">
                <div className="sd-card-head">
                  <h2 className="sd-card-title">Ammunition</h2>
                  {assumedNote === null ? null : <span className="sd-card-note">{assumedNote}</span>}
                </div>
                <div className="sd-ammo-head yo-label" aria-hidden="true">
                  <span className="sd-ammo-name">Round</span><span className="sd-ammo-damage">Damage</span><span className="sd-ammo-dps">DPS</span>
                  <span className="sd-optimal">Optimal</span><span className="sd-falloff">Falloff</span><span className="sd-ammo-band">Range</span>
                </div>
                <ul className="sd-list is-tight">{view.ammo.map((row) => <AmmoRow key={row.key} row={row} />)}</ul>
              </section>
            )}

            {view.consumables.length === 0 ? null : (
              <section className="yo-card sd-card" aria-label="Consumables">
                <h2 className="sd-card-title">Consumables</h2>
                <ul className="sd-list is-ruled">{view.consumables.map((row) => <ConsumableRow key={row.key} row={row} />)}</ul>
              </section>
            )}

            <section className="yo-card sd-card" aria-label="Cargo and drones">
              <h2 className="sd-card-title">Cargo and drones</h2>
              {holdEmpty ? <p className="yo-empty">Nothing in the cargo hold or drone bay.</p> : (<>
                {view.drones.length === 0 ? null : <Hold name="Drone bay" used={bay("Drone bay")} entries={view.drones} />}
                {view.cargo.length === 0 ? null : <Hold name="Cargo hold" used={bay("Cargo hold")} entries={view.cargo} />}
              </>)}
              {view.unknown.length === 0 ? null : (
                <Hold name="Unknown types" entries={view.unknown} note="The static data does not know these types, so they are excluded from the calculation." />
              )}
              {view.unfittable.length === 0 ? null : (
                <Hold name="Not fitted" entries={view.unfittable} note="Saved with no slot, so the fitting window would not place them either." />
              )}
            </section>

            <section className="yo-card sd-card" aria-label="Ship bonuses">
              <h2 className="sd-card-title">Ship bonuses</h2>
              {view.bonuses.length === 0 ? <p className="yo-empty">This hull has no listed bonuses.</p> : (
                <ul className="sd-list is-ruled">
                  {view.bonuses.map((bonus, index) => (
                    <li key={index} className="sd-bonus">
                      <span className="sd-bonus-skill">{bonus.skill === null ? "Role bonus" : `${bonus.skill} ${bonus.level === null || bonus.level === 0 ? "0" : roman(bonus.level)}`}</span>
                      <span className="sd-bonus-text">{bonus.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="yo-card sd-card" aria-label="Skills">
              <div className="sd-card-head">
                <h2 className="sd-card-title">Skills</h2>
                {gapTotal === 0 ? null : <span className="sd-card-note">{gapTotal} skill{gapTotal === 1 ? "" : "s"} could still improve this ship</span>}
              </div>
              {!view.skillsSynced ? <p className="sd-skills-none">Skills have not synced yet, so there is nothing to compare this ship against.</p>
                : gapTotal === 0 ? <p className="sd-skills-none yo-good">Every skill that affects this ship, its bonuses, modules and drones is at level 5.</p>
                : view.skillGaps.map((group) => (
                  <div key={group.name} className="sd-hold">
                    <div className="sd-hold-head">
                      <h3 className="sd-group-title">{group.name}</h3>
                      <span className="sd-group-count">{group.skills.length} skill{group.skills.length === 1 ? "" : "s"}</span>
                    </div>
                    <ul className="sd-list">
                      {group.skills.map((skill) => (
                        <li key={skill.skillTypeId} className="sd-gap">
                          <div className="sd-gap-skill">
                            <div className="sd-gap-top">
                              <LevelBlocks states={filledBlocks(skill.level)} label={`Level ${skill.level} of 5`} />
                              <span className="sk-level" aria-hidden="true">{skill.level}</span>
                              <span className="sd-gap-name">{skill.name}</span>
                            </div>
                            {skill.effect === null ? null : <span className="sd-gap-effect">{skill.effect}</span>}
                          </div>
                          <div className="sd-gap-affects">
                            <span className="yo-label">Affects</span>
                            <span>{skill.affects}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </section>
          </div>

          <aside className="sd-side">
            <section className="yo-card sd-card" aria-label="Fitting">
              <h2 className="sd-card-title">Fitting</h2>
              {view.gauges.map((gauge) => <FittingBar key={gauge.label} view={gauge} />)}
              <div className="sd-counters">
                {view.counters.map((counter) => (
                  <span key={counter.label} className={`sd-counter${counter.over ? " is-over" : ""}`}>
                    {counter.label}<span className="sd-counter-value">{counter.used} / {counter.total}</span>
                  </span>
                ))}
              </div>
            </section>

            <Defense stats={view.stats} />

            <section className="yo-card sd-card" aria-label="Repairs">
              <h2 className="sd-card-title">Repairs</h2>
              <div className="sd-repairs">
                {view.repairs.map((repair) => (
                  <div key={repair.label} className="sd-repair">
                    <span className="yo-label">{repair.label}</span>
                    <span className={`sd-repair-value${repair.idle ? " is-idle" : ""}`}>{repair.value} <span className="sd-repair-unit">hp/s</span></span>
                  </div>
                ))}
              </div>
            </section>

            <StatCard title="Capacitor" headline={view.stats.capacitor.headline} rows={view.stats.capacitor.rows}
              tone={view.stats.capacitor.ok === null ? null : view.stats.capacitor.ok ? "good" : "bad"} />
            <OffensePanel note={view.ammo.length === 0 ? assumedNote : null} />
            <DronesPanel />
            <StatCard title="Targeting" headline={view.stats.targeting.headline} rows={view.stats.targeting.rows} />
            <StatCard title="Navigation" headline={view.stats.navigation.headline} rows={view.stats.navigation.rows} />
            <StatCard title="Estimated value" headline={view.value.totalShort} note={view.value.unpriced}
              rows={[...view.value.lines, { label: "Total", value: view.value.total }]} />
          </aside>
        </div>
      </div>
    </DroneProvider>
  );
}
