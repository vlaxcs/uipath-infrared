import type { KeyboardEvent } from "react";
import type { ParallelTask } from "~/runs/parallelTasks";
import { STEP_META } from "~/runs/stepMeta";
import type { RunDetail, RunStep, StepState } from "~/runs/types";
import { workflowFlow } from "~/runs/workflowFlow";
import { workflowLayout, type EdgeTone, type Frame, type LayoutEdge, type LayoutNode, type NodeKind, type NodeTone } from "~/runs/workflowLayout";

type StepGraphProps = {
  run: RunDetail;
  states: Record<RunStep, StepState>;
  selectedStep: RunStep | null;
  onSelectStep: (step: RunStep) => void;
  parallel?: readonly ParallelTask[];
  trials?: number;
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

const EDGE_TONES: readonly EdgeTone[] = ["idle", "taken", "active", "returned", "later"];
const RADIUS: Record<NodeKind, number> = { terminal: 17, step: 8, check: 17, gate: 8, side: 8, later: 8 };
const MAX_TEXT = 34;

export function StepGraph({ run, states, selectedStep, onSelectStep, parallel = [], trials = 0 }: StepGraphProps) {
  const titles = Object.fromEntries(Object.entries(STEP_META).map(([id, meta]) => [id, meta.title])) as Record<RunStep, string>;
  const layout = workflowLayout(workflowFlow(run), run.project, titles, states, parallel, trials);
  const spine = layout.nodes.filter((node) => node.kind !== "side");
  const sides = layout.nodes.filter((node) => node.kind === "side");
  const besides = [...new Set(sides.map((node) => node.beside!))];

  return (
    <section aria-labelledby="steps-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="steps-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Pipeline
        </h2>
        <p className="text-caption text-fg-subtle">Select a step to inspect it.</p>
      </div>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="block h-auto w-176 max-w-none" aria-labelledby="steps-title">
          <defs>
            {EDGE_TONES.map((tone) => (
              <marker key={tone} id={`arrow-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className={ARROW_CLASS[tone]} />
              </marker>
            ))}
          </defs>

          <FrameBox frame={layout.loop} name="Revision loop" tone={layout.loop.used ? "returned" : "idle"} />
          <FrameBox frame={layout.phaseTwo} name="Phase 2" tone="later" />

          <g aria-hidden="true">
            {layout.edges.map((edge) => (
              <Edge key={edge.id} edge={edge} />
            ))}
          </g>

          <g role="list" aria-label="Steps">
            {spine.map((node) => (
              <g key={node.id} role="listitem">
                {node.step ? (
                  <StepButton node={node} step={node.step} selected={selectedStep === node.step} executing={run.step === node.step} onSelect={onSelectStep} />
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
                  <g key={node.id} role="listitem">
                    <Node node={node} />
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
      <text x={frame.x + 12} y={frame.y + 16} className="fill-fg-subtle text-caption font-semibold">
        {frame.label}
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

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

function Shape({ node, selected = false }: { node: LayoutNode; selected?: boolean }) {
  return (
    <>
      <title>{[node.label, node.sub, node.detail].filter(Boolean).join(" · ")}</title>
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
        {clip(node.label)}
      </text>
      <text x={node.x + 26} y={node.y + 29} className="fill-fg-muted text-caption">
        {clip(node.sub)}
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
