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
