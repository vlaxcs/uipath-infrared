import { PROJECT_DELTA_LINES, type Segment, type TerminalLine, type Tone } from "../data/run";
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

export function PlanRail() {
  return (
    <section aria-labelledby="plan-rail-title" className="raised w-full max-w-full overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
        <h3 id="plan-rail-title" className="font-mono text-[11px] font-medium text-fg">
          project delta
        </h3>
        <p className="font-mono text-[10px] text-fg-muted">hover / focus</p>
      </header>
      <ol className="py-1">
        {PROJECT_DELTA_LINES.map((line) => (
          <PlanLineRow key={line.id} line={line} compact />
        ))}
      </ol>
    </section>
  );
}
