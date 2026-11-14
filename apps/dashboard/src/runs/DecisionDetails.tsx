import type { RunDecision } from "~/runs/types";

export function DecisionDetails({ decision }: { decision: RunDecision }) {
  return (
    <div className="flex flex-col gap-1 rounded-control bg-surface-muted px-3 py-2">
      <p className="flex flex-wrap items-baseline gap-2 text-label">
        <span className="font-mono text-caption text-fg-muted">{decision.kind}</span>
        <span className="break-words">{decision.reason}</span>
      </p>
      {decision.analyses ? (
        <p className="text-caption text-fg-subtle">
          Analyses: <span className="font-mono">{decision.analyses.join(", ")}</span>
        </p>
      ) : null}
      {decision.layout ? (
        <p className="text-caption text-fg-subtle">
          Layout: <span className="font-mono">{decision.layout}</span>
        </p>
      ) : null}
    </div>
  );
}
