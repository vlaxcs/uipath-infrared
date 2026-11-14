import { useMemo, useState } from "react";
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
import { StepGraph } from "~/runs/StepGraph";
import { StepResultPane } from "~/runs/StepResultPane";
import { NextStepPreview } from "~/runs/NextStepPreview";

type RunViewProps = {
  run: RunDetail;
  source: RunSource;
  onReload?: () => void;
  onStartAgain?: () => void;
};

export function RunView({ run: initialRun, source, onReload, onStartAgain }: RunViewProps) {
  const { run, error, mergeEvent } = useRunFeed(initialRun, source);
  const steps = deriveStepStates(run.events, run);
  const [following, setFollowing] = useState(true);
  const [selectedStep, setSelectedStep] = useState<RunStep | null>(null);
  const [revision, setRevision] = useState<number | null>(null);

  const pinStep = (step: RunStep) => {
    setFollowing(false);
    setSelectedStep(step);
    setRevision(null);
  };

  const toggleStep = (step: RunStep) => {
    if (selectedStep === step) {
      setSelectedStep(null);
      setRevision(null);
      setFollowing(true);
      return;
    }
    pinStep(step);
  };

  const toggleFollowing = () => {
    if (following) {
      setFollowing(false);
      return;
    }
    setFollowing(true);
    setSelectedStep(null);
    setRevision(null);
  };

  const revisions = selectedStep ? revisionsForStep(run, selectedStep) : [];
  const effectiveRevision = selectedStep ? revision ?? latestRevision(run, selectedStep) : null;
  const artifactPath = selectedStep ? primaryArtifactPath(run, selectedStep, effectiveRevision) : null;
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

  const preview = selectedStep ? nextPreview(run, selectedStep, steps) : null;

  const reviewGate = () => {
    if (run.awaiting === "layout") pinStep("present");
    else if (run.awaiting === "plan") pinStep("rehearse");
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
        onToggleFollowing={toggleFollowing}
        onStartAgain={source.mode === "live" ? onStartAgain : undefined}
      />
      <AwaitingBanner run={run} onReview={reviewGate} />
      <StepGraph run={run} states={steps} selectedStep={selectedStep} onSelectStep={toggleStep} />
      {selectedStep && preview ? (
        <div className="flex flex-col gap-4">
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
          <NextStepPreview
            preview={preview}
            onSelect={() => {
              if (preview.step) pinStep(preview.step);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-title font-semibold">Run overview</h2>
            <p className="text-caption text-fg-subtle">
              Select a step in the pipeline to inspect its result.
            </p>
          </div>
          <RunSummary run={run} />
        </div>
      )}
      <RunTimeline run={run} />
    </div>
  );
}
