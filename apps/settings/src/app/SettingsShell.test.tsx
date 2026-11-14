import { screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SettingsProvider } from "~/app/settings-context";
import { SettingsShell } from "~/app/SettingsShell";
import { fakeApi } from "~/app/test-utils";
import { sectionFromHash } from "~/app/sections";

describe("the settings shell", () => {
  it("opens on subscription by default and names the company", async () => {
    render(
      <SettingsProvider api={fakeApi()}>
        <SettingsShell />
      </SettingsProvider>,
    );
    expect(await screen.findByText("/ Shopwave")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Subscription" }).getAttribute("aria-current")).toBe("page");
  });

  it("switches section when the hash changes", async () => {
    render(
      <SettingsProvider api={fakeApi()}>
        <SettingsShell />
      </SettingsProvider>,
    );
    await screen.findByText("/ Shopwave");
    act(() => {
      window.location.hash = "#/github";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("aria-current")).toBe("page");
  });

  it("shows a retry when settings fail to load", async () => {
    const api = fakeApi();
    api.getSettings = () => Promise.reject(new Error("offline"));
    render(
      <SettingsProvider api={api}>
        <SettingsShell />
      </SettingsProvider>,
    );
    expect((await screen.findByRole("alert")).textContent).toContain("offline");
  });

  it("maps unknown hashes to subscription", () => {
    expect(sectionFromHash("#/nope")).toBe("subscription");
    expect(sectionFromHash("#/cloud")).toBe("cloud");
  });
});
