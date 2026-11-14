import { DEFAULT_PROFILE } from "~/onboarding/criteria";
import { providerLabel } from "~/onboarding/providers";
import { DEFAULT_RADIUS_KM } from "~/onboarding/searchAreas";
import type { AppAnswer, Answers, Choice, Criteria, OnboardingSetup, Profile, ProfileSite, Project, SearchArea, StartRequest } from "~/onboarding/types";

const ONPREM = "onprem";
export const FORBIDDEN_HINT = "Forbidden by the project";
export const LAST_TARGET_HINT = "At least one target stays ticked";

export function projectById(setup: OnboardingSetup, id: string): Project | undefined {
  return setup.projects.find((project) => project.id === id);
}

function defaultTargets(setup: OnboardingSetup, project: Project | undefined): string[] {
  return setup.providers.filter((provider) => !project?.forbidden_providers.includes(provider));
}

export const MAX_INTENT = 2000;

export function companyOf(setup: OnboardingSetup): Project | undefined {
  const named = setup.company === undefined ? undefined : projectById(setup, setup.company);
  return named ?? setup.projects.find((project) => (project.applications?.length ?? 0) > 0) ?? setup.projects[0];
}

export function initialAnswers(setup: OnboardingSetup, profile: Profile = DEFAULT_PROFILE): Answers {
  const project = companyOf(setup);
  const onpremForbidden = project?.forbidden_providers.includes(ONPREM) ?? false;
  return {
    connection: setup.connections[0]?.id ?? "",
    project: project?.id ?? "",
    targets: defaultTargets(setup, project),
    onprem: setup.onprem && !onpremForbidden && profile.onprem.wanted,
    site: profile.onprem.site,
    criteria: profile.criteria,
    apps: appAnswers(project, profile),
  };
}

export function appAnswers(project: Project | undefined, profile: Profile = DEFAULT_PROFILE): AppAnswer[] {
  return (project?.applications ?? []).map((app) => {
    const own = profile.projects?.[app.id];
    return {
      id: app.id,
      users_now: app.users.current,
      users_expected: app.users.expected,
      at_month: app.users.at_month,
      ...(own ? { criteria: own } : {}),
    };
  });
}

export function withApp(answers: Answers, id: string, change: Partial<Omit<AppAnswer, "id">>): Answers {
  return { ...answers, apps: answers.apps.map((app) => (app.id === id ? { ...app, ...change } : app)) };
}

export function withAppFocus(answers: Answers, id: string, criteria: Criteria | null): Answers {
  return {
    ...answers,
    apps: answers.apps.map((app) => {
      if (app.id !== id) return app;
      const { criteria: _dropped, ...rest } = app;
      return criteria ? { ...rest, criteria } : rest;
    }),
  };
}

export function appsValid(answers: Answers): boolean {
  return answers.apps.every((app) => app.users_now > 0 && app.users_expected > 0 && app.at_month >= 1 && (app.intent ?? "").length <= MAX_INTENT);
}

export function withTarget(answers: Answers, provider: string, ticked: boolean): Answers {
  if (ticked) {
    return answers.targets.includes(provider) ? answers : { ...answers, targets: [...answers.targets, provider] };
  }
  if (answers.targets.length === 1 && answers.targets[0] === provider) return answers;
  return { ...answers, targets: answers.targets.filter((target) => target !== provider) };
}

export function targetChoices(setup: OnboardingSetup, answers: Answers): Choice[] {
  const forbidden = projectById(setup, answers.project)?.forbidden_providers ?? [];
  return setup.providers.map((provider) => {
    const label = providerLabel(provider);
    if (forbidden.includes(provider)) {
      return { id: provider, label, ticked: false, disabled: true, hint: FORBIDDEN_HINT };
    }
    const ticked = answers.targets.includes(provider);
    const last = ticked && answers.targets.length === 1;
    return { id: provider, label, ticked, disabled: last, hint: last ? LAST_TARGET_HINT : undefined };
  });
}

export function onpremChoice(setup: OnboardingSetup, answers: Answers): Choice | null {
  if (!setup.onprem) return null;
  const forbidden = projectById(setup, answers.project)?.forbidden_providers.includes(ONPREM) ?? false;
  return {
    id: ONPREM,
    label: "Also price a setup of our own",
    ticked: !forbidden && answers.onprem,
    disabled: forbidden,
    hint: forbidden ? FORBIDDEN_HINT : undefined,
  };
}

export function searchAreas(site: ProfileSite | undefined): SearchArea[] {
  if (!site) return [];
  return site.kind === "search" ? site.areas : [{ lat: site.lat, lng: site.lng, radius_km: DEFAULT_RADIUS_KM }];
}

function siteValid(answers: Answers): boolean {
  return !answers.onprem || searchAreas(answers.site).length > 0;
}

export function canStart(setup: OnboardingSetup, answers: Answers): boolean {
  return answers.connection !== "" && projectById(setup, answers.project) !== undefined && answers.targets.length > 0 && appsValid(answers) && siteValid(answers);
}

function appRequest({ intent, ...app }: AppAnswer): AppAnswer {
  const said = intent?.trim() ?? "";
  return said === "" ? app : { ...app, intent: said };
}

export function startRequest(answers: Answers): StartRequest {
  return {
    project: answers.project,
    onboarding: {
      connection: answers.connection,
      targets: answers.targets,
      onprem: { wanted: answers.onprem },
      criteria: answers.criteria,
      ...(answers.apps.length > 0
        ? {
            focus_mode: answers.apps.some((app) => app.criteria) ? ("project" as const) : ("plan" as const),
            applications: answers.apps.map(appRequest),
          }
        : {}),
    },
  };
}

export function onpremChanged(profile: Profile, answers: Answers): boolean {
  if (answers.onprem !== profile.onprem.wanted) return true;
  if (!answers.onprem) return false;
  return JSON.stringify(answers.site ?? null) !== JSON.stringify(profile.onprem.site ?? null);
}

export function withOnpremOnProfile(profile: Profile, answers: Answers): Profile {
  return { ...profile, onprem: answers.onprem && answers.site ? { wanted: true, site: answers.site } : { wanted: false, site: answers.site } };
}
