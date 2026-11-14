import { useCallback, useState } from "react";
import { gateStep } from "~/runs/approvals";
import type { RunSource } from "~/runs/source";
import { START_PROJECT } from "~/runs/runSource";
import { useSelectedRun } from "~/runs/useSelectedRun";
import { RunView } from "~/runs/RunView";

type RunPageProps = {
  source: RunSource;
  runId: string;
  focusGate: boolean;
  onOpenRun: (id: string) => void;
};

export function RunPage({ source, runId, focusGate, onOpenRun }: RunPageProps) {
  const { run, loading, error, reload } = useSelectedRun(source, runId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const startAgain = useCallback(async () => {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {run ? (
          <p className="text-label text-fg-muted">
            {run.project} · <span className="font-mono text-caption">{run.id}</span>
          </p>
        ) : null}
      </div>

      {starting ? (
        <p role="status" className="text-body text-fg-muted">
          Starting a new run…
        </p>
      ) : null}
      {startError ? (
        <p
          role="alert"
          className="rounded-control border border-status-failed bg-surface-muted px-3 py-2 text-label text-status-failed"
        >
          {startError}
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="text-body text-fg-muted">
          Loading the run…
        </p>
      ) : error ? (
        <div role="alert" className="flex flex-col gap-2 rounded-control border border-status-failed px-3 py-2">
          <p className="text-label text-status-failed">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="self-start rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
          >
            Retry
          </button>
        </div>
      ) : run ? (
        <RunView
          key={`${run.id}${focusGate ? ":gate" : ""}`}
          run={run}
          source={source}
          initialStep={focusGate ? gateStep(run.awaiting) : null}
          onReload={reload}
          onStartAgain={() => void startAgain()}
        />
      ) : (
        <p className="text-body text-fg-muted">Run not found.</p>
      )}
    </div>
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
