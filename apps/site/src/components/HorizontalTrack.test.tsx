import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HorizontalTrack } from "./HorizontalTrack";

function offscreen(element: HTMLElement) {
  element.getBoundingClientRect = () => ({ left: -1200, right: -800, top: 0, bottom: 100, width: 400, height: 100, x: -1200, y: 0, toJSON: () => ({}) });
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.scrollTo = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

function renderTrack() {
  render(
    <HorizontalTrack>
      <main data-testid="main" tabIndex={-1}>
        <section>
          <a href="#somewhere">Link in a panel</a>
        </section>
      </main>
    </HorizontalTrack>,
  );
}

describe("horizontal track", () => {
  it("stays where it is when a click focuses the page itself", () => {
    renderTrack();
    const main = screen.getByTestId("main");
    offscreen(main);
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.focusIn(main);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("stays where it is when a mouse click focuses a link outside the screen", () => {
    renderTrack();
    const link = screen.getByRole("link", { name: "Link in a panel" });
    offscreen(link);
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.pointerDown(link);
    fireEvent.focusIn(link);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to a link that Tab lands on outside the screen", () => {
    renderTrack();
    const link = screen.getByRole("link", { name: "Link in a panel" });
    offscreen(link);
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.keyDown(document, { key: "Tab" });
    fireEvent.focusIn(link);
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
