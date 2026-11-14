import type { RehearsalArtifact } from "~/runs/artifactTypes";
import { formatPercent } from "~/runs/format";
import { Field, Section, Table } from "~/runs/results/ResultParts";

export function RehearseResult({ value }: { value: RehearsalArtifact }) {
  const verdict = value.verdict;
  const failure = value.failure;
  const phases = Object.entries(value.phases ?? {});
  const components = value.component_results ?? [];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Verdict">
          {verdict?.passed === undefined ? "Not reported" : verdict.passed ? "Passed" : "Failed"}
        </Field>
        <Field label="Measured availability">{formatPercent(verdict?.measured_availability_pct)}</Field>
        <Field label="Minimum availability">{formatPercent(verdict?.forecast_min_availability_pct)}</Field>
        <Field label="Candidate">{value.candidate_id ?? "Not reported"}</Field>
        <Field label="Failure injected">
          {failure
            ? `${failure.type ?? "failure"} on ${failure.target_component ?? "a component"}${
                failure.duration_s !== undefined ? ` for ${failure.duration_s}s` : ""
              }`
            : "None reported"}
        </Field>
        <Field label="Gap">{formatPercent(verdict?.gap_pct)}</Field>
      </dl>
      {verdict?.reason ?? value.x_decision?.reason ? (
        <p className="text-label">{verdict?.reason ?? value.x_decision?.reason}</p>
      ) : null}
      {failure?.detail ? <p className="text-caption text-fg-muted">{failure.detail}</p> : null}
      {phases.length > 0 ? (
        <Section title="Phases">
          <Table
            headers={["Phase", "Availability", "p95 latency", "Requests"]}
            rows={phases.map(([name, phase]) => [
              name,
              formatPercent(metricValue(phase.availability_pct)),
              metricValue(phase.latency_p95_ms) ?? "—",
              phase.requests_total ?? "—",
            ])}
          />
        </Section>
      ) : null}
      {components.length > 0 ? (
        <Section title="Components">
          <Table
            headers={["Component", "Kind", "Status", "Note"]}
            rows={components.map((component) => [
              component.component_id ?? "—",
              component.kind ?? "—",
              component.status ?? "—",
              component.note ?? "—",
            ])}
          />
        </Section>
      ) : null}
    </div>
  );
}

function metricValue(metric?: number | { value?: number }): number | undefined {
  if (typeof metric === "number") return metric;
  return typeof metric?.value === "number" ? metric.value : undefined;
}
