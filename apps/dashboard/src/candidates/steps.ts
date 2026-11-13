import type { Action } from "~/candidates/types";

export type Step = { number: number; action: Action };
export type StepGroup = { layer: string | undefined; start: number; steps: Step[] };
export type StepsView = {
  groups: StepGroup[];
  total: number;
  changes: number;
  findings: number;
  keeps: number;
};

export function buildSteps(actions: readonly Action[]): StepsView {
  const groups: StepGroup[] = [];
  let total = 0;
  let changes = 0;
  let findings = 0;
  let keeps = 0;

  for (const action of actions) {
    total += 1;
    // Group consecutive actions that share a layer. A layer appearing again
    // later starts a new group, so the global order matches the array order.
    const current = groups[groups.length - 1];
    if (current && current.layer === action.layer) {
      current.steps.push({ number: total, action });
    } else {
      groups.push({ layer: action.layer, start: total, steps: [{ number: total, action }] });
    }

    if (action.action === "flag") findings += 1;
    else if (action.action === "keep") keeps += 1;
    else changes += 1;
  }

  return { groups, total, changes, findings, keeps };
}
