import type { Gate, RunStep } from "~/runs/types";

export type StepControl = "automatic" | "approval";

export type StepMeta = {
  title: string;
  control: StepControl;
  gate?: Gate;
  hint: string;
};

export const STEP_META: Record<RunStep, StepMeta> = {
  extract: {
    title: "Extract",
    control: "automatic",
    hint: "Reads the infrastructure and writes infra.json.",
  },
  investigate: {
    title: "Investigate",
    control: "automatic",
    hint: "Records findings with their evidence.",
  },
  propose: {
    title: "Propose",
    control: "automatic",
    hint: "Turns the findings into candidate plans.",
  },
  evaluate: {
    title: "Evaluate",
    control: "automatic",
    hint: "Prices, checks and ranks every candidate.",
  },
  present: {
    title: "Present",
    control: "approval",
    gate: "layout",
    hint: "Runs automatically, then waits for the layout choice.",
  },
  rehearse: {
    title: "Rehearse",
    control: "approval",
    gate: "plan",
    hint: "Runs automatically, then waits for plan approval.",
  },
};
