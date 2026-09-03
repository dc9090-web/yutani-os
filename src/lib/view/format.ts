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

/**
 * "128,450,032 ISK" — the Overview wallet row (design hand-back): whole ISK only, no decimals.
 * `isk()` itself keeps its two decimals everywhere else (spec §7), so this is a separate function
 * rather than a flag on it.
 */
export function iskWhole(value: number): string {
  return `${grouped(Math.round(value))} ISK`;
}

/**
 * "12.3M SP" / "850k SP" / "512 SP". The k branch floors so 999,999 never reads "1000k SP".
 * `withUnit = false` drops the trailing " SP" for a spot (the Overview footer) where the label next
 * to it already says "Total SP".
 */
export function sp(value: number, withUnit = true): string {
  const unit = withUnit ? " SP" : "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${unit}`;
  if (value >= 1_000) return `${Math.floor(value / 1_000)}k${unit}`;
  return `${grouped(Math.round(value))}${unit}`;
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

/**
 * "5d 13h 20m" — a training span, as the planner shows it. Distinct from `relativeTime`'s
 * private `span`, which collapses anything over a day to whole days: right for "synced 2 days ago",
 * useless for a plan whose length is the whole point. Minutes are zero-padded to two digits once a
 * larger unit (day or hour) precedes them, matching the design hand-back's "1d 4h 09m".
 */
export function duration(ms: number): string {
  if (ms <= 0) return "0m";
  const minutes = Math.round(ms / MINUTE);
  if (minutes === 0) return "< 1m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (rest > 0 || parts.length === 0) {
    const padded = parts.length > 0 ? String(rest).padStart(2, "0") : String(rest);
    parts.push(`${padded}m`);
  }
  return parts.join(" ");
}

/**
 * "3d 12h 09m 41s" — the live queue-countdown ticker (design hand-back). The only place seconds are
 * shown at all: this re-renders every second, whereas `duration()` (which floors to whole minutes)
 * is used everywhere else a span is displayed once and left alone.
 */
export function countdown(ms: number): string {
  if (ms <= 0) return "Queue complete";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
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

export interface QueueHeadView {
  skillName: string; finishedLevel: number; startDate: Date | null; finishDate: Date | null;
}

/** The Overview footer's `.ov-training` block (design hand-back): a skill name, its `.dur` remaining
 *  time, and a mini progress bar — or, when there is nothing training, a faint one-line message. */
export type OverviewTraining =
  | { active: true; skill: string; time: string; percent: number }
  | { active: false; label: string };

/**
 * Skill name + level, a `duration()` remaining-time string, and a 0–100 fill percent derived from
 * the queue head's start/finish bounds against `now`. A stale head — its finishDate already passed —
 * means the sync just hasn't caught up with ESI yet, not that the skill is still finishing "3h ago";
 * render it as 100% complete instead of a confusing past tense. A paused queue comes back from ESI
 * with no dates at all (phase 3a stores them as NULL): the remaining time cannot be known, so `time`
 * says so and `percent` is 0 rather than guessed.
 */
export function overviewTraining(head: QueueHeadView | null, now: Date = new Date()): OverviewTraining {
  if (head === null) return { active: false, label: "Queue empty" };
  const skill = `${head.skillName} ${roman(head.finishedLevel)}`;
  if (head.finishDate === null) return { active: true, skill, time: "paused", percent: 0 };
  const remaining = head.finishDate.getTime() - now.getTime();
  if (remaining <= 0) return { active: true, skill, time: duration(0), percent: 100 };
  const percent = head.startDate === null ? 0 : Math.max(0, Math.min(100, Math.round(
    ((now.getTime() - head.startDate.getTime()) / (head.finishDate.getTime() - head.startDate.getTime())) * 100)));
  return { active: true, skill, time: duration(remaining), percent };
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

const DESCRIPTION_MAX = 600;

/**
 * An SDE type description as hover text: anchors and other client markup stripped, CRLF and runs
 * of blank lines collapsed to paragraph breaks (rendered with `white-space: pre-line`), and the
 * rare multi-screen essay cut at a word boundary. Null when the SDE has nothing to say.
 */
export function typeDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = raw.replace(/<[^>]*>/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  if (text === "") return null;
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), DESCRIPTION_MAX - 40)).trimEnd()}…`;
}
