import { useCallback, useEffect, useState } from "react";
import type { RunSource } from "~/runs/source";
import type { RunSummary } from "~/runs/types";
import { START_PROJECT } from "~/runs/runSource";
import { useRuns } from "~/runs/useRuns";
import { useRunCosts } from "~/runs/useRunCosts";
import { useSelectedRun } from "~/runs/useSelectedRun";
import { RunView } from "~/runs/RunView";
import { RunsEmptyState } from "~/runs/RunsEmptyState";
import { RunsTable } from "~/runs/RunsTable";
import { StartRunPanel } from "~/runs/StartRunPanel";

type RunsSectionProps = {
  source: RunSource;
};

export function RunsSection({ source }: RunsSectionProps) {
  const { runs, loading, error, refresh } = useRuns(source);
  const costs = useRunCosts(source, runs);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selected = useSelectedRun(source, selectedRunId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRunId || runs.length === 0) return;
    const active = runs.find(isActive);
    if (active) setSelectedRunId(active.id);
  }, [runs, selectedRunId]);

  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const started = await source.startRun(START_PROJECT);
      setSelectedRunId(started.id);
      refresh();
    } catch (cause) {
      setStartError(messageOf(cause));
    } finally {
      setStarting(false);
    }
  }, [source, refresh]);

  const activeRun: RunSummary | null =
    runs.find(isActive) ?? (selected.run && isActive(selected.run) ? selected.run : null);
  const viewingActiveRun = activeRun !== null && selected.run?.id === activeRun.id;
  const reloadSelected = () => {
    selected.reload();
    refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {!viewingActiveRun ? (
        <StartRunPanel
          mode={source.mode}
          activeRun={activeRun}
          busy={starting}
          error={startError}
          onStart={() => void start()}
          onFollow={() => {
            if (activeRun) setSelectedRunId(activeRun.id);
          }}
        />
      ) : null}

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
          <RunsEmptyState hasRuns={false} />
        ) : (
          <RunsTable
            runs={runs}
            costs={costs}
            selectedRunId={selectedRunId}
            onSelectRun={setSelectedRunId}
          />
        )}
      </section>

      <div>
        {selected.loading ? (
          <p role="status" className="text-body text-fg-muted">
            Loading the run…
          </p>
        ) : selected.error ? (
          <div role="alert" className="flex flex-col gap-2 rounded-control border border-status-failed px-3 py-2">
            <p className="text-label text-status-failed">{selected.error}</p>
            <button
              type="button"
              onClick={reloadSelected}
              className="self-start rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
            >
              Retry
            </button>
          </div>
        ) : selected.run ? (
          <RunView
            key={selected.run.id}
            run={selected.run}
            source={source}
            onReload={reloadSelected}
            onStartAgain={() => void start()}
            onRunUpdated={refresh}
          />
        ) : runs.length > 0 ? (
          <RunsEmptyState hasRuns />
        ) : null}
      </div>
    </div>
  );
}

function isActive(run: RunSummary): boolean {
  return run.status === "running" || run.status === "awaiting_approval";
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
