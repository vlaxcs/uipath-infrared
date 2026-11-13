import type { ReactNode } from "react";
import type { EdgeKind, GraphCategory, GraphModel, GraphStatus } from "~/graph/types";
import {
  CATEGORY_LABEL,
  CATEGORY_SHAPE,
  EDGE_STYLE,
  STATUS_META,
  shapePath,
} from "~/graph/style";

export function GraphLegend({ model }: { model: GraphModel }) {
  const categories = unique(model.nodes.map((node) => node.category));
  const kinds = unique(model.edges.map((edge) => edge.kind));
  const statuses = unique(model.nodes.map((node) => node.status)).filter(
    (status): status is Exclude<GraphStatus, "active" | "unknown"> => status === "idle" || status === "orphan",
  );

  return (
    <div className="flex flex-col gap-4">
      <LegendGroup title="Components">
        {categories.map((category) => (
          <LegendItem key={category}>
            <svg viewBox="-8 -8 16 16" className="h-3 w-3" aria-hidden="true">
              <path d={shapePath(CATEGORY_SHAPE[category], 6)} className="fill-fg-muted" />
            </svg>
            {CATEGORY_LABEL[category]}
          </LegendItem>
        ))}
      </LegendGroup>

      <LegendGroup title="Connections">
        {kinds.map((kind) => (
          <LegendItem key={kind}>
            <svg viewBox="0 0 24 10" className="h-2.5 w-6" aria-hidden="true">
              <path
                d="M 1 5 L 23 5"
                fill="none"
                className="stroke-graph-edge"
                strokeWidth={EDGE_STYLE[kind].width}
                strokeDasharray={EDGE_STYLE[kind].dash}
              />
            </svg>
            {EDGE_STYLE[kind].label}
          </LegendItem>
        ))}
      </LegendGroup>

      {statuses.length > 0 ? (
        <LegendGroup title="Health">
          {statuses.map((status) => (
            <LegendItem key={status}>
              <svg viewBox="-8 -8 16 16" className="h-3 w-3" aria-hidden="true">
                <circle r={6} fill="none" className={STATUS_META[status].haloClass} strokeWidth={2} />
              </svg>
              {STATUS_META[status].label}
            </LegendItem>
          ))}
        </LegendGroup>
      ) : null}
    </div>
  );
}

function LegendGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-caption uppercase tracking-wide text-fg-subtle">{title}</h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function LegendItem({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-2 text-caption text-fg-muted">{children}</li>;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
