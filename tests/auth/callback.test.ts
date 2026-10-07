import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SessionPayload } from "../../src/lib/auth/session.js";

process.env.EVE_CLIENT_ID = "cid";
process.env.EVE_CLIENT_SECRET = "sec";
process.env.EVE_CALLBACK_URL = "https://eve.example.com/auth/callback";
process.env.ALLOWED_CHARACTER_IDS = "1,2";
process.env.ESI_COMPATIBILITY_DATE = "2026-08-28";
process.env.ESI_USER_AGENT = "ua";
process.env.SESSION_SECRET = "s".repeat(32);
process.env.DATABASE_URL = "postgres://x";

vi.mock("../../src/lib/auth/flow.js", () => ({
  completeLogin: vi.fn(async () => ({ characterId: 2, name: "x" })),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; this.name = "AuthError"; }
  },
}));

vi.mock("../../src/lib/auth/session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/auth/session.js")>();
  return { ...actual, readSession: vi.fn(async () => ({ activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) })) };
});

// These regular imports run after the mocks above because vitest hoists vi.mock() calls to the top of the file.
import { GET } from "../../src/app/auth/callback/route.js";
import { completeLogin } from "../../src/lib/auth/flow.js";
import { readSession, verifyPayload, SESSION_COOKIE, SESSION_MAX_AGE } from "../../src/lib/auth/session.js";

// Behind Traefik the route handler sees the container's own origin, not the public one —
// redirects must be built from the configured site origin, never from req.nextUrl.
function req(): NextRequest {
  return new NextRequest("http://localhost:3000/auth/callback?code=c0de&state=st");
}

describe("auth callback", () => {
  beforeEach(() => {
    vi.mocked(completeLogin).mockResolvedValue({ characterId: 2, name: "x" });
    vi.mocked(readSession).mockResolvedValue({ activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) });
  });

  it("redirects to /settings and keeps the existing active character when a session exists", async () => {
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/settings");
    const cookie = res.cookies.get(SESSION_COOKIE)?.value;
    const payload = verifyPayload<SessionPayload>(cookie, process.env.SESSION_SECRET!, SESSION_MAX_AGE);
    expect(payload).toMatchObject({ activeCharacterId: 1 });
  });

  it("redirects to / and uses the newly logged-in character when there is no existing session", async () => {
    vi.mocked(readSession).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("https://eve.example.com/");
    const cookie = res.cookies.get(SESSION_COOKIE)?.value;
    const payload = verifyPayload<SessionPayload>(cookie, process.env.SESSION_SECRET!, SESSION_MAX_AGE);
    expect(payload).toMatchObject({ activeCharacterId: 2 });
  });
});

describe("auth callback failure path", () => {
  it("redirects to the public /login with the error code, not the container origin", async () => {
    vi.mocked(completeLogin).mockRejectedValueOnce(Object.assign(new Error("bad"), { name: "AuthError", code: "jwt" }));
    const res = await GET(req());
    expect(res.headers.get("location")).toMatch(/^https:\/\/eve\.example\.com\/login\?error=/);
  });
});
