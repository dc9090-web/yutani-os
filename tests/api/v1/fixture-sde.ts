import os from "node:os";
import path from "node:path";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";
import type { Pool } from "pg";
import { importSde } from "../../../src/lib/sde/import.js";
import { readJsonlMember } from "../../../src/lib/sde/jsonl.js";
import { writeZip, type ZipMember } from "../../../scripts/lib/zip.js";
import { FIXTURE_ZIP } from "../../sde/fixture.js";

const EXTRA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "api", "sde-extra.json");

function memberNames(zipPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error(`cannot open ${zipPath}`));
      const names: string[] = [];
      zip.on("entry", (entry: yauzl.Entry) => { names.push(entry.fileName); zip.readEntry(); });
      zip.on("end", () => resolve(names));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

/**
 * Imports the mini SDE with tests/fixtures/api/sde-extra.json laid over it: the ten types the
 * importer's tests use, plus the hulls, modules, ammunition, drones, implants and skills a
 * believable ship sheet needs. The importer only reads archives, so the two are merged into a
 * throwaway zip first.
 */
export async function importApiSde(pool: Pool): Promise<void> {
  const extra = JSON.parse(await readFile(EXTRA, "utf8")) as Record<string, Record<string, unknown>[]>;
  const members: ZipMember[] = [];
  for (const name of await memberNames(FIXTURE_ZIP)) {
    const lines: string[] = [];
    const keys = new Set<unknown>();
    for await (const record of readJsonlMember(FIXTURE_ZIP, name)) {
      keys.add(record._key);
      lines.push(JSON.stringify(record));
    }
    for (const record of extra[name.replace(/\.jsonl$/, "")] ?? []) if (!keys.has(record._key)) lines.push(JSON.stringify(record));
    members.push({ name, content: `${lines.join("\n")}\n` });
  }
  const merged = path.join(os.tmpdir(), `eve-api-sde-${process.pid}.zip`);
  try {
    await writeZip(merged, members);
    await importSde(merged, pool);
  } finally {
    await rm(merged, { force: true });
  }
}
