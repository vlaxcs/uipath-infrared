import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_HINT,
  LAST_TARGET_HINT,
  MAX_INTENT,
  canStart,
  companyOf,
  initialAnswers,
  onpremChanged,
  onpremChoice,
  startRequest,
  targetChoices,
  withApp,
  withAppFocus,
  withOnpremOnProfile,
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
  it("start with the first connection and the company, every provider ticked and on-prem off", () => {
    expect(initialAnswers(setup)).toEqual({
      connection: "floci",
      project: "startup",
      targets: ["aws", "gcp", "managed_pg"],
      onprem: false,
      criteria: DEFAULT_CRITERIA,
      apps: [],
    });
  });

  it("drop what the company forbids", () => {
    const answers = initialAnswers({ ...setup, company: "strict" }, { ...DEFAULT_PROFILE, onprem: { wanted: true } });
    expect(answers.project).toBe("strict");
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
    const answers = { ...initialAnswers({ ...setup, company: "strict" }), targets: ["managed_pg"] };
    expect(targetChoices(setup, answers)).toEqual([
      { id: "aws", label: "AWS", ticked: false, disabled: false, hint: undefined },
      { id: "gcp", label: "Google Cloud", ticked: false, disabled: true, hint: FORBIDDEN_HINT },
      { id: "managed_pg", label: "Managed Postgres", ticked: true, disabled: true, hint: LAST_TARGET_HINT },
    ]);
  });

  it("hide on-prem when the catalog has none and disable it when the project forbids it", () => {
    expect(onpremChoice({ ...setup, onprem: false }, initialAnswers(setup))).toBeNull();
    const strict = initialAnswers({ ...setup, company: "strict" });
    expect(onpremChoice(setup, { ...strict, onprem: true })).toMatchObject({ ticked: false, disabled: true, hint: FORBIDDEN_HINT });
  });

  it("need a project and a target to start", () => {
    expect(canStart(setup, initialAnswers(setup))).toBe(true);
    expect(canStart({ ...setup, projects: [] }, initialAnswers({ ...setup, projects: [] }))).toBe(false);
    expect(canStart(setup, { ...initialAnswers(setup), targets: [] })).toBe(false);
  });

  it("become the body POST /runs takes", () => {
    expect(startRequest({ connection: "floci", project: "startup", targets: ["aws"], onprem: true, criteria: DEFAULT_CRITERIA, apps: [] })).toEqual({
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
  const answers = { connection: "floci", project: "startup", targets: ["aws"], criteria: DEFAULT_CRITERIA, onprem: true, site, apps: [] };

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

describe("the company's projects in a run", () => {
  const payments = { id: "payments", name: "Payments API", summary: "", stacks: ["payments-prod"], users: { metric: "monthly_active_users", current: 52000, expected: 190000, at_month: 36 } };
  const hr = { id: "hr-portal", name: "HR portal", summary: "", stacks: ["hr-portal-prod"], users: { metric: "internal_users", current: 900, expected: 1450, at_month: 36 } };
  const company = {
    ...setup,
    company: "northwind",
    projects: [
      { id: "alpha", description: "", forbidden_providers: [], applications: [hr] },
      { id: "northwind", description: "", forbidden_providers: [], applications: [payments, hr] },
    ],
  };

  it("work on the company the platform names", () => {
    expect(companyOf(company)?.id).toBe("northwind");
    expect(initialAnswers(company).apps.map((app) => app.id)).toEqual(["payments", "hr-portal"]);
  });

  it("fall back to the first project with projects of its own, then to the first one", () => {
    const { company: _named, ...older } = company;
    expect(companyOf({ ...older, projects: [{ id: "bare", description: "", forbidden_providers: [] }, ...older.projects] })?.id).toBe("alpha");
    expect(companyOf({ ...older, company: "gone" })?.id).toBe("alpha");
    expect(companyOf(setup)?.id).toBe("startup");
    expect(companyOf({ ...setup, projects: [] })).toBeUndefined();
  });

  it("start from finance's users, on the default focus unless Configuration gives a project its own", () => {
    const answers = initialAnswers(company, { ...DEFAULT_PROFILE, projects: { payments: { focus: "availability" } } });
    expect(answers.apps).toEqual([
      { id: "payments", users_now: 52000, users_expected: 190000, at_month: 36, criteria: { focus: "availability" } },
      { id: "hr-portal", users_now: 900, users_expected: 1450, at_month: 36 },
    ]);
  });

  it("send the plan's focus mode while every project is on the default focus", () => {
    const sent = startRequest(initialAnswers(company)).onboarding;
    expect(sent.focus_mode).toBe("plan");
    expect(sent.applications?.every((app) => !("criteria" in app))).toBe(true);
  });

  it("send a project's own focus, and the project mode, once one opts out of the default", () => {
    const own = withAppFocus(initialAnswers(company), "hr-portal", { focus: "zone", market: "de" });
    const sent = startRequest(own).onboarding;
    expect(sent.focus_mode).toBe("project");
    expect(sent.applications).toEqual([
      { id: "payments", users_now: 52000, users_expected: 190000, at_month: 36 },
      { id: "hr-portal", users_now: 900, users_expected: 1450, at_month: 36, criteria: { focus: "zone", market: "de" } },
    ]);
    const back = startRequest(withAppFocus(own, "hr-portal", null)).onboarding;
    expect(back.focus_mode).toBe("plan");
    expect(back.applications?.[1]).toEqual({ id: "hr-portal", users_now: 900, users_expected: 1450, at_month: 36 });
  });

  it("send what the owner wants to do next with a project, trimmed, and nothing when it is blank", () => {
    let answers = withApp(initialAnswers(company), "payments", { intent: "  Move it to managed Postgres.  " });
    answers = withApp(answers, "hr-portal", { intent: "   " });
    const sent = startRequest(answers).onboarding.applications;
    expect(sent?.[0].intent).toBe("Move it to managed Postgres.");
    expect(sent?.[1]).not.toHaveProperty("intent");
  });

  it("will not start with a project that has no users, or a plan past the limit", () => {
    expect(canStart(company, withApp(initialAnswers(company), "payments", { users_now: 0 }))).toBe(false);
    expect(canStart(company, withApp(initialAnswers(company), "payments", { intent: "x".repeat(MAX_INTENT + 1) }))).toBe(false);
    expect(canStart(company, withApp(initialAnswers(company), "payments", { intent: "x".repeat(MAX_INTENT) }))).toBe(true);
  });

  it("will not start on-prem without an area", () => {
    const answers = { ...initialAnswers(company), onprem: true };
    expect(canStart(company, { ...answers, site: { kind: "search", areas: [] } })).toBe(false);
    expect(canStart(company, { ...answers, site: { kind: "search", areas: [{ lat: 44.43, lng: 26.1, radius_km: 25 }] } })).toBe(true);
  });
});
