import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExtensionCard } from "~/features/github/ExtensionCard";

afterEach(cleanup);

describe("the Chrome extension card", () => {
  it("never sends people to the Web Store while the extension is not published there", () => {
    render(<ExtensionCard org="acme" />);
    const storeLinks = screen.queryAllByRole("link").filter((link) => link.getAttribute("href")?.includes("chromewebstore.google.com"));
    expect(storeLinks).toEqual([]);
  });

  it("explains how to load the unpublished extension", () => {
    render(<ExtensionCard org="acme" />);
    const steps = within(screen.getByRole("list", { name: "Install the extension from the repository" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(steps.join(" ")).toContain("npm run build");
    expect(steps.join(" ")).toContain("chrome://extensions");
    expect(steps.join(" ")).toContain("Load unpacked");
    expect(steps.join(" ")).toContain("apps/chrome-extension/dist");
  });
});
