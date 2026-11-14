import { useMemo, useState } from "react";
import {
  connectionsFor,
  defaultFilters,
  filterOptions,
  focusStates,
  toggleValue,
  visibleGraph,
  type Filters,
} from "~/graph/filters";
import {
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  fitView,
  layoutGraph,
  panBy,
  zoomAt,
  type ViewTransform,
} from "~/graph/layout";
import { stackClasses } from "~/graph/style";
import type { EdgeKind, GraphModel, GraphStatus } from "~/graph/types";
import { GraphCanvas } from "~/graph/GraphCanvas";
import { GraphControls } from "~/graph/GraphControls";
import { GraphDetails } from "~/graph/GraphDetails";

export function GraphSection({ model }: { model: GraphModel }) {
  const layout = useMemo(() => layoutGraph(model), [model]);
  const options = useMemo(() => filterOptions(model), [model]);
  const classes = useMemo(() => stackClasses(model), [model]);
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(model));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTransform>(() => fitView(layout));

  const visible = useMemo(() => visibleGraph(model, filters), [model, filters]);
  const focus = useMemo(
    () => focusStates(visible, { selectedId, hoveredId, query: filters.query }),
    [visible, selectedId, hoveredId, filters.query],
  );
  const selected = visible.nodes.find((node) => node.id === selectedId) ?? null;
  const connections = useMemo(
    () => connectionsFor(visible, selected?.id ?? null),
    [visible, selected?.id],
  );
  const visibleLayout = useMemo(() => {
    const ids = new Set(visible.nodes.map((node) => node.id));
    return layout.filter((node) => ids.has(node.id));
  }, [layout, visible.nodes]);
  const stackLabel = selected
    ? model.stacks.find((stack) => stack.id === selected.stackId)?.label ?? "Unassigned"
    : "";

  const updateFilters = (change: (current: Filters) => Filters) => setFilters(change);
  const toggleStack = (id: string) =>
    updateFilters((current) => ({ ...current, stacks: toggleValue(current.stacks, id) }));
  const toggleKind = (kind: EdgeKind) =>
    updateFilters((current) => ({ ...current, kinds: toggleValue(current.kinds, kind) }));
  const toggleStatus = (status: GraphStatus) =>
    updateFilters((current) => ({ ...current, statuses: toggleValue(current.statuses, status) }));
  const onQuery = (query: string) => updateFilters((current) => ({ ...current, query }));
  const toggleLabels = () =>
    updateFilters((current) => ({ ...current, showLabels: !current.showLabels }));
  const fit = () => setView(fitView(visibleLayout.length > 0 ? visibleLayout : layout));
  const zoom = (factor: number) =>
    setView((current) => zoomAt(current, factor, GRAPH_WIDTH / 2, GRAPH_HEIGHT / 2));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-title font-semibold">{model.project}</h2>
        <p className="text-label text-fg-muted">
          {model.nodes.length} components · {model.edges.length} dependencies
        </p>
      </header>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <GraphControls
          model={model}
          options={options}
          filters={filters}
          onToggleStack={toggleStack}
          onToggleKind={toggleKind}
          onToggleStatus={toggleStatus}
          onQuery={onQuery}
          onToggleLabels={toggleLabels}
          onFit={fit}
          onZoomIn={() => zoom(1.25)}
          onZoomOut={() => zoom(0.8)}
        />
        <div className="min-w-0 flex-1">
          <GraphCanvas
            layout={layout}
            visible={visible}
            focus={focus}
            selectedId={selectedId}
            showLabels={filters.showLabels}
            view={view}
            stackClasses={classes}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            onZoom={(factor, anchorX, anchorY) =>
              setView((current) => zoomAt(current, factor, anchorX, anchorY))
            }
            onPan={(dx, dy) => setView((current) => panBy(current, dx, dy))}
          />
        </div>
        <GraphDetails
          node={selected}
          stackLabel={stackLabel}
          connections={connections}
          onSelectNode={setSelectedId}
          onClear={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
