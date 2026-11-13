import { afterEach, describe, expect, it } from "vitest";
import { rememberScroll, takeRememberedScroll } from "./scrollMemory";

afterEach(() => sessionStorage.clear());

describe("scroll memory", () => {
  it("gives back the position saved before a reload, once", () => {
    rememberScroll(4200);
    expect(takeRememberedScroll()).toBe(4200);
    expect(takeRememberedScroll()).toBeNull();
  });

  it("gives nothing when no position was saved", () => {
    expect(takeRememberedScroll()).toBeNull();
  });

  it("ignores a stored value that is not a position", () => {
    sessionStorage.setItem("netpot:scroll", "not a number");
    expect(takeRememberedScroll()).toBeNull();
    sessionStorage.setItem("netpot:scroll", "-30");
    expect(takeRememberedScroll()).toBeNull();
  });
});
