/**
 * Regenerates tests/fixtures/sde-mini.zip from a full SDE archive.
 *
 *   npm run sde:fixture -- .superpowers/research/sde-3484357.zip
 *
 * The fixture is committed and regenerated only deliberately — every DB and mapper test asserts
 * against the record counts and values it contains, so a regeneration is a test change.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, stat } from "node:fs/promises";
import { readJsonlMember } from "../src/lib/sde/jsonl.js";
import { writeZip, type ZipMember } from "./lib/zip.js";

/** Copied whole: together these are ~4.1 MB of JSON that deflates to well under the budget. */
const FULL_MEMBERS = [
  "_sde", "categories", "groups", "metaGroups", "dogmaUnits",
  "dogmaAttributeCategories", "dogmaAttributes", "marketGroups", "mapRegions",
];

/** Rifter, Gyrostabilizer II, Gunnery, Small Hybrid Turret, Small Projectile Turret,
 *  Minmatar Frigate, Power Grid Management, CPU Management, Tritanium, Jita Trade Hub. */
const TYPE_IDS = new Set([587, 519, 3300, 3301, 3302, 3329, 3413, 3426, 34, 52678]);

/** Effects kept regardless of whether an allow-listed type references them:
 *  754 shipHybridDamageBonusCF, 290 sharpshooter…, 146 damageMultiplierSkillBonus,
 *  92 projectileWeaponDamageMultiply, 89 projectileWeaponSpeedMultiply,
 *  5928 warpScrambleTargetMWDBlockActivationForEntity (the EffectStopper sample). */
const EXTRA_EFFECT_IDS = [754, 290, 146, 92, 89, 5928];

/** Kimotoro — contains Jita (30000142). */
const CONSTELLATION_IDS = new Set([20000020]);

/** Stations are kept by the system they orbit, not by their own id. */
const STATION_SYSTEM_IDS = new Set([30000142]);

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

async function member(source: string, name: string, keep: (r: Record<string, unknown>) => boolean): Promise<ZipMember> {
  const lines: string[] = [];
  for await (const record of readJsonlMember(source, `${name}.jsonl`)) {
    if (keep(record)) lines.push(JSON.stringify(record));
  }
  console.log(`  ${name}.jsonl: ${lines.length}`);
  return { name: `${name}.jsonl`, content: `${lines.join("\n")}\n` };
}

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error("usage: npm run sde:fixture -- <eve-online-static-data-<build>-jsonl.zip>");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dest = path.join(here, "..", "tests", "fixtures", "sde-mini.zip");
  await mkdir(path.dirname(dest), { recursive: true });

  // Pass 1: which effects and solar systems does the allow-list pull in?
  const effectIds = new Set<number>(EXTRA_EFFECT_IDS);
  for await (const record of readJsonlMember(source, "typeDogma.jsonl")) {
    if (!TYPE_IDS.has(record._key as number)) continue;
    for (const e of asArray(record.dogmaEffects)) effectIds.add(e.effectID as number);
  }
  const systemIds = new Set<number>();
  for await (const record of readJsonlMember(source, "mapConstellations.jsonl")) {
    if (!CONSTELLATION_IDS.has(record._key as number)) continue;
    for (const id of (record.solarSystemIDs as number[] | undefined) ?? []) systemIds.add(id);
  }
  console.log(`effects: ${effectIds.size}, solar systems: ${systemIds.size}`);

  // Pass 2: build every member.
  const members: ZipMember[] = [];
  for (const name of FULL_MEMBERS) members.push(await member(source, name, () => true));
  members.push(await member(source, "types", (r) => TYPE_IDS.has(r._key as number)));
  members.push(await member(source, "typeDogma", (r) => TYPE_IDS.has(r._key as number)));
  members.push(await member(source, "typeBonus", (r) => TYPE_IDS.has(r._key as number)));
  members.push(await member(source, "dogmaEffects", (r) => effectIds.has(r._key as number)));
  members.push(await member(source, "mapConstellations", (r) => CONSTELLATION_IDS.has(r._key as number)));
  members.push(await member(source, "mapSolarSystems", (r) => systemIds.has(r._key as number)));
  members.push(await member(source, "npcStations", (r) => STATION_SYSTEM_IDS.has(r.solarSystemID as number)));

  await writeZip(dest, members);
  const { size } = await stat(dest);
  console.log(`wrote ${dest} (${size} bytes)`);
  if (size > 1_500_000) throw new Error(`fixture is ${size} bytes — over the 1.5 MB budget`);
}

main().catch((e) => { console.error(e); process.exit(1); });
