import type { EventStatus, RunStatus } from "~/runs/types";
import type { StatusTone } from "~/ui/StatusBadge";

type StatusMeta = {
  label: string;
  tone: StatusTone;
};

export const runStatusMeta: Record<RunStatus, StatusMeta> = {
  running: { label: "Running", tone: "running" },
  awaiting_approval: { label: "Awaiting approval", tone: "awaiting" },
  completed: { label: "Completed", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
};

export const eventStatusMeta: Record<EventStatus, StatusMeta> = {
  started: { label: "Started", tone: "running" },
  completed: { label: "Completed", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
  awaiting_approval: { label: "Awaiting approval", tone: "awaiting" },
  approved: { label: "Approved", tone: "completed" },
};
