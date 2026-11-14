import type { CandidatesModel } from "~/candidates/model";
import { StatusBadge } from "~/ui/StatusBadge";

type ResultHeaderProps = {
  context: CandidatesModel["context"];
  counts: CandidatesModel["counts"];
  flags: string[];
};

export function ResultHeader({ context, counts, flags }: ResultHeaderProps) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="text-title font-semibold">{context.project}</h2>
      <p className="text-label text-fg-muted">
        {context.forecast} · {context.horizon} · {context.currency}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={`${counts.total} candidates`} tone="neutral" />
        <StatusBadge label={`${counts.feasible} feasible`} tone="completed" />
        {counts.infeasible > 0 ? (
          <StatusBadge label={`${counts.infeasible} infeasible`} tone="failed" />
        ) : null}
        {counts.pareto > 0 ? (
          <StatusBadge label={`${counts.pareto} on the Pareto frontier`} tone="neutral" />
        ) : null}
        {context.catalogIllustrative ? <StatusBadge label="Illustrative prices" tone="awaiting" /> : null}
        <StatusBadge
          label={`Schema ${context.schemaVersion}`}
          tone={context.schemaSupported ? "neutral" : "failed"}
        />
      </div>
      {!context.schemaSupported ? (
        <p className="text-caption text-fg-muted">
          This result uses a schema this view does not know; showing it best-effort.
        </p>
      ) : null}
      {flags.length > 0 ? <p className="text-caption text-fg-subtle">Flags: {flags.join(" · ")}</p> : null}
    </header>
  );
}
