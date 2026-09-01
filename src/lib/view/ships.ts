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
