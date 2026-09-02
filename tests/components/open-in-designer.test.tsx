import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OpenInDesigner } from "../../src/app/combat/OpenInDesigner.js";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { push.mockClear(); vi.restoreAllMocks(); });

describe("OpenInDesigner", () => {
  it("posts the killmail and the character, then opens the new fit", async () => {
    const posts: { url: string; body: unknown }[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ fit: { id: 42 } }), { status: 201 });
    }) as unknown as typeof fetch;

    render(<OpenInDesigner killmailId={120000001} characterId={669539978} />);
    fireEvent.click(screen.getByRole("button", { name: /open in fitting designer/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/fitting/42"));
    expect(posts).toEqual([{
      url: "/api/fits/from-killmail",
      body: { killmailId: 120000001, characterId: 669539978 },
    }]);
  });

  it("reports a failure instead of silently doing nothing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = (async () => new Response("nope", { status: 400 })) as unknown as typeof fetch;
    render(<OpenInDesigner killmailId={1} characterId={2} />);
    fireEvent.click(screen.getByRole("button", { name: /open in fitting designer/i }));
    await waitFor(() => expect(screen.getByText(/could not build a fit/i)).toHaveClass("neg"));
    expect(push).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
