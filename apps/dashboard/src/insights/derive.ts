import type { RunDetail, RunEvent } from "~/runs/types";
import type {
  CandidatePoint,
  HumanCall,
  ProjectInsight,
  Pulse,
  RehearsalOutcome,
  RunArtifacts,
  RunInsight,
  StepVisit,
} from "~/insights/types";

export function deriveRun(run: RunDetail, artifacts: RunArtifacts): RunInsight {
  const events = [...run.events].sort((a, b) => a.seq - b.seq);
  const calls = humanCalls(events);
  const layout = [...calls].reverse().find((call) => call.kind === "pick_layout")?.layout ?? null;
  const result = record(artifacts.result);
  const baseline = record(result?.baseline);
  const winner = typeof result?.winner === "string" ? result.winner : null;
  const candidates = candidatePoints(result?.candidates, layout, winner);
  const chosen = candidates.find((candidate) => candidate.picked) ?? candidates.find((candidate) => candidate.winner);
  const last = events[events.length - 1];
  const startedAt = time(events[0]?.at ?? run.started_at);

  return {
    id: run.id,
    project: run.project,
    status: run.status,
    ...(run.awaiting ? { awaiting: run.awaiting } : {}),
    startedAt,
    endedAt: time(last?.at ?? run.updated_at),
    visits: stepVisits(events, run.status),
    revisions: events.filter((event) => event.decision?.kind === "revise").length,
    calls,
    layout,
    winner,
    before: number(baseline?.monthly_eur),
    after: chosen?.monthly ?? null,
    availabilityBefore: number(baseline?.availability_pct),
    availabilityAfter: chosen?.availability ?? null,
    candidates,
    findings: list(record(artifacts.findings)?.findings).length,
    components: list(record(artifacts.infra)?.components).length,
    rehearsal: rehearsalOutcome(artifacts.rehearsal),
    stopReason: run.status === "failed" ? (last?.decision?.reason ?? null) : null,
  };
}

export function stepVisits(events: readonly RunEvent[], status: RunDetail["status"]): StepVisit[] {
  const visits: StepVisit[] = [];
  let open: StepVisit | null = null;

  for (const event of events) {
    const at = time(event.at);
    if (event.status === "started" || !open || open.step !== event.step) {
      if (open) settle(open);
      open = { step: event.step, revision: event.revision, start: at, end: at, state: "current" };
      visits.push(open);
    }
    open.end = at;
    if (event.status === "failed") open.state = "failed";
    if (event.status === "completed") open.state = "done";
    if (event.status === "awaiting_approval" && event.gate) {
      open.gate = event.gate;
      open.gateOpen = true;
      open.state = "awaiting";
    }
    // keep_analyses only narrows the options; the layout gate stays open until the pick.
    const kind = event.decision?.kind;
    if (kind && kind !== "keep_analyses") {
      if (open.gate) open.gateOpen = false;
      if (kind === "stop") open.state = "failed";
      else if (kind === "pick_layout") open.state = "current";
      else if (open.state !== "failed") open.state = "done";
    }
  }

  if (open && status === "completed") settle(open);
  if (open && status === "failed" && (open.state === "current" || open.state === "awaiting")) {
    open.state = "failed";
    open.gateOpen = false;
  }
  return visits;
}

// A visit the run has moved past is finished, whatever it was waiting on.
function settle(visit: StepVisit): void {
  if (visit.state === "current" || visit.state === "awaiting") visit.state = "done";
  if (visit.gateOpen) visit.gateOpen = false;
}

function humanCalls(events: readonly RunEvent[]): HumanCall[] {
  return events.flatMap((event) => {
    if (event.actor.kind !== "human" || !event.decision) return [];
    return [{
      kind: event.decision.kind,
      by: event.actor.id,
      surface: event.actor.surface,
      at: time(event.at),
      reason: event.decision.reason,
      ...(event.decision.layout ? { layout: event.decision.layout } : {}),
    }];
  });
}

function candidatePoints(value: unknown, layout: string | null, winner: string | null): CandidatePoint[] {
  return list(value).flatMap((item) => {
    const candidate = record(item);
    if (!candidate || typeof candidate.id !== "string") return [];
    const source = candidate.source === "engine" || candidate.source === "agent" ? candidate.source : "other";
    return [{
      id: candidate.id,
      source,
      feasible: candidate.feasible === true,
      monthly: number(record(candidate.cost)?.run_eur_month_now) ?? number(candidate.monthly_eur),
      availability: number(candidate.availability_pct),
      risk: number(candidate.risk),
      picked: candidate.id === layout,
      winner: candidate.id === winner,
    }];
  });
}

function rehearsalOutcome(value: unknown): RehearsalOutcome | null {
  const verdict = record(record(value)?.verdict);
  if (!verdict) return null;
  return {
    passed: verdict.passed === true,
    measured: number(verdict.measured_availability_pct),
    floor: number(verdict.forecast_min_availability_pct),
  };
}

export function groupProjects(runs: readonly RunInsight[]): ProjectInsight[] {
  const byProject = new Map<string, RunInsight[]>();
  for (const run of runs) byProject.set(run.project, [...(byProject.get(run.project) ?? []), run]);

  return [...byProject.entries()]
    .map(([id, projectRuns]) => {
      const ordered = [...projectRuns].sort((a, b) => b.startedAt - a.startedAt);
      const settled = ordered.find((run) => run.status === "completed" && run.after !== null) ?? null;
      const latest = ordered[0];
      return {
        id,
        label: projectLabel(id),
        runs: ordered,
        settled,
        before: settled?.before ?? latest?.before ?? null,
        after: settled?.after ?? null,
        components: latest?.components ?? 0,
        findings: latest?.findings ?? 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function pulseOf(projects: readonly ProjectInsight[]): Pulse {
  const runs = projects.flatMap((project) => project.runs);
  return {
    monthlyDelta: projects.reduce(
      (sum, project) => (project.before !== null && project.after !== null ? sum + project.after - project.before : sum),
      0,
    ),
    spend: projects.reduce((sum, project) => sum + (project.before ?? 0), 0),
    planned: projects.filter((project) => project.before !== null && project.after !== null).length,
    projects: projects.length,
    runs: runs.length,
    components: projects.reduce((sum, project) => sum + project.components, 0),
    findings: projects.reduce((sum, project) => sum + project.findings, 0),
    candidates: runs.reduce((sum, run) => sum + run.candidates.length, 0),
    rehearsals: runs.filter((run) => run.rehearsal !== null).length,
    calls: runs.reduce((sum, run) => sum + run.calls.length, 0),
  };
}

export function latestArtifactPaths(paths: readonly string[]): { result: string | null; rehearsal: string | null } {
  return { result: highest(paths, "result"), rehearsal: highest(paths, "rehearsal") };
}

function highest(paths: readonly string[], stem: string): string | null {
  let best: { path: string; revision: number } | null = null;
  for (const path of paths) {
    const match = new RegExp(`^${stem}\\.(\\d+)\\.json$`).exec(path);
    if (!match) continue;
    const revision = Number(match[1]);
    if (!best || revision > best.revision) best = { path, revision };
  }
  return best?.path ?? null;
}

export function projectLabel(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
