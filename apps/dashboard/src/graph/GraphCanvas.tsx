import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { FocusStates, VisibleGraph } from "~/graph/filters";
import {
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  edgePath,
  type PositionedNode,
  type ViewTransform,
} from "~/graph/layout";
import {
  CATEGORY_SHAPE,
  EDGE_STATE_CLASS,
  EDGE_STYLE,
  NODE_STATE_CLASS,
  STATUS_META,
  shapePath,
  truncateLabel,
} from "~/graph/style";

type GraphCanvasProps = {
  layout: readonly PositionedNode[];
  visible: VisibleGraph;
  focus: FocusStates;
  selectedId: string | null;
  showLabels: boolean;
  view: ViewTransform;
  stackClasses: ReadonlyMap<string, { fill: string; swatch: string }>;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onZoom: (factor: number, anchorX: number, anchorY: number) => void;
  onPan: (dx: number, dy: number) => void;
};

export function GraphCanvas({
  layout,
  visible,
  focus,
  selectedId,
  showLabels,
  view,
  stackClasses,
  onSelect,
  onHover,
  onZoom,
  onPan,
}: GraphCanvasProps) {
  const markerId = `graph-arrow-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  const zoomRef = useRef(onZoom);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  viewRef.current = view;
  zoomRef.current = onZoom;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const worldX = ((event.clientX - rect.left) / rect.width) * GRAPH_WIDTH;
      const worldY = ((event.clientY - rect.top) / rect.height) * GRAPH_HEIGHT;
      const current = viewRef.current;

      zoomRef.current(
        Math.exp(-event.deltaY * 0.0015),
        (worldX - current.x) / current.k,
        (worldY - current.y) / current.k,
      );
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const positionedById = new Map(layout.map((node) => [node.id, node]));
  const nodes = visible.nodes.flatMap((node) => {
    const positioned = positionedById.get(node.id);
    return positioned ? [positioned] : [];
  });
  const edges = visible.edges.flatMap((edge) => {
    const from = positionedById.get(edge.from);
    const to = positionedById.get(edge.to);
    return from && to ? [{ edge, from, to }] : [];
  });

  if (nodes.length === 0) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-card border border-border bg-surface p-6">
        <p className="text-body text-fg-muted">No components match these filters.</p>
      </div>
    );
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    panStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!panStart.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dx = ((event.clientX - panStart.current.x) / rect.width) * GRAPH_WIDTH;
    const dy = ((event.clientY - panStart.current.y) / rect.height) * GRAPH_HEIGHT;
    panStart.current = { x: event.clientX, y: event.clientY };
    onPan(dx, dy);
  };

  const handlePointerUp = () => {
    panStart.current = null;
  };

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <svg
        ref={svgRef}
        role="group"
        aria-label="Dependency graph"
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        className="h-auto w-full cursor-grab touch-none select-none"
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onSelect(null);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" className="fill-graph-edge" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g aria-hidden="true">
            {edges.map(({ edge, from, to }) => {
              const style = EDGE_STYLE[edge.kind];
              const state = focus.edges[edge.key] ?? "normal";
              return (
                <path
                  key={edge.key}
                  data-graph-edge
                  data-edge-key={edge.key}
                  data-state={state}
                  d={edgePath(from, to)}
                  fill="none"
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  markerEnd={style.arrow ? `url(#${markerId})` : undefined}
                  className={EDGE_STATE_CLASS[state]}
                >
                  <title>{`${from.label} → ${to.label} (${style.label})`}</title>
                </path>
              );
            })}
          </g>
          <g>
            {nodes.map((node) => {
              const status = STATUS_META[node.status];
              const state = focus.nodes[node.id] ?? "normal";
              const selected = node.id === selectedId;
              const fill = stackClasses.get(node.stackId)?.fill ?? "fill-fg-subtle";

              return (
                <g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.label}, ${node.kind}, ${status.label}`}
                  aria-pressed={selected}
                  data-node-id={node.id}
                  data-state={state}
                  transform={`translate(${node.x} ${node.y})`}
                  className={`group cursor-pointer ${NODE_STATE_CLASS[state]}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(node.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                  onMouseEnter={() => onHover(node.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(node.id)}
                  onBlur={() => onHover(null)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <circle
                    r={node.r + 8}
                    fill="none"
                    strokeWidth={2}
                    className="stroke-focus opacity-0 group-focus-visible:opacity-100"
                  />
                  {status.haloClass ? (
                    <circle
                      r={node.r + 5}
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray={node.status === "idle" ? "4 3" : undefined}
                      className={status.haloClass}
                    />
                  ) : null}
                  {selected ? (
                    <circle r={node.r + 9} fill="none" strokeWidth={2} className="stroke-accent" />
                  ) : null}
                  <path
                    d={shapePath(CATEGORY_SHAPE[node.category], node.r)}
                    strokeWidth={1.5}
                    fillOpacity={0.85}
                    className={`${fill} stroke-surface`}
                  />
                  {showLabels ? (
                    <text
                      y={node.r + 14}
                      textAnchor="middle"
                      paintOrder="stroke"
                      strokeWidth={3}
                      className="fill-fg stroke-surface text-caption"
                    >
                      {truncateLabel(node.label)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
