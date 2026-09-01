/**
 * Imports the SDE into the database in DATABASE_URL.
 *
 *   npm run sde:import                                   # download the latest zip, import, delete it
 *   npm run sde:import -- --file path/to/sde.zip         # import a zip already on disk
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPool } from "../src/lib/db/client.js";
import { downloadSde, SDE_ZIP_URL } from "../src/lib/sde/download.js";
import { importSde } from "../src/lib/sde/import.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = argv.indexOf("--file");
  if (flag >= 0 && !argv[flag + 1]) throw new Error("--file needs a path to a jsonl SDE zip");
  let zipPath = flag >= 0 ? argv[flag + 1]! : undefined;

  const pool = getPool();
  let tmpDir: string | undefined;
  try {
    if (!zipPath) {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), "eve-sde-"));
      zipPath = path.join(tmpDir, "sde.zip");
      console.log(`downloading ${SDE_ZIP_URL} to ${zipPath}`);
      await downloadSde(zipPath);
    }
    const result = await importSde(zipPath, pool, (msg) => console.log(msg));
    console.log(`imported SDE build ${result.buildNumber} released ${result.releaseDate.toISOString()}`);
    for (const [table, n] of Object.entries(result.counts)) console.log(`  ${table}: ${n}`);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
