import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pitch2Copy } from "./copy.ts";
import { Pitch2 } from "./Pitch2.tsx";

describe("Pitch2", () => {
  it("shows exactly the three sections, in order, then the closing line last", () => {
    render(<Pitch2 />);
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual([...pitch2Copy.en.sections.map((section) => section.title), pitch2Copy.en.closing]);
  });

  it("switches the headlines to Romanian", async () => {
    render(<Pitch2 />);
    await userEvent.click(screen.getByRole("button", { name: /RO/ }));
    expect(screen.getByRole("heading", { level: 2, name: pitch2Copy.ro.sections[1].title })).toBeInTheDocument();
  });
});

describe("Pitch2 sublines", () => {
  it("shows every problem and why-us card", () => {
    render(<Pitch2 />);
    const [problem, , whyUs] = pitch2Copy.en.sections;
    for (const point of [...problem.points, ...whyUs.points]) {
      expect(screen.getByRole("heading", { level: 3, name: point.who })).toBeInTheDocument();
      expect(screen.getByText(point.text)).toBeInTheDocument();
    }
  });
});

describe("Pitch2 shouting", () => {
  it("paints the capitalised words in the hero, sections, and closing", () => {
    const { container } = render(<Pitch2 />);
    const green = [...container.querySelectorAll(".text-accent")].map((node) => node.textContent);
    expect(green).toEqual(
      expect.arrayContaining([
        "RECEIPTS",
        "PRICE",
        "PROVE",
        "SIGN",
        "REPORT",
        "MOVE",
        "ADVISES",
      ]),
    );
  });
});

describe("Pitch2 scenes", () => {
  it("plays the Rive scenes above and the product scene in the closing", () => {
    const { container } = render(<Pitch2 />);
    const scenes = [...container.querySelectorAll("[data-animation]")].map((node) =>
      node.getAttribute("data-animation"),
    );
    expect(scenes).toEqual(["scan", "reorganise", "grow", "scan"]);
    expect(screen.getByRole("img", { name: pitch2Copy.en.sceneLabel })).toBeInTheDocument();
  });
});

describe("Pitch2 brand line", () => {
  it("never says 'by Digi'", () => {
    const { container } = render(<Pitch2 />);
    expect(container.textContent).not.toMatch(/by Digi/i);
  });
});
