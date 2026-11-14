import type { RunSource } from "~/runs/source";
import { useRuns } from "~/runs/useRuns";
import { useRunCosts } from "~/runs/useRunCosts";
import { RunsEmptyState } from "~/runs/RunsEmptyState";
import { RunsTable } from "~/runs/RunsTable";
import { useOnRefresh } from "~/ui/refreshSignal";

type RunsPageProps = {
  source: RunSource;
  onOpenRun: (id: string) => void;
};

export function RunsPage({ source, onOpenRun }: RunsPageProps) {
  const { runs, loading, error, refresh } = useRuns(source, 3000);
  const costs = useRunCosts(source, runs);
  useOnRefresh(refresh);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">All runs</h2>
        </div>
        {loading && runs.length === 0 ? (
          <p role="status" className="text-body text-fg-muted">
            Loading runs…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="flex flex-col gap-2 rounded-control border border-status-failed px-3 py-2">
            <p className="text-label text-status-failed">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="self-start rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
            >
              Retry
            </button>
          </div>
        ) : null}
        {runs.length === 0 ? (
          <RunsEmptyState />
        ) : (
          <RunsTable runs={runs} costs={costs} onOpenRun={onOpenRun} />
        )}
      </section>
    </div>
  );
}
