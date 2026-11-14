import type { Gate, RunEvent, RunStatus, RunStep } from "~/runs/types";

export type RunSummaryFields = {
  status: RunStatus;
  step: RunStep;
  revision: number;
  awaiting?: Gate;
  started_at: string;
  updated_at: string;
  finished_at?: string;
};

export function isTerminal(status: RunStatus): boolean {
  return status === "completed" || status === "failed";
}

export function deriveRunSummary(events: readonly RunEvent[]): RunSummaryFields {
  const ordered = sortBySeq(events);
  const last = ordered[ordered.length - 1];
  const revisions = ordered.filter((event) => event.decision?.kind === "revise").length;
  const openGate = openGateFrom(ordered);
  const failed = last?.status === "failed";
  const completed = last?.decision?.kind === "approve_plan";
  const status: RunStatus = failed ? "failed" : completed ? "completed" : openGate ? "awaiting_approval" : "running";
  const awaiting = status === "awaiting_approval" ? openGate : undefined;
  const finished_at = isTerminal(status) ? last?.at : undefined;

  return {
    status,
    step: last?.step ?? "extract",
    revision: revisions,
    ...(awaiting ? { awaiting } : {}),
    started_at: ordered[0]?.at ?? "",
    updated_at: last?.at ?? "",
    ...(finished_at ? { finished_at } : {}),
  };
}

function openGateFrom(events: readonly RunEvent[]): Gate | undefined {
  let open: Gate | undefined;

  for (const event of events) {
    if (event.status === "awaiting_approval" && event.gate) open = event.gate;
    if (event.decision?.kind === "pick_layout" || event.decision?.kind === "approve_plan") open = undefined;
  }

  return open;
}

function sortBySeq(events: readonly RunEvent[]): RunEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq);
}
