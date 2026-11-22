import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.EVE_CLIENT_ID = "cid";
process.env.EVE_CLIENT_SECRET = "sec";
process.env.EVE_CALLBACK_URL = "https://eve.example.com/auth/callback";
process.env.ALLOWED_CHARACTER_IDS = "1,2";
process.env.ESI_COMPATIBILITY_DATE = "2026-08-28";
process.env.ESI_USER_AGENT = "ua";
process.env.SESSION_SECRET = "s".repeat(32);
process.env.DATABASE_URL = "postgres://x";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsec";
process.env.ALLOWED_GOOGLE_EMAILS = "owner@example.com";

vi.mock("../../src/lib/auth/google-flow.js", () => ({
  completeGoogleLogin: vi.fn(async () => ({ sub: "g-1", email: "owner@example.com" })),
  startGoogleLogin: vi.fn(() => ({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=st", oauthCookie: "oc" })),
}));

// These regular imports run after the mock above because vitest hoists vi.mock() calls to the top of the file.
import { GET } from "../../src/app/auth/google/callback/route.js";
import { GET as START } from "../../src/app/auth/google/start/route.js";
import { completeGoogleLogin } from "../../src/lib/auth/google-flow.js";
import { AuthError } from "../../src/lib/auth/flow.js";
import { signPayload, verifySession, SESSION_COOKIE, GOOGLE_OAUTH_COOKIE } from "../../src/lib/auth/session.js";

// Behind Traefik the route handler sees the container's own origin; redirects must use the configured site origin.
function req(query: string): NextRequest {
  const r = new NextRequest(`http://localhost:3000/auth/google/callback${query}`);
  r.cookies.set(GOOGLE_OAUTH_COOKIE, "oc");
  return r;
}

describe("google callback", () => {
  beforeEach(() => {
    vi.mocked(completeGoogleLogin).mockReset();
    vi.mocked(completeGoogleLogin).mockResolvedValue({ sub: "g-1", email: "owner@example.com" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("signs the owner in and lands on the overview", async () => {
    const res = await GET(req("?code=c&state=st"));
    expect(res.headers.get("location")).toBe("https://eve.example.com/");
    expect(verifySession(res.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET!, new Set(["owner@example.com"]))).toMatchObject({ sub: "g-1", email: "owner@example.com", activeCharacterId: null });
    expect(res.cookies.get(GOOGLE_OAUTH_COOKIE)?.value ?? "").toBe("");
    expect(completeGoogleLogin).toHaveBeenCalledWith({ code: "c", state: "st", error: null, oauthCookie: "oc" }, expect.anything());
  });

  it("passes Google's error parameter on when the owner cancels", async () => {
    vi.mocked(completeGoogleLogin).mockRejectedValue(new AuthError("cancelled", "x"));
    const res = await GET(req("?error=access_denied&state=st"));
    expect(completeGoogleLogin).toHaveBeenCalledWith(expect.objectContaining({ code: null, error: "access_denied" }), expect.anything());
    expect(res.headers.get("location")).toBe("https://eve.example.com/login?error=cancelled");
  });

  it.each(["not-allowed", "cancelled", "token", "jwt"])("sends a %s failure to the login page with no session and clears the attempt", async (code) => {
    vi.mocked(completeGoogleLogin).mockRejectedValue(new AuthError(code as never, "x"));
    const res = await GET(req("?code=c&state=st"));
    expect(res.headers.get("location")).toBe(`https://eve.example.com/login?error=${code}`);
    expect(res.cookies.get(SESSION_COOKIE)?.value ?? "").toBe("");
    expect(res.cookies.get(GOOGLE_OAUTH_COOKIE)?.value ?? "").toBe("");
  });

  // Two tabs: the second /auth/google/start overwrote the cookie, so the first tab's callback fails on state.
  // It must leave the cookie alone so the second tab can still finish.
  it("sends a state failure to the login page but keeps the other tab's attempt", async () => {
    vi.mocked(completeGoogleLogin).mockRejectedValue(new AuthError("state", "x"));
    const res = await GET(req("?code=c&state=stale"));
    expect(res.headers.get("location")).toBe("https://eve.example.com/login?error=state");
    expect(res.cookies.get(SESSION_COOKIE)?.value ?? "").toBe("");
    expect(res.cookies.get(GOOGLE_OAUTH_COOKIE)).toBeUndefined();
  });

  // Back button, reload or session restore replays a callback that already succeeded.
  it("sends an owner who is already signed in to the overview on a replayed callback", async () => {
    vi.mocked(completeGoogleLogin).mockRejectedValue(new AuthError("state", "x"));
    const r = req("?code=c&state=st");
    r.cookies.set(SESSION_COOKIE, signPayload({ sub: "g-1", email: "owner@example.com", activeCharacterId: 7, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET!));
    const res = await GET(r);
    expect(res.headers.get("location")).toBe("https://eve.example.com/");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("reports an unexpected failure as unknown", async () => {
    vi.mocked(completeGoogleLogin).mockRejectedValue(new Error("boom"));
    const res = await GET(req("?code=c&state=st"));
    expect(res.headers.get("location")).toBe("https://eve.example.com/login?error=unknown");
    expect(res.cookies.get(SESSION_COOKIE)?.value ?? "").toBe("");
  });
});

describe("google start", () => {
  it("redirects to Google and sets the Google oauth cookie", async () => {
    const res = await START();
    expect(res.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=st");
    expect(res.cookies.get(GOOGLE_OAUTH_COOKIE)?.value).toBe("oc");
  });
});
