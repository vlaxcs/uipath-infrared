import { useCallback, useEffect, useState } from "react";
import { gateStep } from "~/runs/approvals";
import type { RunSource } from "~/runs/source";
import { START_PROJECT } from "~/runs/runSource";
import { useSelectedRun } from "~/runs/useSelectedRun";
import { RunView } from "~/runs/RunView";
import { useOnRefresh } from "~/ui/refreshSignal";

type RunPageProps = {
  source: RunSource;
  runId: string;
  focusGate: boolean;
  onOpenRun: (id: string) => void;
};

export function RunPage({ source, runId, focusGate, onOpenRun }: RunPageProps) {
  const { run, loading, error, reload } = useSelectedRun(source, runId);
  useOnRefresh(reload);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [resumed, setResumed] = useState(0);
  const project = run?.project ?? null;
  const terminal = run?.status === "completed" || run?.status === "failed";

  // A project runs one analysis at a time: offer the active one instead of a start that would be refused.
  useEffect(() => {
    if (!project || !terminal) return;
    let current = true;
    source.listRuns().then(
      (runs) => {
        if (!current) return;
        const active = runs.find((item) => item.project === project && item.id !== run?.id && (item.status === "running" || item.status === "awaiting_approval"));
        setActiveRunId(active?.id ?? null);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [source, project, terminal, run?.id]);

  const startAgain = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const started = await source.startRun(project ?? START_PROJECT);
      onOpenRun(started.id);
    } catch (cause) {
      setStartError(messageOf(cause));
    } finally {
      setStarting(false);
    }
  }, [source, onOpenRun, project]);

  const resume = useCallback(async () => {
    if (!run || !source.retryRun) return;
    setStartError(null);
    try {
      await source.retryRun(run.id);
      setResumed((count) => count + 1);
      reload();
    } catch (cause) {
      setStartError(messageOf(cause));
    }
  }, [source, run, reload]);

  return (
    <div className="flex flex-col gap-4">
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
          key={`${run.id}${focusGate ? ":gate" : ""}:${resumed}`}
          run={run}
          source={source}
          initialStep={focusGate ? gateStep(run.awaiting) : null}
          onReload={reload}
          onStartAgain={() => void startAgain()}
          activeRunId={activeRunId}
          onResume={source.retryRun ? () => void resume() : undefined}
          onOpenRun={onOpenRun}
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
