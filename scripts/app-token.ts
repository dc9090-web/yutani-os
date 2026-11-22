/**
 * Creates an app session straight in the database and prints its bearer token, once.
 *
 *   DATABASE_URL=… npm run app:token -- <email> [device name]
 *
 * For development: the desktop build of the app and the emulator cannot run Google's account
 * picker, so they sign in with a token made here. The email must be on ALLOWED_GOOGLE_EMAILS of
 * the site that will be asked, or the token is refused like any other. Revoke it from Settings ›
 * Signed-in phones.
 */
import { closePool } from "../src/lib/db/client.js";
import { createAppSession } from "../src/lib/db/app-sessions.js";

async function main(): Promise<void> {
  const [rawEmail, ...rest] = process.argv.slice(2);
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("usage: npm run app:token -- <email> [device name]");
  const deviceName = rest.join(" ").trim() || "Development token";
  // No Google account stands behind a token made here, so its subject says where it came from.
  const { token } = await createAppSession({ sub: `dev:${email}`, email, deviceName });
  console.log(token);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(closePool);
