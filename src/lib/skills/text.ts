/**
 * Plan text, both directions (spec §5).
 *
 * Out: one line per LEVEL, in plan order, `Gunnery V` (EVEMon) or `Gunnery 5` (the in-game
 * importer). In: either flavour, plus the `<localized hint="…">Name*</localized>` wrapper a
 * non-English client pastes, plus a bare name meaning level I.
 */
import { roman } from "../view/format.js";
import { skillLabel, type SkillCatalogue } from "./catalogue.js";

export type PlanTextFormat = "evemon" | "ingame";
export const PLAN_TEXT_FORMATS: readonly PlanTextFormat[] = ["evemon", "ingame"];

export function isPlanTextFormat(value: unknown): value is PlanTextFormat {
  return typeof value === "string" && (PLAN_TEXT_FORMATS as readonly string[]).includes(value);
}

const ROMAN_LEVELS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

export function levelFromToken(token: string): number | null {
  const lower = token.trim().toLowerCase();
  if (/^[1-5]$/.test(lower)) return Number(lower);
  return ROMAN_LEVELS[lower] ?? null;
}

export interface PlanTextLine { name: string; level: number; raw: string }

const LOCALIZED = /<localized\b[^>]*>([\s\S]*?)<\/localized>/gi;
const SKIPPED = /^(\*\*\*.*\*\*\*|#.*|\/\/.*)$/;

/**
 * One `PlanTextLine` per usable line. Blank lines, EVEMon remap markers (`***…***`) and `#` / `//`
 * comments are dropped silently — they are not entries and not failures.
 */
export function tokenisePlanText(text: string): PlanTextLine[] {
  const out: PlanTextLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (raw === "" || SKIPPED.test(raw)) continue;
    // Unwrap the client's localisation tag, then drop the trailing "*" it appends to the English name.
    const flat = raw.replace(LOCALIZED, "$1").replace(/\s+/g, " ").trim();
    const parts = flat.split(" ");
    const last = parts.length > 1 ? levelFromToken(parts[parts.length - 1]) : null;
    const level = last ?? 1;
    const name = (last === null ? flat : parts.slice(0, -1).join(" ")).replace(/\*$/, "").trim();
    if (name === "") continue;
    out.push({ name, level, raw });
  }
  return out;
}

/** The lower-cased names an import must resolve, deduplicated, in first-appearance order. */
export function planTextNames(text: string): string[] {
  const seen = new Set<string>();
  for (const line of tokenisePlanText(text)) seen.add(line.name.toLowerCase());
  return [...seen];
}

export interface ParsedPlanText { entries: { skillId: number; level: number }[]; unresolved: string[] }

/** `byName` is a lower-cased skill name → id map, from the catalogue (spec §5: exact, case-insensitive). */
export function resolvePlanLines(
  lines: readonly PlanTextLine[], byName: ReadonlyMap<string, number>,
): ParsedPlanText {
  const entries: { skillId: number; level: number }[] = [];
  const unresolved: string[] = [];
  for (const line of lines) {
    const skillId = byName.get(line.name.toLowerCase());
    if (skillId === undefined) unresolved.push(line.raw);
    else entries.push({ skillId, level: line.level });
  }
  return { entries, unresolved };
}

/**
 * A skill the catalogue does not hold is omitted: `skillLabel` would write "Unknown skill (id)",
 * which no importer anywhere accepts.
 */
export function exportPlanText(
  entries: readonly { skillId: number; level: number }[], catalogue: SkillCatalogue, format: PlanTextFormat,
): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (!catalogue.has(entry.skillId)) continue;
    const level = format === "evemon" ? roman(entry.level) : String(entry.level);
    lines.push(`${skillLabel(catalogue, entry.skillId)} ${level}`);
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
