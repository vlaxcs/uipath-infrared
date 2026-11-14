import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CreditMarks } from "~/credits/CreditMarks";

afterEach(cleanup);

describe("the credit count", () => {
  it("shows one mark and the runs left as Nx", () => {
    const { container } = render(<CreditMarks credits={3} />);
    expect(container.querySelectorAll("[data-credit-mark]")).toHaveLength(1);
    expect(screen.getByText("3x")).toBeTruthy();
    expect(screen.getByRole("img", { name: "3 runs left" })).toBeTruthy();
  });

  it("uses the singular for one run, and says when none is left", () => {
    render(<CreditMarks credits={1} />);
    expect(screen.getByRole("img", { name: "1 run left" })).toBeTruthy();
    cleanup();
    render(<CreditMarks credits={0} />);
    expect(screen.getByText("0x")).toBeTruthy();
    expect(screen.getByRole("img", { name: "No runs left" })).toBeTruthy();
  });
});
