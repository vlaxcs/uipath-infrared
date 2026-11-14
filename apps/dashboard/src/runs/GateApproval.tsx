import { useEffect, useState, type FormEvent } from "react";
import { approvePlanDecision, pickLayoutDecision } from "~/runs/decisions";
import { formatEUR, formatPercent, formatRisk } from "~/runs/format";
import type { Gate, HumanDecision, LayoutOption, RunEvent } from "~/runs/types";
import { feasibleLayouts } from "~/runs/xCandidates";

type GateApprovalProps = {
  gate: Gate;
  options: readonly LayoutOption[];
  onSubmit: (decision: HumanDecision) => Promise<RunEvent | null>;
  busy: boolean;
  error: string | null;
  onRefresh?: () => void;
};

export function GateApproval({ gate, options, onSubmit, busy, error, onRefresh }: GateApprovalProps) {
  const feasible = feasibleLayouts(options);
  const [layout, setLayout] = useState(() => feasible[0]?.id ?? "");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!layout && feasible[0]) setLayout(feasible[0].id);
  }, [layout, feasible]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    const decision =
      gate === "layout" ? pickLayoutDecision(layout, reason.trim()) : approvePlanDecision(reason.trim());
    const appended = await onSubmit(decision);
    if (appended) setReason("");
  };

  const suggestion =
    gate === "layout" ? "best payback that stays in the EU" : "the rehearsal held; go ahead";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-status-awaiting bg-surface-muted p-4">
      <h3 className="text-label font-semibold">
        {gate === "layout" ? "Pick the layout to rehearse" : "Approve the plan"}
      </h3>

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

      <button
        type="submit"
        disabled={busy || !reason.trim() || (gate === "layout" && !layout)}
        aria-busy={busy}
        className="self-start rounded-control border border-accent bg-accent px-3 py-2 text-label font-medium text-on-accent disabled:opacity-50"
      >
        {busy ? "Submitting…" : gate === "layout" ? "Pick layout" : "Approve plan"}
      </button>
    </form>
  );
}
