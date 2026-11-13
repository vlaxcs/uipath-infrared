import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { content } from "../content";
import { FindArt } from "./FindArt";

const COLOR_BY_SEVERITY = {
  high: "var(--color-badge-high-lip)",
  medium: "var(--color-badge-medium-lip)",
  low: "var(--color-badge-low-lip)",
};

describe("find badges", () => {
  it.each(content.ro.finds.items)("draws $code in its severity colour, hidden from screen readers", (item) => {
    const { container } = render(<FindArt code={item.code} severity={item.severity} />);
    const wrapper = container.firstElementChild!;
    const svg = container.querySelector("svg")!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-severity", item.severity);
    expect(svg.querySelector(`circle[fill="${COLOR_BY_SEVERITY[item.severity]}"]`)).not.toBeNull();
  });

  it("gives every example its own drawing", () => {
    const drawings = content.ro.finds.items.map((item) => {
      const { container } = render(<FindArt code={item.code} severity={item.severity} />);
      return container.querySelector("g[transform='scale(1.15)']")!.innerHTML;
    });
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it("falls back to the question mark for a code it does not know", () => {
    const { container } = render(<FindArt code="SOMETHING_NEW" severity="low" />);
    expect(container.querySelector(".badge-question")).not.toBeNull();
  });
});
