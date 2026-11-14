import { useCallback, useState } from "react";
import type { RunSource } from "~/runs/source";
import type { RunSummary } from "~/runs/types";
import { START_PROJECT } from "~/runs/runSource";
import { useRuns } from "~/runs/useRuns";
import { useRunCosts } from "~/runs/useRunCosts";
import { RunsEmptyState } from "~/runs/RunsEmptyState";
import { RunsTable } from "~/runs/RunsTable";
import { StartRunPanel } from "~/runs/StartRunPanel";

type RunsPageProps = {
  source: RunSource;
  onOpenRun: (id: string) => void;
};

export function RunsPage({ source, onOpenRun }: RunsPageProps) {
  const { runs, loading, error, refresh } = useRuns(source, 3000);
  const costs = useRunCosts(source, runs);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const started = await source.startRun(START_PROJECT);
      onOpenRun(started.id);
    } catch (cause) {
      setStartError(messageOf(cause));
    } finally {
      setStarting(false);
    }
  }, [source, onOpenRun]);

  const activeRun: RunSummary | null = runs.find(isActive) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <StartRunPanel
        mode={source.mode}
        activeRun={activeRun}
        busy={starting}
        error={startError}
        onStart={() => void start()}
        onView={() => {
          if (activeRun) onOpenRun(activeRun.id);
        }}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">All runs</h2>
          {source.mode === "live" ? (
            <button
              type="button"
              onClick={refresh}
              className="rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
            >
              Refresh
            </button>
          ) : null}
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

function isActive(run: RunSummary): boolean {
  return run.status === "running" || run.status === "awaiting_approval";
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
