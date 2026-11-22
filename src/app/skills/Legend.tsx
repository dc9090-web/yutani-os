import type { ReactNode } from "react";

/** The key above a list of level blocks: Trained, Training now, Queued and — on the sheet — Untrained. */
export function BlockLegend({ untrained = false, children }: { untrained?: boolean; children?: ReactNode }) {
  return (
    <div className="yo-legend">
      <span className="yo-legend-item"><span className="yo-block is-filled" aria-hidden="true" />Trained</span>
      <span className="yo-legend-item"><span className="yo-block is-training" aria-hidden="true" />Training now</span>
      <span className="yo-legend-item"><span className="yo-block is-queued" aria-hidden="true" />Queued</span>
      {untrained ? <span className="yo-legend-item"><span className="yo-block" aria-hidden="true" />Untrained</span> : null}
      {children}
    </div>
  );
}
