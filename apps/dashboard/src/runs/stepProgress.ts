import type { EventStatus, Run, RunEvent, RunStep, StepState } from "~/runs/types";

export const RUN_STEPS: readonly RunStep[] = ["extract", "investigate", "propose", "evaluate", "present", "rehearse"];

export function deriveStepStates(events: readonly RunEvent[], run: Run): Record<RunStep, StepState> {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const states = {} as Record<RunStep, StepState>;

  for (const step of RUN_STEPS) {
    const stepEvents = ordered.filter((event) => event.step === step);
    states[step] = stateFor(stepEvents[stepEvents.length - 1]?.status);
  }

  if (run.status === "awaiting_approval" && run.awaiting) states[run.step] = "awaiting";

  return states;
}

function stateFor(status: EventStatus | undefined): StepState {
  switch (status) {
    case "started":
      return "current";
    case "completed":
    case "approved":
      return "done";
    case "failed":
      return "failed";
    case "awaiting_approval":
      return "awaiting";
    default:
      return "pending";
  }
}
