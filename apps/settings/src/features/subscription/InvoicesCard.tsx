import { useSettings } from "~/app/settings-context";
import { formatDate, formatUsd } from "~/app/format";
import type { Invoice } from "~/domain/types";
import { Badge, type Tone } from "~/ui/Badge";
import { Card } from "~/ui/Card";

const statuses: Record<Invoice["status"], { tone: Tone; label: string }> = {
  paid: { tone: "success", label: "Paid" },
  open: { tone: "warn", label: "Open" },
  failed: { tone: "danger", label: "Failed" },
};

export function InvoicesCard() {
  const { invoices } = useSettings().subscription;

  return (
    <Card dense title="Invoices">
      {invoices.length === 0 ? (
        <p className="type-small text-fg-muted">
          No invoices yet. They appear here after your first purchase.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead className="hidden sm:table-header-group">
            <tr className="type-eyebrow border-b border-line text-left text-fg-muted">
              <th className="pb-1.5 pr-4 font-semibold">Date</th>
              <th className="pb-1.5 pr-4 font-semibold">Description</th>
              <th className="pb-1.5 pr-4 text-right font-semibold">Amount</th>
              <th className="pb-1.5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const status = statuses[invoice.status];
              return (
                <tr
                  key={invoice.id}
                  className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0 sm:table-row sm:py-0"
                >
                  <td className="type-small col-start-1 row-start-2 text-fg-muted sm:py-2 sm:pr-4 sm:text-fg">{formatDate(invoice.date)}</td>
                  <td className="type-small col-start-1 row-start-1 sm:py-2 sm:pr-4">{invoice.description}</td>
                  <td className="type-label col-start-2 row-start-1 text-right tabular-nums sm:py-2 sm:pr-4">{formatUsd(invoice.amountUsd)}</td>
                  <td className="col-start-2 row-start-2 text-right sm:py-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
