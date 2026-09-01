import { getPool } from "./client.js";
export interface Account { id: number; name: string }

export async function listAccounts(): Promise<Account[]> {
  const { rows } = await getPool().query<Account>("SELECT id, name FROM accounts ORDER BY name");
  return rows;
}
export async function createAccount(name: string): Promise<Account> {
  const { rows } = await getPool().query<Account>("INSERT INTO accounts (name) VALUES ($1) RETURNING id, name", [name]);
  return rows[0];
}
export async function renameAccount(id: number, name: string): Promise<void> {
  await getPool().query("UPDATE accounts SET name = $2 WHERE id = $1", [id, name]);
}
export async function deleteAccount(id: number): Promise<void> {
  await getPool().query("DELETE FROM accounts WHERE id = $1", [id]);
}
