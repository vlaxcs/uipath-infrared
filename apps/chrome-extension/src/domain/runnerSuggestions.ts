import { formatHours } from "~/domain/format";
import type { RunnerSuggestion, RunnerUsage } from "~/domain/types";

export type RunnerReport = {
  runners: RunnerUsage[];
  suggestions: RunnerSuggestion[];
  sourceRepo: string | null;
  note?: string;
};

const NO_DATA = "No GitHub Actions runner data in this run.";

export function runnerReport(value: unknown): RunnerReport {
  if (!isRecord(value) || !Array.isArray(value.runners)) {
    return { runners: [], suggestions: [], sourceRepo: null, note: NO_DATA };
  }

  const sourceRepo = typeof value.source_repo === "string" ? value.source_repo : null;
  const byType = new Map<string, { hours: number; workflows: number | null }>();

  for (const item of value.runners) {
    if (!isRecord(item) || typeof item.runner_type !== "string") continue;
    const runnerType = item.runner_type.trim() || "unknown";
    const hours = typeof item.hours_month === "number" && item.hours_month >= 0 ? item.hours_month : 0;
    const workflows =
      typeof item.workflow_runs === "number" && item.workflow_runs >= 0 ? item.workflow_runs : null;
    const previous = byType.get(runnerType) ?? { hours: 0, workflows: null };
    byType.set(runnerType, {
      hours: previous.hours + hours,
      workflows: workflows === null ? previous.workflows : (previous.workflows ?? 0) + workflows,
    });
  }

  const runners = [...byType.entries()].map(([runnerType, usage]) => ({ runnerType, ...usage }));
  const suggestions: RunnerSuggestion[] = [];

  for (const runner of runners) {
    const metered = /^(macos|windows)/i.test(runner.runnerType);

    if (runner.hours > 0 && runner.runnerType === "self-hosted" && runner.hours <= 20) {
      suggestions.push({
        id: `move-to-hosted:${runner.runnerType}`,
        title: "Move this workload to GitHub-hosted runners",
        detail: `Only ${formatHours(runner.hours)} of self-hosted use; confirm the fixed maintenance and on-call cost is buying something. GitHub-hosted minutes may be enough.`,
        runnerType: runner.runnerType,
        hours: runner.hours,
        workflows: runner.workflows,
      });
    } else if (runner.hours > 0 && metered && runner.hours >= 80) {
      suggestions.push({
        id: `metered-runner:${runner.runnerType}`,
        title: "Check this metered runner type",
        detail: `${formatHours(runner.hours)} on ${runner.runnerType}; metered macOS and Windows minutes are costly, so confirm the workflow requires this runner type.`,
        runnerType: runner.runnerType,
        hours: runner.hours,
        workflows: runner.workflows,
      });
    } else if (
      runner.hours > 0 &&
      !metered &&
      runner.runnerType !== "self-hosted" &&
      runner.runnerType !== "unknown" &&
      runner.hours >= 160
    ) {
      suggestions.push({
        id: `consider-self-hosted:${runner.runnerType}`,
        title: "Consider self-hosted or on-prem runners",
        detail: `${formatHours(runner.hours)} on ${runner.runnerType}; evaluate a self-hosted or on-prem pool, including its maintenance cost.`,
        runnerType: runner.runnerType,
        hours: runner.hours,
        workflows: runner.workflows,
      });
    } else if (runner.runnerType === "unknown") {
      suggestions.push({
        id: `unknown-runner:${runner.runnerType}`,
        title: "Runner type is unknown",
        detail: "Enable the GitHub Actions extractor so Infrared can identify the runners and make a suggestion.",
        runnerType: runner.runnerType,
        hours: runner.hours,
        workflows: runner.workflows,
      });
    }
  }

  suggestions.sort((left, right) => right.hours - left.hours);

  return {
    runners,
    suggestions: suggestions.slice(0, 3),
    sourceRepo,
    ...(runners.length === 0
      ? { note: NO_DATA }
      : suggestions.length === 0
        ? { note: "No runner change is suggested by the current usage." }
        : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
