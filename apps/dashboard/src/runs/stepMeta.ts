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
    hint: "Reads the cloud account: every resource, its metrics and what depends on what. Writes infra.json.",
  },
  investigate: {
    title: "Investigate",
    control: "automatic",
    hint: "The agent reads the estate with read-only tools and records each problem it finds, with the evidence behind it.",
  },
  propose: {
    title: "Propose",
    control: "automatic",
    hint: "The agent turns the findings into candidate plans: which components change, and how.",
  },
  evaluate: {
    title: "Evaluate",
    control: "automatic",
    hint: "The engine prices every candidate, checks it against the hard constraints and ranks the ones that pass. If none of the agent's plans pass, the run goes back to Propose.",
  },
  present: {
    title: "Present",
    control: "approval",
    gate: "layout",
    hint: "Lays out the ranked candidates and waits for a person to pick the one to rehearse.",
  },
  rehearse: {
    title: "Rehearse",
    control: "approval",
    gate: "plan",
    hint: "Builds the picked layout in the sandbox, breaks one part of it and measures what stays up. Then waits for a person to approve the plan.",
  },
};
