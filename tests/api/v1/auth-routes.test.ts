import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "../../../src/lib/auth/flow.js";

const { appGoogleLogin, authenticateApi, revokeAppSession } = vi.hoisted(() => ({
  appGoogleLogin: vi.fn(), authenticateApi: vi.fn(), revokeAppSession: vi.fn(),
}));
vi.mock("../../../src/lib/auth/app-session.js", async (original) => ({
  ...(await original<typeof import("../../../src/lib/auth/app-session.js")>()), appGoogleLogin, authenticateApi,
}));
vi.mock("../../../src/lib/db/app-sessions.js", () => ({ revokeAppSession }));

const { POST } = await import("../../../src/app/api/v1/auth/google/route.js");
const { DELETE } = await import("../../../src/app/api/v1/auth/session/route.js");
const { DELETE: REVOKE } = await import("../../../src/app/api/app-sessions/[id]/route.js");

const post = (body: unknown) => POST(new NextRequest("https://eve.example.com/api/v1/auth/google", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
}));

beforeEach(() => { vi.resetAllMocks(); });

describe("POST /api/v1/auth/google", () => {
  it("returns the token and email for a good ID token", async () => {
    appGoogleLogin.mockResolvedValue({ token: "tok", email: "owner@example.com" });
    const res = await post({ idToken: "id.tok", deviceName: " Pixel 9 " });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ token: "tok", email: "owner@example.com" });
    expect(appGoogleLogin).toHaveBeenCalledWith({ idToken: "id.tok", deviceName: "Pixel 9" });
  });

  it("401s invalid-token when the ID token does not verify", async () => {
    appGoogleLogin.mockRejectedValue(new AuthError("jwt", "bad signature"));
    const res = await post({ idToken: "bad", deviceName: "Pixel 9" });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "invalid-token" });
  });

  it("503s when Google's keys cannot be fetched, so the phone does not read it as a bad token", async () => {
    const { KeysUnavailableError } = await import("../../../src/lib/auth/app-session.js");
    appGoogleLogin.mockRejectedValue(new KeysUnavailableError("fetch failed"));
    const res = await post({ idToken: "id.tok", deviceName: "Pixel 9" });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "unavailable" });
  });

  it("400s a body far larger than any ID token without reading it as JSON", async () => {
    const res = await post({ idToken: "x".repeat(9000), deviceName: "Pixel 9" });
    expect(res.status).toBe(400);
    expect(appGoogleLogin).not.toHaveBeenCalled();
  });

  it("403s not-allowed for an account off the list", async () => {
    appGoogleLogin.mockRejectedValue(new AuthError("not-allowed", "nope"));
    const res = await post({ idToken: "id.tok", deviceName: "Pixel 9" });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "not-allowed" });
  });

  it("400s a body without an ID token or a usable device name", async () => {
    for (const body of [{}, { idToken: "x" }, { deviceName: "Pixel 9" }, { idToken: 5, deviceName: "Pixel 9" }, { idToken: "x", deviceName: " " }, "not json"]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "bad-request" });
    }
    expect(appGoogleLogin).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/auth/session", () => {
  const del = () => DELETE(new NextRequest("https://eve.example.com/api/v1/auth/session", { method: "DELETE", headers: { authorization: "Bearer tok" } }));

  it("revokes the caller's own app session and answers 204", async () => {
    authenticateApi.mockResolvedValue({ sub: "g-1", email: "owner@example.com", appSessionId: 3 });
    const res = await del();
    expect(res.status).toBe(204);
    expect(revokeAppSession).toHaveBeenCalledWith(3);
  });

  it("is a 204 with nothing to revoke for a cookie caller", async () => {
    authenticateApi.mockResolvedValue({ sub: "g-1", email: "owner@example.com", appSessionId: null });
    expect((await del()).status).toBe(204);
    expect(revokeAppSession).not.toHaveBeenCalled();
  });

  it("401s an unknown token", async () => {
    authenticateApi.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorised" });
  });
});

describe("DELETE /api/app-sessions/[id] (Settings › Revoke)", () => {
  const revoke = (id: string) => REVOKE(new NextRequest(`https://eve.example.com/api/app-sessions/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });
  it("revokes by id", async () => {
    expect((await revoke("12")).status).toBe(204);
    expect(revokeAppSession).toHaveBeenCalledWith(12);
  });
  it("400s a bad id", async () => {
    expect((await revoke("nope")).status).toBe(400);
    expect(revokeAppSession).not.toHaveBeenCalled();
  });
});
