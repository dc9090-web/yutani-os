import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  }
  return pool;
}

/** Test-only: drop the memoised pool so the next getPool() reads a fresh DATABASE_URL. */
export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
