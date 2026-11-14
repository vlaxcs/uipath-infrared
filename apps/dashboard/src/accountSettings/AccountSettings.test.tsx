import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSettingsApi } from "../../../settings/src/adapters/fake-settings-api";
import type { AccountSettingsSource } from "~/accountSettings/AccountSettings";
import { AccountPage } from "~/pages/AccountPage";
import { ConfigurationPage } from "~/pages/ConfigurationPage";
import { DEFAULT_PROFILE } from "~/onboarding/criteria";
import type { OnboardingSource } from "~/onboarding/api";

afterEach(cleanup);

function settings(): AccountSettingsSource {
  const fake = createFakeSettingsApi(undefined, { delayMs: 0 });
  return { api: fake, sandbox: fake.sandbox };
}

const profiles: OnboardingSource = {
  load: vi.fn(),
  start: vi.fn(),
  loadProfile: vi.fn(async () => DEFAULT_PROFILE),
  saveProfile: vi.fn(async (profile) => profile),
  listRuns: vi.fn(async () => []),
};

describe("the account settings inside the platform", () => {
  it("puts the GitHub and cloud access panels beside the default focus on Configuration", async () => {
    render(<ConfigurationPage source={profiles} accountSettings={settings()} />);
    expect(await screen.findByRole("heading", { name: "GitHub organisation" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cloud access" })).toBeTruthy();
    expect(await screen.findByRole("radio", { name: /Cost reduction/ })).toBeTruthy();
    expect((await screen.findAllByText(/Connect/)).length).toBeGreaterThan(0);
  });

  it("shows the subscription panel, with the Stripe test-mode sandbox, on Account", async () => {
    render(<AccountPage accountSettings={settings()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Subscription" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Current plan" })).toBeTruthy();
    expect(await screen.findByText("Test mode")).toBeTruthy();
  });

  it("says when the account settings cannot load, and offers a retry", async () => {
    const failing = settings();
    failing.api = { ...failing.api, getSettings: () => Promise.reject(new Error("unreachable")) };
    render(<AccountPage accountSettings={failing} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load account settings: unreachable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
