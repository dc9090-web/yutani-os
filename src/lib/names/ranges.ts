export type LocationKind = "station" | "structure" | "system" | "unknown";

/**
 * ESI location ids are ranged, not typed: 30000000–39999999 are solar systems, 60000000–69999999
 * are NPC stations, and 1 000 000 000 000 and up are player structures. Anything else (an asset's
 * parent item id, a fitting slot, a corporation office) is not a place we can name.
 */
export function classifyLocation(id: number): LocationKind {
  if (id >= 30_000_000 && id <= 39_999_999) return "system";
  if (id >= 60_000_000 && id <= 69_999_999) return "station";
  if (id >= 1_000_000_000_000) return "structure";
  return "unknown";
}

/** "Unknown structure (1035…)" — what the UI shows when a citadel is forbidden or never resolved. */
export function unknownStructureLabel(id: number): string {
  return `Unknown structure (${String(id).slice(0, 4)}…)`;
}
