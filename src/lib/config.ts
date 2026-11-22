export interface AppConfig {
  eveClientId: string; eveClientSecret: string; eveCallbackUrl: string;
  googleClientId: string; googleClientSecret: string;
  /** `${siteOrigin}/auth/google/callback`. */
  googleCallbackUrl: string;
  /** Google accounts allowed to sign in, trimmed and lower-cased. Never empty: an empty list stops the app. */
  allowedGoogleEmails: Set<string>;
  /** Characters the Overview page and the Skills training overview show; empty = every authorised character. */
  overviewCharacterIds: Set<number>;
  /** Up to three letters for the header's account button (OWNER_INITIALS); null shows a person icon. */
  ownerInitials: string | null;
  esiBaseUrl: string; esiCompatibilityDate: string; esiUserAgent: string;
  sessionSecret: string; databaseUrl: string;
  /** Public origin (from EVE_CALLBACK_URL). Route handlers behind Traefik see the container origin, so redirects use this. */
  siteOrigin: string;
}

const REQUIRED = ["EVE_CLIENT_ID", "EVE_CLIENT_SECRET", "EVE_CALLBACK_URL",
  "ESI_COMPATIBILITY_DATE", "ESI_USER_AGENT", "SESSION_SECRET", "DATABASE_URL",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_GOOGLE_EMAILS"] as const;

/** Comma-separated positive character ids (used for OVERVIEW_CHARACTER_IDS); junk is dropped. */
export function parseAllowedCharacterIds(raw: string | undefined): Set<number> {
  const out = new Set<number>();
  for (const part of (raw ?? "").split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return out;
}

/** Comma-separated emails, trimmed and lower-cased; an entry without "@" is dropped. */
export function parseAllowedEmails(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const email = part.trim().toLowerCase();
    if (email.includes("@")) out.add(email);
  }
  return out;
}

/** Letters and digits only, upper-cased, at most three — anything else in OWNER_INITIALS is dropped. */
export function parseOwnerInitials(raw: string | undefined): string | null {
  const clean = (raw ?? "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase();
  return clean === "" ? null : clean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
  // An empty allow-list must never mean "allow everyone".
  const allowedGoogleEmails = parseAllowedEmails(env.ALLOWED_GOOGLE_EMAILS);
  if (allowedGoogleEmails.size === 0) throw new Error("Missing env: ALLOWED_GOOGLE_EMAILS");
  const siteOrigin = new URL(env.EVE_CALLBACK_URL!).origin;
  return {
    eveClientId: env.EVE_CLIENT_ID!, eveClientSecret: env.EVE_CLIENT_SECRET!, eveCallbackUrl: env.EVE_CALLBACK_URL!,
    googleClientId: env.GOOGLE_CLIENT_ID!, googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
    googleCallbackUrl: `${siteOrigin}/auth/google/callback`,
    allowedGoogleEmails,
    overviewCharacterIds: parseAllowedCharacterIds(env.OVERVIEW_CHARACTER_IDS),
    ownerInitials: parseOwnerInitials(env.OWNER_INITIALS),
    esiBaseUrl: env.ESI_BASE_URL ?? "https://esi.evetech.net",
    esiCompatibilityDate: env.ESI_COMPATIBILITY_DATE!, esiUserAgent: env.ESI_USER_AGENT!,
    sessionSecret: env.SESSION_SECRET!, databaseUrl: env.DATABASE_URL!,
    siteOrigin,
  };
}

let cached: AppConfig | undefined;
export function getConfig(): AppConfig { return (cached ??= loadConfig()); }
