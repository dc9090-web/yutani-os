/**
 * Regenerates api-fixtures/v1/*.json: every `/api/v1` response for an invented account.
 *
 *   npm run api:fixtures          # needs the eve-dev-postgres container (compose.dev.yml)
 *
 * It TRUNCATES the test database (TEST_DATABASE_URL, default eve_test) and seeds it, so it can
 * never be pointed at real data by accident. The files are the contract the Android app's models
 * are tested against, and tests/api/v1/contract.test.ts fails when a loader's output drifts from
 * them — so run this deliberately, read the diff, and change the app with it.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { closePool } from "../src/lib/db/client.js";
import { buildApiFixtures, seedApiFixtureDb } from "../tests/api/v1/fixture-data.js";

export const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api-fixtures", "v1");

async function main(): Promise<void> {
  await seedApiFixtureDb();
  const fixtures = await buildApiFixtures();
  // Clear the old set first: a resource that no longer exists must not leave its file behind.
  for (const entry of await readdir(FIXTURE_DIR, { withFileTypes: true }).catch(() => [])) {
    if (entry.name !== "README.md") await rm(path.join(FIXTURE_DIR, entry.name), { recursive: true, force: true });
  }
  for (const [file, envelope] of fixtures) {
    const dest = path.join(FIXTURE_DIR, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, `${JSON.stringify(envelope, null, 2)}\n`);
  }
  console.log(`wrote ${fixtures.size} files to ${FIXTURE_DIR}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closePool);
}
