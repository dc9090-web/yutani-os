import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { TagsPanel } from "../../src/app/settings/TagsPanel.js";
import type { Tag } from "../../src/lib/db/tags.js";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const TAGS: Tag[] = [{ id: 1, name: "Miner" }, { id: 2, name: "Scanner" }];
const ui = (tags: Tag[]) => render(<MantineProvider><TagsPanel tags={tags} /></MantineProvider>);

let calls: { url: string; method: string; body?: unknown }[] = [];

beforeEach(() => {
  calls = []; refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return { ok: true, status: init?.method === "POST" ? 201 : 204, json: async () => ({ id: 3, name: "Hauler" }) } as Response;
  }) as typeof fetch;
  window.confirm = vi.fn(() => true);
});

describe("TagsPanel", () => {
  it("lists existing tags", () => {
    ui(TAGS);
    expect(screen.getByText("Miner")).toBeInTheDocument();
    expect(screen.getByText("Scanner")).toBeInTheDocument();
  });

  it("adds a tag via the input and button", async () => {
    ui(TAGS);
    fireEvent.change(screen.getByPlaceholderText(/tag name/i), { target: { value: "Hauler" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls[0]).toMatchObject({ url: "/api/tags", method: "POST", body: { name: "Hauler" } }));
    expect(refresh).toHaveBeenCalled();
  });

  it("deletes a tag after confirming, with a warning that assignments are removed too", async () => {
    ui(TAGS);
    fireEvent.click(screen.getByRole("button", { name: "Delete Miner" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("every character"));
    await waitFor(() => expect(calls[0]).toMatchObject({ url: "/api/tags/1", method: "DELETE" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not delete when the confirm is dismissed", () => {
    window.confirm = vi.fn(() => false);
    ui(TAGS);
    fireEvent.click(screen.getByRole("button", { name: "Delete Miner" }));
    expect(calls).toHaveLength(0);
    expect(refresh).not.toHaveBeenCalled();
  });
});
