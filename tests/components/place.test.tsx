import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Place } from "../../src/app/components/Place.js";

const jita = { name: "Jita", sec: "0.9", secClass: "sec-high" };

describe("Place", () => {
  it("puts the coloured security status in front of a station whose name already starts with its system", () => {
    render(<Place name="Jita IV - Moon 4 - Caldari Navy Assembly Plant" system={jita} />);
    expect(screen.getByText("0.9")).toHaveClass("yo-sec", "sec-high");
    expect(screen.getByTitle("Jita IV - Moon 4 - Caldari Navy Assembly Plant")).toHaveTextContent(/^0\.9 Jita IV - Moon 4 - Caldari Navy Assembly Plant$/);
  });
  it("spells the system out for a place whose name does not say it (a player structure)", () => {
    render(<Place name="Tranquility Trading Tower" system={{ name: "Perimeter", sec: "1.0", secClass: "sec-high" }} />);
    expect(screen.getByTitle("Perimeter · Tranquility Trading Tower")).toHaveTextContent("1.0 Perimeter · Tranquility Trading Tower");
  });
  it("does not repeat a system that is the whole place", () => {
    render(<Place name="Jita" system={jita} />);
    expect(screen.getByTitle("Jita")).toHaveTextContent(/^0\.9 Jita$/);
  });
  it("colours low-sec and null-sec differently", () => {
    render(<><Place name="Tama VII" system={{ name: "Tama", sec: "0.3", secClass: "sec-low" }} /><Place name="M-OEE8 I" system={{ name: "M-OEE8", sec: "0.0", secClass: "sec-null" }} /></>);
    expect(screen.getByText("0.3")).toHaveClass("sec-low");
    expect(screen.getByText("0.0")).toHaveClass("sec-null");
  });
  it("shows just the name when there is no system to speak of", () => {
    render(<Place name="Saved fit" system={null} className="x" />);
    expect(screen.getByText("Saved fit")).toHaveClass("x");
    expect(document.querySelector(".yo-sec")).toBeNull();
  });
});
