import type { RunCostEntry } from "~/runs/useRunCosts";
import type { RunSummary } from "~/runs/types";
import { formatEUR, formatTimestamp } from "~/runs/format";
import { runStatusLabel, runStatusMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

type RunsTableProps = {
  runs: readonly RunSummary[];
  costs: Record<string, RunCostEntry>;
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
};

export function RunsTable({ runs, costs, selectedRunId, onSelectRun }: RunsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table aria-label="Runs" className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
              Run
            </th>
            <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-caption uppercase tracking-wide text-fg-subtle">
              Step
            </th>
            <th scope="col" className="px-4 py-3 text-right text-caption uppercase tracking-wide text-fg-subtle">
              Before €/mo
            </th>
            <th scope="col" className="px-4 py-3 text-right text-caption uppercase tracking-wide text-fg-subtle">
              After €/mo
            </th>
            <th scope="col" className="px-4 py-3 text-right text-caption uppercase tracking-wide text-fg-subtle">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const selected = run.id === selectedRunId;
            const status = runStatusMeta[run.status];
            const cost = costs[run.id];

            return (
              <tr
                key={run.id}
                onClick={() => onSelectRun(run.id)}
                aria-current={selected ? "true" : undefined}
                className={
                  selected
                    ? "cursor-pointer border-b border-border bg-surface-muted last:border-0"
                    : "cursor-pointer border-b border-border bg-surface last:border-0 hover:bg-surface-muted"
                }
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectRun(run.id);
                    }}
                    aria-expanded={selected}
                    className="flex items-center gap-2 text-left"
                  >
                    <span aria-hidden="true" className="text-fg-subtle">
                      {selected ? "▾" : "▸"}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-label font-semibold">{run.project}</span>
                      <span className="font-mono text-caption text-fg-subtle">{run.id}</span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={runStatusLabel(run)} tone={status.tone} />
                </td>
                <td className="px-4 py-3 text-label capitalize">{run.step}</td>
                <td className="px-4 py-3 text-right font-mono text-label">{price(cost, "before")}</td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-label">{price(cost, "after")}</span>
                  {cost && cost !== "loading" && cost.winner ? (
                    <span className="block text-caption text-fg-subtle">{cost.winner}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right text-caption text-fg-subtle">
                  {formatTimestamp(run.updated_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function price(cost: RunCostEntry | undefined, field: "before" | "after"): string {
  if (!cost || cost === "loading") return "…";
  return cost[field] === null ? "—" : formatEUR(cost[field]);
}
