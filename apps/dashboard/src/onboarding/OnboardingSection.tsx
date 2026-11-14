import { useCallback, useEffect, useState } from "react";
import { initialAnswers, startRequest } from "~/onboarding/answers";
import { OrchestratorError, orchestratorOnboarding, type OnboardingSource } from "~/onboarding/api";
import { OnboardingForm } from "~/onboarding/OnboardingForm";
import { StartedRun } from "~/onboarding/StartedRun";
import { DEFAULT_PROFILE } from "~/onboarding/criteria";
import type { Answers, OnboardingSetup, Profile, StartedRun as Started } from "~/onboarding/types";

type Loaded = { state: "loading" } | { state: "failed"; reason: string } | { state: "ready"; setup: OnboardingSetup; profile: Profile };

type OnboardingSectionProps = {
  source?: OnboardingSource;
  onFollowRun: (id: string) => void;
};

function reasonOf(error: unknown): string {
  return error instanceof OrchestratorError ? error.message : "Something went wrong. Try again.";
}

export function OnboardingSection({ source = orchestratorOnboarding, onFollowRun }: OnboardingSectionProps) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setLoaded({ state: "loading" });
    Promise.all([source.load(), source.loadProfile().catch(() => DEFAULT_PROFILE)]).then(
      ([setup, profile]) => {
        if (!current) return;
        setLoaded({ state: "ready", setup, profile });
        setAnswers(initialAnswers(setup, profile));
      },
      (failure: unknown) => {
        if (current) setLoaded({ state: "failed", reason: reasonOf(failure) });
      },
    );
    return () => {
      current = false;
    };
  }, [source, attempt]);

  const start = useCallback(() => {
    if (!answers) return;
    setStarting(true);
    setError(null);
    source
      .start(startRequest(answers))
      .then(setStarted, (failure: unknown) => setError(reasonOf(failure)))
      .finally(() => setStarting(false));
  }, [answers, source]);

  if (loaded.state === "loading") {
    return (
      <p role="status" className="text-label text-fg-muted">
        Loading the platform
      </p>
    );
  }
  if (loaded.state === "failed") {
    return (
      <div className="flex max-w-3xl flex-col items-start gap-3">
        <p role="alert" className="text-label text-status-failed">
          {loaded.reason}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="rounded-control border border-border-strong px-4 py-2 text-label font-medium text-fg"
        >
          Retry
        </button>
      </div>
    );
  }
  if (started) {
    return (
      <StartedRun
        run={started}
        onFollow={() => onFollowRun(started.id)}
        onAnother={() => {
          setStarted(null);
          setAnswers(initialAnswers(loaded.setup, loaded.profile));
        }}
      />
    );
  }
  return answers ? (
    <OnboardingForm
      setup={loaded.setup}
      answers={answers}
      onAnswers={setAnswers}
      onStart={start}
      starting={starting}
      error={error}
    />
  ) : null;
}
