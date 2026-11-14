import type { FindingsArtifact } from "~/runs/artifactTypes";
import { evidenceText } from "~/runs/findings";
import { Empty } from "~/runs/results/ResultParts";

export function InvestigateResult({ value }: { value: FindingsArtifact }) {
  const findings = value.findings ?? [];
  if (findings.length === 0) return <Empty>No findings recorded.</Empty>;

  return (
    <ul className="flex flex-col gap-3">
      {findings.map((finding, index) => {
        const evidence = evidenceText(finding.evidence);
        return (
          <li key={finding.id ?? index} className="flex flex-col gap-2 rounded-card border border-border bg-surface-muted p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-label font-semibold">{finding.title ?? finding.id ?? "Finding"}</h3>
              <span className="font-mono text-caption text-fg-subtle">{finding.id ?? ""}</span>
            </div>
            <p className="flex flex-wrap gap-3 text-caption text-fg-muted">
              <span>{finding.category ?? "Uncategorised"}</span>
              <span>{finding.stack ?? "No stack"}</span>
              <span>confidence {finding.confidence ?? "unknown"}</span>
              <span>risk {finding.risk ?? "unknown"}</span>
            </p>
            {evidence ? <p className="text-caption text-fg-muted">{evidence}</p> : null}
            {finding.recommendation ? <p className="text-label">{finding.recommendation}</p> : null}
            {finding.resources?.length ? (
              <p className="text-caption text-fg-subtle">Resources: {finding.resources.join(", ")}</p>
            ) : null}
            {finding.migration_notes ? (
              <p className="text-caption text-fg-subtle">{finding.migration_notes}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
