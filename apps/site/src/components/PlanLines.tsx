import {
  PROJECT_DELTA_LINES,
  PROJECT_DELTAS,
  formatK,
  type Segment,
  type TerminalLine,
  type Tone,
} from "../data/run";
import { usePlanLink } from "./plan-link-context";

const TONE: Record<Tone, string> = {
  muted: "text-fg-muted",
  strong: "text-fg",
  warm: "text-accent-lip",
  cool: "text-cluster-sage",
  ice: "text-cluster-ice",
};

function SegmentText({ segment }: { segment: Segment }) {
  return <span className={segment.tone ? TONE[segment.tone] : undefined}>{segment.text}</span>;
}

export function PlanLineRow({
  line,
  lineNumber,
  showNumber = false,
  compact = false,
}: {
  line: TerminalLine;
  lineNumber?: number;
  showNumber?: boolean;
  compact?: boolean;
}) {
  const { selection, selectLine, clearLine } = usePlanLink();
  const interactive = line.projectIds.length > 0 || line.resourceIds.length > 0;
  const active = selection.lineIds.includes(line.id);

  if (line.kind === "blank") {
    return (
      <li aria-hidden="true" className={`flex ${compact ? "h-2" : "h-3"}`}>
        {showNumber && (
          <span
            aria-hidden="true"
            className="w-7 flex-none select-none pr-3 text-right font-mono text-[10px] tabular-nums text-fg-muted/45"
          >
            {String(lineNumber).padStart(2, "0")}
          </span>
        )}
      </li>
    );
  }

  return (
    <li
      tabIndex={line.focusable ? 0 : undefined}
      aria-current={active ? "true" : undefined}
      onPointerEnter={interactive ? () => selectLine(line) : undefined}
      onPointerLeave={interactive ? () => clearLine(line.id) : undefined}
      onFocus={interactive ? () => selectLine(line) : undefined}
      onBlur={interactive ? () => clearLine(line.id) : undefined}
      className={`flex items-baseline whitespace-pre rounded-[1px] transition-colors ${
        interactive ? "cursor-crosshair hover:bg-fg/[0.04]" : ""
      } ${active ? "bg-fg/[0.08] shadow-[inset_2px_0_0_#ece8dc]" : ""} ${
        compact ? "px-2 py-[3px]" : "px-2 py-[1.5px]"
      }`}
    >
      {showNumber && (
        <span
          aria-hidden="true"
          className="w-7 flex-none select-none pr-3 text-right font-mono text-[10px] tabular-nums text-fg-muted/45"
        >
          {String(lineNumber).padStart(2, "0")}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 whitespace-pre font-mono tabular-nums ${
          compact ? "text-[11px] leading-[1.55]" : "text-[11.5px] leading-[1.55]"
        } ${line.kind === "heading" ? "pt-2 font-medium text-fg" : ""} ${
          line.kind === "status" ? "text-cluster-sage" : ""
        }`}
      >
        {line.segments.map((segment, index) => (
          <SegmentText key={index} segment={segment} />
        ))}
      </span>
    </li>
  );
}

export function ProjectDeltaStrip({
  nearest,
}: {
  nearest?: { id: string; cost: number; zone: string } | null;
}) {
  const { selection, selectLine, clearLine } = usePlanLink();

  return (
    <section aria-labelledby="project-delta-title" className="min-w-0">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <h3 id="project-delta-title" className="shrink-0 font-mono text-[10px] font-medium text-fg">
          project delta
        </h3>
        <div className="flex min-w-0 flex-1 items-baseline gap-2 font-mono text-[10px] tabular-nums text-fg-muted">
          <span className="shrink-0">nearest</span>
          {nearest ? (
            <span className="min-w-0 truncate">
              <span className="text-fg">{nearest.id}</span> / {nearest.cost.toFixed(2)}k USD/mo / {nearest.zone}
            </span>
          ) : (
            <span>--</span>
          )}
        </div>
        <p className="shrink-0 font-mono text-[10px] text-fg-muted">hover / focus</p>
      </header>
      <ol className="grid grid-cols-2 sm:grid-cols-3 horizontal:grid-cols-6">
        {PROJECT_DELTAS.map((delta) => {
          const line = PROJECT_DELTA_LINES.find((entry) => entry.id === delta.lineId)!;
          const active = selection.lineIds.includes(delta.lineId);
          return (
            <li
              key={delta.project}
              tabIndex={0}
              aria-current={active ? "true" : undefined}
              onPointerEnter={() => selectLine(line)}
              onPointerLeave={() => clearLine(line.id)}
              onFocus={() => selectLine(line)}
              onBlur={() => clearLine(line.id)}
              className={`min-w-0 cursor-crosshair border-r border-b border-line px-3 py-2 transition-colors hover:bg-fg/[0.04] ${
                active ? "bg-fg/[0.08] shadow-[inset_0_-2px_0_#ece8dc]" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 font-mono text-[10px]">
                <span className="truncate text-fg">
                  <span className="text-cluster-ice">~</span> {delta.label}
                </span>
                <span className="shrink-0 tabular-nums text-fg-muted">
                  zones {delta.zonesNow}-&gt;{delta.zonesNext}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 whitespace-nowrap font-mono text-[10px] tabular-nums">
                <span>
                  <span className="text-fg-muted">{formatK(delta.current)}</span>
                  <span className="text-fg-muted"> -&gt; </span>
                  <span className="text-fg">{formatK(delta.planned)}</span>
                </span>
                <span className={delta.difference <= 0 ? "text-cluster-sage" : "text-accent-lip"}>
                  {delta.difference <= 0 ? `-${Math.abs(delta.difference).toFixed(1)}k` : `+${delta.difference.toFixed(1)}k`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
