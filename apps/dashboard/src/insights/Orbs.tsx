import type { KeyboardEvent } from "react";
import { euros, shortRun, signedEuros } from "~/insights/format";
import { orbitSpot, type OrbPlace } from "~/insights/geometry";
import { deltaFill, projectTone, RUN_TONES } from "~/insights/tones";
import type { ProjectInsight, RunInsight } from "~/insights/types";

type OrbProps = {
  project: ProjectInsight;
  index: number;
  place: OrbPlace;
  focused: boolean;
  hoverRun: RunInsight | null;
  onSelect: (project: string) => void;
  onHoverRun: (run: RunInsight | null) => void;
  onPickRun: (project: string, run: string) => void;
};

export function Orb({ project, index, place, focused, hoverRun, onSelect, onHoverRun, onPickRun }: OrbProps) {
  const tone = projectTone(index);
  const delta = project.before !== null && project.after !== null ? project.after - project.before : null;
  const grew = place.inner > place.r;
  const ring = place.r + (focused ? 22 : 16);
  const shownRun = hoverRun && hoverRun.project === project.id ? hoverRun : null;

  const keyed = (action: () => void) => (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  return (
    <g transform={`translate(${place.x} ${place.y})`}>
      <g
        role="button"
        tabIndex={0}
        aria-label={`${project.label}: ${project.runs.length} runs${delta !== null ? `, ${signedEuros(delta)} a month` : ""}`}
        aria-pressed={focused}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(project.id);
        }}
        onKeyDown={keyed(() => onSelect(project.id))}
        className="orb-body cursor-pointer outline-none"
      >
        <circle r={place.r * 1.35} className={`${tone.fill} opacity-10 animate-breathe`} />
        <circle r={place.r} className={`fill-surface ${tone.stroke}`} strokeWidth={focused ? 2.5 : 1.5} />
        {place.inner > 0 ? (
          <circle
            r={place.inner}
            className={`${grew ? "fill-transparent stroke-status-awaiting" : `${tone.fill} opacity-30`}`}
            strokeWidth={grew ? 2 : 0}
            strokeDasharray={grew ? "3 4" : undefined}
          />
        ) : null}
        {place.docked ? (
          <title>{project.label}</title>
        ) : focused ? (
          <FocusCore project={project} delta={delta} r={place.r} />
        ) : (
          <text y={6} textAnchor="middle" className="fill-fg type-label pointer-events-none">
            {project.before !== null ? euros(project.before) : "—"}
          </text>
        )}
      </g>

      {place.docked ? null : (
        <>
          <circle r={ring} className="fill-transparent stroke-border" strokeDasharray="1 6" strokeLinecap="round" strokeWidth={1.5} />
          <g className={shownRun ? "orbit orbit-paused" : "orbit"}>
            {project.runs.map((run, slot) => {
              const spot = orbitSpot(slot, project.runs.length, ring);
              const runTone = RUN_TONES[run.status];
              const live = run.status === "running" || run.status === "awaiting_approval";
              return (
                <g
                  key={run.id}
                  transform={`translate(${spot.x} ${spot.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Run ${shortRun(run.id)}, ${runTone.label}`}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => onHoverRun(run)}
                  onMouseLeave={() => onHoverRun(null)}
                  onFocus={() => onHoverRun(run)}
                  onBlur={() => onHoverRun(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPickRun(project.id, run.id);
                  }}
                  onKeyDown={keyed(() => onPickRun(project.id, run.id))}
                >
                  <circle r={14} className="fill-transparent" />
                  {live ? <circle r={6} className={`${runTone.fill} animate-beacon`} /> : null}
                  <circle r={shownRun?.id === run.id ? 8 : 5.5} className={`${runTone.fill} stroke-canvas transition-all`} strokeWidth={2} />
                </g>
              );
            })}
          </g>
          {focused ? null : (
            <g className="pointer-events-none" transform={`translate(0 ${ring + 30})`}>
              <text textAnchor="middle" className="fill-fg type-label">
                {project.label}
              </text>
              {shownRun ? (
                <RunCaption run={shownRun} />
              ) : delta !== null ? (
                <text y={20} textAnchor="middle" className={`${deltaFill(delta)} text-label font-semibold tabular-nums`}>
                  {signedEuros(delta)}/mo
                </text>
              ) : (
                <text y={20} textAnchor="middle" className="fill-fg-subtle text-caption">
                  no plan yet
                </text>
              )}
            </g>
          )}
        </>
      )}
    </g>
  );
}

function RunCaption({ run }: { run: RunInsight }) {
  const tone = RUN_TONES[run.status];
  const delta = run.before !== null && run.after !== null && run.status !== "failed" ? run.after - run.before : null;
  return (
    <text y={20} textAnchor="middle" className="text-caption tabular-nums">
      <tspan className="fill-fg-muted">{shortRun(run.id)} </tspan>
      <tspan className={tone.fill}>{tone.label}</tspan>
      {delta !== null ? <tspan className={deltaFill(delta)}> {signedEuros(delta)}</tspan> : null}
    </text>
  );
}

function FocusCore({ project, delta, r }: { project: ProjectInsight; delta: number | null; r: number }) {
  return (
    <g className="pointer-events-none" textAnchor="middle">
      <text y={-r * 0.18} className="fill-fg-subtle text-caption">
        {project.before !== null ? euros(project.before) : "—"}
        {project.after !== null ? ` → ${euros(project.after)}` : ""}
      </text>
      <text y={r * 0.2} className={`${delta === null ? "fill-fg-subtle" : deltaFill(delta)} type-figure`}>
        {delta === null ? "—" : signedEuros(delta)}
      </text>
      <text y={r * 0.2 + 22} className="fill-fg-subtle text-caption">
        a month
      </text>
    </g>
  );
}
