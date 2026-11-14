import type { RunSourceMode } from "~/runs/source";
import type { RunSummary } from "~/runs/types";

type StartRunPanelProps = {
  mode: RunSourceMode;
  activeRun: RunSummary | null;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onFollow: () => void;
};

export function StartRunPanel({ mode, activeRun, busy, error, onStart, onFollow }: StartRunPanelProps) {
  if (mode !== "live") return null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h3 className="text-label font-semibold">Live run</h3>
      {activeRun ? (
        <>
          <p className="text-caption text-fg-muted">
            {activeRun.project} is {activeRun.status} ({activeRun.id}).
          </p>
          <button
            type="button"
            onClick={onFollow}
            className="self-start rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
          >
            Follow active run
          </button>
        </>
      ) : (
        <>
          <p className="text-caption text-fg-muted">Start a run on the startup project.</p>
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            aria-busy={busy}
            className="self-start rounded-control border border-accent bg-accent px-3 py-2 text-label font-medium text-on-accent disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start run"}
          </button>
        </>
      )}
      {error ? (
        <p role="alert" className="text-caption text-status-failed">
          {error}
        </p>
      ) : null}
    </div>
  );
}
