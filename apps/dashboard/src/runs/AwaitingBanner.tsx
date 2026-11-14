import type { RunDetail } from "~/runs/types";
import { formatActor, gateMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

export function AwaitingBanner({ run, onReview }: { run: RunDetail; onReview?: () => void }) {
  if (!run.awaiting) return null;

  const gate = gateMeta[run.awaiting];
  const lastDecision = [...run.events]
    .sort((a, b) => a.seq - b.seq)
    .reverse()
    .find((event) => event.decision);

  return (
    <section
      aria-labelledby="awaiting-title"
      className="flex flex-col gap-3 rounded-card border border-status-awaiting bg-surface-muted p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={gate.label} tone="awaiting" />
        <h2 id="awaiting-title" className="text-title font-semibold">
          {gate.title}
        </h2>
      </div>
      <p className="text-body text-fg-muted">{gate.description}</p>
      {lastDecision?.decision ? (
        <p className="text-label text-fg-muted">
          Latest decision: <span className="font-mono">{lastDecision.decision.kind}</span> by{" "}
          {formatActor(lastDecision.actor)} — {lastDecision.decision.reason}
        </p>
      ) : null}
      {lastDecision?.decision?.analyses ? (
        <p className="text-caption text-fg-subtle">
          Kept analyses: <span className="font-mono">{lastDecision.decision.analyses.join(", ")}</span>
        </p>
      ) : null}
      {lastDecision?.decision?.layout ? (
        <p className="text-caption text-fg-subtle">
          Layout: <span className="font-mono">{lastDecision.decision.layout}</span>
        </p>
      ) : null}
      {onReview ? (
        <button
          type="button"
          onClick={onReview}
          className="self-start rounded-control border border-border bg-surface px-3 py-2 text-label hover:bg-surface-muted"
        >
          Review the gate
        </button>
      ) : null}
    </section>
  );
}
