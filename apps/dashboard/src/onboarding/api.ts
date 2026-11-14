import type { OnboardingSetup, StartRequest, StartedRun } from "~/onboarding/types";

export class OrchestratorError extends Error {}

export type OnboardingSource = {
  load(): Promise<OnboardingSetup>;
  start(request: StartRequest): Promise<StartedRun>;
};

const UNREACHABLE = "The platform is unreachable. Check that the orchestrator is running, then try again.";

function baseUrl(): string {
  const url = import.meta.env.VITE_ORCHESTRATOR_URL;
  if (!url) throw new OrchestratorError("VITE_ORCHESTRATOR_URL is not set. Copy .env.example to .env at the repo root.");
  return url.replace(/\/+$/, "");
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const url = baseUrl() + path;
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new OrchestratorError(UNREACHABLE);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = (body as { error?: unknown } | null)?.error;
    throw new OrchestratorError(typeof reason === "string" ? reason : `The platform answered ${response.status}.`);
  }
  return body as T;
}

export const orchestratorOnboarding: OnboardingSource = {
  load: () => call<OnboardingSetup>("/onboarding"),
  start: (request) =>
    call<StartedRun>("/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }),
};
