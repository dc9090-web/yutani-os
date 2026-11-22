import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

vi.mock("../../src/lib/auth/flow.js", () => ({
  completeLogin: vi.fn(async () => ({ characterId: 2, name: "x" })),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; this.name = "AuthError"; }
  },
}));

vi.mock("../../src/lib/auth/session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/auth/session.js")>();
  return { ...actual, readSession: vi.fn(async () => ({ sub: "g-1", email: "owner@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) })) };
});

// These regular imports run after the mocks above because vitest hoists vi.mock() calls to the top of the file.
import { GET } from "../../src/app/auth/callback/route.js";
import { completeLogin, AuthError } from "../../src/lib/auth/flow.js";
import { readSession, verifySession, SESSION_COOKIE, OAUTH_COOKIE } from "../../src/lib/auth/session.js";

// Behind Traefik the route handler sees the container's own origin, not the public one —
// redirects must be built from the configured site origin, never from req.nextUrl.
function req(): NextRequest {
  const r = new NextRequest("http://localhost:3000/auth/callback?code=c0de&state=st");
  r.cookies.set(OAUTH_COOKIE, "oc");
  return r;
}

describe("auth callback (adding a character)", () => {
  beforeEach(() => {
    vi.mocked(completeLogin).mockReset();
    vi.mocked(completeLogin).mockResolvedValue({ characterId: 2, name: "x" });
    vi.mocked(readSession).mockResolvedValue({ sub: "g-1", email: "owner@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("redirects to /settings and keeps the Google account and the existing active character", async () => {
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/settings");
    expect(completeLogin).toHaveBeenCalledWith({ code: "c0de", state: "st", oauthCookie: "oc" }, expect.anything());
    const payload = verifySession(res.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET!);
    expect(payload).toMatchObject({ sub: "g-1", email: "owner@example.com", activeCharacterId: 1 });
    expect(res.cookies.get(OAUTH_COOKIE)?.value ?? "").toBe("");
  });

  it("makes the new character active when the session has none yet", async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: "g-1", email: "owner@example.com", activeCharacterId: null, iat: Math.floor(Date.now() / 1000) });
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/settings");
    const payload = verifySession(res.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET!);
    expect(payload).toMatchObject({ sub: "g-1", email: "owner@example.com", activeCharacterId: 2 });
  });

  it("does nothing for a visitor who is not signed in", async () => {
    vi.mocked(readSession).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/login");
    expect(completeLogin).not.toHaveBeenCalled();
  });

  it("reports a failed character authorisation on Settings and keeps the session", async () => {
    vi.mocked(completeLogin).mockRejectedValue(new AuthError("jwt" as never, "x"));
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/settings?error=jwt");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("reports an unexpected failure on Settings as unknown", async () => {
    vi.mocked(completeLogin).mockRejectedValue(new Error("boom"));
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/settings?error=unknown");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});
