import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrchestratorError, type OnboardingSource } from "~/onboarding/api";
import { DEFAULT_PROFILE } from "~/onboarding/criteria";
import type { Profile } from "~/onboarding/types";
import { ConfigurationPage } from "~/pages/ConfigurationPage";

afterEach(cleanup);

function source(profile: Profile = DEFAULT_PROFILE, saveProfile = vi.fn(async (saved: Profile) => saved)): OnboardingSource {
  return { load: vi.fn(), start: vi.fn(), loadProfile: vi.fn(async () => profile), saveProfile, listRuns: vi.fn(async () => []) };
}

describe("the configuration page", () => {
  it("shows the saved focus", async () => {
    render(<ConfigurationPage source={source({ ...DEFAULT_PROFILE, criteria: { focus: "zone", market: "de" } })} />);
    expect(((await screen.findByRole("radio", { name: /Zones/ })) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Market") as HTMLSelectElement).value).toBe("de");
  });

  it("saves one focus as the default", async () => {
    const saveProfile = vi.fn(async (saved: Profile) => saved);
    render(<ConfigurationPage source={source(DEFAULT_PROFILE, saveProfile)} />);
    fireEvent.click(await screen.findByRole("radio", { name: /High availability/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    expect(saveProfile.mock.calls[0][0].criteria).toEqual({ focus: "availability" });
    expect(await screen.findByText("Saved. New analyses start from these defaults.")).toBeTruthy();
  });

  it("asks for the on-prem site once on-prem is wanted, and saves it", async () => {
    const saveProfile = vi.fn(async (saved: Profile) => saved);
    render(<ConfigurationPage source={source(DEFAULT_PROFILE, saveProfile)} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Also price a setup of our own" }));
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Bucharest, Romania" } });
    fireEvent.change(screen.getByLabelText("Radius, km (5 to 100)"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() => expect(saveProfile).toHaveBeenCalled());
    expect(saveProfile.mock.calls[0][0].onprem).toEqual({
      wanted: true,
      site: { kind: "search", label: "Bucharest, Romania", lat: 44.4268, lng: 26.1025, radius_km: 40 },
    });
  });

  it("shows the orchestrator's reason when it refuses the defaults", async () => {
    const saveProfile = vi.fn(async () => {
      throw new OrchestratorError("invalid profile: a search needs radius_km from 5 to 100 and no free_area_m2");
    });
    render(<ConfigurationPage source={source(DEFAULT_PROFILE, saveProfile)} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save defaults" }));
    expect((await screen.findByRole("alert")).textContent).toContain("radius_km from 5 to 100");
  });

  it("says when the defaults cannot be loaded", async () => {
    const failing: OnboardingSource = { ...source(), loadProfile: vi.fn(async () => { throw new OrchestratorError("The platform is unreachable."); }) };
    render(<ConfigurationPage source={failing} />);
    expect((await screen.findByRole("alert")).textContent).toContain("unreachable");
  });
});
