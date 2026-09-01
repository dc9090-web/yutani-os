/**
 * Request-body validation for the fit routes, as pure functions so the rules are unit-tested
 * rather than smoke-tested through a route. `null` always means "answer 400".
 */
import { DRONE_BAY_FLAG, slotFromFlag } from "../dogma/index.js";
import { CARGO_FLAG, FIT_ITEM_STATES, type FitItem, type FitItemState } from "./doc.js";

export const MAX_FIT_ITEMS = 200;
export const MAX_FIT_NAME = 60;
export const MAX_FIT_DESCRIPTION = 500;
const MAX_QUANTITY = 1_000_000_000;

export interface FitCreateBody {
  name: string; description: string; shipTypeId: number; characterId: number | null; items: FitItem[];
}
export interface FitPatchBody {
  name?: string; description?: string; characterId?: number | null; items?: FitItem[];
}

const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const field = (body: unknown, key: string): unknown =>
  body !== null && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
const has = (body: unknown, key: string): boolean =>
  body !== null && typeof body === "object" && key in (body as Record<string, unknown>);

function validFlag(flag: unknown): flag is string {
  return typeof flag === "string"
    && (flag === CARGO_FLAG || flag === DRONE_BAY_FLAG || slotFromFlag(flag) !== null);
}

export function parseFitItems(raw: unknown): FitItem[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FIT_ITEMS) return null;
  const out: FitItem[] = [];
  for (const entry of raw) {
    const typeId = field(entry, "typeId");
    const flag = field(entry, "flag");
    if (!isPositiveInt(typeId) || !validFlag(flag)) return null;

    const rawQuantity = field(entry, "quantity");
    const quantity = rawQuantity === undefined ? 1 : rawQuantity;
    if (!isPositiveInt(quantity) || quantity > MAX_QUANTITY) return null;

    const rawCharge = field(entry, "chargeTypeId");
    const chargeTypeId = rawCharge === undefined || rawCharge === null ? null : rawCharge;
    if (chargeTypeId !== null && !isPositiveInt(chargeTypeId)) return null;

    const rawState = field(entry, "state");
    const state = rawState === undefined ? "active" : rawState;
    if (typeof state !== "string" || !FIT_ITEM_STATES.includes(state as FitItemState)) return null;

    out.push({ typeId, quantity, flag, chargeTypeId, state: state as FitItemState });
  }
  return out;
}

// Would break a stored name back out of an EFT `[Hull, Name]` header, so it is never accepted,
// generated names are clamped clean instead (see `clampFitName`).
const UNSAFE_NAME_CHARS = /[\n\r\]]/;

function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (UNSAFE_NAME_CHARS.test(name)) return null;
  return name.length >= 1 && name.length <= MAX_FIT_NAME ? name : null;
}

/**
 * The three "make me a new fit" sources (spec §6) and the editor toolbar's Clone build a name from
 * data `parseFitCreate`/`parseFitPatch` would reject outright — an EFT header's fit name, a saved
 * fitting's name, an asset's custom name, `"${name} copy"`. Rather than 400 later, clean it up front:
 * trim, drop the characters `parseName` rejects, cap at `MAX_FIT_NAME`, and never hand back empty.
 */
export function clampFitName(raw: string): string {
  const cleaned = raw.trim().replace(/[\n\r\]]/g, "").slice(0, MAX_FIT_NAME);
  return cleaned.length > 0 ? cleaned : "Unnamed fit";
}

function parseDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw.length <= MAX_FIT_DESCRIPTION ? raw : null;
}

export function parseFitCreate(body: unknown): FitCreateBody | null {
  const name = parseName(field(body, "name"));
  const shipTypeId = field(body, "shipTypeId");
  if (name === null || !isPositiveInt(shipTypeId)) return null;

  const rawDescription = field(body, "description");
  const description = rawDescription === undefined ? "" : parseDescription(rawDescription);
  if (description === null) return null;

  const rawCharacter = field(body, "characterId");
  const characterId = rawCharacter === undefined || rawCharacter === null ? null : rawCharacter;
  if (characterId !== null && !isPositiveInt(characterId)) return null;

  const rawItems = field(body, "items");
  const items = rawItems === undefined ? [] : parseFitItems(rawItems);
  if (items === null) return null;

  return { name, description, shipTypeId, characterId, items };
}

export function parseFitPatch(body: unknown): FitPatchBody | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const patch: FitPatchBody = {};

  if (has(body, "name")) {
    const name = parseName(field(body, "name"));
    if (name === null) return null;
    patch.name = name;
  }
  if (has(body, "description")) {
    const description = parseDescription(field(body, "description"));
    if (description === null) return null;
    patch.description = description;
  }
  // An explicit null selects the "All skills V" pilot, so absent and null are different answers.
  if (has(body, "characterId")) {
    const raw = field(body, "characterId");
    if (raw !== null && !isPositiveInt(raw)) return null;
    patch.characterId = raw === null ? null : (raw as number);
  }
  if (has(body, "items")) {
    const items = parseFitItems(field(body, "items"));
    if (items === null) return null;
    patch.items = items;
  }
  return patch;
}
