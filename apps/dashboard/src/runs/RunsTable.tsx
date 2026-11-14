import type { RunCostEntry } from "~/runs/useRunCosts";
import type { RunSummary } from "~/runs/types";
import { formatEUR, formatTimestamp } from "~/runs/format";
import { runStatusLabel, runStatusMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";
import { Fragment } from "react";
import { isLive, RunProgressBar } from "~/runs/RunProgressBar";

type RunsTableProps = {
  runs: readonly RunSummary[];
  costs: Record<string, RunCostEntry>;
  onOpenRun: (id: string) => void;
};

export function RunsTable({ runs, costs, onOpenRun }: RunsTableProps) {
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
            const status = runStatusMeta[run.status];
            const cost = costs[run.id];

            const live = isLive(run);

            return (
              <Fragment key={run.id}>
              <tr
                onClick={() => onOpenRun(run.id)}
                className={
                  live
                    ? "cursor-pointer bg-surface-muted"
                    : "cursor-pointer border-b border-border bg-surface last:border-0 hover:bg-surface-muted"
                }
              >
                <td className={live ? "border-l-4 border-credit px-4 py-3" : "border-l-4 border-transparent px-4 py-3"}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenRun(run.id);
                    }}
                    className="flex items-center gap-2 text-left"
                  >
                    <span aria-hidden="true" className="text-fg-subtle">
                      ▸
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
              {live ? (
                <tr onClick={() => onOpenRun(run.id)} className="cursor-pointer border-b border-border bg-surface-muted last:border-0">
                  <td colSpan={6} className="border-l-4 border-credit px-4 pb-3">
                    <RunProgressBar run={run} />
                  </td>
                </tr>
              ) : null}
              </Fragment>
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
