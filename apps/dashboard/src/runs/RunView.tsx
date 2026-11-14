import { useEffect, useMemo, useState } from "react";
import type { RunSource } from "~/runs/source";
import { deriveStepStates } from "~/runs/stepProgress";
import type { HumanDecision, RunDetail, RunStep } from "~/runs/types";
import { latestRevision, primaryArtifactPath, revisionsForStep } from "~/runs/artifactRefs";
import { layoutOptions, layoutOptionsFromResult } from "~/runs/xCandidates";
import { nextPreview } from "~/runs/nextPreview";
import { parseArtifact } from "~/runs/artifactParse";
import { useRunArtifact } from "~/runs/useRunArtifact";
import { useRunFeed } from "~/runs/useRunFeed";
import { useSubmitDecision } from "~/runs/useSubmitDecision";
import { AwaitingBanner } from "~/runs/AwaitingBanner";
import { RunControls } from "~/runs/RunControls";
import { RunSummary } from "~/runs/RunSummary";
import { RunTimeline } from "~/runs/RunTimeline";
import { StepRail } from "~/runs/StepRail";
import { StepResultPane } from "~/runs/StepResultPane";
import { NextStepPreview } from "~/runs/NextStepPreview";

type RunViewProps = {
  run: RunDetail;
  source: RunSource;
  onReload?: () => void;
  onStartAgain?: () => void;
  onRunUpdated?: () => void;
};

export function RunView({ run: initialRun, source, onReload, onStartAgain, onRunUpdated }: RunViewProps) {
  const { run, error, mergeEvent } = useRunFeed(initialRun, source);
  const steps = deriveStepStates(run.events, run);
  const [following, setFollowing] = useState(true);
  const [selectedStep, setSelectedStep] = useState<RunStep>(run.step);
  const [revision, setRevision] = useState<number | null>(null);

  useEffect(() => {
    onRunUpdated?.();
  }, [onRunUpdated, run.status, run.step, run.updated_at]);

  useEffect(() => {
    if (!following) return;
    setSelectedStep(run.step);
    setRevision(null);
  }, [following, run.step]);

  const selectStep = (step: RunStep) => {
    setFollowing(false);
    setSelectedStep(step);
    setRevision(null);
  };

  const preview = nextPreview(run, selectedStep, steps);
  const selectNext = () => {
    if (preview.step) selectStep(preview.step);
  };

  const revisions = revisionsForStep(run, selectedStep);
  const effectiveRevision = revision ?? latestRevision(run, selectedStep);
  const artifactPath = primaryArtifactPath(run, selectedStep, effectiveRevision);
  const artifact = useRunArtifact(source, run.id, artifactPath);

  const eventOptions = useMemo(() => layoutOptions(run.events), [run.events]);
  const fallbackPath =
    eventOptions.length === 0
      ? primaryArtifactPath(run, "evaluate", latestRevision(run, "evaluate"))
      : null;
  const fallbackArtifact = useRunArtifact(source, run.id, fallbackPath);
  const fallbackOptions = useMemo(() => {
    if (fallbackArtifact.status !== "ready" || fallbackArtifact.text === undefined) return [];
    const parsed = parseArtifact(fallbackArtifact.text);
    return parsed.ok ? layoutOptionsFromResult(parsed.value) : [];
  }, [fallbackArtifact.status, fallbackArtifact.text]);
  const options = eventOptions.length > 0 ? eventOptions : fallbackOptions;

  const decision = useSubmitDecision(source, run.id, onReload);
  const submitDecision = async (humanDecision: HumanDecision) => {
    const appended = await decision.submit(humanDecision);
    if (appended) mergeEvent(appended);
    return appended;
  };

  const reviewGate = () => {
    if (run.awaiting === "layout") selectStep("present");
    else if (run.awaiting === "plan") selectStep("rehearse");
  };

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
      <RunControls
        run={run}
        mode={source.mode}
        following={following}
        onToggleFollowing={() => setFollowing((current) => !current)}
        onStartAgain={source.mode === "live" ? onStartAgain : undefined}
      />
      <AwaitingBanner run={run} onReview={reviewGate} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-64 lg:shrink-0">
          <StepRail run={run} states={steps} selectedStep={selectedStep} onSelectStep={selectStep} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <StepResultPane
            run={run}
            step={selectedStep}
            state={steps[selectedStep]}
            revision={effectiveRevision}
            revisions={revisions}
            onSelectRevision={setRevision}
            artifactPath={artifactPath}
            artifact={artifact}
            options={options}
            onSubmitDecision={submitDecision}
            decisionBusy={decision.busy}
            decisionError={decision.error}
            onRefresh={onReload}
          />
          <NextStepPreview preview={preview} onSelect={selectNext} />
        </div>
      </div>
      <RunSummary run={run} />
      <RunTimeline run={run} />
    </div>
  );
}
