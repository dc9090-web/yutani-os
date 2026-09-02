/**
 * Request-body validation for the plan routes, as pure functions so the rules are unit-tested
 * rather than smoke-tested through a route. `null` always means "answer 400".
 */
import { ATTRIBUTE_KEYS, isLegalBase, type AttributeSet } from "./attributes.js";
import type { PlanEntry } from "./expand.js";
import { MAX_SKILL_LEVEL } from "./sp.js";

export const MAX_PLAN_ENTRIES = 500;
export const MAX_PLAN_NAME = 60;
export const MAX_PLAN_NOTE = 200;
export const MAX_IMPORT_CHARS = 40_000;

const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const field = (body: unknown, key: string): unknown =>
  body !== null && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
const has = (body: unknown, key: string): boolean =>
  body !== null && typeof body === "object" && key in (body as Record<string, unknown>);
const isObject = (body: unknown): boolean =>
  body !== null && typeof body === "object" && !Array.isArray(body);

function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_PLAN_NAME ? name : null;
}

/** For names the app generates (a template's name, "<name> copy", an import's default). */
export function clampPlanName(raw: string): string {
  const cleaned = raw.replace(/[\n\r]/g, " ").trim().slice(0, MAX_PLAN_NAME).trim();
  return cleaned.length > 0 ? cleaned : "Unnamed plan";
}

export function parsePlanEntries(raw: unknown): PlanEntry[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PLAN_ENTRIES) return null;
  const out: PlanEntry[] = [];
  for (const item of raw) {
    const skillId = field(item, "skillId");
    const level = field(item, "level");
    if (!isPositiveInt(skillId)) return null;
    if (!isPositiveInt(level) || level > MAX_SKILL_LEVEL) return null;
    const rawNote = field(item, "note");
    if (rawNote !== undefined && rawNote !== null
        && (typeof rawNote !== "string" || rawNote.length > MAX_PLAN_NOTE)) return null;
    out.push({ skillId, level, note: typeof rawNote === "string" ? rawNote : null });
  }
  return out;
}

/**
 * `undefined` means "reject the whole body"; `null` means "clear the remap". A remap must be a
 * legal base — five integers in 17..27 summing to 99 — because nothing downstream re-checks it.
 */
export function parseRemap(raw: unknown): AttributeSet | null | undefined {
  if (raw === null) return null;
  if (!isObject(raw)) return undefined;
  const out = {} as AttributeSet;
  for (const key of ATTRIBUTE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
    out[key] = value;
  }
  return isLegalBase(out) ? out : undefined;
}

export interface PlanCreateBody {
  characterId: number; name: string; entries: PlanEntry[]; templateId: number | null;
}

export function parsePlanCreate(body: unknown): PlanCreateBody | null {
  const characterId = field(body, "characterId");
  const name = parseName(field(body, "name"));
  if (!isPositiveInt(characterId) || name === null) return null;

  const rawTemplate = field(body, "templateId");
  const templateId = rawTemplate === undefined || rawTemplate === null ? null : rawTemplate;
  if (templateId !== null && !isPositiveInt(templateId)) return null;

  const rawEntries = field(body, "entries");
  // Spec §6 offers entries OR a template; asking for both is a bug in the caller, not a merge.
  if (templateId !== null && rawEntries !== undefined) return null;
  const entries = rawEntries === undefined ? [] : parsePlanEntries(rawEntries);
  if (entries === null) return null;

  return { characterId, name, entries, templateId };
}

export interface PlanPatchBody { name?: string; remap?: AttributeSet | null; entries?: PlanEntry[] }

export function parsePlanPatch(body: unknown): PlanPatchBody | null {
  if (!isObject(body)) return null;
  // A plan belongs to one character for life (Task 9); moving it is not a patch, it is a new plan.
  if (has(body, "characterId")) return null;
  const patch: PlanPatchBody = {};
  if (has(body, "name")) {
    const name = parseName(field(body, "name"));
    if (name === null) return null;
    patch.name = name;
  }
  if (has(body, "remap")) {
    const remap = parseRemap(field(body, "remap"));
    if (remap === undefined) return null;
    patch.remap = remap;
  }
  if (has(body, "entries")) {
    const entries = parsePlanEntries(field(body, "entries"));
    if (entries === null) return null;
    patch.entries = entries;
  }
  // An empty patch recognises no field at all — accepting it would silently bump `updated_at` for
  // no reason, so it is a 400 rather than a no-op write (mirrors the fits route's same rule).
  if (Object.keys(patch).length === 0) return null;
  return patch;
}

export interface PlanImportBody { characterId: number; name: string; text: string }

export function parsePlanImport(body: unknown): PlanImportBody | null {
  const characterId = field(body, "characterId");
  const name = parseName(field(body, "name"));
  const text = field(body, "text");
  if (!isPositiveInt(characterId) || name === null) return null;
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_IMPORT_CHARS) return null;
  return { characterId, name, text };
}
