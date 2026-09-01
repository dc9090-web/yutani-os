/** sde_categories.id for Skills — the Skills page shows nothing outside it (spec §7). */
export const SKILL_CATEGORY_ID = 16;

export type AttributeKey = "charisma" | "intelligence" | "memory" | "perception" | "willpower";

/** charismaBonus … willpowerBonus in sde_type_attributes, in the order EVE numbers them. */
export const ATTRIBUTE_BONUS_ATTR: Record<AttributeKey, number> = {
  charisma: 175, intelligence: 176, memory: 177, perception: 178, willpower: 179,
};

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  charisma: "Charisma", intelligence: "Intelligence", memory: "Memory",
  perception: "Perception", willpower: "Willpower",
};

const ORDER: AttributeKey[] = ["charisma", "intelligence", "memory", "perception", "willpower"];

export interface AttributeView { key: AttributeKey; label: string; base: number; bonus: number; total: number }

/**
 * base + Σ implant attribute bonus (spec §7). `implantAttributes` is one `getTypeAttributes(typeId)`
 * map per implant on the active clone; an implant with no relevant attribute contributes zero.
 */
export function attributeViews(
  base: Record<AttributeKey, number>,
  implantAttributes: ReadonlyMap<number, number>[],
): AttributeView[] {
  return ORDER.map((key) => {
    const attributeId = ATTRIBUTE_BONUS_ATTR[key];
    let bonus = 0;
    for (const attributes of implantAttributes) bonus += attributes.get(attributeId) ?? 0;
    return { key, label: ATTRIBUTE_LABEL[key], base: base[key], bonus, total: base[key] + bonus };
  });
}

/**
 * 0–1 progress of a queue entry by wall clock. SP-based progress would need the character's live SP,
 * which ESI only refreshes on login; the dates are exact. A paused entry has no dates and reads 0.
 */
export function queueProgress(entry: { startDate: Date | null; finishDate: Date | null }, now: Date): number {
  if (entry.startDate === null || entry.finishDate === null) return 0;
  const window = entry.finishDate.getTime() - entry.startDate.getTime();
  if (window <= 0) return 1;
  const done = (now.getTime() - entry.startDate.getTime()) / window;
  return Math.min(1, Math.max(0, done));
}
