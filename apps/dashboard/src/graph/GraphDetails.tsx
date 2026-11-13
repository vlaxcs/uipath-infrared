import type { ReactNode } from "react";
import type { Connection, Connections } from "~/graph/filters";
import { formatMetric, formatScalar, formatSeries, humanizeKey } from "~/graph/format";
import { CATEGORY_LABEL, EDGE_STYLE, STATUS_META } from "~/graph/style";
import type { GraphNode, SeriesMetric, StaticMetric } from "~/graph/types";
import { StatusBadge } from "~/ui/StatusBadge";

type GraphDetailsProps = {
  node: GraphNode | null;
  stackLabel: string;
  connections: Connections;
  onSelectNode: (id: string) => void;
  onClear: () => void;
};

export function GraphDetails({ node, stackLabel, connections, onSelectNode, onClear }: GraphDetailsProps) {
  if (!node) {
    return (
      <aside className="w-full xl:w-72 xl:shrink-0">
        <div className="rounded-card border border-dashed border-border-strong p-6">
          <p className="text-label font-medium">Select a component</p>
          <p className="text-body text-fg-muted">Pick a node to see its facts and connections.</p>
        </div>
      </aside>
    );
  }

  const status = STATUS_META[node.status];
  const component = node.component;
  const cost = component.cost?.monthly_eur;
  const config = entries(component.config);
  const capacity = entries(component.capacity);
  const usage = entries(component.usage);
  const security = entries(component.security);

  return (
    <aside className="w-full xl:w-72 xl:shrink-0">
      <section aria-live="polite" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-title font-semibold">{node.label}</h2>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <p className="font-mono text-caption text-fg-muted">{node.id}</p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind">{node.kind}</Field>
          <Field label="Category">{CATEGORY_LABEL[node.category]}</Field>
          <Field label="Stack">{stackLabel}</Field>
          <Field label="Region">{component.region ?? "Unknown"}</Field>
          <Field label="Zones">{component.zones ?? "Unknown"}</Field>
          <Field label="Quantity">{component.quantity ?? 1}</Field>
          <Field label="Parent">{component.parent ?? "None"}</Field>
        </dl>

        {config.length > 0 ? <Facts title="Configuration" entries={config} render={formatScalar} /> : null}
        {capacity.length > 0 ? (
          <Facts
            title="Capacity"
            entries={capacity}
            render={(value) => formatMetric(value as StaticMetric)}
          />
        ) : null}
        {usage.length > 0 ? (
          <Facts title="Usage" entries={usage} render={(value) => formatSeries(value as SeriesMetric)} />
        ) : null}
        {cost ? (
          <Facts
            title="Cost"
            entries={[["monthly_eur", cost]]}
            render={(value) => formatMetric(value as StaticMetric)}
          />
        ) : null}
        {security.length > 0 ? <Facts title="Security" entries={security} render={formatScalar} /> : null}

        <ConnectionGroup
          title="Dependencies"
          connections={connections.outbound}
          direction="out"
          onSelectNode={onSelectNode}
        />
        <ConnectionGroup
          title="Dependents"
          connections={connections.inbound}
          direction="in"
          onSelectNode={onSelectNode}
        />

        <button
          type="button"
          onClick={onClear}
          className="self-start rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
        >
          Clear selection
        </button>
      </section>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="break-words text-label">{children}</dd>
    </div>
  );
}

function Facts({
  title,
  entries,
  render,
}: {
  title: string;
  entries: [string, unknown][];
  render: (value: unknown) => string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label font-semibold">{title}</h3>
      <dl className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <dt className="text-caption uppercase tracking-wide text-fg-subtle">{humanizeKey(key)}</dt>
            <dd className="break-words text-label">{render(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ConnectionGroup({
  title,
  connections,
  direction,
  onSelectNode,
}: {
  title: string;
  connections: Connection[];
  direction: "out" | "in";
  onSelectNode: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label font-semibold">{title}</h3>
      {connections.length === 0 ? (
        <p className="text-caption text-fg-subtle">None.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {connections.map(({ edge, peer }) => (
            <li key={edge.key}>
              <button
                type="button"
                onClick={() => onSelectNode(peer.id)}
                className="flex w-full flex-col gap-1 rounded-control border border-border px-3 py-2 text-left hover:bg-surface-muted"
              >
                <span className="text-label">
                  {EDGE_STYLE[edge.kind].label} {direction === "out" ? "→" : "←"} {peer.label}
                </span>
                {edge.note ? <span className="text-caption text-fg-subtle">{edge.note}</span> : null}
                {edge.gbMonth ? (
                  <span className="text-caption text-fg-subtle">{formatMetric(edge.gbMonth)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function entries<T>(record: Record<string, T> | null | undefined): [string, T][] {
  return record ? (Object.entries(record) as [string, T][]) : [];
}
