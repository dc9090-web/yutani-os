import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createAccount, listAccounts, renameAccount, deleteAccount } from "../../src/lib/db/accounts.js";
import { upsertCharacter, listCharacters, getCharacter, setCharacterAccount, updateCharacterInfo, setTokenStatus, updateRefreshToken, deleteCharacter } from "../../src/lib/db/characters.js";
import { getCached, putCached } from "../../src/lib/db/esi-cache.js";
import { startRun, finishRun, latestRuns } from "../../src/lib/db/sync-runs.js";

beforeEach(async () => { await resetDb(); });
afterAll(closePool);

const tril = { id: 669539978, name: "TrilliumONE", refreshTokenEnc: "enc1", scopes: ["esi-skills.read_skills.v1"] };

describe("accounts", () => {
  it("creates, lists, renames, deletes", async () => {
    const a = await createAccount("Main");
    await createAccount("Alt");
    expect((await listAccounts()).map((x) => x.name)).toEqual(["Alt", "Main"]);
    await renameAccount(a.id, "Primary");
    expect((await listAccounts()).find((x) => x.id === a.id)?.name).toBe("Primary");
    await deleteAccount(a.id);
    expect((await listAccounts()).length).toBe(1);
  });
});

describe("characters", () => {
  it("upsert is idempotent on id and refreshes token/scopes/name", async () => {
    await upsertCharacter(tril);
    const again = await upsertCharacter({ ...tril, name: "Trillium ONE", refreshTokenEnc: "enc2" });
    expect(again.name).toBe("Trillium ONE");
    expect(again.refreshTokenEnc).toBe("enc2");
    expect(again.tokenStatus).toBe("ok");
    expect((await listCharacters()).length).toBe(1);
  });
  it("lists characters by account, then in the order they were added", async () => {
    const alt = await createAccount("Alt");
    await upsertCharacter({ ...tril, id: 2, name: "Sasha" });
    await upsertCharacter({ ...tril, id: 3, name: "HawkTah" });   // alphabetically first, added last
    await upsertCharacter({ ...tril, id: 1, name: "Trillium" });
    await setCharacterAccount(2, alt.id);
    await setCharacterAccount(3, alt.id);
    expect((await listCharacters()).map((c) => c.name)).toEqual(["Sasha", "HawkTah", "Trillium"]);
  });
  it("re-login resets needs_reauth to ok", async () => {
    await upsertCharacter(tril);
    await setTokenStatus(tril.id, "needs_reauth");
    expect((await getCharacter(tril.id))!.tokenStatus).toBe("needs_reauth");
    await upsertCharacter(tril);
    expect((await getCharacter(tril.id))!.tokenStatus).toBe("ok");
  });
  it("assigns to an account and unassigns when the account is deleted", async () => {
    const a = await createAccount("Main");
    await upsertCharacter(tril);
    await setCharacterAccount(tril.id, a.id);
    expect((await getCharacter(tril.id))!.accountId).toBe(a.id);
    await deleteAccount(a.id);
    expect((await getCharacter(tril.id))!.accountId).toBeNull();
  });
  it("updates the refresh token", async () => {
    await upsertCharacter(tril);
    await updateRefreshToken(tril.id, "enc-rotated");
    expect((await getCharacter(tril.id))!.refreshTokenEnc).toBe("enc-rotated");
  });
  it("updates public info and deletes", async () => {
    await upsertCharacter(tril);
    await updateCharacterInfo(tril.id, { name: "TrilliumONE", corporationId: 98000001, corporationName: "Corp", allianceId: null, allianceName: null, raceId: 1 });
    const updated = (await getCharacter(tril.id))!;
    expect(updated.corporationName).toBe("Corp");
    expect(updated.raceId).toBe(1);
    await deleteCharacter(tril.id);
    expect(await getCharacter(tril.id)).toBeNull();
  });
});

describe("esi_cache", () => {
  it("round-trips and upserts", async () => {
    expect(await getCached(0, "/markets/prices")).toBeNull();
    await putCached(0, "/markets/prices", { etag: "a", expiresAt: new Date("2030-01-01"), pages: 1, body: [1], lastModified: "Mon, 01 Sep 2026 10:00:00 GMT" });
    await putCached(0, "/markets/prices", { etag: "b", expiresAt: null, pages: 2, body: [2], lastModified: "Mon, 01 Sep 2026 10:30:00 GMT" });
    const e = await getCached(0, "/markets/prices");
    expect(e).toMatchObject({ etag: "b", expiresAt: null, pages: 2, body: [2], lastModified: "Mon, 01 Sep 2026 10:30:00 GMT" });
  });
});

describe("sync_runs", () => {
  it("records runs and reports the latest per job/character", async () => {
    await upsertCharacter(tril);
    const r1 = await startRun("character-info", tril.id);
    await finishRun(r1, { status: "error", error: "boom" });
    const r2 = await startRun("character-info", tril.id);
    await finishRun(r2, { status: "ok", rows: 1 });
    const r3 = await startRun("prices", null);
    const latest = await latestRuns();
    expect(latest.length).toBe(2);
    const ci = latest.find((r) => r.job === "character-info")!;
    expect(ci.status).toBe("ok");
    expect(ci.rows).toBe(1);
    expect(latest.find((r) => r.job === "prices")!.status).toBe("running");
    expect(r3).toBeGreaterThan(r2);
  });
});
