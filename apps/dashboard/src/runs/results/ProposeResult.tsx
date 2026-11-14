import type { CandidatesArtifact } from "~/runs/artifactTypes";
import { Empty } from "~/runs/results/ResultParts";

export function ProposeResult({ value }: { value: CandidatesArtifact }) {
  const candidates = value.candidates ?? [];
  if (candidates.length === 0) return <Empty>No candidates recorded.</Empty>;

  return (
    <ul className="flex flex-col gap-3">
      {candidates.map((candidate, index) => (
        <li key={candidate.id ?? index} className="flex flex-col gap-2 rounded-card border border-border bg-surface-muted p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-label font-semibold">{candidate.id ?? "Candidate"}</h3>
            <span className="text-caption text-fg-subtle">
              {candidate.builds_on ? `builds on ${candidate.builds_on}` : candidate.revises ? `revises ${candidate.revises}` : ""}
            </span>
          </div>
          {candidate.rationale ? <p className="text-caption text-fg-muted">{candidate.rationale}</p> : null}
          <ul className="flex flex-col gap-1">
            {(candidate.actions ?? []).map((action, actionIndex) => (
              <li key={actionIndex} className="text-caption text-fg-muted">
                <span className="font-mono">{action.action ?? "action"}</span>{" "}
                {action.component ?? "component"}
                {action.signal ? ` · ${action.signal}` : ""}
                {action.to ? ` → ${action.to}` : ""}
                {action.reason ? ` — ${action.reason}` : ""}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
