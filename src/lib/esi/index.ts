import { getConfig } from "../config.js";
import { getCharacter, setTokenStatus } from "../db/characters.js";
import { getCached, putCached } from "../db/esi-cache.js";
import { getSsoMetadata, refreshAccessToken } from "../auth/sso.js";
import { TokenStore } from "./tokens.js";
import { EsiClient } from "./client.js";

let client: EsiClient | undefined;
export function createEsiClient(): EsiClient {
  if (!client) {
    const config = getConfig();
    const tokens = new TokenStore({ config, getCharacter, setTokenStatus, refresh: refreshAccessToken, metadata: () => getSsoMetadata() });
    client = new EsiClient({ getAccessToken: (id) => tokens.getAccessToken(id), cache: { get: getCached, put: putCached }, config });
  }
  return client;
}
export { EsiClient, EsiError } from "./client.js";
export { NeedsReauthError } from "./tokens.js";
