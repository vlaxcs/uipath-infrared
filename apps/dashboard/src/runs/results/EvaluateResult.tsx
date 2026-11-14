import type { ResultArtifact } from "~/runs/artifactTypes";
import { formatEUR, formatPercent } from "~/runs/format";
import { Field } from "~/runs/results/ResultParts";

export function EvaluateResult({ value }: { value: ResultArtifact }) {
  const baseline = value.baseline;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Winner">{value.winner ?? "None"}</Field>
        <Field label="Baseline cost">{formatEUR(baseline?.monthly_eur)}</Field>
        <Field label="Baseline availability">{formatPercent(baseline?.availability_pct)}</Field>
      </dl>
    </div>
  );
}
