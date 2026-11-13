import type { Run } from "~/runs/types";
import { RunsEmptyState } from "~/runs/RunsEmptyState";
import { RunsList } from "~/runs/RunsList";
import { RunSummary } from "~/runs/RunSummary";

type RunsSectionProps = {
  runs: readonly Run[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
};

export function RunsSection({ runs, selectedRunId, onSelectRun }: RunsSectionProps) {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex w-full flex-col gap-3 xl:w-80 xl:shrink-0">
        <h2 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">All runs</h2>
        {runs.length === 0 ? (
          <RunsEmptyState hasRuns={false} />
        ) : (
          <RunsList runs={runs} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {selectedRun ? <RunSummary run={selectedRun} /> : runs.length > 0 ? <RunsEmptyState hasRuns /> : null}
      </div>
    </div>
  );
}
