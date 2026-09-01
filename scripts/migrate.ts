import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Pool } from "pg";
import { getPool } from "../src/lib/db/client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const schemaPath = path.join(here, "..", "db", "schema.sql");

export async function applySchema(pool: Pool): Promise<void> {
  await pool.query(await readFile(schemaPath, "utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = getPool();
  applySchema(pool)
    .then(() => console.log("schema applied"))
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => pool.end());
}
