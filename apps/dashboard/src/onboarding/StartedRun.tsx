import type { StartedRun as Started } from "~/onboarding/types";
import { StatusBadge } from "~/ui/StatusBadge";

type StartedRunProps = {
  run: Started;
  onFollow: () => void;
  onAnother: () => void;
};

export function StartedRun({ run, onFollow, onAnother }: StartedRunProps) {
  return (
    <section
      aria-labelledby="started-run-title"
      className="flex max-w-3xl flex-col gap-4 rounded-card border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="started-run-title" className="text-title font-semibold">
          The run started
        </h2>
        <StatusBadge label="Running" tone="running" />
      </div>
      <p className="font-mono text-label text-fg-muted">{run.id}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onFollow}
          className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent"
        >
          Follow it in Runs
        </button>
        <button
          type="button"
          onClick={onAnother}
          className="rounded-control border border-border-strong px-4 py-2 text-label font-medium text-fg"
        >
          Start another run
        </button>
      </div>
    </section>
  );
}
