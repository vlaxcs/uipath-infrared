import type { RunSource } from "~/runs/source";
import { deriveStepStates } from "~/runs/stepProgress";
import type { RunDetail } from "~/runs/types";
import { AwaitingBanner } from "~/runs/AwaitingBanner";
import { RunSummary } from "~/runs/RunSummary";
import { RunTimeline } from "~/runs/RunTimeline";
import { StepRail } from "~/runs/StepRail";
import { useRunFeed } from "~/runs/useRunFeed";

type RunViewProps = {
  run: RunDetail;
  source: RunSource;
};

export function RunView({ run: initialRun, source }: RunViewProps) {
  const { run, error } = useRunFeed(initialRun, source);
  const steps = deriveStepStates(run.events, run);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-control border border-status-failed bg-surface-muted px-3 py-2 text-label text-status-failed"
        >
          Live updates failed: {error}
        </p>
      ) : null}
      <RunSummary run={run} />
      <AwaitingBanner run={run} />
      <StepRail run={run} states={steps} />
      <RunTimeline run={run} />
    </div>
  );
}
