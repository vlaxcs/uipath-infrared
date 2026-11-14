import type { ResultArtifact } from "~/runs/artifactTypes";
import { formatEUR, formatPercent, formatRisk } from "~/runs/format";
import { Field, Section, Table } from "~/runs/results/ResultParts";

export function EvaluateResult({ value }: { value: ResultArtifact }) {
  const candidates = value.candidates ?? [];
  const baseline = value.baseline;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Winner">{value.winner ?? "None"}</Field>
        <Field label="Baseline cost">{formatEUR(baseline?.monthly_eur)}</Field>
        <Field label="Baseline availability">{formatPercent(baseline?.availability_pct)}</Field>
      </dl>
      <Section title="Candidates">
        <Table
          headers={["Candidate", "Feasible", "Rank", "Monthly", "Availability", "Risk", "Why it lost"]}
          rows={candidates.map((candidate) => [
            candidate.id ?? "—",
            candidate.feasible ? "Yes" : "No",
            candidate.rank ?? "—",
            formatEUR(candidate.cost?.run_eur_month_now),
            formatPercent(candidate.availability_pct),
            formatRisk(candidate.risk),
            candidate.lost_because?.reason ?? candidate.violations?.map((v) => v.constraint).join(", ") ?? "—",
          ])}
        />
      </Section>
    </div>
  );
}
