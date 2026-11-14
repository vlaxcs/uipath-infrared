import type { ArtifactFeed, ArtifactState } from "~/runs/useRunArtifact";
import type {
  CandidatesArtifact,
  FindingsArtifact,
  InfraArtifact,
  RehearsalArtifact,
  ResultArtifact,
} from "~/runs/artifactTypes";
import { revisionLabel } from "~/runs/artifactRefs";
import type { AnalysisOption } from "~/runs/findings";
import type { ReactNode } from "react";
import type { Gate, HumanDecision, LayoutOption, RunDetail, RunEvent, RunStep, StepState } from "~/runs/types";
import { stepStateMeta } from "~/runs/status";
import { STEP_META } from "~/runs/stepMeta";
import { GateApproval } from "~/runs/GateApproval";
import { StatusBadge } from "~/ui/StatusBadge";
import { ArtifactFrame } from "~/runs/results/ArtifactFrame";
import { Empty } from "~/runs/results/ResultParts";
import { PresentResult } from "~/runs/results/PresentResult";
import { ExtractResult } from "~/runs/results/ExtractResult";
import { InvestigateResult } from "~/runs/results/InvestigateResult";
import { ProposeResult } from "~/runs/results/ProposeResult";
import { EvaluateResult } from "~/runs/results/EvaluateResult";
import { RehearseResult } from "~/runs/results/RehearseResult";

type StepResultPaneProps = {
  run: RunDetail;
  step: RunStep;
  state: StepState;
  revision: number | null;
  revisions: number[];
  onSelectRevision: (revision: number | null) => void;
  artifactPath: string | null;
  artifact: ArtifactFeed;
  options: readonly LayoutOption[];
  analyses: readonly AnalysisOption[];
  analysesStatus: ArtifactState["status"];
  analysesError?: string;
  onRetryAnalyses?: () => void;
  onSubmitDecision: (decision: HumanDecision) => Promise<RunEvent | null>;
  decisionBusy: boolean;
  decisionError: string | null;
  onRefresh?: () => void;
  gate?: Gate | null;
  renderPlan?: (candidate: string) => ReactNode;
  children?: ReactNode;
};

export function StepResultPane({
  run,
  step,
  state,
  revision,
  revisions,
  onSelectRevision,
  artifactPath,
  artifact,
  options,
  analyses,
  analysesStatus,
  analysesError,
  onRetryAnalyses,
  onSubmitDecision,
  decisionBusy,
  decisionError,
  onRefresh,
  gate = run.awaiting && STEP_META[step].gate === run.awaiting ? run.awaiting : null,
  renderPlan,
  children,
}: StepResultPaneProps) {
  const meta = STEP_META[step];
  const stateMeta = stepStateMeta[state];
  const selectedRevision = revision ?? (revisions.length > 0 ? revisions[revisions.length - 1] : null);

  return (
    <section aria-label="What happened" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-label text-fg-muted">{meta.hint}</p>
        <StatusBadge label={stateMeta.label} tone={stateMeta.tone} />
      </div>

      {revisions.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {revisions.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={selectedRevision === item}
              onClick={() => onSelectRevision(item)}
              className={
                selectedRevision === item
                  ? "rounded-control border border-accent px-3 py-2 text-caption text-fg"
                  : "rounded-control border border-border px-3 py-2 text-caption text-fg-muted hover:bg-surface-muted"
              }
            >
              {revisionLabel(item)}
            </button>
          ))}
        </div>
      ) : null}

      {state === "pending" ? (
        <Empty>Not started yet{artifactPath ? `; it writes ${artifactPath}` : ""}.</Empty>
      ) : state === "current" ? (
        <p className="text-body text-fg-muted">
          In progress{artifactPath ? `; the result appears when ${artifactPath} is written` : ""}.
        </p>
      ) : step === "present" ? (
        <PresentResult options={options} />
      ) : artifactPath ? (
        <ArtifactFrame path={artifactPath} artifact={artifact}>
          {(value) => renderResult(step, value)}
        </ArtifactFrame>
      ) : (
        <Empty>No result file for this step yet.</Empty>
      )}

      {children}

      {gate ? (
        <GateApproval
          gate={gate}
          options={options}
          analyses={analyses}
          analysesStatus={analysesStatus}
          analysesError={analysesError}
          onRetryAnalyses={onRetryAnalyses}
          onSubmit={onSubmitDecision}
          busy={decisionBusy}
          error={decisionError}
          onRefresh={onRefresh}
          renderPlan={renderPlan}
        />
      ) : null}
    </section>
  );
}

function renderResult(step: RunStep, value: unknown) {
  switch (step) {
    case "extract":
      return <ExtractResult value={value as InfraArtifact} />;
    case "investigate":
      return <InvestigateResult value={value as FindingsArtifact} />;
    case "propose":
      return <ProposeResult value={value as CandidatesArtifact} />;
    case "evaluate":
      return <EvaluateResult value={value as ResultArtifact} />;
    case "rehearse":
      return <RehearseResult value={value as RehearsalArtifact} />;
    case "present":
      return null;
  }
}
