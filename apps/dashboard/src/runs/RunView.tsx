import { useMemo, useState } from "react";
import { CandidateDetail } from "~/candidates/CandidateDetail";
import { CandidateList } from "~/candidates/CandidateList";
import { buildCandidatesModel } from "~/candidates/model";
import type { ResultDocument } from "~/candidates/types";
import { animationForRun } from "~/mascot/animations";
import { Mascot } from "~/mascot/Mascot";
import type { RunSource } from "~/runs/source";
import { deriveStepStates } from "~/runs/stepProgress";
import type { Gate, HumanDecision, RunDetail, RunStep } from "~/runs/types";
import { PlanView } from "~/plan/PlanView";
import { useParallelTasks } from "~/runs/useParallelTasks";
import { STEP_META } from "~/runs/stepMeta";
import { latestPickedLayout } from "~/sandbox/pickedLayout";
import { SandboxPanel } from "~/sandbox/SandboxPanel";
import {
  latestOutputPath,
  latestRevision,
  primaryArtifactPath,
  revisionsForStep,
  stepEvents,
} from "~/runs/artifactRefs";
import { analysisOptions } from "~/runs/findings";
import { layoutOptions, layoutOptionsFromResult } from "~/runs/xCandidates";
import { parseArtifact } from "~/runs/artifactParse";
import { useRunArtifact } from "~/runs/useRunArtifact";
import { useRunFeed } from "~/runs/useRunFeed";
import { useSubmitDecision } from "~/runs/useSubmitDecision";
import { StepGraph } from "~/runs/StepGraph";
import { StepLog } from "~/runs/StepLog";
import { useStepLog } from "~/runs/useStepLog";
import { StepResultPane } from "~/runs/StepResultPane";
import { StepDialog, type DialogPage } from "~/runs/StepDialog";
import { ReviewPlan } from "~/runs/ReviewPlan";
import { ArtifactFrame } from "~/runs/results/ArtifactFrame";
import { StartResult, type ForecastArtifact } from "~/runs/results/StartResult";
import { StepEvents } from "~/runs/StepEvents";
import { useSlackStatus } from "~/runs/useSlackStatus";

const GATE_ACTION: Record<Gate, string> = {
  layout: "Pick a layout",
  plan: "Review the plan",
};

type RunViewProps = {
  run: RunDetail;
  source: RunSource;
  initialStep?: RunStep | null;
  onReload?: () => void;
  onStartAgain?: () => void;
  activeRunId?: string | null;
  onOpenRun?: (id: string) => void;
};

export function RunView({
  run: initialRun,
  source,
  initialStep = null,
  onReload,
  onStartAgain,
  activeRunId = null,
  onOpenRun,
}: RunViewProps) {
  const { run, error, mergeEvent } = useRunFeed(initialRun, source);
  const steps = deriveStepStates(run.events, run);
  const [page, setPage] = useState<DialogPage | null>(initialStep);
  const selectedStep = page && page !== "start" ? page : null;
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null,
  );
  const [revision, setRevision] = useState<number | null>(null);

  const pinStep = (next: DialogPage) => {
    setPage(next);
    setRevision(null);
  };

  const closeStep = () => {
    setPage(null);
    setRevision(null);
  };

  const pickCandidate = (id: string) => {
    setSelectedCandidate(id);
    pinStep("evaluate");
  };

  const revisions = selectedStep ? revisionsForStep(run, selectedStep) : [];
  const effectiveRevision = selectedStep
    ? (revision ?? latestRevision(run, selectedStep))
    : null;
  const artifactPath = selectedStep
    ? primaryArtifactPath(run, selectedStep, effectiveRevision)
    : null;
  const artifact = useRunArtifact(source, run.id, page === "start" ? "forecast.json" : artifactPath);

  const evaluatedRevision = latestRevision(run, "evaluate");
  const resultPath =
    evaluatedRevision === null
      ? null
      : primaryArtifactPath(run, "evaluate", evaluatedRevision);
  const resultArtifact = useRunArtifact(source, run.id, resultPath);
  const result = useMemo(() => {
    if (resultArtifact.status !== "ready" || resultArtifact.text === undefined)
      return null;
    const parsed = parseArtifact(resultArtifact.text);
    return parsed.ok ? (parsed.value as ResultDocument) : null;
  }, [resultArtifact.status, resultArtifact.text]);
  const candidates = useMemo(
    () =>
      result && Array.isArray(result.candidates)
        ? buildCandidatesModel(result)
        : null,
    [result],
  );

  const eventOptions = useMemo(() => layoutOptions(run.events), [run.events]);
  const options =
    eventOptions.length > 0
      ? eventOptions
      : result
        ? layoutOptionsFromResult(result)
        : [];

  const findingsPath = run.awaiting === "layout" ? "findings.json" : null;
  const findingsArtifact = useRunArtifact(source, run.id, findingsPath);
  const findingsParsed = useMemo(() => {
    if (
      findingsArtifact.status !== "ready" ||
      findingsArtifact.text === undefined
    )
      return null;
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

  const loggedStep = selectedStep === "present" ? null : selectedStep;
  const log = useStepLog(source, run.id, loggedStep);
  const winner = typeof result?.winner === "string" ? result.winner : null;
  const candidate =
    candidates?.candidates.find((item) => item.id === (selectedCandidate ?? winner)) ??
    candidates?.candidates[0] ??
    null;
  const pickedLayout = useMemo(() => latestPickedLayout(run), [run]);
  const parallel = useParallelTasks(
    source,
    run,
    typeof result?.winner === "string" ? result.winner : null,
  );

  /* The layout is picked where the candidates are: on Evaluate. */
  const gateStep: RunStep | null =
    run.awaiting === "layout" ? "evaluate" : run.awaiting === "plan" ? "rehearse" : null;
  const slack = useSlackStatus(source);
  const headline =
    run.status === "running"
      ? `Working on ${STEP_META[run.step].title}`
      : run.status === "awaiting_approval"
        ? "Waiting for your decision"
        : run.status === "completed"
          ? "Completed"
          : "Stopped";

  return (
    <div className="grid gap-6 lg:h-[calc(100vh-11rem)] lg:grid-cols-[minmax(16rem,1fr)_minmax(0,46rem)]">
      <aside aria-label="Agent" className="flex min-h-0 min-w-0 flex-col">
        <StepGraph
          run={run}
          states={steps}
          selectedStep={selectedStep}
          onSelectStep={pinStep}
          parallel={parallel.tasks}
          trials={parallel.trials}
          onSelectPlan={pickCandidate}
          onSelectStart={() => pinStep("start")}
          onSelectGate={(gate) => pinStep(gate === "layout" ? "evaluate" : "rehearse")}
          startSelected={page === "start"}
        />
      </aside>

      <section aria-label="Details" className="order-first flex min-w-0 flex-col items-center justify-center">
        <div
          aria-label="Run status"
          role="group"
          className="flex flex-col items-center gap-3 p-6 text-center"
        >
          {slack ? (
            <p role="status" aria-label="Slack" className="flex items-center gap-2 text-caption text-fg-muted">
              <span className={`h-2 w-2 rounded-full ${slack.connected ? "bg-status-completed" : "bg-status-neutral"}`} />
              {slack.connected ? `Slack connected${slack.channel ? ` · #${slack.channel}` : ""}` : "Slack not connected"}
            </p>
          ) : null}
          <Mascot
            animation={animationForRun(run.step, run.status)}
            className="h-40 w-40"
          />
          <p className="text-title font-semibold">{headline}</p>
          {gateStep && run.awaiting ? (
            <button
              type="button"
              onClick={() => pinStep(gateStep)}
              className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent"
            >
              {GATE_ACTION[run.awaiting]}
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="text-label text-status-failed">
              Live updates failed: {error}
            </p>
          ) : null}
          {source.mode === "live" && (run.status === "completed" || run.status === "failed") ? (
            activeRunId && onOpenRun ? (
              <button
                type="button"
                onClick={() => onOpenRun(activeRunId)}
                className="rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
              >
                Open the active run
              </button>
            ) : onStartAgain ? (
              <button
                type="button"
                onClick={onStartAgain}
                className="rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
              >
                Run again
              </button>
            ) : null
          ) : null}
        </div>
      </section>

      {page === "start" ? (
        <StepDialog
          step="start"
          startTitle={`Analyze: ${run.project}`}
          onSelect={pinStep}
          onClose={closeStep}
          log={<StepEvents events={startEvents(run)} />}
          happened={
            <ArtifactFrame path="forecast.json" artifact={artifact}>
              {(value) => <StartResult value={value as ForecastArtifact} />}
            </ArtifactFrame>
          }
        />
      ) : selectedStep ? (
        <StepDialog
          step={selectedStep}
          startTitle={`Analyze: ${run.project}`}
          onSelect={pinStep}
          onClose={closeStep}
          log={
            <>
              {loggedStep ? <StepLog step={loggedStep} log={log} /> : null}
              <StepEvents
                events={stepEvents(run, selectedStep, effectiveRevision)}
              />
              {!loggedStep &&
              stepEvents(run, selectedStep, effectiveRevision).length === 0 ? (
                <p className="text-caption text-fg-muted">
                  Nothing logged yet.
                </p>
              ) : null}
            </>
          }
          happened={
            <>
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
                renderPlan={
                  evaluatedRevision !== null
                    ? (planned: string) => <ReviewPlan source={source} runId={run.id} revision={evaluatedRevision} candidate={planned} />
                    : undefined
                }
                gate={
                  run.awaiting === "layout"
                    ? selectedStep === "evaluate" || selectedStep === "present"
                      ? "layout"
                      : null
                    : run.awaiting === "plan" && selectedStep === "rehearse"
                      ? "plan"
                      : null
                }
              >
                {selectedStep === "evaluate" && candidates && candidates.candidates.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    <CandidateList
                      candidates={candidates.candidates}
                      selectedId={candidate?.id ?? null}
                      onSelect={setSelectedCandidate}
                    />
                    {candidate ? <CandidateDetail candidate={candidate} /> : null}
                    {candidate && evaluatedRevision !== null && run.awaiting !== "layout" ? (
                      <PlanView
                        source={source}
                        runId={run.id}
                        revision={evaluatedRevision}
                        candidate={candidate.id}
                        rehearsalPath={latestOutputPath(run, "rehearsal")}
                      />
                    ) : null}
                  </div>
                ) : null}
              </StepResultPane>
              {selectedStep === "rehearse" && pickedLayout ? (
                <SandboxPanel source={source} runId={run.id} layout={pickedLayout} />
              ) : null}
              {evaluatedRevision !== null &&
              stepPlan(selectedStep, result?.winner, pickedLayout) ? (
                <PlanView
                  source={source}
                  runId={run.id}
                  revision={evaluatedRevision}
                  candidate={stepPlan(
                    selectedStep,
                    result?.winner,
                    pickedLayout,
                  )!}
                  rehearsalPath={
                    selectedStep === "rehearse"
                      ? latestOutputPath(run, "rehearsal")
                      : null
                  }
                />
              ) : null}
            </>
          }
        />
      ) : null}
    </div>
  );
}

function stepPlan(
  step: RunStep,
  winner: unknown,
  picked: string | null,
): string | null {
  if (step === "rehearse")
    return picked ?? (typeof winner === "string" ? winner : null);
  return null;
}

function startEvents(run: RunDetail) {
  const first = [...run.events].sort((a, b) => a.seq - b.seq)[0];
  return first ? [first] : [];
}
