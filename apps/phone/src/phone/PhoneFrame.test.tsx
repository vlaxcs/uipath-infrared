import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneFrame } from "~/phone/PhoneFrame";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the phone frame", () => {
  it("shows what it is given inside the screen", () => {
    render(<PhoneFrame><p>inside the phone</p></PhoneFrame>);
    expect(screen.getByRole("main").textContent).toContain("inside the phone");
  });

  it("keeps the status bar clock current", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 9, 41, 50));
    render(<PhoneFrame />);
    const statusBar = screen.getByTestId("status-bar");
    expect(statusBar.textContent).toContain("09:41");
    act(() => { vi.advanceTimersByTime(15000); });
    expect(statusBar.textContent).toContain("09:42");
  });

  it("hides the status bar from screen readers", () => {
    render(<PhoneFrame />);
    expect(screen.getByTestId("status-bar").getAttribute("aria-hidden")).toBe("true");
  });
});
