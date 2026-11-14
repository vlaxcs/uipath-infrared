import type { HumanDecision, RunDecision, RunStep } from "~/runs/types";

export const DASHBOARD_ACTOR = { kind: "human", id: "cto", surface: "dashboard" } as const;

export function pickLayoutDecision(layout: string, reason: string): HumanDecision {
  return decision("present", { kind: "pick_layout", reason, layout });
}

export function approvePlanDecision(reason: string): HumanDecision {
  return decision("rehearse", { kind: "approve_plan", reason });
}

function decision(step: RunStep, decision: RunDecision): HumanDecision {
  return { step, status: "approved", actor: DASHBOARD_ACTOR, decision };
}
