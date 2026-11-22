import { sp } from "./format.js";

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

/**
 * "MAIN" / "ALT" — the account's name in capitals, as the badge beside a character's name. Accounts
 * are named by the owner in Settings (ESI does not expose them), so any other name shows as typed.
 */
export function accountTag(accountId: number | null, accounts: readonly { id: number; name: string }[]): string | null {
  const account = accountId === null ? undefined : accounts.find((a) => a.id === accountId);
  return account === undefined ? null : account.name.toUpperCase();
}

export interface CharacterOptionView { id: number; name: string; tag: string | null; sp: string | null; needsReauth: boolean }

/** The rows of the character dropdown, in the order the characters are listed everywhere else. */
export function characterOptions(
  characters: readonly { id: number; name: string; accountId: number | null; tokenStatus: "ok" | "needs_reauth" }[],
  accounts: readonly { id: number; name: string }[],
  totalSp: ReadonlyMap<number, number | null>,
): CharacterOptionView[] {
  return characters.map((c) => {
    const points = totalSp.get(c.id) ?? null;
    return {
      id: c.id, name: c.name, tag: accountTag(c.accountId, accounts),
      sp: points === null ? null : sp(points, false),
      needsReauth: c.tokenStatus === "needs_reauth",
    };
  });
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

/**
 * The Skills page's Multiview tab: the saved list in its saved order (characters since removed are
 * skipped), or the Overview's set when nothing has been saved yet.
 */
export function multiviewCharacters<T extends { id: number }>(
  characters: readonly T[], saved: readonly number[], overviewIds: ReadonlySet<number>,
): T[] {
  if (saved.length === 0) return overviewCharacters(characters, overviewIds);
  const byId = new Map(characters.map((c) => [c.id, c]));
  return saved.flatMap((id) => byId.get(id) ?? []);
}
