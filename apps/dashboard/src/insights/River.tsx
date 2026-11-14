import { FlaskConical, Monitor, MessageSquare, ArrowUpRight } from "lucide-react";
import type { KeyboardEvent } from "react";
import { ago, shortRun, signedEuros } from "~/insights/format";
import { lanePath, laneY, STEPS, stepX, type Box } from "~/insights/geometry";
import { deltaFill, RUN_TONES, VISIT_TONES, type ProjectTone } from "~/insights/tones";
import type { HumanCall, RunInsight, StepVisit } from "~/insights/types";

type RiverProps = {
  box: Box;
  runs: RunInsight[];
  tone: ProjectTone;
  selected: string | null;
  hovered: string | null;
  now: number;
  live: boolean;
  onSelect: (run: string) => void;
  onHover: (run: string | null) => void;
  runHref: (run: string) => string;
  onOpen: (run: string) => void;
};

const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  extract: "extract",
  investigate: "investigate",
  propose: "propose",
  evaluate: "evaluate",
  present: "pick",
  rehearse: "rehearse",
};

export function River({ box, runs, tone, selected, hovered, now, live, onSelect, onHover, runHref, onOpen }: RiverProps) {
  const shown = runs.slice(0, 4);
  const lit = hovered ?? selected;

  return (
    <g>
      {STEPS.map((step) => {
        const x = stepX(step, box);
        return (
          <g key={step}>
            <line x1={x} x2={x} y1={box.y + 34} y2={box.y + box.h - 8} className="stroke-border" strokeDasharray="2 5" />
            <text x={x} y={box.y + 20} textAnchor="middle" className="fill-fg-subtle text-caption">
              {STEP_LABELS[step]}
            </text>
          </g>
        );
      })}

      {shown.map((run, index) => {
        const y = laneY(index, shown.length, box);
        const dim = lit !== null && lit !== run.id;
        const isSelected = selected === run.id;
        const select = () => onSelect(run.id);
        const keyed = (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            select();
          }
        };
        return (
          <g key={run.id}>
            <g
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Run ${shortRun(run.id)}, ${RUN_TONES[run.status].label}`}
              className={`lane cursor-pointer outline-none transition-opacity duration-300 ${dim ? "opacity-40" : "opacity-100"}`}
              onClick={(event) => {
                event.stopPropagation();
                select();
              }}
              onKeyDown={keyed}
              onMouseEnter={() => onHover(run.id)}
              onMouseLeave={() => onHover(null)}
            >
              <rect
                x={box.x - 10}
                y={y - 30}
                width={box.w + 20}
                height={60}
                rx={14}
                className={isSelected ? "fill-surface-muted" : "fill-transparent"}
              />
              <text x={box.x} y={y - 12} className="fill-fg text-caption font-semibold tabular-nums">
                {shortRun(run.id)}
              </text>
              <text x={box.x + 44} y={y - 12} className="fill-fg-subtle text-caption">
                {ago(run.endedAt, now)}
              </text>
              <path
                key={`${run.id}:${run.visits.length}`}
                d={lanePath(run.visits, y, box)}
                pathLength={1}
                className={`fill-transparent ${tone.stroke} animate-draw`}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {run.visits.map((visit, slot) => (
                <VisitMark key={`${visit.step}:${slot}`} visit={visit} x={stepX(visit.step, box)} y={y} />
              ))}
              {gateCalls(run).map(({ call, step }, slot) => (
                <CallBadge key={slot} call={call} x={stepX(step, box) + 16} y={y + 18} />
              ))}
              <Outcome run={run} x={stepX("rehearse", box) + 26} y={y} />
            </g>
            {live && isSelected ? (
              <a
                href={runHref(run.id)}
                aria-label={`Open run ${shortRun(run.id)}`}
                className="open-run cursor-pointer text-fg-muted outline-none hover:text-fg"
                onClick={(event) => {
                  event.stopPropagation();
                  // A plain click stays in the app; a modified click opens a new tab from the href.
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onOpen(run.id);
                }}
              >
                <circle cx={box.x + box.w - 2} cy={y - 16} r={11} className="fill-surface stroke-border" />
                <ArrowUpRight x={box.x + box.w - 10} y={y - 24} width={16} height={16} />
              </a>
            ) : null}
          </g>
        );
      })}

      {runs.length > shown.length ? (
        <text x={box.x} y={box.y + box.h + 4} className="fill-fg-subtle text-caption">
          +{runs.length - shown.length} older
        </text>
      ) : null}
    </g>
  );
}

function VisitMark({ visit, x, y }: { visit: StepVisit; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {visit.state === "current" || visit.state === "awaiting" ? (
        <circle r={7} className={`${visit.state === "current" ? "fill-status-running" : "fill-status-awaiting"} animate-beacon`} />
      ) : null}
      {visit.gate ? (
        <rect
          x={-7}
          y={-7}
          width={14}
          height={14}
          rx={2.5}
          transform="rotate(45)"
          className={visit.gateOpen ? "fill-status-awaiting stroke-canvas" : "fill-fg stroke-canvas"}
          strokeWidth={2.5}
        />
      ) : (
        <circle r={visit.revision > 0 ? 5 : 6} className={VISIT_TONES[visit.state]} strokeWidth={2.5} />
      )}
      <title>
        {visit.step}
        {visit.revision > 0 ? ` · revision ${visit.revision}` : ""}
      </title>
    </g>
  );
}

function CallBadge({ call, x, y }: { call: HumanCall; x: number; y: number }) {
  const Icon = call.surface === "slack" ? MessageSquare : Monitor;
  return (
    <g transform={`translate(${x} ${y})`} className="text-fg-muted">
      <circle r={9} className="fill-surface stroke-border" />
      <Icon x={-5.5} y={-5.5} width={11} height={11} />
      <title>{`${call.by} on ${call.surface}: ${call.reason}`}</title>
    </g>
  );
}

function Outcome({ run, x, y }: { run: RunInsight; x: number; y: number }) {
  if (run.status === "failed") {
    return (
      <text x={x} y={y + 5} className="fill-status-failed text-label font-semibold">
        stopped
        <title>{run.stopReason ?? "stopped"}</title>
      </text>
    );
  }
  if (run.status === "awaiting_approval" || run.status === "running") {
    return (
      <text x={x} y={y + 5} className={`${RUN_TONES[run.status].fill} text-label font-semibold`}>
        {run.awaiting === "layout" ? "pick" : run.awaiting === "plan" ? "approve" : "…"}
      </text>
    );
  }
  const delta = run.before !== null && run.after !== null ? run.after - run.before : null;
  return (
    <g>
      <text x={x} y={y + 5} className={`${delta === null ? "fill-fg-subtle" : deltaFill(delta)} text-label font-semibold tabular-nums`}>
        {delta === null ? "done" : signedEuros(delta)}
      </text>
      {run.rehearsal ? (
        <g className={run.rehearsal.passed ? "text-status-completed" : "text-status-failed"}>
          <FlaskConical x={x} y={y + 12} width={12} height={12} />
          <title>{`rehearsal ${run.rehearsal.passed ? "passed" : "failed"}${run.rehearsal.measured !== null ? `, ${run.rehearsal.measured}%` : ""}`}</title>
        </g>
      ) : null}
    </g>
  );
}

function gateCalls(run: RunInsight): { call: HumanCall; step: StepVisit["step"] }[] {
  return run.calls
    .filter((call) => call.kind === "pick_layout" || call.kind === "approve_plan")
    .map((call) => ({ call, step: call.kind === "pick_layout" ? "present" : "rehearse" }));
}
