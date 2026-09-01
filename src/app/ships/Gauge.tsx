import type { GaugeView } from "../../lib/view/ships.js";

/**
 * One resource bar, shared by the card and the fit sheet. The width is a length, not a colour, so
 * it is allowed to be inline; `.over` is what turns the bar red (spec §4).
 */
export function Gauge({ view }: { view: GaugeView }) {
  return (
    <div className="gauge-row">
      <span className="gauge-label">{view.label}</span>
      <span className={`gauge${view.over ? " over" : ""}`}>
        <span className="gauge-fill" style={{ width: `${view.percent}%` }} />
      </span>
      <span className="gauge-text num">{view.text}</span>
    </div>
  );
}
