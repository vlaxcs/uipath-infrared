import { heldSince, holdingReason } from "~/onboarding/projectHolder";
import type { RunSummary } from "~/runs/types";

export function ProjectHeld({ run, onOpen }: { run: RunSummary; onOpen: () => void }) {
  const since = heldSince(run);
  return (
    <div role="status" className="flex flex-col gap-2 rounded-control border border-status-awaiting bg-surface-muted px-4 py-3">
      <p className="text-label text-fg">
        <span className="font-semibold">{run.project}</span> is held by <span className="font-mono">{run.id}</span>, {holdingReason(run)}
        {since ? ` since ${since}` : ""}.
      </p>
      <p className="text-caption text-fg-muted">One run per project at a time. Decide or stop that run before starting another.</p>
      <button
        type="button"
        onClick={onOpen}
        className="self-start rounded-pill border border-border-strong bg-surface px-4 py-1.5 text-label font-medium text-fg hover:bg-surface-muted"
      >
        Open {run.id}
      </button>
    </div>
  );
}
