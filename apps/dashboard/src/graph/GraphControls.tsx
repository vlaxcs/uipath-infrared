import type { ReactNode } from "react";
import type { FilterOptions, Filters } from "~/graph/filters";
import type { EdgeKind, GraphModel, GraphStatus } from "~/graph/types";
import { EDGE_STYLE, STATUS_META } from "~/graph/style";
import { GraphLegend } from "~/graph/GraphLegend";

type GraphControlsProps = {
  model: GraphModel;
  options: FilterOptions;
  filters: Filters;
  onToggleStack: (id: string) => void;
  onToggleKind: (kind: EdgeKind) => void;
  onToggleStatus: (status: GraphStatus) => void;
  onQuery: (query: string) => void;
  onToggleLabels: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function GraphControls({
  model,
  options,
  filters,
  onToggleStack,
  onToggleKind,
  onToggleStatus,
  onQuery,
  onToggleLabels,
  onFit,
  onZoomIn,
  onZoomOut,
}: GraphControlsProps) {
  return (
    <aside className="flex w-full flex-col gap-6 xl:w-56 xl:shrink-0">
      <label className="flex flex-col gap-1 text-label font-medium">
        Search components
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onQuery(event.target.value)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-label font-normal text-fg placeholder:text-fg-subtle"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption uppercase tracking-wide text-fg-subtle">Stacks</legend>
        {options.stacks.map((option) => (
          <label key={option.id} className="flex items-center justify-between gap-2 text-label">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.stacks.has(option.id)}
                onChange={() => onToggleStack(option.id)}
              />
              {option.label}
            </span>
            <span className="text-caption text-fg-subtle">{option.count}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption uppercase tracking-wide text-fg-subtle">Connections</legend>
        {options.kinds.map((option) => (
          <label key={option.kind} className="flex items-center justify-between gap-2 text-label">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.kinds.has(option.kind)}
                onChange={() => onToggleKind(option.kind)}
              />
              {EDGE_STYLE[option.kind].label}
            </span>
            <span className="text-caption text-fg-subtle">{option.count}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption uppercase tracking-wide text-fg-subtle">Status</legend>
        {options.statuses.map((option) => (
          <label key={option.status} className="flex items-center justify-between gap-2 text-label">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.statuses.has(option.status)}
                onChange={() => onToggleStatus(option.status)}
              />
              {STATUS_META[option.status].label}
            </span>
            <span className="text-caption text-fg-subtle">{option.count}</span>
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-label">
        <input type="checkbox" checked={filters.showLabels} onChange={onToggleLabels} />
        Show labels
      </label>

      <div className="flex flex-wrap gap-2">
        <ControlButton onClick={onFit}>Fit view</ControlButton>
        <ControlButton onClick={onZoomIn}>Zoom in</ControlButton>
        <ControlButton onClick={onZoomOut}>Zoom out</ControlButton>
      </div>

      <GraphLegend model={model} />
    </aside>
  );
}

function ControlButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control border border-border bg-surface px-3 py-2 text-label hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}
