import { formatPercent, formatSignedPp } from "~/rehearsal/format";
import { decisionMeta, VERDICT_META } from "~/rehearsal/labels";
import type { RehearsalDocument } from "~/rehearsal/types";
import type { StatusTone } from "~/ui/StatusBadge";

export type DecisionView = {
  label: string;
  tone: StatusTone;
  reason: string | null;
  source: "recorded" | "derived";
  sourceLabel: string;
  conflict: boolean;
};

export type VerdictView = {
  label: string;
  tone: StatusTone;
  passed: boolean;
  headline: string;
  measured: string;
  threshold: string;
  gap: string;
  gapDerived: boolean;
  reason: string | null;
  decision: DecisionView;
};

export function buildVerdict(rehearsal: RehearsalDocument): VerdictView {
  const verdict = rehearsal.verdict;
  const passed = verdict.passed === true;
  const meta = VERDICT_META[passed ? "passed" : "failed"];
  const measured = verdict.measured_availability_pct;
  const threshold = verdict.forecast_min_availability_pct;
  const measuredValid = Number.isFinite(measured);
  const thresholdValid = Number.isFinite(threshold);
  const reportedGap = verdict.gap_pct;
  const gapDerived = !Number.isFinite(reportedGap) && measuredValid && thresholdValid;
  const gap = Number.isFinite(reportedGap)
    ? reportedGap
    : gapDerived
      ? measured - threshold
      : undefined;

  const recordedKind = rehearsal.x_decision?.kind?.trim() ?? "";
  const source: DecisionView["source"] = recordedKind ? "recorded" : "derived";
  const kind = recordedKind || (passed ? "proceed" : "revise");
  const decision = decisionMeta(kind);
  const reason =
    (rehearsal.x_decision?.reason ?? verdict.reason ?? "").trim() || null;
  const conflict = (kind === "proceed" && !passed) || (kind === "revise" && passed);

  return {
    label: meta.label,
    tone: meta.tone,
    passed,
    headline: passed
      ? "The measured availability meets the forecast minimum."
      : "The measured availability falls short of the forecast minimum.",
    measured: formatPercent(measured),
    threshold: formatPercent(threshold),
    gap: formatSignedPp(gap),
    gapDerived,
    reason,
    decision: {
      label: decision.label,
      tone: decision.tone,
      reason,
      source,
      sourceLabel:
        source === "recorded"
          ? "Recorded in x_decision; the orchestrator acts on it."
          : "Derived from the verdict; no decision was recorded.",
      conflict,
    },
  };
}
