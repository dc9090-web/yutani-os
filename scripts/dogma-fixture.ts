/**
 * Regenerates tests/fixtures/dogma/*.json from the SDE imported into the dev database.
 *
 *   npm run dogma:fixture                    # every named fixture
 *   npm run dogma:fixture -- rifter          # just that one
 *   npm run dogma:fixture -- scratch 587 519 # an ad-hoc snapshot
 *
 * The snapshots are committed and regenerated only deliberately — every engine test asserts against
 * the values they contain, so a regeneration is a test change. Import
 * `.superpowers/research/sde-3484357.zip` first so the snapshots match tests/fixtures/sde-mini.zip.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { closePool } from "../src/lib/db/client.js";
import { loadDogmaData } from "../src/lib/dogma/sde-loader.js";
import {
  ATTR, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, REQUIRED_SKILL_ATTRS, serialiseDogmaData,
  type AttrId, type DogmaAttribute, type DogmaData, type DogmaEffect, type DogmaGroup, type DogmaType,
  type EffectId, type GroupId, type TypeId,
} from "../src/lib/dogma/data.js";

/** The fixture definitions are this script's contract — do not duplicate them in a test. */
const FIXTURES: Record<string, TypeId[]> = {
  rifter: [
    587,    // Rifter
    2889,   // 200mm AutoCannon II
    2048,   // Damage Control II            (maxGroupFitted 1)
    519,    // Gyrostabilizer II
    440,    // 5MN Microwarpdrive II
    380,    // Small Shield Extender II
    33076,  // Small Ancillary Armor Repairer (maxGroupFitted 1)
    31686,  // Small Projectile Collision Accelerator II (rig size 1, calibration 300)
    31682,  // Medium Projectile Collision Accelerator I (rig size 2, calibration 200)
    31724,  // Medium EM Shield Reinforcer II            (rig size 2, calibration 75)
    484,    // 125mm Gatling AutoCannon I
    5443,   // Faint Epsilon Scoped Warp Scrambler
    12608,  // Hail S                       (charge)
    27339,  // Caldari Navy Mjolnir Torpedo (the Invalid-flag fitting item)
    4256,   // Bomb Launcher II             (canFitShipGroup01 834)
    12034,  // Hound                        (group 834)
    27143,  // Zainou 'Gypsy' CPU Management EE-601 (implant)
    2456,   // Hobgoblin II                 (drone)
    626,    // Vexor
    3426, 3413, 3318, 11207,   // CPU Management, Power Grid Management, Weapon Upgrades, Advanced Weapon Upgrades
  ],
  tengu: [
    29984,  // Tengu
    45601,  // Tengu Offensive - Accelerated Ejection Bay (effects 3772/3773/3774)
    3426, 3413,
  ],
};

const DEST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "dogma");

/** Attributes the engine reads by name, whether or not any included type carries them. */
const ENGINE_ATTRIBUTE_IDS: readonly AttrId[] = [
  ...Object.values(ATTR),
  ...CAN_FIT_SHIP_TYPE_ATTRS,
  ...CAN_FIT_SHIP_GROUP_ATTRS,
  ...REQUIRED_SKILL_ATTRS.flatMap(([skill, level]) => [skill, level]),
];

function sorted<T>(entries: Map<number, T>): Map<number, T> {
  return new Map([...entries.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * Keep only what items built from these types can reach: their own attributes, the attributes their
 * effects read and write, the engine's named attributes, and any max/min cap targets of those.
 */
function prune(data: DogmaData): DogmaData {
  const effects = new Map<EffectId, DogmaEffect>();
  const groups = new Map<GroupId, DogmaGroup>();
  const attrIds = new Set<AttrId>(ENGINE_ATTRIBUTE_IDS);
  const types = new Map<TypeId, DogmaType>();

  for (const type of sorted(data.types).values()) {
    types.set(type.id, { ...type, attrs: sorted(type.attrs), effects: sorted(type.effects) });
    const group = data.groups.get(type.groupId);
    if (group) groups.set(group.id, group);
    for (const attrId of type.attrs.keys()) attrIds.add(attrId);
    for (const effectId of type.effects.keys()) {
      const effect = data.effects.get(effectId);
      if (!effect) continue;                 // dropped at load time (effect category 3 or 6)
      effects.set(effect.id, effect);
      if (effect.fittingUsageChanceAttrId !== undefined) attrIds.add(effect.fittingUsageChanceAttrId);
      for (const m of effect.modifiers) {
        attrIds.add(m.modifiedAttrId);
        attrIds.add(m.modifyingAttrId);
      }
    }
  }

  for (let changed = true; changed;) {
    changed = false;
    for (const id of [...attrIds]) {
      const attr = data.attributes.get(id);
      if (!attr) continue;
      for (const target of [attr.maxAttributeId, attr.minAttributeId]) {
        if (target !== undefined && !attrIds.has(target)) { attrIds.add(target); changed = true; }
      }
    }
  }

  const attributes = new Map<AttrId, DogmaAttribute>();
  for (const id of [...attrIds].sort((a, b) => a - b)) {
    const attr = data.attributes.get(id);
    if (attr) attributes.set(id, attr);
  }
  return { attributes, effects: sorted(effects), groups: sorted(groups), types };
}

function jobs(): [string, TypeId[]][] {
  const [name, ...ids] = process.argv.slice(2);
  if (ids.length > 0) return [[name, ids.map(Number)]];
  if (name) {
    const seeds = FIXTURES[name];
    if (!seeds) throw new Error(`unknown fixture ${name}; known: ${Object.keys(FIXTURES).join(", ")}`);
    return [[name, seeds]];
  }
  return Object.entries(FIXTURES);
}

async function main(): Promise<void> {
  await mkdir(DEST_DIR, { recursive: true });
  for (const [name, seeds] of jobs()) {
    const data = prune(await loadDogmaData(seeds));
    const dest = path.join(DEST_DIR, `${name}.json`);
    await writeFile(dest, `${JSON.stringify(serialiseDogmaData(data), null, 1)}\n`);
    console.log(
      `${name}: ${data.types.size} types, ${data.effects.size} effects, ` +
      `${data.attributes.size} attributes, ${data.groups.size} groups → ${dest}`);
  }
  await closePool();
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
