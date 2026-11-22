export type BarTone = "default" | "accent" | "bad";

/**
 * The 4px segmented bar (redesign hand-off, DESIGN_SYSTEM.md "Segmented bar"): training progress in
 * amber, CPU / powergrid / calibration in the neutral fill, coral when over. `value` is a fraction;
 * anything past 1 draws a full bar.
 */
export function SegBar({ value, label, tone = "default", className }: { value: number; label: string; tone?: BarTone; className?: string }) {
  const width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  return (
    <span className={`yo-bar${tone === "default" ? "" : ` is-${tone}`}${className === undefined ? "" : ` ${className}`}`} role="img" aria-label={label}>
      <i style={{ width }} />
    </span>
  );
}
