import { useCallback, useEffect, useState } from "react";
import { initialAnswers, onpremChanged, startRequest, withOnpremOnProfile } from "~/onboarding/answers";
import { OrchestratorError, orchestratorOnboarding, type OnboardingSource } from "~/onboarding/api";
import { OnboardingForm } from "~/onboarding/OnboardingForm";
import { holderOf } from "~/onboarding/projectHolder";
import type { RunSummary } from "~/runs/types";
import { useOnRefresh } from "~/ui/refreshSignal";
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
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsAttempt, setRunsAttempt] = useState(0);
  const [asking, setAsking] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  useOnRefresh(() => setRunsAttempt((count) => count + 1));

  useEffect(() => {
    let current = true;
    source.listRuns().then(
      (list) => {
        if (current) setRuns(list);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [source, runsAttempt]);

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

  const launch = useCallback(() => {
    if (!answers) return;
    setAsking(false);
    setStarting(true);
    setError(null);
    source
      .start(startRequest(answers))
      .then(setStarted, (failure: unknown) => {
        setError(reasonOf(failure));
        setRunsAttempt((count) => count + 1);
      })
      .finally(() => setStarting(false));
  }, [answers, source]);

  const start = useCallback(() => {
    if (!answers || loaded.state !== "ready") return;
    if (onpremChanged(loaded.profile, answers)) {
      setAsking(true);
      return;
    }
    launch();
  }, [answers, loaded, launch]);

  const saveAndStart = useCallback(() => {
    if (!answers || loaded.state !== "ready") return;
    setSavingProfile(true);
    setError(null);
    source
      .saveProfile(withOnpremOnProfile(loaded.profile, answers))
      .then(
        (profile) => {
          setLoaded({ ...loaded, profile });
          launch();
        },
        (failure: unknown) => {
          setAsking(false);
          setError(reasonOf(failure));
        },
      )
      .finally(() => setSavingProfile(false));
  }, [answers, loaded, launch, source]);

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
      holder={answers.project ? holderOf(runs, answers.project) : null}
      onOpenRun={onFollowRun}
      saveChoice={asking ? { saving: savingProfile, onSave: saveAndStart, onSkip: launch, onBack: () => setAsking(false) } : null}
    />
  ) : null;
}
