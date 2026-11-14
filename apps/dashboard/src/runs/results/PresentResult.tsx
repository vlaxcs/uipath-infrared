import type { LayoutOption } from "~/runs/types";
import { formatEUR, formatPercent, formatRisk } from "~/runs/format";
import { Empty, Table } from "~/runs/results/ResultParts";

export function PresentResult({ options }: { options: readonly LayoutOption[] }) {
  if (options.length === 0) {
    return <Empty>The candidate list is unavailable for this run.</Empty>;
  }

  return (
    <Table
      headers={["Layout", "Feasible", "Rank", "Monthly", "Availability", "Risk"]}
      rows={options.map((option) => [
        option.id,
        option.feasible ? "Yes" : "No",
        option.rank ?? "—",
        formatEUR(option.monthly_eur),
        formatPercent(option.availability_pct),
        formatRisk(option.risk),
      ])}
    />
  );
}
