import type { CandidateView } from "~/candidates/model";
import { StatusBadge } from "~/ui/StatusBadge";

type CandidateListProps = {
  candidates: readonly CandidateView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CandidateList({ candidates, selectedId, onSelect }: CandidateListProps) {
  return (
    <ul aria-label="Candidates" className="flex flex-col gap-2">
      {candidates.map((candidate) => {
        const selected = candidate.id === selectedId;
        return (
          <li key={candidate.id}>
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(candidate.id)}
              className={`flex w-full flex-col gap-2 rounded-card border p-4 text-left ${
                selected
                  ? "border-border-strong bg-surface-muted"
                  : "border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-label font-medium">{candidate.id}</span>
                <StatusBadge label={candidate.statusLabel} tone={candidate.statusTone} />
              </span>

              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
                <span>{candidate.rankLabel}</span>
                {candidate.sourceLabel ? <span>{candidate.sourceLabel}</span> : null}
                {candidate.pareto ? <span>Pareto frontier</span> : null}
              </span>

              <span className="grid grid-cols-2 gap-2">
                {candidate.headline.map((metric) => (
                  <span key={metric.label} className="flex flex-col">
                    <span className="text-caption uppercase tracking-wide text-fg-subtle">
                      {metric.label}
                    </span>
                    <span className="text-label">{metric.value}</span>
                  </span>
                ))}
              </span>

              {candidate.whyLost ? (
                <span className="text-caption text-fg-muted">
                  Lost on {candidate.whyLost.label.toLowerCase()} — {candidate.whyLost.detail}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
