import type { NextPreview } from "~/runs/nextPreview";
import { stepStateMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

export function NextStepPreview({ preview, onSelect }: { preview: NextPreview; onSelect: () => void }) {
  const state = stepStateMeta[preview.state];

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-label font-semibold">
            {preview.control === "last" ? "Last step" : `Next: ${preview.title}`}
          </h3>
          <p className="text-caption text-fg-muted">{preview.hint}</p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={!preview.step}
          className="rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted disabled:opacity-50"
        >
          Next step
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-caption text-fg-subtle">
        <StatusBadge label={state.label} tone={state.tone} />
        <span>{preview.control === "automatic" ? "Automatic" : preview.control === "approval" ? "Needs approval" : "Last step"}</span>
        {preview.artifactPath ? <span className="font-mono">{preview.artifactPath}</span> : null}
      </div>
      <p className="text-caption text-fg-subtle">Changing the view does not advance the run.</p>
    </section>
  );
}
