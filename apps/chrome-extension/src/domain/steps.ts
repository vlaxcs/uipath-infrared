import type { RunDetail, RunStep, StepEntry, StepState } from "~/domain/types";

export const RUN_STEPS: readonly RunStep[] = [
  "extract",
  "investigate",
  "propose",
  "evaluate",
  "present",
  "rehearse",
];

type RunEventStatus = RunDetail["events"][number]["status"];

export function deriveStepStates(detail: RunDetail): StepEntry[] {
  const ordered = [...detail.events].sort((left, right) => left.seq - right.seq);

  return RUN_STEPS.map((step) => {
    const events = ordered.filter((event) => event.step === step);
    const last = events[events.length - 1];
    const state: StepState =
      detail.status === "awaiting_approval" && detail.awaiting && detail.step === step
        ? "awaiting"
        : stateFor(last?.status);
    return { step, state };
  });
}

function stateFor(status: RunEventStatus | undefined): StepState {
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
