import type { RunSource } from "~/runs/source";
import type { Run, RunDetail } from "~/runs/types";
import { RunsEmptyState } from "~/runs/RunsEmptyState";
import { RunsList } from "~/runs/RunsList";
import { RunView } from "~/runs/RunView";

type RunsSectionProps = {
  runs: readonly Run[];
  selectedRun: RunDetail | null;
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  source: RunSource;
};

export function RunsSection({ runs, selectedRun, selectedRunId, onSelectRun, source }: RunsSectionProps) {
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
        {selectedRun ? (
          <RunView key={selectedRun.id} run={selectedRun} source={source} />
        ) : runs.length > 0 ? (
          <RunsEmptyState hasRuns />
        ) : null}
      </div>
    </div>
  );
}
