import { useEffect, useState, type FormEvent } from "react";
import { approvePlanDecision, keepAnalysesDecision, pickLayoutDecision } from "~/runs/decisions";
import type { AnalysisOption } from "~/runs/findings";
import { formatEUR, formatPercent, formatRisk } from "~/runs/format";
import type { Gate, HumanDecision, LayoutOption, RunEvent } from "~/runs/types";
import type { ArtifactState } from "~/runs/useRunArtifact";
import { feasibleLayouts } from "~/runs/xCandidates";

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
  const feasible = feasibleLayouts(options);
  const [layout, setLayout] = useState(() => feasible[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [kept, setKept] = useState<string[]>(() => analyses.map((analysis) => analysis.id));
  const [keepReason, setKeepReason] = useState("");
  const [keepNotice, setKeepNotice] = useState<string | null>(null);
  const analysisSignature = analyses.map((analysis) => analysis.id).join("\n");

  useEffect(() => {
    setLayout((current) => current || feasible[0]?.id || "");
  }, [feasible]);

  useEffect(() => {
    setKept(analyses.map((analysis) => analysis.id));
  }, [analysisSignature]);

  const submitDecision = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    const decision =
      gate === "layout" ? pickLayoutDecision(layout, reason.trim()) : approvePlanDecision(reason.trim());
    const appended = await onSubmit(decision);
    if (appended) setReason("");
  };

  const submitKeep = async (event: FormEvent) => {
    event.preventDefault();
    if (kept.length === 0 || !keepReason.trim()) return;
    const appended = await onSubmit(keepAnalysesDecision(kept, keepReason.trim()));
    if (appended) {
      setKeepReason("");
      setKeepNotice(`Kept ${kept.length} ${kept.length === 1 ? "analysis" : "analyses"}.`);
    }
  };

  const toggleAnalysis = (id: string) => {
    setKept((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const suggestion =
    gate === "layout" ? "best payback that stays in the EU" : "the rehearsal held; go ahead";

  return (
    <div className="flex flex-col gap-4 rounded-card border border-status-awaiting bg-surface-muted p-4">
      <h3 className="text-label font-semibold">
        {gate === "layout" ? "Layout approval" : "Plan approval"}
      </h3>

      {gate === "layout" ? (
        <form onSubmit={submitKeep} className="flex flex-col gap-2 rounded-control border border-border bg-surface p-3">
          <h4 className="text-label font-semibold">Keep analyses</h4>
          <p className="text-caption text-fg-subtle">
            Keeping records the analyses for the next plans; it does not start the rehearsal. Pick a
            layout to continue.
          </p>

          {analysesStatus === "idle" || analysesStatus === "loading" ? (
            <p role="status" className="text-caption text-fg-muted">
              Loading analyses…
            </p>
          ) : analysesStatus === "error" ? (
            <div role="alert" className="flex flex-col gap-2 text-status-failed">
              <p className="text-caption">{analysesError ?? "Analyses could not be loaded."}</p>
              {onRetryAnalyses ? (
                <button
                  type="button"
                  onClick={onRetryAnalyses}
                  className="self-start rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
                >
                  Retry analyses
                </button>
              ) : null}
            </div>
          ) : analysesStatus === "unavailable" ? (
            <div className="flex flex-col gap-2">
              <p className="text-caption text-fg-muted">Findings are unavailable; you can still pick a layout.</p>
              {onRetryAnalyses ? (
                <button
                  type="button"
                  onClick={onRetryAnalyses}
                  className="self-start rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
                >
                  Retry analyses
                </button>
              ) : null}
            </div>
          ) : analyses.length === 0 ? (
            <p className="text-caption text-fg-muted">No analyses to keep; pick a layout.</p>
          ) : (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-caption uppercase tracking-wide text-fg-subtle">
                  Analyses to keep
                </legend>
                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {analyses.map((analysis) => (
                    <label key={analysis.id} className="flex items-start gap-2 text-label">
                      <input
                        type="checkbox"
                        checked={kept.includes(analysis.id)}
                        onChange={() => toggleAnalysis(analysis.id)}
                      />
                      <span>
                        <span className="font-medium">{analysis.title}</span>
                        <span className="block text-caption text-fg-subtle">
                          <span className="font-mono">{analysis.id}</span>
                          {analysis.category ? ` · ${analysis.category}` : ""}
                          {analysis.risk ? ` · risk ${analysis.risk}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex flex-col gap-1 text-label font-medium">
                Reason for keeping
                <textarea
                  value={keepReason}
                  onChange={(event) => setKeepReason(event.target.value)}
                  rows={2}
                  className="rounded-control border border-border bg-surface px-3 py-2 text-label font-normal text-fg"
                />
              </label>

              {keepNotice ? (
                <p role="status" className="text-caption text-status-completed">
                  {keepNotice}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy || kept.length === 0 || !keepReason.trim()}
                aria-busy={busy}
                className="self-start rounded-control border border-accent bg-accent px-3 py-2 text-label font-medium text-on-accent disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Keep selected analyses"}
              </button>
            </>
          )}
        </form>
      ) : null}

      <form onSubmit={submitDecision} className="flex flex-col gap-3">
        <h4 className="text-label font-semibold">
          {gate === "layout" ? "Pick the layout to rehearse" : "Approve the plan"}
        </h4>

        {gate === "layout" ? (
          feasible.length === 0 ? (
            <p className="text-label text-status-failed">
              No feasible layout is available. Decide this gate from Slack.
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-caption uppercase tracking-wide text-fg-subtle">Feasible layouts</legend>
              {feasible.map((option) => (
                <label key={option.id} className="flex items-start gap-2 text-label">
                  <input
                    type="radio"
                    name="layout"
                    value={option.id}
                    checked={layout === option.id}
                    onChange={() => setLayout(option.id)}
                  />
                  <span>
                    <span className="font-mono">{option.id}</span>
                    <span className="text-caption text-fg-muted">
                      {" "}
                      rank {option.rank ?? "—"} · {formatEUR(option.monthly_eur)}/mo ·{" "}
                      {formatPercent(option.availability_pct)} · risk {formatRisk(option.risk)}
                    </span>
                  </span>
                </label>
              ))}
              {options.some((option) => !option.feasible) ? (
                <p className="text-caption text-fg-subtle">
                  Infeasible: {options.filter((option) => !option.feasible).map((option) => option.id).join(", ")}
                </p>
              ) : null}
            </fieldset>
          )
        ) : null}

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
          onClick={() => setReason(suggestion)}
          className="self-start rounded-control border border-border px-3 py-2 text-caption hover:bg-surface-muted"
        >
          Use suggested reason
        </button>

        <button
          type="submit"
          disabled={busy || !reason.trim() || (gate === "layout" && !layout)}
          aria-busy={busy}
          className="self-start rounded-control border border-accent bg-accent px-3 py-2 text-label font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? "Submitting…" : gate === "layout" ? "Pick layout" : "Approve plan"}
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
