import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonlMember } from "../../src/lib/sde/jsonl.js";

export const FIXTURE_ZIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "sde-mini.zip");

/** The verbatim record with this `_key` from a fixture member. Throws if it is absent. */
export async function fixtureRecord(member: string, key: number | string): Promise<Record<string, unknown>> {
  for await (const record of readJsonlMember(FIXTURE_ZIP, member)) {
    if (record._key === key) return record;
  }
  throw new Error(`no record ${String(key)} in ${member}`);
}

export async function fixtureCount(member: string): Promise<number> {
  let n = 0;
  for await (const record of readJsonlMember(FIXTURE_ZIP, member)) { void record; n++; }
  return n;
}
