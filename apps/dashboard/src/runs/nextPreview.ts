import { primaryArtifactPath, nextStep as followingStep } from "~/runs/artifactRefs";
import { STEP_META } from "~/runs/stepMeta";
import type { RunDetail, RunStep, StepState } from "~/runs/types";

export type NextPreview = {
  step: RunStep | null;
  title: string;
  control: "automatic" | "approval" | "last";
  state: StepState;
  artifactPath: string | null;
  hint: string;
};

export function nextPreview(
  run: RunDetail,
  step: RunStep,
  states: Record<RunStep, StepState>,
): NextPreview {
  const next = followingStep(step);
  if (!next) {
    return {
      step: null,
      title: "Last step",
      control: "last",
      state: "done",
      artifactPath: null,
      hint: "There is no step after this one.",
    };
  }

  const meta = STEP_META[next];
  const state = states[next];
  const artifactPath = primaryArtifactPath(run, next, null);

  return {
    step: next,
    title: meta.title,
    control: meta.control,
    state,
    artifactPath,
    hint:
      state === "pending"
        ? meta.control === "approval"
          ? "Waits for the gate after it runs."
          : "Runs automatically after this step."
        : state === "done"
          ? "Result available."
          : "Waiting for the step to finish.",
  };
}
