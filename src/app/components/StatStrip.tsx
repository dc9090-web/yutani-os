import type { CSSProperties, ReactNode } from "react";

export interface StatCellView {
  label: string;
  /** The headline figure, already formatted. */
  value: ReactNode;
  /** The small grey text beside the figure — its unit, or what it refers to. */
  unit?: ReactNode;
  /** Set when `unit` is a name or a phrase, not a unit: it is then set in the UI face, not mono. */
  unitIsText?: boolean;
  /** Set when `value` is a name, not a figure: it is set in the UI face at body size, its unit in mono. */
  valueIsText?: boolean;
  note?: ReactNode;
  tone?: "good" | "bad";
}

/**
 * A row of hairline-divided cells (redesign hand-off, DESIGN_SYSTEM.md "Stat strip"): micro label,
 * mono headline figure, optional note. `min` is the narrowest a cell may get before the row wraps;
 * on a phone the strip is always two columns.
 */
export function StatStrip({ cells, label, min = 240, small = false }: { cells: StatCellView[]; label: string; min?: number; small?: boolean }) {
  return (
    <section className={`yo-stat-strip${small ? " is-small" : ""}`} aria-label={label} style={{ "--yo-strip-min": `${min}px` } as CSSProperties}>
      {cells.map((cell) => (
        <div key={cell.label} className="yo-stat-cell">
          <span className="yo-label">{cell.label}</span>
          <span className={`yo-stat-figure${cell.valueIsText ? " is-name" : ""}${cell.tone === undefined ? "" : ` is-${cell.tone}`}`}>
            {cell.value}
            {cell.unit === undefined ? null : <span className={`yo-stat-unit${cell.unitIsText ? " is-text" : ""}${cell.valueIsText ? " is-mono" : ""}`}> {cell.unit}</span>}
          </span>
          {cell.note === undefined ? null : <span className="yo-stat-note">{cell.note}</span>}
        </div>
      ))}
    </section>
  );
}
