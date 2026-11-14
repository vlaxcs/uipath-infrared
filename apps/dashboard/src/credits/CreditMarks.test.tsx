import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CreditMarks } from "~/credits/CreditMarks";

afterEach(cleanup);

describe("the credit marks", () => {
  it("draws one mark per credit left and names the count", () => {
    const { container } = render(<CreditMarks credits={3} />);
    expect(container.querySelectorAll("[data-credit-mark]")).toHaveLength(3);
    expect(screen.getByRole("img", { name: "3 runs left" })).toBeTruthy();
  });

  it("switches to one mark and a number above 10", () => {
    const { container } = render(<CreditMarks credits={42} />);
    expect(container.querySelectorAll("[data-credit-mark]")).toHaveLength(1);
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByRole("img", { name: "42 runs left" })).toBeTruthy();
  });

  it("says when no run is left", () => {
    const { container } = render(<CreditMarks credits={0} />);
    expect(container.querySelectorAll("[data-credit-mark]")).toHaveLength(0);
    expect(screen.getByRole("img", { name: "No runs left" })).toBeTruthy();
  });

  it("uses the singular for one run", () => {
    render(<CreditMarks credits={1} />);
    expect(screen.getByRole("img", { name: "1 run left" })).toBeTruthy();
  });
});
