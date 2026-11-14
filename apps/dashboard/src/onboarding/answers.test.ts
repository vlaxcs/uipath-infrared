import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_HINT,
  LAST_TARGET_HINT,
  canStart,
  initialAnswers,
  onpremChanged,
  onpremChoice,
  startRequest,
  targetChoices,
  withApp,
  withOnpremOnProfile,
  withProject,
  withTarget,
} from "~/onboarding/answers";
import { providerLabel } from "~/onboarding/providers";
import type { OnboardingSetup } from "~/onboarding/types";
import { DEFAULT_CRITERIA, DEFAULT_PROFILE } from "~/onboarding/criteria";

const setup: OnboardingSetup = {
  connections: [{ id: "floci", label: "AWS (demo estate)" }],
  providers: ["aws", "gcp", "managed_pg"],
  onprem: true,
  projects: [
    { id: "startup", description: "A start-up", forbidden_providers: [] },
    { id: "strict", description: "", forbidden_providers: ["gcp", "onprem"] },
  ],
};

describe("the onboarding answers", () => {
  it("start with the first connection and project, every provider ticked and on-prem off", () => {
    expect(initialAnswers(setup)).toEqual({
      connection: "floci",
      project: "startup",
      targets: ["aws", "gcp", "managed_pg"],
      onprem: false,
      criteria: DEFAULT_CRITERIA,
    });
  });

  it("drop what the newly picked project forbids", () => {
    const answers = withProject(setup, { ...initialAnswers(setup), onprem: true }, "strict");
    expect(answers.targets).toEqual(["aws", "managed_pg"]);
    expect(answers.onprem).toBe(false);
  });

  it("never untick the last target", () => {
    const one = { ...initialAnswers(setup), targets: ["aws"] };
    expect(withTarget(one, "aws", false)).toBe(one);
    expect(withTarget(one, "gcp", true).targets).toEqual(["aws", "gcp"]);
    expect(withTarget(initialAnswers(setup), "gcp", false).targets).toEqual(["aws", "managed_pg"]);
  });

  it("show a forbidden provider unticked and disabled, and the last ticked one disabled", () => {
    const answers = { ...withProject(setup, initialAnswers(setup), "strict"), targets: ["managed_pg"] };
    expect(targetChoices(setup, answers)).toEqual([
      { id: "aws", label: "AWS", ticked: false, disabled: false, hint: undefined },
      { id: "gcp", label: "Google Cloud", ticked: false, disabled: true, hint: FORBIDDEN_HINT },
      { id: "managed_pg", label: "Managed Postgres", ticked: true, disabled: true, hint: LAST_TARGET_HINT },
    ]);
  });

  it("hide on-prem when the catalog has none and disable it when the project forbids it", () => {
    expect(onpremChoice({ ...setup, onprem: false }, initialAnswers(setup))).toBeNull();
    const strict = withProject(setup, initialAnswers(setup), "strict");
    expect(onpremChoice(setup, { ...strict, onprem: true })).toMatchObject({ ticked: false, disabled: true, hint: FORBIDDEN_HINT });
  });

  it("need a project and a target to start", () => {
    expect(canStart(setup, initialAnswers(setup))).toBe(true);
    expect(canStart({ ...setup, projects: [] }, initialAnswers({ ...setup, projects: [] }))).toBe(false);
    expect(canStart(setup, { ...initialAnswers(setup), targets: [] })).toBe(false);
  });

  it("become the body POST /runs takes", () => {
    expect(startRequest({ connection: "floci", project: "startup", targets: ["aws"], onprem: true, criteria: DEFAULT_CRITERIA, focusMode: "plan", apps: [] })).toEqual({
      project: "startup",
      onboarding: { connection: "floci", targets: ["aws"], onprem: { wanted: true }, criteria: DEFAULT_CRITERIA },
    });
  });

  it("start from the saved profile: its criteria, and on-prem when it is wanted and allowed", () => {
    const profile = { criteria: { focus: "zone" as const, market: "fr" }, onprem: { wanted: true } };
    const answers = initialAnswers(setup, profile);
    expect(answers.criteria).toEqual({ focus: "zone", market: "fr" });
    expect(answers.onprem).toBe(setup.onprem);
    expect(initialAnswers({ ...setup, onprem: false }, profile).onprem).toBe(false);
  });

  it("label known providers and show unknown ones as they are", () => {
    expect(providerLabel("hetzner")).toBe("Hetzner");
    expect(providerLabel("supabase")).toBe("Supabase");
    expect(providerLabel("ovh")).toBe("ovh");
  });
});

describe("on-prem changes against the profile", () => {
  const site = { kind: "search" as const, areas: [{ label: "Bucharest", lat: 44.43, lng: 26.1, radius_km: 25 }] };
  const profile = { criteria: DEFAULT_CRITERIA, onprem: { wanted: true, site } };
  const answers = { connection: "floci", project: "startup", targets: ["aws"], criteria: DEFAULT_CRITERIA, onprem: true, site, focusMode: "plan" as const, apps: [] };

  it("sees no change when the run keeps the profile's site", () => {
    expect(onpremChanged(profile, answers)).toBe(false);
  });

  it("sees a change in the site, or in wanting on-prem at all", () => {
    expect(onpremChanged(profile, { ...answers, site: { ...site, areas: [...site.areas, { lat: 46.77, lng: 23.59, radius_km: 40 }] } })).toBe(true);
    expect(onpremChanged(profile, { ...answers, onprem: false })).toBe(true);
  });

  it("ignores the site when neither the profile nor the run wants on-prem", () => {
    expect(onpremChanged({ ...profile, onprem: { wanted: false, site } }, { ...answers, onprem: false, site: { ...site, areas: [{ ...site.areas[0], label: "Cluj" }] } })).toBe(false);
  });

  it("writes the run's on-prem details onto the profile", () => {
    const moved = { ...site, areas: [{ ...site.areas[0], label: "Cluj" }] };
    expect(withOnpremOnProfile(profile, { ...answers, site: moved }).onprem).toEqual({ wanted: true, site: moved });
  });
});

describe("the projects of an estate in a run", () => {
  const estate = {
    ...setup,
    projects: [{
      id: "northwind", description: "", forbidden_providers: [],
      applications: [
        { id: "payments", name: "Payments API", summary: "", stacks: ["payments-prod"], users: { metric: "monthly_active_users", current: 52000, expected: 190000, at_month: 36 } },
        { id: "hr-portal", name: "HR portal", summary: "", stacks: ["hr-portal-prod"], users: { metric: "internal_users", current: 900, expected: 1450, at_month: 36 } },
      ],
    }],
  };

  it("start from the estate's users and from each project's focus in Configuration", () => {
    const answers = initialAnswers(estate, { ...DEFAULT_PROFILE, projects: { payments: { focus: "availability" } } });
    expect(answers.apps).toEqual([
      { id: "payments", users_now: 52000, users_expected: 190000, at_month: 36, criteria: { focus: "availability" } },
      { id: "hr-portal", users_now: 900, users_expected: 1450, at_month: 36, criteria: DEFAULT_CRITERIA },
    ]);
  });

  it("send one focus for every project in plan mode, and each project's own otherwise", () => {
    const answers = initialAnswers(estate, { ...DEFAULT_PROFILE, projects: { payments: { focus: "availability" } } });
    const plan = startRequest(answers).onboarding;
    expect(plan.focus_mode).toBe("plan");
    expect(plan.applications?.map((app) => app.criteria)).toEqual([DEFAULT_CRITERIA, DEFAULT_CRITERIA]);
    const own = startRequest({ ...answers, focusMode: "project" }).onboarding;
    expect(own.applications?.map((app) => app.criteria)).toEqual([{ focus: "availability" }, DEFAULT_CRITERIA]);
  });

  it("will not start with a project that has no users", () => {
    const answers = withApp(initialAnswers(estate), "payments", { users_now: 0 });
    expect(canStart(estate, answers)).toBe(false);
  });
});

