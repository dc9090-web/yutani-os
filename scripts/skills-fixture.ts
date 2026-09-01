/**
 * Regenerates tests/fixtures/skills/alpha-set.json from a full SDE archive.
 *
 *   npm run skills:fixture -- .superpowers/research/sde-3484357.zip
 *
 * The fixture is 175 `[typeId, rank, alphaCap]` triples — clone grade 1's skill list joined to
 * each skill's `skillTimeConstant` (attribute 275). `tests/skills/sp.test.ts` sums
 * `spForLevel(rank, cap)` over it and asserts CCP's published Alpha maximum of 19,669,072 SP, so
 * regenerating it against a different build is a deliberate test change.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { readJsonlMember } from "../src/lib/sde/jsonl.js";

const SKILL_TIME_CONSTANT = 275;

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error("usage: npm run skills:fixture -- <eve-online-static-data-<build>-jsonl.zip>");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dest = path.join(here, "..", "tests", "fixtures", "skills", "alpha-set.json");

  const caps = new Map<number, number>();
  for await (const record of readJsonlMember(source, "cloneGrades.jsonl")) {
    if (record._key !== 1) continue;                       // all four racial grades are identical
    for (const s of (record.skills as { typeID: number; level: number }[]) ?? []) {
      caps.set(s.typeID, s.level);
    }
  }
  if (caps.size === 0) throw new Error("clone grade 1 is missing from cloneGrades.jsonl");

  const ranks = new Map<number, number>();
  for await (const record of readJsonlMember(source, "typeDogma.jsonl")) {
    const id = record._key as number;
    if (!caps.has(id)) continue;
    for (const a of (record.dogmaAttributes as { attributeID: number; value: number }[]) ?? []) {
      if (Math.round(a.attributeID) === SKILL_TIME_CONSTANT) ranks.set(id, Math.round(a.value));
    }
  }

  const rows = [...caps.entries()].sort((a, b) => a[0] - b[0]).map(([typeId, cap]) => {
    const rank = ranks.get(typeId);
    if (rank === undefined) throw new Error(`no skillTimeConstant for type ${typeId}`);
    return [typeId, rank, cap];
  });

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, `${JSON.stringify(rows)}\n`);
  console.log(`wrote ${dest} (${rows.length} skills)`);
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
