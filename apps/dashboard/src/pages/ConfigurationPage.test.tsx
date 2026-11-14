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
  it("shows the saved defaults", async () => {
    render(<ConfigurationPage source={source({ ...DEFAULT_PROFILE, criteria: { ...DEFAULT_PROFILE.criteria, min_availability_pct: 99.99, min_zones: 3 } })} />);
    expect(((await screen.findByLabelText("High availability")) as HTMLSelectElement).value).toBe("99.99");
    expect((screen.getByLabelText("Zones") as HTMLSelectElement).value).toBe("3");
    expect((screen.getByRole("checkbox", { name: "EU (eu-*)" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Not evaluated by the engine yet.")).toBeTruthy();
  });

  it("saves the edited criteria", async () => {
    const saveProfile = vi.fn(async (saved: Profile) => saved);
    render(<ConfigurationPage source={source(DEFAULT_PROFILE, saveProfile)} />);
    fireEvent.change(await screen.findByLabelText("Cost reduction"), { target: { value: "risk" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "US (us-*)" }));
    fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    const saved = saveProfile.mock.calls[0][0];
    expect(saved.criteria.weights).toEqual({ cost: 0.2, risk: 0.65, effort: 0.15 });
    expect(saved.criteria.allowed_regions).toEqual(["eu-*", "us-*"]);
    expect(await screen.findByText("Saved. New analyses start from these defaults.")).toBeTruthy();
  });

  it("keeps the last region allowed", async () => {
    render(<ConfigurationPage source={source()} />);
    const eu = (await screen.findByRole("checkbox", { name: "EU (eu-*)" })) as HTMLInputElement;
    expect(eu.disabled).toBe(true);
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
