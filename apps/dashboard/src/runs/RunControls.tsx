import type { RunSourceMode } from "~/runs/source";
import type { RunDetail } from "~/runs/types";
import { runStatusLabel, runStatusMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

type RunControlsProps = {
  run: RunDetail;
  mode: RunSourceMode;
  following: boolean;
  onToggleFollowing: () => void;
  onStartAgain?: () => void;
};

export function RunControls({ run, mode, following, onToggleFollowing, onStartAgain }: RunControlsProps) {
  const terminal = run.status === "completed" || run.status === "failed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={runStatusLabel(run)} tone={runStatusMeta[run.status].tone} />
        <span className="text-label text-fg-muted">
          {run.step} · revision {run.revision}/{run.max_revisions}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === "live" && !terminal ? (
          <button
            type="button"
            aria-pressed={following}
            onClick={onToggleFollowing}
            className="rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
          >
            {following ? "Following live" : "Follow live"}
          </button>
        ) : null}
        {mode === "live" && terminal && onStartAgain ? (
          <button
            type="button"
            onClick={onStartAgain}
            className="rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
          >
            Run again
          </button>
        ) : null}
      </div>
    </div>
  );
}
