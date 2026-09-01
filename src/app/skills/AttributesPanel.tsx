"use client";
import { IconWand } from "@tabler/icons-react";
import type { AttributePanelView, RemapSuggestionView } from "../../lib/view/plan.js";

export interface AttributesPanelProps {
  panel: AttributePanelView;
  suggestion: RemapSuggestionView | null;
  optimising: boolean;
  usingRemap: boolean;
  onOptimise(): void;
  onToggleRemap(next: boolean): void;
}

export function AttributesPanel({
  panel, suggestion, optimising, usingRemap, onOptimise, onToggleRemap,
}: AttributesPanelProps) {
  const remapNote = [
    panel.bonusRemaps === null ? null : `${panel.bonusRemaps} bonus remap${panel.bonusRemaps === 1 ? "" : "s"}`,
    panel.remapAvailable === null ? null : `next remap ${panel.remapAvailable}`,
  ].filter((part): part is string => part !== null).join(" · ");

  return (
    <div className="card">
      <h2 className="card-title">Attributes</h2>
      {panel.sane ? null : (
        <p className="banner">
          These attributes cannot be a legal remap (they must be five values of 17–27 totalling 99)
          — they may already include implant bonuses.
        </p>
      )}
      <div className="attr-grid">
        {panel.attributes.map((a) => (
          <div key={a.key} className="attr">
            <span className="attr-label">{a.label}</span>
            <div>
              <span className="attr-total">{a.total}</span>
              {a.bonus > 0 ? <span className="attr-bonus">+{a.bonus}</span> : null}
            </div>
            <span className="faint">{a.base} base</span>
          </div>
        ))}
      </div>
      {remapNote === "" ? null : <p className="faint">{remapNote}</p>}

      <h3 className="section-title">Training rate</h3>
      {panel.pairs.length === 0
        ? <p className="faint">Nothing left to train.</p>
        : (
          <ul className="value-list">
            {panel.pairs.map((pair) => (
              <li key={pair.label}>
                <span>{pair.label}</span>
                <span className="num">{pair.spPerHour}</span>
                <span className="faint">{pair.entries} entr{pair.entries === 1 ? "y" : "ies"}</span>
              </li>
            ))}
          </ul>
        )}

      <h3 className="section-title">Optimal remap</h3>
      <button type="button" className="fit-btn" onClick={onOptimise} disabled={optimising}>
        <IconWand size={14} /> {optimising ? "Optimising…" : "Find optimal remap"}
      </button>
      {suggestion === null ? null : suggestion.alreadyOptimal
        ? <p className="faint">Already optimal for this plan.</p>
        : (
          <>
            <ul className="remap-list">
              {suggestion.deltas.map((d) => (
                <li key={d.key}>
                  <span>{d.label}</span>
                  <span className="num">{d.from} → {d.to}</span>
                  <span className="num remap-delta">{d.delta}</span>
                </li>
              ))}
            </ul>
            <ul className="value-list">
              <li><span>With this remap</span><span className="num">{suggestion.totalTime}</span></li>
              <li><span>As you are</span><span className="num">{suggestion.currentTime}</span></li>
              <li className="value-total"><span>Saved</span><span className="num pos">{suggestion.saved}</span></li>
            </ul>
            <label className="check-row">
              <input type="checkbox" checked={usingRemap} aria-label="Plan with this remap"
                     onChange={(e) => onToggleRemap(e.target.checked)} />
              Plan with this remap
            </label>
          </>
        )}
    </div>
  );
}
