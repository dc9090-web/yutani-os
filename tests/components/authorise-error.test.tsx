import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthoriseError } from "../../src/app/settings/AuthoriseError.js";

describe("AuthoriseError", () => {
  it("shows nothing when there is no error", () => {
    render(<AuthoriseError error={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("explains a failed character authorisation in one line", () => {
    render(<AuthoriseError error="jwt" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/^That character could not be authorised\. Please try again\.$/);
  });
});
