export interface CharacterView { id: number; name: string; accountId: number | null; corporationName: string | null; allianceName: string | null; tokenStatus: "ok" | "needs_reauth" }
export interface CharacterGroup { label: string; characters: CharacterView[] }

export function groupByAccount(characters: CharacterView[], accounts: { id: number; name: string }[]): CharacterGroup[] {
  const groups: CharacterGroup[] = [];
  for (const a of accounts) {
    const cs = characters.filter((c) => c.accountId === a.id);
    if (cs.length) groups.push({ label: a.name, characters: cs });
  }
  const known = new Set(accounts.map((a) => a.id));
  const rest = characters.filter((c) => c.accountId === null || !known.has(c.accountId));
  if (rest.length) groups.push({ label: "Unassigned", characters: rest });
  return groups;
}

export function portraitUrl(id: number, size: 64 | 128 | 256 = 64): string {
  return `https://images.evetech.net/characters/${id}/portrait?size=${size}`;
}

export function toCharacterView(c: { id: number; name: string; accountId: number | null; corporationName: string | null; allianceName: string | null; tokenStatus: "ok" | "needs_reauth" }): CharacterView {
  return { id: c.id, name: c.name, accountId: c.accountId, corporationName: c.corporationName, allianceName: c.allianceName, tokenStatus: c.tokenStatus };
}

/**
 * "Active character" per spec §7: the session's `activeCharacterId`, falling back to the first
 * character. Returns null only when no character is authorised at all.
 */
export function pickActive<T extends { id: number }>(characters: T[], activeId: number | null): T | null {
  if (characters.length === 0) return null;
  return characters.find((c) => c.id === activeId) ?? characters[0];
}

/**
 * The characters the Overview page and the Skills training overview show: those in
 * OVERVIEW_CHARACTER_IDS, in their stored order — or everyone when the list is empty, so a fresh
 * install with no list configured still shows something.
 */
export function overviewCharacters<T extends { id: number }>(characters: readonly T[], ids: ReadonlySet<number>): T[] {
  return ids.size === 0 ? [...characters] : characters.filter((c) => ids.has(c.id));
}
