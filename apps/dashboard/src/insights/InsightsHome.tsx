import { useEffect, useMemo, useState } from "react";
import { pulseOf } from "~/insights/derive";
import { Field } from "~/insights/Field";
import { placeOrbs, STAGES } from "~/insights/geometry";
import { Hero } from "~/insights/Hero";
import { useFrame, useTween } from "~/insights/motion";
import { Orb } from "~/insights/Orbs";
import { River } from "~/insights/River";
import { sampleInsightSource } from "~/insights/sampleInsightSource";
import { projectTone } from "~/insights/tones";
import type { InsightReader, ProjectInsight, RunInsight } from "~/insights/types";
import { useInsights } from "~/insights/useInsights";

type InsightsHomeProps = {
  source: InsightReader;
  runHref: (id: string) => string;
  onOpenRun: (id: string) => void;
};

export function InsightsHome({ source, runHref, onOpenRun }: InsightsHomeProps) {
  const reader = source.mode === "live" ? source : sampleInsightSource;
  const state = useInsights(reader);

  if (state.status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-fg-subtle animate-breathe">·</div>;
  }
  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-label text-fg-muted">
        The orchestrator did not answer: {state.message}
      </div>
    );
  }
  if (state.projects.length === 0) {
    return <div className="flex min-h-screen items-center justify-center text-label text-fg-muted">No runs yet. Analyze a project to start.</div>;
  }
  return <Canvas projects={state.projects} live={reader.mode === "live"} stale={state.stale} runHref={runHref} onOpenRun={onOpenRun} />;
}

type CanvasProps = Pick<InsightsHomeProps, "runHref" | "onOpenRun"> & { projects: ProjectInsight[]; live: boolean; stale: boolean };

function Canvas({ projects, live, stale, runHref, onOpenRun }: CanvasProps) {
  const frame = useFrame();
  const stage = STAGES[frame];
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverRun, setHoverRun] = useState<RunInsight | null>(null);
  const [hoverLane, setHoverLane] = useState<string | null>(null);
  const now = useNow();

  const focused = projects.find((project) => project.id === focus) ?? null;
  const focusIndex = focused ? projects.indexOf(focused) : -1;
  const selectedRun = focused?.runs.find((run) => run.id === selected) ?? null;

  const places = placeOrbs(projects, frame, focus);
  const target: Record<string, number> = { river: focused ? 1 : 0, web: focused ? 0 : 1 };
  for (const [id, place] of Object.entries(places)) {
    target[`${id}:x`] = place.x;
    target[`${id}:y`] = place.y;
    target[`${id}:r`] = place.r;
    target[`${id}:i`] = place.inner;
  }
  const t = useTween(target);
  const pulse = useMemo(() => pulseOf(focused ? [focused] : projects), [focused, projects]);

  const open = (id: string) => {
    setFocus(id === focus ? null : id);
    setSelected(null);
    setHoverRun(null);
  };
  const pick = (project: string, run: string) => {
    setFocus(project);
    setSelected(run);
    setHoverRun(null);
  };
  const close = () => {
    setFocus(null);
    setSelected(null);
  };

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  useEffect(() => {
    if (focused && !selected && focused.runs[0]) setSelected(focused.runs[0].id);
  }, [focused, selected]);

  const ordered = focused ? [...projects.filter((project) => project.id !== focus), focused] : projects;
  const web = webPath(projects.map((project) => ({ x: t[`${project.id}:x`] ?? 0, y: t[`${project.id}:y`] ?? 0 })));

  return (
    <section aria-label="Infrared at a glance" className="relative min-h-screen overflow-hidden pb-24">
      <Hero pulse={pulse} focus={focused ? { label: focused.label, tone: projectTone(focusIndex) } : null} sample={!live} stale={stale} />
      <svg
        viewBox={`0 0 ${stage.width} ${stage.height}`}
        className="mx-auto mt-6 block h-auto w-full max-w-7xl select-none"
        role="group"
        aria-label={focused ? `${focused.label}: runs` : "Use cases"}
        onClick={close}
      >
        <defs>
          <pattern id="insight-dots" width={28} height={28} patternUnits="userSpaceOnUse">
            <circle cx={2} cy={2} r={1} className="fill-border" />
          </pattern>
        </defs>
        <rect width={stage.width} height={stage.height} fill="url(#insight-dots)" className="opacity-70" />
        <path d={web} className="fill-transparent stroke-border-strong" strokeDasharray="2 8" strokeWidth={1.5} opacity={t.web} />

        {ordered.map((project) => {
          const index = projects.indexOf(project);
          return (
            <Orb
              key={project.id}
              project={project}
              index={index}
              place={{
                x: t[`${project.id}:x`] ?? 0,
                y: t[`${project.id}:y`] ?? 0,
                r: t[`${project.id}:r`] ?? 0,
                inner: t[`${project.id}:i`] ?? 0,
                docked: places[project.id]?.docked ?? false,
              }}
              focused={project.id === focus}
              hoverRun={hoverRun}
              onSelect={open}
              onHoverRun={setHoverRun}
              onPickRun={pick}
            />
          );
        })}

        {focused && (t.river ?? 0) > 0.02 ? (
          <g opacity={t.river}>
            <River
              box={stage.river}
              runs={focused.runs}
              tone={projectTone(focusIndex)}
              selected={selected}
              hovered={hoverLane}
              now={now}
              live={live}
              onSelect={setSelected}
              onHover={setHoverLane}
              runHref={runHref}
              onOpen={onOpenRun}
            />
            {selectedRun && selectedRun.candidates.length > 0 ? (
              <Field box={stage.field} run={selectedRun} tone={projectTone(focusIndex)} />
            ) : null}
          </g>
        ) : null}
      </svg>
      {focused ? null : (
        <p className="pointer-events-none mt-2 text-center text-caption text-fg-subtle">
          Size is spend today · the inner disc is spend after the plan · dots are runs
        </p>
      )}
    </section>
  );
}

function webPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const mid = (from.x + to.x) / 2;
    path += ` C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
  }
  return path;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
