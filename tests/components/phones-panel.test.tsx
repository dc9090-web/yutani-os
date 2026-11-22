import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { PhonesPanel, type PhoneView } from "../../src/app/settings/PhonesPanel.js";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const PHONES: PhoneView[] = [
  { id: 4, deviceName: "Pixel 9", email: "owner@example.com", created: "2026-03-01 09:00", lastUsed: "2026-03-14 11:58" },
  { id: 5, deviceName: "Development token", email: "owner@example.com", created: "2026-03-10 18:30", lastUsed: "never" },
];
const ui = (phones: PhoneView[]) => render(<MantineProvider><PhonesPanel phones={phones} /></MantineProvider>);

let calls: { url: string; method: string }[] = [];
beforeEach(() => {
  calls = []; refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET" });
    return { ok: true, status: 204 } as Response;
  }) as typeof fetch;
  window.confirm = vi.fn(() => true);
});

describe("PhonesPanel", () => {
  it("lists each phone with its name, when it signed in and when it was last used", () => {
    ui(PHONES);
    expect(screen.getByRole("heading", { name: "Signed-in phones" })).toBeInTheDocument();
    expect(screen.getByText("Pixel 9")).toBeInTheDocument();
    expect(screen.getByText("2026-03-01 09:00")).toBeInTheDocument();
    expect(screen.getByText("2026-03-14 11:58")).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("says so when no phone is signed in", () => {
    ui([]);
    expect(screen.getByText(/No phone is signed in/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("revokes after confirming, then refreshes", async () => {
    ui(PHONES);
    fireEvent.click(screen.getByRole("button", { name: "Revoke Pixel 9" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Pixel 9"));
    await waitFor(() => expect(calls).toEqual([{ url: "/api/app-sessions/4", method: "DELETE" }]));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("does nothing when the confirmation is declined", () => {
    window.confirm = vi.fn(() => false);
    ui(PHONES);
    fireEvent.click(screen.getByRole("button", { name: "Revoke Pixel 9" }));
    expect(calls).toEqual([]);
  });
});
