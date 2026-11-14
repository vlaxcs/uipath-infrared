import { useState, type FormEvent } from "react";
import { approvePlanDecision } from "~/runs/decisions";
import type { AnalysisOption } from "~/runs/findings";
import { LayoutChat } from "~/runs/LayoutChat";
import type { Gate, HumanDecision, LayoutOption, RunEvent } from "~/runs/types";
import type { ArtifactState } from "~/runs/useRunArtifact";

type AnalysesStatus = ArtifactState["status"];

type GateApprovalProps = {
  gate: Gate;
  options: readonly LayoutOption[];
  analyses?: readonly AnalysisOption[];
  analysesStatus?: AnalysesStatus;
  analysesError?: string;
  onRetryAnalyses?: () => void;
  onSubmit: (decision: HumanDecision) => Promise<RunEvent | null>;
  busy: boolean;
  error: string | null;
  onRefresh?: () => void;
};

export function GateApproval({
  gate,
  options,
  analyses = [],
  analysesStatus = "ready",
  analysesError,
  onRetryAnalyses,
  onSubmit,
  busy,
  error,
  onRefresh,
}: GateApprovalProps) {
  if (gate === "layout") {
    return (
      <LayoutChat
        options={options}
        analyses={analyses}
        analysesStatus={analysesStatus}
        analysesError={analysesError}
        onRetryAnalyses={onRetryAnalyses}
        onSubmit={onSubmit}
        busy={busy}
        error={error}
        onRefresh={onRefresh}
      />
    );
  }
  return <PlanApproval onSubmit={onSubmit} busy={busy} error={error} onRefresh={onRefresh} />;
}

type PlanApprovalProps = Pick<GateApprovalProps, "onSubmit" | "busy" | "error" | "onRefresh">;

function PlanApproval({ onSubmit, busy, error, onRefresh }: PlanApprovalProps) {
  const [reason, setReason] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    const appended = await onSubmit(approvePlanDecision(reason.trim()));
    if (appended) setReason("");
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-status-awaiting bg-surface-muted p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h3 className="text-label font-semibold">Approve the plan</h3>
        <label className="flex flex-col gap-1 text-label font-medium">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className="rounded-control border border-border bg-surface px-3 py-2 text-label font-normal text-fg"
          />
        </label>
        <button
          type="button"
          onClick={() => setReason("the rehearsal held; go ahead")}
          className="self-start rounded-control border border-border px-3 py-2 text-caption hover:bg-surface-muted"
        >
          Use suggested reason
        </button>
        <button
          type="submit"
          disabled={busy || !reason.trim()}
          aria-busy={busy}
          className="self-start rounded-control border border-accent bg-accent px-3 py-2 text-label font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Approve plan"}
        </button>
      </form>

      {error ? (
        <div role="alert" className="flex flex-col gap-2 text-status-failed">
          <p className="text-label">{error}</p>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="self-start rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
            >
              Refresh run
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
