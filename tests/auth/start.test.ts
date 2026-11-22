import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.EVE_CLIENT_ID = "cid";
process.env.EVE_CLIENT_SECRET = "sec";
process.env.EVE_CALLBACK_URL = "https://eve.example.com/auth/callback";
process.env.ESI_COMPATIBILITY_DATE = "2026-08-28";
process.env.ESI_USER_AGENT = "ua";
process.env.SESSION_SECRET = "s".repeat(32);
process.env.DATABASE_URL = "postgres://x";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsec";
process.env.ALLOWED_GOOGLE_EMAILS = "owner@example.com";

const AUTHORISE_URL = "https://login.eveonline.com/v2/oauth/authorize?state=st";

vi.mock("../../src/lib/auth/flow.js", () => ({
  startLogin: vi.fn(async () => ({ url: AUTHORISE_URL, oauthCookie: "oc" })),
}));

vi.mock("../../src/lib/auth/session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/auth/session.js")>();
  return { ...actual, readSession: vi.fn(async () => null) };
});

// These regular imports run after the mocks above because vitest hoists vi.mock() calls to the top of the file.
import { GET } from "../../src/app/auth/start/route.js";
import { startLogin } from "../../src/lib/auth/flow.js";
import { readSession, OAUTH_COOKIE } from "../../src/lib/auth/session.js";

describe("auth start (adding a character)", () => {
  beforeEach(() => {
    vi.mocked(startLogin).mockClear();
  });

  it("sends a visitor who is not signed in to /login and starts nothing", async () => {
    vi.mocked(readSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.headers.get("location")).toBe("https://eve.example.com/login");
    expect(startLogin).not.toHaveBeenCalled();
    expect(res.cookies.get(OAUTH_COOKIE)).toBeUndefined();
  });

  it("sends the signed-in owner to EVE SSO with the oauth cookie set", async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: "g-1", email: "owner@example.com", activeCharacterId: null, iat: Math.floor(Date.now() / 1000) });
    const res = await GET();
    expect(res.headers.get("location")).toBe(AUTHORISE_URL);
    expect(res.cookies.get(OAUTH_COOKIE)?.value).toBe("oc");
  });
});
