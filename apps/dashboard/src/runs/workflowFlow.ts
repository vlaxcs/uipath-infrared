import type { RunDetail, RunEvent, RunStep } from "~/runs/types";

export type CheckOutcome = "pending" | "passed" | "revised" | "stopped";
export type GateState = "pending" | "awaiting" | "decided";
export type RunEnd = "running" | "completed" | "failed";

export type FlowCheck = { question: string; outcome: CheckOutcome; reason: string | null };
export type FlowGate = { label: string; state: GateState; detail: string | null };

export type WorkflowFlow = {
  revision: number;
  maxRevisions: number;
  revisions: number;
  evaluateRevisions: number;
  rehearseRevisions: number;
  extractCheck: FlowCheck;
  evaluateCheck: FlowCheck;
  rehearseCheck: FlowCheck;
  layoutGate: FlowGate;
  planGate: FlowGate;
  end: RunEnd;
  failure: { step: RunStep; reason: string } | null;
};

function latest(events: readonly RunEvent[], match: (event: RunEvent) => boolean): RunEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (match(events[index])) return events[index];
  }
  return undefined;
}

function check(question: string, event: RunEvent | undefined): FlowCheck {
  const kind = event?.decision?.kind;
  const reason = event?.decision?.reason?.trim() || null;
  if (kind === "proceed") return { question, outcome: "passed", reason };
  if (kind === "revise") return { question, outcome: "revised", reason };
  if (kind === "stop") return { question, outcome: "stopped", reason };
  return { question, outcome: "pending", reason: null };
}

export function workflowFlow(run: Pick<RunDetail, "events" | "status" | "awaiting" | "revision" | "max_revisions">): WorkflowFlow {
  const events = [...run.events].sort((a, b) => a.seq - b.seq);
  const extracted = latest(events, (event) => event.step === "extract" && event.status === "completed");
  const failedEvent = latest(events, (event) => event.status === "failed");
  const extractFailed = failedEvent?.step === "extract";

  const evaluation = latest(events, (event) => event.step === "evaluate" && (event.status === "completed" || event.status === "failed") && !!event.decision);
  const rehearsal = latest(events, (event) => event.step === "rehearse" && (event.status === "completed" || event.status === "failed") && !!event.decision);
  const revisedAt = (step: RunStep) => events.filter((event) => event.step === step && event.decision?.kind === "revise").length;
  const evaluateRevisions = revisedAt("evaluate");
  const rehearseRevisions = revisedAt("rehearse");
  const revisions = evaluateRevisions + rehearseRevisions;

  const picked = latest(events, (event) => event.decision?.kind === "pick_layout");
  const approved = latest(events, (event) => event.decision?.kind === "approve_plan");
  const awaitingLayout = run.status === "awaiting_approval" && run.awaiting === "layout";
  const awaitingPlan = run.status === "awaiting_approval" && run.awaiting === "plan";

  return {
    revision: run.revision,
    maxRevisions: run.max_revisions,
    revisions,
    evaluateRevisions,
    rehearseRevisions,
    extractCheck: {
      question: "Matches the infra contract?",
      outcome: extractFailed ? "stopped" : extracted ? "passed" : "pending",
      reason: extractFailed ? failedEvent?.decision?.reason ?? null : null,
    },
    evaluateCheck: check("Every agent candidate feasible?", evaluation),
    rehearseCheck: check("Availability meets the forecast?", rehearsal),
    layoutGate: {
      label: "CTO picks a feasible layout",
      state: awaitingLayout ? "awaiting" : picked ? "decided" : "pending",
      detail: picked?.decision?.layout ?? null,
    },
    planGate: {
      label: "CTO approves the plan",
      state: awaitingPlan ? "awaiting" : approved ? "decided" : "pending",
      detail: null,
    },
    end: run.status === "completed" ? "completed" : run.status === "failed" ? "failed" : "running",
    failure: run.status === "failed" && failedEvent ? { step: failedEvent.step, reason: failedEvent.decision?.reason ?? "no reason recorded" } : null,
  };
}
