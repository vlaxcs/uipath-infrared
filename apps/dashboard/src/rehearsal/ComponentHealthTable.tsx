import type { ComponentRowView, RehearsalModel } from "~/rehearsal/model";
import { Card } from "~/rehearsal/parts";
import { StatusBadge } from "~/ui/StatusBadge";

export function ComponentHealthTable({
  components,
  counts,
}: {
  components: readonly ComponentRowView[];
  counts: RehearsalModel["componentCounts"];
}) {
  const summary =
    components.length === 0
      ? undefined
      : `${counts.total} components · ${counts.healthy} healthy · ${counts.degraded} degraded · ${counts.failed} failed${
          counts.unknown > 0 ? ` · ${counts.unknown} unknown` : ""
        }`;

  return (
    <Card id="components" title="Component health" description={summary}>
      {components.length === 0 ? (
        <p className="text-body text-fg-muted">No component results were recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Component health" className="min-w-full border-collapse text-left">
            <caption className="sr-only">Component health</caption>
            <thead>
              <tr className="border-b border-border">
                {["Component", "Kind", "Status", "Availability", "CPU", "Memory", "Note"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-2 py-2 text-caption uppercase tracking-wide text-fg-subtle"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr
                  key={component.id}
                  className={
                    component.isFailureTarget
                      ? "border-b border-border bg-surface-muted"
                      : "border-b border-border"
                  }
                >
                  <th scope="row" className="px-2 py-2 text-left font-mono text-label font-medium">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {component.id}
                      {component.isFailureTarget ? (
                        <StatusBadge label="Failure target" tone="failed" />
                      ) : null}
                      {component.isLoadBalancer ? (
                        <StatusBadge label="Load balancer" tone="neutral" />
                      ) : null}
                    </span>
                  </th>
                  <td className="px-2 py-2 text-label">{component.kind}</td>
                  <td className="px-2 py-2">
                    <StatusBadge label={component.statusLabel} tone={component.statusTone} />
                  </td>
                  <td className="px-2 py-2 text-label">{component.availability.value}</td>
                  <td className="px-2 py-2 text-label">{component.cpu.value}</td>
                  <td className="px-2 py-2 text-label">{component.memory.value}</td>
                  <td className="px-2 py-2 text-label text-fg-muted">{component.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
