/**
 * Regenerates tests/fixtures/api/sde-extra.json from a full SDE archive.
 *
 *   npm run api:sde-extra -- .superpowers/research/sde-3484357.zip
 *
 * tests/fixtures/sde-mini.zip holds ten types — enough for the importer's tests, not for a ship
 * sheet with weapons, ammunition and drones. This file is the difference: the extra records the
 * API contract fixtures (`npm run api:fixtures`) need, laid over the mini SDE at seed time. It is
 * kept apart so the mini SDE, whose record counts many tests assert, does not change. Only English
 * text is kept. Regenerating it changes api-fixtures/v1, so it is a deliberate test change.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { readJsonlMember } from "../src/lib/sde/jsonl.js";

/** What the invented characters fly, fit, carry, train and have plugged in. */
const TYPE_IDS = [
  593, 940,                                   // Tristan and its blueprint
  3178, 222, 12612, 12614,                    // Light Neutron Blaster II; Antimatter, Void, Null S
  4405, 2048, 1183, 438, 448, 527,            // Drone Damage Amplifier II, Damage Control II, Small Armor Repairer II, 1MN Afterburner II, Warp Scrambler II, Stasis Webifier II
  31045, 31526,                               // Small Auxiliary Nano Pump I, Small Hybrid Burst Aerator I
  2456, 2488,                                 // Hobgoblin II, Warrior II
  2889, 21898, 12608,                         // 200mm AutoCannon II, Republic Fleet EMP S, Hail S
  28668, 3297,                                // Nanite Repair Paste, Small Standard Container
  10208, 10212, 10216, 10221, 10225, 13216,   // five attribute implants and a hardwiring
  // Skills: gunnery, drones, armor, navigation, engineering, targeting.
  3310, 3311, 3312, 3315, 3316, 3317, 3318, 11207, 12210,
  3436, 3437, 3442, 12305, 12486, 23606, 23618, 24241,
  3327, 3328, 3392, 3393, 3394, 3402, 3417, 3418, 3427, 3428, 3429, 3431, 3435, 3449, 3450, 3452, 3453,
];

/** requiredSkill1..6 — a type's prerequisites, pulled in so every skill a fit asks for has a name. */
const REQUIRED_SKILL_ATTRS = new Set([182, 183, 184, 1285, 1289, 1290]);

type Rec = Record<string, unknown>;
const asArray = (value: unknown): Rec[] => (Array.isArray(value) ? (value as Rec[]) : []);

/** `{ en, de, fr, … }` → `{ en }`: the importer reads English only and the rest is most of the bytes. */
function englishOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(englishOnly);
  if (value === null || typeof value !== "object") return value;
  const rec = value as Rec;
  if (typeof rec.en === "string" && Object.values(rec).every((v) => typeof v === "string")) return { en: rec.en };
  return Object.fromEntries(Object.entries(rec).map(([key, v]) => [key, englishOnly(v)]));
}

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error("usage: npm run api:sde-extra -- <eve-online-static-data-<build>-jsonl.zip>");
  const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "api", "sde-extra.json");

  // The skill closure needs every type's dogma in hand before the type list is final.
  const dogma = new Map<number, Rec>();
  for await (const record of readJsonlMember(source, "typeDogma.jsonl")) dogma.set(record._key as number, record);
  const typeIds = new Set<number>();
  const visit = (id: number): void => {
    if (typeIds.has(id)) return;
    typeIds.add(id);
    for (const attr of asArray(dogma.get(id)?.dogmaAttributes)) {
      if (REQUIRED_SKILL_ATTRS.has(attr.attributeID as number)) visit(attr.value as number);
    }
  };
  TYPE_IDS.forEach(visit);

  const effectIds = new Set<number>();
  for (const id of typeIds) for (const e of asArray(dogma.get(id)?.dogmaEffects)) effectIds.add(e.effectID as number);

  const pick = async (member: string, keep: (r: Rec) => boolean): Promise<Rec[]> => {
    const out: Rec[] = [];
    for await (const record of readJsonlMember(source, `${member}.jsonl`)) if (keep(record)) out.push(englishOnly(record) as Rec);
    console.log(`  ${member}: ${out.length}`);
    return out;
  };
  const byType = (r: Rec): boolean => typeIds.has(r._key as number);

  const masteries = await pick("masteries", byType);
  const certificateIds = new Set<number>();
  for (const record of masteries) for (const level of asArray(record._value)) for (const id of (level._value as number[] | undefined) ?? []) certificateIds.add(id);

  const members = {
    types: await pick("types", byType),
    typeDogma: await pick("typeDogma", byType),
    typeBonus: await pick("typeBonus", byType),
    dogmaEffects: await pick("dogmaEffects", (r) => effectIds.has(r._key as number)),
    masteries,
    certificates: await pick("certificates", (r) => certificateIds.has(r._key as number)),
  };
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, `${JSON.stringify(members)}\n`);
  console.log(`wrote ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
