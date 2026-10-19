import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MultiviewEditor } from "../../src/app/skills/MultiviewEditor.js";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ALL = [{ id: 1, name: "Alpha" }, { id: 2, name: "Bravo" }, { id: 3, name: "Charlie" }];
const names = () => [...document.querySelectorAll(".mv-name")].map((n) => n.textContent);

beforeEach(() => {
  refresh.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
});

describe("MultiviewEditor", () => {
  it("shows the grid with an Edit button until edit mode is opened", () => {
    render(<MultiviewEditor all={ALL} selected={[3, 1]}><p>grid</p></MultiviewEditor>);
    expect(screen.getByText("grid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByText("grid")).toBeNull();
    // Shown characters first in their current order, then the hidden ones.
    expect(names()).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(screen.getByRole("checkbox", { name: "Bravo" })).not.toBeChecked();
  });

  it("reorders, toggles and saves the shown characters in list order", async () => {
    render(<MultiviewEditor all={ALL} selected={[3, 1]}><p>grid</p></MultiviewEditor>);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Alpha up" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bravo" }));
    expect(names()).toEqual(["Alpha", "Charlie", "Bravo"]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith("/api/multiview", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ characterIds: [1, 3, 2] }),
    }));
    expect(screen.getByText("grid")).toBeInTheDocument();
  });

  it("will not save with nobody shown, and Cancel throws the edits away", () => {
    render(<MultiviewEditor all={ALL} selected={[1]}><p>grid</p></MultiviewEditor>);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeChecked();
  });

  it("says so when the save fails and stays in edit mode", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MultiviewEditor all={ALL} selected={[1]}><p>grid</p></MultiviewEditor>);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Could not save — try again")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
