/**
 * Pure view helpers for the Ships pages. No I/O, no React — every function here is unit-tested and
 * the components stay dumb (the phase-3b pattern).
 */

/** dogmaUnits 105 Percentage, 109 Modifier Percent, 127 Absolute Percent all display as "%". */
const PERCENT_UNIT_IDS: ReadonlySet<number> = new Set([105, 109, 127]);

/** The SDE's bonus text carries `<a href=showinfo:3302>…</a>` anchors; the page shows plain text. */
export function stripBonusMarkup(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/** "7.5% bonus to Small Projectile Turret rate of fire" — value first, then the stripped text. */
export function bonusLabel(b: { bonus: number | null; bonusText: string | null; unitId: number | null }): string {
  const text = stripBonusMarkup(b.bonusText ?? "").trim();
  if (b.bonus === null) return text;
  const value = `${b.bonus}${b.unitId !== null && PERCENT_UNIT_IDS.has(b.unitId) ? "%" : ""}`;
  return text === "" ? value : `${value} ${text}`;
}

/** A resource bar: CPU, powergrid or calibration. `over` drives the `.over` CSS class (spec §4). */
export interface GaugeView {
  label: string; unit: string; used: number; output: number;
  text: string; percent: number; over: boolean;
}

/**
 * `percent` is clamped to 100 so the bar never overflows its track; `over` is the honest
 * `used > output` test — the same one `validateFit` makes, with no epsilon, because the engine
 * already rounded CPU and powergrid to two decimals. A blank `unit` (calibration) would otherwise
 * leave a trailing space in `text`; trim it so the two forms both read cleanly.
 */
export function gauge(
  label: string, unit: string, pool: { used: number; output: number }, digits = 2,
): GaugeView {
  const raw = pool.output > 0 ? (pool.used / pool.output) * 100 : pool.used > 0 ? 100 : 0;
  return {
    label, unit, used: pool.used, output: pool.output,
    text: `${pool.used.toFixed(digits)} / ${pool.output.toFixed(digits)} ${unit}`.trimEnd(),
    percent: Math.round(Math.min(100, raw) * 10) / 10,
    over: pool.used > pool.output,
  };
}
