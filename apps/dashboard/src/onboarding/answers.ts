import { DEFAULT_PROFILE } from "~/onboarding/criteria";
import { providerLabel } from "~/onboarding/providers";
import type { AppAnswer, Answers, Choice, Criteria, OnboardingSetup, Profile, Project, StartRequest } from "~/onboarding/types";

const ONPREM = "onprem";
export const FORBIDDEN_HINT = "Forbidden by the project";
export const LAST_TARGET_HINT = "At least one target stays ticked";

export function projectById(setup: OnboardingSetup, id: string): Project | undefined {
  return setup.projects.find((project) => project.id === id);
}

function defaultTargets(setup: OnboardingSetup, project: Project | undefined): string[] {
  return setup.providers.filter((provider) => !project?.forbidden_providers.includes(provider));
}

export function initialAnswers(setup: OnboardingSetup, profile: Profile = DEFAULT_PROFILE): Answers {
  const project = setup.projects[0];
  const onpremForbidden = project?.forbidden_providers.includes(ONPREM) ?? false;
  return {
    connection: setup.connections[0]?.id ?? "",
    project: project?.id ?? "",
    targets: defaultTargets(setup, project),
    onprem: setup.onprem && !onpremForbidden && profile.onprem.wanted,
    site: profile.onprem.site,
    criteria: profile.criteria,
    focusMode: "plan",
    apps: appAnswers(project, profile),
  };
}

export function appAnswers(project: Project | undefined, profile: Profile = DEFAULT_PROFILE): AppAnswer[] {
  return (project?.applications ?? []).map((app) => ({
    id: app.id,
    users_now: app.users.current,
    users_expected: app.users.expected,
    at_month: app.users.at_month,
    criteria: profile.projects?.[app.id] ?? profile.criteria,
  }));
}

export function withProject(setup: OnboardingSetup, answers: Answers, id: string, profile: Profile = DEFAULT_PROFILE): Answers {
  const project = projectById(setup, id);
  return { ...answers, project: id, targets: defaultTargets(setup, project), onprem: false, apps: appAnswers(project, profile) };
}

export function withApp(answers: Answers, id: string, change: Partial<Omit<AppAnswer, "id">>): Answers {
  return { ...answers, apps: answers.apps.map((app) => (app.id === id ? { ...app, ...change } : app)) };
}

export function withAppFocus(answers: Answers, id: string, criteria: Criteria): Answers {
  return withApp(answers, id, { criteria });
}

export function appsValid(answers: Answers): boolean {
  return answers.apps.every((app) => app.users_now > 0 && app.users_expected > 0 && app.at_month >= 1);
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

export function canStart(setup: OnboardingSetup, answers: Answers): boolean {
  return answers.connection !== "" && projectById(setup, answers.project) !== undefined && answers.targets.length > 0 && appsValid(answers);
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
            focus_mode: answers.focusMode,
            applications: answers.apps.map((app) => ({
              ...app,
              criteria: answers.focusMode === "project" ? app.criteria : answers.criteria,
            })),
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
