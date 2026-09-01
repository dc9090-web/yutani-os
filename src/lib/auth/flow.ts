import { randomBytes } from "node:crypto";
import type { JWTVerifyGetKey } from "jose";
import type { AppConfig } from "../config.js";
import { upsertCharacter } from "../db/characters.js";
import { encryptSecret } from "./crypto.js";
import { OAUTH_MAX_AGE, signPayload, verifyPayload, type OauthPayload } from "./session.js";
import { buildAuthorizeUrl, exchangeCode, generatePkce, getSsoMetadata, remoteJwks, verifyEveJwt, type SsoMetadata } from "./sso.js";

export class AuthError extends Error {
  constructor(public code: "state" | "not-allowed" | "token" | "jwt", message: string) { super(message); this.name = "AuthError"; }
}

export interface FlowDeps {
  metadata: () => Promise<SsoMetadata>;
  jwks: (m: SsoMetadata) => JWTVerifyGetKey;
  exchange: typeof exchangeCode;
  verify: typeof verifyEveJwt;
  upsert: typeof upsertCharacter;
}
const realDeps: FlowDeps = { metadata: () => getSsoMetadata(), jwks: remoteJwks, exchange: exchangeCode, verify: verifyEveJwt, upsert: upsertCharacter };

export async function startLogin(config: AppConfig, deps: Pick<FlowDeps, "metadata"> = realDeps): Promise<{ url: string; oauthCookie: string }> {
  const metadata = await deps.metadata();
  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("base64url");
  const url = buildAuthorizeUrl({ metadata, clientId: config.eveClientId, callbackUrl: config.eveCallbackUrl, state, challenge });
  const payload: OauthPayload = { state, verifier, iat: Math.floor(Date.now() / 1000) };
  return { url, oauthCookie: signPayload(payload, config.sessionSecret) };
}

export async function completeLogin(
  a: { code: string | null; state: string | null; oauthCookie: string | undefined },
  config: AppConfig, deps: FlowDeps = realDeps,
): Promise<{ characterId: number; name: string }> {
  const saved = verifyPayload<OauthPayload>(a.oauthCookie, config.sessionSecret, OAUTH_MAX_AGE);
  if (!saved || !a.state || !a.code || saved.state !== a.state) throw new AuthError("state", "OAuth state mismatch or expired");
  const metadata = await deps.metadata();
  let tokens;
  try {
    tokens = await deps.exchange({ metadata, clientId: config.eveClientId, clientSecret: config.eveClientSecret, code: a.code, verifier: saved.verifier });
  } catch (e) { throw new AuthError("token", (e as Error).message); }
  let verified;
  try { verified = await deps.verify(tokens.access_token, { jwks: deps.jwks(metadata), clientId: config.eveClientId, issuer: metadata.issuer }); }
  catch (e) { throw new AuthError("jwt", (e as Error).message); }
  if (!config.allowedCharacterIds.has(verified.characterId)) throw new AuthError("not-allowed", `character ${verified.characterId} is not allow-listed`);
  await deps.upsert({ id: verified.characterId, name: verified.name, refreshTokenEnc: encryptSecret(tokens.refresh_token, config.sessionSecret), scopes: verified.scopes });
  return { characterId: verified.characterId, name: verified.name };
}

export function safeNextPath(next: unknown, origin: string): string {
  if (typeof next !== "string") return "/";
  let url: URL;
  try { url = new URL(next, origin); } catch { return "/"; }
  if (url.origin !== origin) return "/";
  return url.pathname + url.search;
}
