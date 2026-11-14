import { providerLabel } from "~/onboarding/providers";
import type { Answers, Choice, OnboardingSetup, Project, StartRequest } from "~/onboarding/types";

const ONPREM = "onprem";
export const FORBIDDEN_HINT = "Forbidden by the project";
export const LAST_TARGET_HINT = "At least one target stays ticked";

export function projectById(setup: OnboardingSetup, id: string): Project | undefined {
  return setup.projects.find((project) => project.id === id);
}

function defaultTargets(setup: OnboardingSetup, project: Project | undefined): string[] {
  return setup.providers.filter((provider) => !project?.forbidden_providers.includes(provider));
}

export function initialAnswers(setup: OnboardingSetup): Answers {
  const project = setup.projects[0];
  return {
    connection: setup.connections[0]?.id ?? "",
    project: project?.id ?? "",
    targets: defaultTargets(setup, project),
    onprem: false,
  };
}

export function withProject(setup: OnboardingSetup, answers: Answers, id: string): Answers {
  return { ...answers, project: id, targets: defaultTargets(setup, projectById(setup, id)), onprem: false };
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
  return answers.connection !== "" && projectById(setup, answers.project) !== undefined && answers.targets.length > 0;
}

export function startRequest(answers: Answers): StartRequest {
  return {
    project: answers.project,
    onboarding: { connection: answers.connection, targets: answers.targets, onprem: { wanted: answers.onprem } },
  };
}
