import { awaitingRuns } from "~/runs/approvals";
import { formatTimestamp } from "~/runs/format";
import type { RunSource } from "~/runs/source";
import { gateMeta } from "~/runs/status";
import { useRuns } from "~/runs/useRuns";
import { StatusBadge } from "~/ui/StatusBadge";

type ApprovalsPageProps = {
  source: RunSource;
  onReview: (id: string) => void;
};

export function ApprovalsPage({ source, onReview }: ApprovalsPageProps) {
  const { runs, loading, error, refresh } = useRuns(source);
  const waiting = awaitingRuns(runs);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">Open gates</h2>
        {source.mode === "live" ? (
          <button
            type="button"
            onClick={refresh}
            className="rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
          >
            Refresh
          </button>
        ) : null}
      </div>

      {source.mode === "sample" ? (
        <p className="text-caption text-fg-subtle">Approvals need a live run; sample data is read-only.</p>
      ) : null}

      {loading && runs.length === 0 ? (
        <p role="status" className="text-body text-fg-muted">
          Loading approvals…
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-col gap-2 rounded-control border border-status-failed px-3 py-2">
          <p className="text-label text-status-failed">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="self-start rounded-control border border-border px-2 py-1 text-caption hover:bg-surface-muted"
          >
            Retry
          </button>
        </div>
      ) : null}

      {waiting.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-border-strong p-6">
          <p className="text-label font-medium">No approvals waiting</p>
          <p className="text-body text-fg-muted">Runs paused at a gate appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table aria-label="Approvals" className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
                  Run
                </th>
                <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
                  Gate
                </th>
                <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
                  Step
                </th>
                <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
                  Revision
                </th>
                <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 text-right text-caption uppercase tracking-wide text-fg-subtle">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((run) => (
                <tr key={run.id} className="border-b border-border bg-surface last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex flex-col">
                      <span className="text-label font-semibold">{run.project}</span>
                      <span className="font-mono text-caption text-fg-subtle">{run.id}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={gateMeta[run.awaiting].label} tone="awaiting" />
                  </td>
                  <td className="px-4 py-3 text-label capitalize">{run.step}</td>
                  <td className="px-4 py-3 text-label">
                    {run.revision} / {run.max_revisions}
                  </td>
                  <td className="px-4 py-3 text-caption text-fg-subtle">{formatTimestamp(run.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Review ${run.id}`}
                      onClick={() => onReview(run.id)}
                      className="rounded-control border border-accent px-3 py-2 text-label hover:bg-surface-muted"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
