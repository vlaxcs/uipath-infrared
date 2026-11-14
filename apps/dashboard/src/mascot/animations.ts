import type { RunStatus, RunStep } from "~/runs/types";

export type MascotAnimation = "hood" | "float" | "chomp" | "reorganise" | "grow" | "scan" | "sunset";

const BY_STEP: Record<RunStep, MascotAnimation> = {
  extract: "scan",
  investigate: "scan",
  propose: "reorganise",
  evaluate: "chomp",
  present: "float",
  rehearse: "grow",
};

export function animationForRun(step: RunStep, status: RunStatus): MascotAnimation {
  if (status === "completed") return "sunset";
  if (status === "failed") return "hood";
  if (status === "awaiting_approval") return "float";
  return BY_STEP[step] ?? "scan";
}
