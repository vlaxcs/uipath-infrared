import { useMemo, useState } from "react";
import { CandidateDetail } from "~/candidates/CandidateDetail";
import { CandidateList } from "~/candidates/CandidateList";
import { buildCandidatesModel } from "~/candidates/model";
import type { ResultDocument } from "~/candidates/types";
import { animationForRun } from "~/mascot/animations";
import { Mascot } from "~/mascot/Mascot";
import type { RunSource } from "~/runs/source";
import { deriveStepStates } from "~/runs/stepProgress";
import type { HumanDecision, RunDetail, RunStep } from "~/runs/types";
import { PlanView } from "~/plan/PlanView";
import { latestOutputPath, latestRevision, primaryArtifactPath, revisionsForStep } from "~/runs/artifactRefs";
import { analysisOptions } from "~/runs/findings";
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
import { StepLog } from "~/runs/StepLog";
import { useStepLog } from "~/runs/useStepLog";
import { StepResultPane } from "~/runs/StepResultPane";
import { NextStepPreview } from "~/runs/NextStepPreview";

type RunViewProps = {
  run: RunDetail;
  source: RunSource;
  initialStep?: RunStep | null;
  onReload?: () => void;
  onStartAgain?: () => void;
};

export function RunView({ run: initialRun, source, initialStep = null, onReload, onStartAgain }: RunViewProps) {
  const { run, error, mergeEvent } = useRunFeed(initialRun, source);
  const steps = deriveStepStates(run.events, run);
  const [following, setFollowing] = useState(initialStep === null);
  const [selectedStep, setSelectedStep] = useState<RunStep | null>(initialStep);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [revision, setRevision] = useState<number | null>(null);

  const pinStep = (step: RunStep) => {
    setFollowing(false);
    setSelectedStep(step);
    setSelectedCandidate(null);
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

  const pickCandidate = (id: string) => {
    setFollowing(false);
    setSelectedStep(null);
    setSelectedCandidate(id);
  };

  const toggleFollowing = () => {
    if (following) {
      setFollowing(false);
      return;
    }
    setFollowing(true);
    setSelectedStep(null);
    setSelectedCandidate(null);
    setRevision(null);
  };

  const revisions = selectedStep ? revisionsForStep(run, selectedStep) : [];
  const effectiveRevision = selectedStep ? revision ?? latestRevision(run, selectedStep) : null;
  const artifactPath = selectedStep ? primaryArtifactPath(run, selectedStep, effectiveRevision) : null;
  const artifact = useRunArtifact(source, run.id, artifactPath);

  const evaluatedRevision = latestRevision(run, "evaluate");
  const resultPath = evaluatedRevision === null ? null : primaryArtifactPath(run, "evaluate", evaluatedRevision);
  const resultArtifact = useRunArtifact(source, run.id, resultPath);
  const result = useMemo(() => {
    if (resultArtifact.status !== "ready" || resultArtifact.text === undefined) return null;
    const parsed = parseArtifact(resultArtifact.text);
    return parsed.ok ? (parsed.value as ResultDocument) : null;
  }, [resultArtifact.status, resultArtifact.text]);
  const candidates = useMemo(() => (result && Array.isArray(result.candidates) ? buildCandidatesModel(result) : null), [result]);

  const eventOptions = useMemo(() => layoutOptions(run.events), [run.events]);
  const options = eventOptions.length > 0 ? eventOptions : result ? layoutOptionsFromResult(result) : [];

  const findingsPath = run.awaiting === "layout" ? "findings.json" : null;
  const findingsArtifact = useRunArtifact(source, run.id, findingsPath);
  const findingsParsed = useMemo(() => {
    if (findingsArtifact.status !== "ready" || findingsArtifact.text === undefined) return null;
    return parseArtifact(findingsArtifact.text);
  }, [findingsArtifact.status, findingsArtifact.text]);
  const analyses = useMemo(
    () => (findingsParsed?.ok ? analysisOptions(findingsParsed.value) : []),
    [findingsParsed],
  );
  const analysesStatus =
    findingsParsed && !findingsParsed.ok ? "error" : findingsArtifact.status;
  const analysesError =
    findingsParsed && !findingsParsed.ok
      ? `The findings file is not valid JSON: ${findingsParsed.error}`
      : findingsArtifact.error;

  const decision = useSubmitDecision(source, run.id, onReload);
  const submitDecision = async (humanDecision: HumanDecision) => {
    const appended = await decision.submit(humanDecision);
    if (appended) mergeEvent(appended);
    return appended;
  };

  const preview = selectedStep ? nextPreview(run, selectedStep, steps) : null;
  const logStep = selectedStep ?? (run.status === "running" ? run.step : null);
  const loggedStep = logStep === "present" ? null : logStep;
  const log = useStepLog(source, run.id, loggedStep);
  const candidate = candidates?.candidates.find((item) => item.id === selectedCandidate) ?? null;

  const reviewGate = () => {
    if (run.awaiting === "layout") pinStep("present");
    else if (run.awaiting === "plan") pinStep("rehearse");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <aside aria-label="Agent" className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Mascot animation={animationForRun(run.step, run.status)} className="h-16 w-16" />
          <p className="text-label text-fg-muted">
            {run.status === "running" ? `Working on ${run.step}` : run.status === "awaiting_approval" ? "Waiting for a decision" : run.status === "completed" ? "Completed" : "Stopped"}
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded-control border border-status-failed bg-surface-muted px-3 py-2 text-label text-status-failed">
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
        {loggedStep ? <StepLog step={loggedStep} log={log} /> : null}
        {candidates && candidates.candidates.length > 0 ? (
          <section aria-labelledby="run-candidates-title" className="flex flex-col gap-3">
            <h2 id="run-candidates-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
              Candidates
            </h2>
            <CandidateList candidates={candidates.candidates} selectedId={selectedCandidate} onSelect={pickCandidate} />
          </section>
        ) : null}
        <RunTimeline run={run} />
      </aside>

      <section aria-label="Details" className="min-w-0">
        {candidate ? (
          <div className="flex flex-col gap-6">
            <CandidateDetail candidate={candidate} />
            {evaluatedRevision !== null ? (
              <PlanView
                source={source}
                runId={run.id}
                revision={evaluatedRevision}
                candidate={candidate.id}
                rehearsalPath={latestOutputPath(run, "rehearsal")}
              />
            ) : null}
          </div>
        ) : selectedStep && preview ? (
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
              analyses={analyses}
              analysesStatus={findingsPath ? analysesStatus : "idle"}
              analysesError={analysesError}
              onRetryAnalyses={findingsArtifact.retry}
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
              <p className="text-caption text-fg-subtle">Select a step or a candidate to inspect it.</p>
            </div>
            <RunSummary run={run} />
          </div>
        )}
      </section>
    </div>
  );
}
