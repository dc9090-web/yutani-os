import { describe, it, expect } from "vitest";
import { loadConfig, parseAllowedCharacterIds } from "../src/lib/config.js";

const full: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  EVE_CLIENT_ID: "id", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://x/auth/callback",
  ALLOWED_CHARACTER_IDS: "1, 2,3", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua",
  SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x",
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
  it("derives siteOrigin from the callback URL (route handlers behind Traefik see localhost)", () => {
    expect(loadConfig(full).siteOrigin).toBe("https://x");
    expect(loadConfig({ ...full, EVE_CALLBACK_URL: "https://eve.plasma66.com/auth/callback" }).siteOrigin).toBe("https://eve.plasma66.com");
  });
  it("names every missing variable", () => {
    const { EVE_CLIENT_SECRET: _a, DATABASE_URL: _b, ...rest } = full;
    expect(() => loadConfig(rest)).toThrow(/EVE_CLIENT_SECRET, DATABASE_URL/);
  });
});
