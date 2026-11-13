import type { Run } from "~/runs/types";
import { formatTimestamp } from "~/runs/format";
import { runStatusMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

type RunsListProps = {
  runs: readonly Run[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
};

export function RunsList({ runs, selectedRunId, onSelectRun }: RunsListProps) {
  return (
    <ul aria-label="Runs" className="flex flex-col gap-2">
      {runs.map((run) => {
        const selected = run.id === selectedRunId;
        const status = runStatusMeta[run.status];
        return (
          <li key={run.id}>
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelectRun(run.id)}
              className={
                selected
                  ? "flex w-full flex-col gap-2 rounded-card border border-border-strong bg-surface p-4 text-left"
                  : "flex w-full flex-col gap-2 rounded-card border border-border bg-surface p-4 text-left hover:border-border-strong"
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-label font-semibold">{run.project}</span>
                <StatusBadge label={status.label} tone={status.tone} />
              </span>
              <span className="font-mono text-caption text-fg-muted">{run.id}</span>
              <span className="flex items-center justify-between gap-2 text-caption text-fg-subtle">
                <span className="capitalize">{run.step}</span>
                <span>{formatTimestamp(run.updated_at)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
