/**
 * Display formatting for the phase-3 pages. Pure, no locale data: the runtime's ICU tables are not
 * guaranteed in the production container, so thousands separators are done by hand exactly like
 * `StaticDataPanel.grouped` in phase 2.
 */

export function grouped(value: string | number): string {
  const raw = typeof value === "number" ? String(value) : value;
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [whole, fraction] = body.split(".");
  const separated = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${separated}${fraction === undefined ? "" : `.${fraction}`}`;
}

/**
 * "1,234,567.89 ISK" — spec §7. Always two decimals, even for a whole number.
 * `toFixed` rounds tiny negatives (e.g. -0.001) to "-0.00"; normalise that to "0.00" so the sign
 * never appears without a nonzero magnitude behind it.
 */
export function isk(value: number): string {
  const fixed = value.toFixed(2);
  return `${grouped(fixed === "-0.00" ? "0.00" : fixed)} ISK`;
}

/** "12.3M SP" / "850k SP" / "512 SP". The k branch floors so 999,999 never reads "1000k SP". */
export function sp(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M SP`;
  if (value >= 1_000) return `${Math.floor(value / 1_000)}k SP`;
  return `${grouped(Math.round(value))} SP`;
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];

export function roman(level: number): string {
  return ROMAN[level] ?? String(level);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 h 12 m" / "42 m" / "2 days" — the magnitude, without direction. */
function span(ms: number): string {
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} m`;
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} m`;
  }
  const days = Math.floor(ms / DAY);
  return days === 1 ? "1 day" : `${days} days`;
}

/** "in 3 h 12 m" / "2 days ago" / "just now" / "never" — spec §7. */
export function relativeTime(date: Date | null, now: Date = new Date()): string {
  if (date === null) return "never";
  const delta = date.getTime() - now.getTime();
  const magnitude = Math.abs(delta);
  if (magnitude < MINUTE) return "just now";
  return delta > 0 ? `in ${span(magnitude)}` : `${span(magnitude)} ago`;
}

export type SecClass = "sec-high" | "sec-low" | "sec-null";

/**
 * The client rounds security to one decimal before colouring it, and so do we: 0.45 is high-sec.
 * A genuinely nonzero status below 0.05 is the one exception — the game still rounds that band up
 * to 0.1 rather than letting plain rounding drop it to 0.0, so 0.01 reads "0.1"/sec-low, not
 * "0.0"/sec-null. A true 0.0 (or negative) status is unaffected.
 */
function rounded(status: number): number {
  if (status > 0 && status < 0.05) return 0.1;
  return Math.round(status * 10) / 10;
}

export function secClass(status: number | null): SecClass {
  if (status === null) return "sec-null";
  const value = rounded(status);
  if (value >= 0.5) return "sec-high";
  return value > 0 ? "sec-low" : "sec-null";
}

export function secText(status: number | null): string {
  return status === null ? "—" : rounded(status).toFixed(1);
}

/** "2026-08-31 18:30" — the timestamp format the settings tables use across the app. */
export function stamp(date: Date | null): string {
  return date === null ? "—" : date.toISOString().replace("T", " ").slice(0, 16);
}

export interface QueueHeadLabel { skillName: string; finishedLevel: number; finishDate: Date | null }

/**
 * "Caldari Frigate V · finishes in 3 h 12 m" — the Overview's training line. A stale head — its
 * finishDate already passed — means the sync just hasn't caught up with ESI yet, not that the
 * skill is still finishing "3 h ago"; render it as still-in-progress instead of a confusing past tense.
 */
export function trainingLabel(head: QueueHeadLabel | null, now: Date = new Date()): string {
  if (head === null) return "Queue empty";
  const skill = `${head.skillName} ${roman(head.finishedLevel)}`;
  // A paused queue comes back from ESI with no dates at all (phase 3a stores them as NULL).
  if (head.finishDate === null) return `${skill} · paused`;
  if (head.finishDate.getTime() <= now.getTime()) return `${skill} · finishing`;
  return `${skill} · finishes ${relativeTime(head.finishDate, now)}`;
}

/**
 * A job that partly succeeded records `ok` and puts its message in `sync_runs.error` behind this
 * prefix (spec §3). The worker's scheduler writes it and the settings page reads it, so the literal
 * lives here — in the one module with no imports at all — rather than in either of them.
 */
export const WARN_PREFIX = "warn: ";

export function isWarning(error: string | null): boolean {
  return error !== null && error.startsWith(WARN_PREFIX);
}
