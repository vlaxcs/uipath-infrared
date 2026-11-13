import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pitch2Copy } from "./copy.ts";
import { Pitch2 } from "./Pitch2.tsx";

describe("Pitch2", () => {
  it("shows exactly the three sections, in order, then the bundled-with-the-router line last", () => {
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
  it("shows the provider and the customer line under the problem and under why us", () => {
    render(<Pitch2 />);
    const [problem, , whyUs] = pitch2Copy.en.sections;
    for (const point of [...problem.points, ...whyUs.points]) {
      expect(screen.getByRole("heading", { level: 3, name: point.who })).toBeInTheDocument();
      expect(screen.getByText(point.text)).toBeInTheDocument();
    }
  });
});

describe("Pitch2 shouting", () => {
  it("paints the capitalised words green and shows TAP and SOLVE", () => {
    const { container } = render(<Pitch2 />);
    const green = [...container.querySelectorAll(".text-accent")].map((node) => node.textContent);
    expect(green).toEqual(expect.arrayContaining(["ACTIONABLE", "TAP", "SOLVE"]));
    expect(green).not.toContain("and");
  });
});

describe("Pitch2 screenshots", () => {
  it("shows the provider screenshot first and the customer one second, under how we solved it", () => {
    render(<Pitch2 />);
    const [provider, customer] = pitch2Copy.en.sections[1].shots!;
    const images = screen.getAllByRole("img").filter((image) => image.tagName === "IMG" && image.getAttribute("src")?.startsWith("/pitch-"));
    expect(images.map((image) => image.getAttribute("alt"))).toEqual([provider.alt, customer.alt]);
  });
});

describe("Pitch2 brand line", () => {
  it("says it is a service for internet providers, never 'by Digi'", () => {
    const { container } = render(<Pitch2 />);
    expect(screen.getByText("Service for internet providers")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/by Digi/i);
  });
});
