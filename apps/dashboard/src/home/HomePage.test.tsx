import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "~/home/HomePage";

function renderHome(extensionUrl: string | null) {
  return render(<HomePage extensionUrl={extensionUrl} onAnalyze={() => {}} onPrevious={() => {}} />);
}

function openGuide() {
  fireEvent.click(screen.getByRole("button", { name: "Browser extension" }));
  return screen.getByRole("dialog", { name: "Install the Infrared extension" });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the browser extension button", () => {
  it("links to the published extension when there is one", () => {
    renderHome("https://chromewebstore.google.com/detail/infrared");
    expect(screen.getByRole("link", { name: "Browser extension" }).getAttribute("href")).toBe(
      "https://chromewebstore.google.com/detail/infrared",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the install guide while the extension is unpublished", () => {
    renderHome(null);
    expect(screen.queryByRole("dialog")).toBeNull();

    const guide = openGuide();
    const steps = within(guide).getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(steps).toHaveLength(5);
    expect(steps[0]).toContain("npm run build");
    expect(steps[1]).toContain("chrome://extensions");
    expect(steps[2]).toContain("apps/chrome-extension/dist");
    expect(steps[4]).toContain("https://");
  });

  it("closes the guide and returns focus to the button", async () => {
    renderHome(null);
    const button = screen.getByRole("button", { name: "Browser extension" });
    const guide = openGuide();

    fireEvent.click(within(guide).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("copies the extensions address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderHome(null);
    const guide = openGuide();

    fireEvent.click(within(guide).getByRole("button", { name: "Copy chrome://extensions" }));

    expect(writeText).toHaveBeenCalledWith("chrome://extensions");
    await waitFor(() => expect(within(guide).getByRole("button", { name: "Copy chrome://extensions" }).textContent).toBe("Copied"));
  });

  it("says when copying fails", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    renderHome(null);
    const guide = openGuide();

    fireEvent.click(within(guide).getByRole("button", { name: "Copy chrome://extensions" }));

    await waitFor(() => expect(within(guide).getByRole("button", { name: "Copy chrome://extensions" }).textContent).toBe("Copy failed"));
  });
});
