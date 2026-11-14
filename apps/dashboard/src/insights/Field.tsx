import { useState } from "react";
import { euros, percent, shortRun } from "~/insights/format";
import { fieldScales, project, type Box } from "~/insights/geometry";
import type { ProjectTone } from "~/insights/tones";
import type { CandidatePoint, RunInsight } from "~/insights/types";

type FieldProps = { box: Box; run: RunInsight; tone: ProjectTone };

export function Field({ box, run, tone }: FieldProps) {
  const [hover, setHover] = useState<string | null>(null);
  const baseline = { monthly: run.before, availability: run.availabilityBefore };
  const priced = run.candidates
    .filter((point) => point.monthly !== null && point.availability !== null)
    .sort((a, b) => layer(a) - layer(b));
  const scales = fieldScales(priced, baseline);
  const x = (value: number) => project(value, scales.cost, box.x, box.x + box.w);
  const y = (value: number) => project(value, scales.availability, box.y + box.h, box.y + 24);
  const chosen = priced.find((point) => point.picked) ?? priced.find((point) => point.winner) ?? null;
  const home = baseline.monthly !== null && baseline.availability !== null ? { x: x(baseline.monthly), y: y(baseline.availability) } : null;
  const hovered = priced.find((point) => point.id === hover) ?? null;

  return (
    <g key={run.id} className="animate-panel-in">
      <text x={box.x} y={box.y} className="fill-fg-subtle type-eyebrow">
        {shortRun(run.id)} · {priced.length} options
      </text>
      <Legend x={box.x + box.w} y={box.y} tone={tone} />

      <line x1={box.x} x2={box.x + box.w} y1={box.y + box.h + 8} y2={box.y + box.h + 8} className="stroke-border" />
      <line x1={box.x - 8} x2={box.x - 8} y1={box.y + 24} y2={box.y + box.h} className="stroke-border" />
      <text x={box.x} y={box.y + box.h + 26} className="fill-fg-subtle text-caption">
        {euros(scales.cost.min)}
      </text>
      <text x={box.x + box.w} y={box.y + box.h + 26} textAnchor="end" className="fill-fg-subtle text-caption">
        {euros(scales.cost.max)} /mo
      </text>
      <text x={box.x - 16} y={box.y + 30} textAnchor="end" className="fill-fg-subtle text-caption">
        {percent(scales.availability.max)}
      </text>
      <text x={box.x - 16} y={box.y + box.h} textAnchor="end" className="fill-fg-subtle text-caption">
        {percent(scales.availability.min)}
      </text>

      {home && chosen ? (
        <line
          x1={home.x}
          y1={home.y}
          x2={x(chosen.monthly!)}
          y2={y(chosen.availability!)}
          pathLength={1}
          className={`${tone.stroke} animate-draw`}
          strokeWidth={2}
        />
      ) : null}

      {priced.map((point) => (
        <Point key={point.id} point={point} cx={x(point.monthly!)} cy={y(point.availability!)} tone={tone} onHover={setHover} />
      ))}

      {home ? (
        <g transform={`translate(${home.x} ${home.y})`}>
          <circle r={9} className="fill-canvas stroke-fg" strokeWidth={2} />
          <text y={-16} textAnchor="middle" className="fill-fg-muted text-caption">
            today
          </text>
        </g>
      ) : null}

      {hovered ? <Tip point={hovered} cx={x(hovered.monthly!)} cy={y(hovered.availability!)} box={box} /> : null}

      {run.stopReason ? (
        <text x={box.x} y={box.y + box.h + 46} className="fill-status-failed text-caption">
          {clip(run.stopReason, 110)}
        </text>
      ) : null}
    </g>
  );
}

function Point({ point, cx, cy, tone, onHover }: { point: CandidatePoint; cx: number; cy: number; tone: ProjectTone; onHover: (id: string | null) => void }) {
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      onMouseEnter={() => onHover(point.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-default"
    >
      <circle r={14} className="fill-transparent" />
      {point.feasible ? (
        <>
          {point.picked ? <circle r={15} className={`${tone.fill} opacity-20 animate-breathe`} /> : null}
          <circle
            r={point.picked ? 8 : 5.5}
            className={point.picked ? `${tone.fill} stroke-canvas` : "fill-fg-muted stroke-canvas"}
            strokeWidth={2}
          />
          {point.winner && !point.picked ? <circle r={10} className="fill-transparent stroke-fg-muted" strokeDasharray="2 3" /> : null}
        </>
      ) : (
        <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" className="stroke-status-failed opacity-60" strokeWidth={2} strokeLinecap="round" />
      )}
    </g>
  );
}

function Tip({ point, cx, cy, box }: { point: CandidatePoint; cx: number; cy: number; box: Box }) {
  const width = 200;
  const left = cx + width + 20 > box.x + box.w ? cx - width - 16 : cx + 16;
  const top = Math.max(box.y, cy - 46);
  return (
    <g transform={`translate(${left} ${top})`} className="pointer-events-none">
      <rect width={width} height={52} rx={10} className="fill-surface stroke-border" />
      <text x={12} y={21} className="fill-fg text-caption font-semibold">
        {clip(point.id, 26)}
      </text>
      <text x={12} y={39} className="fill-fg-muted text-caption tabular-nums">
        {euros(point.monthly!)} · {percent(point.availability)}
        {point.feasible ? "" : " · blocked"}
      </text>
    </g>
  );
}

function Legend({ x, y, tone }: { x: number; y: number; tone: ProjectTone }) {
  return (
    <g transform={`translate(${x} ${y - 4})`} className="text-caption" textAnchor="end">
      <circle cx={-262} cy={0} r={5} className="fill-canvas stroke-fg" strokeWidth={2} />
      <text x={-218} y={4} className="fill-fg-subtle">today</text>
      <circle cx={-196} cy={0} r={5} className={tone.fill} />
      <text x={-150} y={4} className="fill-fg-subtle">picked</text>
      <circle cx={-128} cy={0} r={4} className="fill-fg-muted" />
      <text x={-78} y={4} className="fill-fg-subtle">viable</text>
      <path d="M -60 -4 L -52 4 M -52 -4 L -60 4" className="stroke-status-failed" strokeWidth={2} />
      <text x={0} y={4} className="fill-fg-subtle">blocked</text>
    </g>
  );
}

// Later layers draw on top, so the picked option is never hidden under a tie.
function layer(point: CandidatePoint): number {
  if (point.picked) return 3;
  if (point.winner) return 2;
  return point.feasible ? 1 : 0;
}

function clip(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
