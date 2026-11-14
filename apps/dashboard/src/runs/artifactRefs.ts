import { RUN_STEPS } from "~/runs/stepProgress";
import type { RunDetail, RunEvent, RunStep } from "~/runs/types";

export function revisionsForStep(run: RunDetail, step: RunStep): number[] {
  return [...new Set(run.events.filter((event) => event.step === step).map((event) => event.revision))]
    .sort((a, b) => a - b);
}

export function latestRevision(run: RunDetail, step: RunStep): number | null {
  const revisions = revisionsForStep(run, step);
  return revisions.length > 0 ? revisions[revisions.length - 1] : null;
}

export function primaryArtifactPath(
  run: RunDetail,
  step: RunStep,
  revision: number | null,
): string | null {
  switch (step) {
    case "extract":
      return outputPath(run, "infra") ?? "infra.json";
    case "investigate":
      return "findings.json";
    case "propose":
      return revision === null ? null : `candidates.${revision}.json`;
    case "evaluate":
      return outputPath(run, "result", revision) ?? (revision === null ? null : `result.${revision}.json`);
    case "present":
      return outputPath(run, "result");
    case "rehearse":
      return outputPath(run, "rehearsal", revision) ?? (revision === null ? null : `rehearsal.${revision}.json`);
  }
}

export function nextStep(step: RunStep): RunStep | null {
  const index = RUN_STEPS.indexOf(step);
  return index >= 0 && index + 1 < RUN_STEPS.length ? RUN_STEPS[index + 1] : null;
}

export function stepEvents(run: RunDetail, step: RunStep, revision: number | null): RunEvent[] {
  return run.events.filter(
    (event) => event.step === step && (revision === null || event.revision === revision),
  );
}

export function revisionLabel(revision: number): string {
  return revision === 0 ? "Initial pass" : `Revision ${revision}`;
}

export function latestOutputPath(run: RunDetail, contract: string): string | null {
  return outputPath(run, contract);
}

function outputPath(run: RunDetail, contract: string, revision?: number | null): string | null {
  for (let index = run.events.length - 1; index >= 0; index--) {
    const event = run.events[index];
    if (event.output?.contract !== contract) continue;
    if (revision !== undefined && revision !== null && event.revision !== revision) continue;
    return event.output.file.path;
  }
  return null;
}
