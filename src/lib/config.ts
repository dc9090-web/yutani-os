export interface AppConfig {
  eveClientId: string; eveClientSecret: string; eveCallbackUrl: string;
  allowedCharacterIds: Set<number>;
  esiBaseUrl: string; esiCompatibilityDate: string; esiUserAgent: string;
  sessionSecret: string; databaseUrl: string;
  /** Public origin (from EVE_CALLBACK_URL). Route handlers behind Traefik see the container origin, so redirects use this. */
  siteOrigin: string;
}

const REQUIRED = ["EVE_CLIENT_ID", "EVE_CLIENT_SECRET", "EVE_CALLBACK_URL", "ALLOWED_CHARACTER_IDS",
  "ESI_COMPATIBILITY_DATE", "ESI_USER_AGENT", "SESSION_SECRET", "DATABASE_URL"] as const;

export function parseAllowedCharacterIds(raw: string | undefined): Set<number> {
  const out = new Set<number>();
  for (const part of (raw ?? "").split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return out;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
  return {
    eveClientId: env.EVE_CLIENT_ID!, eveClientSecret: env.EVE_CLIENT_SECRET!, eveCallbackUrl: env.EVE_CALLBACK_URL!,
    allowedCharacterIds: parseAllowedCharacterIds(env.ALLOWED_CHARACTER_IDS),
    esiBaseUrl: env.ESI_BASE_URL ?? "https://esi.evetech.net",
    esiCompatibilityDate: env.ESI_COMPATIBILITY_DATE!, esiUserAgent: env.ESI_USER_AGENT!,
    sessionSecret: env.SESSION_SECRET!, databaseUrl: env.DATABASE_URL!,
    siteOrigin: new URL(env.EVE_CALLBACK_URL!).origin,
  };
}

let cached: AppConfig | undefined;
export function getConfig(): AppConfig { return (cached ??= loadConfig()); }
