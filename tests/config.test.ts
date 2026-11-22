import { describe, it, expect } from "vitest";
import { loadConfig, parseAllowedCharacterIds, parseAllowedEmails, parseOwnerInitials } from "../src/lib/config.js";

const full: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  EVE_CLIENT_ID: "id", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://x/auth/callback",
  ALLOWED_CHARACTER_IDS: "1, 2,3", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua",
  SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x",
  GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: "owner@example.com",
};

describe("config", () => {
  it("parses allow-list with spaces and ignores junk", () => {
    expect([...parseAllowedCharacterIds("1, 2,3,abc,")]).toEqual([1, 2, 3]);
    expect(parseAllowedCharacterIds(undefined).size).toBe(0);
  });
  it("loads a full env", () => {
    const c = loadConfig(full);
    expect(c.allowedCharacterIds.has(2)).toBe(true);
    expect(c.overviewCharacterIds.size).toBe(0);   // optional: unset means every character
    expect([...loadConfig({ ...full, OVERVIEW_CHARACTER_IDS: "3,1" }).overviewCharacterIds]).toEqual([3, 1]);
    expect(c.esiBaseUrl).toBe("https://esi.evetech.net");
  });
  it("reads the owner's initials for the account button, or null when unset", () => {
    expect(loadConfig(full).ownerInitials).toBeNull();
    expect(loadConfig({ ...full, OWNER_INITIALS: " dc " }).ownerInitials).toBe("DC");
    expect(parseOwnerInitials("d.c. long")).toBe("DCL");
    expect(parseOwnerInitials("  ")).toBeNull();
  });
  it("derives siteOrigin from the callback URL (route handlers behind Traefik see localhost)", () => {
    expect(loadConfig(full).siteOrigin).toBe("https://x");
    expect(loadConfig({ ...full, EVE_CALLBACK_URL: "https://eve.example.com/auth/callback" }).siteOrigin).toBe("https://eve.example.com");
  });
  it("names every missing variable", () => {
    const { EVE_CLIENT_SECRET: _a, DATABASE_URL: _b, ...rest } = full;
    expect(() => loadConfig(rest)).toThrow(/EVE_CLIENT_SECRET, DATABASE_URL/);
  });
  it("parses the Google allow-list trimmed and lower-cased", () => {
    expect([...parseAllowedEmails(" Owner@Example.com , second@example.com,, ")]).toEqual(["owner@example.com", "second@example.com"]);
    expect([...parseAllowedEmails("no-at-sign, a@example.com")]).toEqual(["a@example.com"]);
    expect(parseAllowedEmails(undefined).size).toBe(0);
  });
  it("loads the Google settings and derives the callback from the site origin", () => {
    const c = loadConfig({ ...full, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: "Owner@Example.com" });
    expect(c.googleClientId).toBe("gid");
    expect(c.googleClientSecret).toBe("gsec");
    expect(c.googleCallbackUrl).toBe("https://x/auth/google/callback");
    expect(c.allowedGoogleEmails.has("owner@example.com")).toBe(true);
  });
  it("refuses to start with no usable Google allow-list", () => {
    expect(() => loadConfig({ ...full, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: " , ," })).toThrow(/ALLOWED_GOOGLE_EMAILS/);
    expect(() => loadConfig({ ...full, ALLOWED_GOOGLE_EMAILS: "not-an-email" })).toThrow(/ALLOWED_GOOGLE_EMAILS/);
    const { GOOGLE_CLIENT_ID: _id, ...noClientId } = full;
    expect(() => loadConfig({ ...noClientId, GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: "a@example.com" })).toThrow(/GOOGLE_CLIENT_ID/);
  });
});
