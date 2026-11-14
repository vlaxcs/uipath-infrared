import type { KeyboardEvent } from "react";
import type { ParallelTask } from "~/runs/parallelTasks";
import { STEP_META } from "~/runs/stepMeta";
import type { Gate, RunDetail, RunStep, StepState } from "~/runs/types";
import { workflowFlow } from "~/runs/workflowFlow";
import { workflowLayout, type EdgeTone, type Frame, type LayoutEdge, type LayoutNode, type NodeKind, type NodeTone } from "~/runs/workflowLayout";

type StepGraphProps = {
  run: RunDetail;
  states: Record<RunStep, StepState>;
  selectedStep: RunStep | null;
  onSelectStep: (step: RunStep) => void;
  parallel?: readonly ParallelTask[];
  trials?: number;
  onSelectPlan?: (candidate: string) => void;
  onSelectStart?: () => void;
  startSelected?: boolean;
  onSelectGate?: (gate: Gate) => void;
};

const NODE_CLASS: Record<NodeTone, string> = {
  pending: "fill-surface stroke-border-strong",
  current: "fill-surface stroke-status-running",
  awaiting: "fill-surface stroke-status-awaiting",
  done: "fill-surface stroke-status-completed",
  failed: "fill-surface stroke-status-failed",
  later: "fill-surface-muted stroke-border",
};

const GLYPH_CLASS: Record<NodeTone, string> = {
  pending: "fill-status-neutral",
  current: "fill-status-running",
  awaiting: "fill-status-awaiting",
  done: "fill-status-completed",
  failed: "fill-status-failed",
  later: "fill-border-strong",
};

const EDGE_CLASS: Record<EdgeTone, string> = {
  idle: "stroke-border-strong",
  taken: "stroke-status-completed",
  active: "stroke-status-running",
  returned: "stroke-status-awaiting",
  later: "stroke-border",
};

const ARROW_CLASS: Record<EdgeTone, string> = {
  idle: "fill-border-strong",
  taken: "fill-status-completed",
  active: "fill-status-running",
  returned: "fill-status-awaiting",
  later: "fill-border",
};

const FRAME_CLASS: Record<RunDetail["status"], string> = {
  running: "border-status-running text-status-running animate-frame-pulse",
  awaiting_approval: "border-status-awaiting text-status-awaiting animate-frame-pulse",
  completed: "border-status-completed",
  failed: "border-status-failed",
};

const isDecision = (node: LayoutNode) => node.kind === "gate" && node.tone === "awaiting";

const EDGE_TONES: readonly EdgeTone[] = ["idle", "taken", "active", "returned", "later"];
const RADIUS: Record<NodeKind, number> = { terminal: 17, step: 8, check: 17, gate: 8, side: 8, later: 8 };
/* Caption text is about 6 units a character; the glyph and padding take 34. */
const textFits = (width: number) => Math.floor((width - 34) / 6);

export function StepGraph({ run, states, selectedStep, onSelectStep, parallel = [], trials = 0, onSelectPlan, onSelectStart, startSelected = false, onSelectGate }: StepGraphProps) {
  const titles = Object.fromEntries(Object.entries(STEP_META).map(([id, meta]) => [id, meta.title])) as Record<RunStep, string>;
  const layout = workflowLayout(workflowFlow(run), run.project, titles, states, parallel, trials);
  const spine = layout.nodes.filter((node) => node.kind !== "side");
  const sides = layout.nodes.filter((node) => node.kind === "side");
  const besides = [...new Set(sides.map((node) => node.beside!))];
  /* While a person has to decide, everything but the decision steps back. */
  const deciding = layout.nodes.some(isDecision);
  const dim = (node?: LayoutNode) => (deciding && !(node && isDecision(node)) ? "opacity-35 transition-opacity hover:opacity-100" : "transition-opacity");

  return (
    <section aria-labelledby="steps-title" className="flex min-h-0 flex-1 flex-col">
      <h2 id="steps-title" className="sr-only">
        Pipeline
      </h2>
      <div data-status={run.status} className={`min-h-0 flex-1 overflow-auto rounded-card border bg-canvas ${FRAME_CLASS[run.status]}`}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="block h-auto w-176 max-w-none" aria-labelledby="steps-title">
          <defs>
            {EDGE_TONES.map((tone) => (
              <marker key={tone} id={`arrow-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className={ARROW_CLASS[tone]} />
              </marker>
            ))}
          </defs>

          <g className={dim()}>
            <FrameBox frame={layout.loop} name="Revision loop" tone={layout.loop.used ? "returned" : "idle"} />
            <FrameBox frame={layout.phaseTwo} name="Phase 2" tone="later" />
          </g>

          <g aria-hidden="true" className={dim()}>
            {layout.edges.map((edge) => (
              <Edge key={edge.id} edge={edge} />
            ))}
          </g>

          <g role="list" aria-label="Steps">
            {spine.map((node) => (
              <g key={node.id} role="listitem" className={dim(node)}>
                {node.step ? (
                  <StepButton node={node} step={node.step} selected={selectedStep === node.step} executing={run.step === node.step} onSelect={onSelectStep} />
                ) : node.kind === "gate" && node.tone === "awaiting" && onSelectGate ? (
                  <NodeButton node={node} label={node.label} onSelect={() => onSelectGate(node.id === "plan-gate" ? "plan" : "layout")} />
                ) : node.id === "start" && onSelectStart ? (
                  <NodeButton node={node} label={`Open the starting configuration of ${run.project}`} selected={startSelected} onSelect={onSelectStart} />
                ) : (
                  <Node node={node} />
                )}
              </g>
            ))}
          </g>

          {besides.map((beside) => (
            <g key={beside} role="list" aria-label={`In parallel with ${STEP_META[beside].title}`}>
              {sides
                .filter((node) => node.beside === beside)
                .map((node) => (
                  <g key={node.id} role="listitem" className={dim(node)}>
                    {node.candidate && onSelectPlan ? <NodeButton node={node} label={`Open the migration plan of ${node.candidate}`} onSelect={() => onSelectPlan(node.candidate!)} /> : <Node node={node} />}
                  </g>
                ))}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function FrameBox({ frame, name, tone }: { frame: Frame; name: string; tone: EdgeTone }) {
  return (
    <g role="group" aria-label={name}>
      <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx={12} className={`fill-none ${EDGE_CLASS[tone]}`} strokeWidth={1.5} strokeDasharray="6 5" />
      <text x={frame.x + 12} y={frame.y + 18} className="fill-fg-subtle text-caption font-semibold">
        {frame.label}
      </text>
      <text x={frame.x + 12} y={frame.y + 33} className="fill-fg-subtle text-caption">
        {frame.sub}
      </text>
    </g>
  );
}

function Edge({ edge }: { edge: LayoutEdge }) {
  const dashed = edge.tone === "later" || (edge.returns && edge.tone === "idle");
  return (
    <g>
      <path
        d={edge.path}
        className={`fill-none ${EDGE_CLASS[edge.tone]}`}
        strokeWidth={edge.tone === "returned" ? 2.5 : 1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd={`url(#arrow-${edge.tone})`}
      />
      {edge.label ? (
        <text x={edge.labelX} y={edge.labelY} className="fill-fg-subtle text-caption">
          {edge.label}
        </text>
      ) : null}
    </g>
  );
}

function clip(text: string, width: number): string {
  const max = textFits(width);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function Shape({ node, selected = false }: { node: LayoutNode; selected?: boolean }) {
  return (
    <>
      <title>{[node.label, node.sub, node.detail].filter(Boolean).join(" · ")}</title>
      {node.tone === "awaiting" && node.kind === "gate" ? (
        <rect
          data-pulse
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={RADIUS[node.kind]}
          className="origin-center animate-node-pulse fill-none stroke-status-awaiting [transform-box:fill-box]"
          strokeWidth={2}
        />
      ) : null}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={RADIUS[node.kind]}
        className={`${selected ? "fill-surface stroke-accent" : NODE_CLASS[node.tone]} group-focus-visible:stroke-focus`}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={node.kind === "later" || node.kind === "side" ? "5 4" : undefined}
      />
      <Glyph node={node} />
      <text x={node.x + 26} y={node.y + 15} className="fill-fg text-caption font-semibold">
        {clip(node.label, node.width)}
      </text>
      <text x={node.x + 26} y={node.y + 29} className="fill-fg-muted text-caption">
        {clip(node.sub, node.width)}
      </text>
    </>
  );
}

function Glyph({ node }: { node: LayoutNode }) {
  const cx = node.x + 13;
  const cy = node.y + node.height / 2;
  const className = GLYPH_CLASS[node.tone];
  if (node.kind === "check") return <path d={`M ${cx} ${cy - 6} L ${cx + 6} ${cy} L ${cx} ${cy + 6} L ${cx - 6} ${cy} Z`} className={className} />;
  if (node.kind === "gate") return <path d={`M ${cx - 5} ${cy + 6} Q ${cx} ${cy - 2} ${cx + 5} ${cy + 6} Z M ${cx} ${cy - 7} a 3 3 0 1 0 0.01 0 Z`} className={className} />;
  return <circle cx={cx} cy={cy} r={4} className={className} />;
}

function Node({ node }: { node: LayoutNode }) {
  return (
    <g>
      <Shape node={node} />
    </g>
  );
}

function NodeButton({ node, label, selected = false, onSelect }: { node: LayoutNode; label: string; selected?: boolean; onSelect: () => void }) {
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <g role="button" tabIndex={0} aria-label={label} onClick={onSelect} onKeyDown={onKeyDown} className="group cursor-pointer outline-none">
      <Shape node={node} selected={selected} />
    </g>
  );
}

type StepButtonProps = { node: LayoutNode; step: RunStep; selected: boolean; executing: boolean; onSelect: (step: RunStep) => void };

function StepButton({ node, step, selected, executing, onSelect }: StepButtonProps) {
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(step);
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-current={executing ? "step" : undefined}
      onClick={() => onSelect(step)}
      onKeyDown={onKeyDown}
      className="group cursor-pointer outline-none"
    >
      <Shape node={node} selected={selected} />
    </g>
  );
}
