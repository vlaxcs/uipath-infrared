import { humanizeKey } from "~/rehearsal/format";
import type { StatusTone } from "~/ui/StatusBadge";

type Meta = { label: string; tone: StatusTone };

export const PATTERN_LABELS: Record<string, string> = {
  constant: "Constant",
  ramp: "Ramp",
  burst: "Burst",
  diurnal: "Diurnal",
};

export function patternLabel(pattern: string): string {
  return PATTERN_LABELS[pattern] ?? humanizeKey(pattern);
}

export const FAILURE_LABELS: Record<string, string> = {
  instance_stop: "Instance stop",
  task_stop: "Task stop",
  zone_down: "Zone down",
  network_partition: "Network partition",
  resource_exhaustion: "Resource exhaustion",
};

export function failureLabel(type: string): string {
  return FAILURE_LABELS[type] ?? humanizeKey(type);
}

export function failureNoun(type: string): string {
  switch (type) {
    case "instance_stop":
      return "instance";
    case "task_stop":
      return "task";
    case "zone_down":
      return "zone";
    case "network_partition":
      return "network";
    case "resource_exhaustion":
      return "resource";
    default:
      return "component";
  }
}

export const COMPONENT_STATUS_META: Record<string, Meta> = {
  healthy: { label: "Healthy", tone: "completed" },
  degraded: { label: "Degraded", tone: "awaiting" },
  failed: { label: "Failed", tone: "failed" },
};

export function componentStatusMeta(status: string): Meta {
  return COMPONENT_STATUS_META[status] ?? { label: humanizeKey(status), tone: "neutral" };
}

export const PROVENANCE_LABELS: Record<string, string> = {
  observed: "Observed",
  estimated: "Estimated",
  synthetic: "Synthetic",
};

export function provenanceLabel(provenance: string): string {
  return PROVENANCE_LABELS[provenance] ?? humanizeKey(provenance);
}

export const VERDICT_META: Record<string, Meta> = {
  passed: { label: "Passed", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
};

export const DECISION_META: Record<string, Meta> = {
  proceed: { label: "Proceed", tone: "completed" },
  revise: { label: "Revise", tone: "awaiting" },
};

export function decisionMeta(kind: string): Meta {
  return DECISION_META[kind] ?? { label: humanizeKey(kind), tone: "neutral" };
}

export const TEARDOWN_META: Record<string, Meta> = {
  success: { label: "Teardown succeeded", tone: "completed" },
  partial: { label: "Teardown partial", tone: "awaiting" },
  failed: { label: "Teardown failed", tone: "failed" },
};

export function teardownMeta(status: string): Meta {
  return TEARDOWN_META[status] ?? { label: humanizeKey(status), tone: "neutral" };
}

export const PHASE_LABELS: Record<string, string> = {
  baseline: "Before the failure",
  failure: "During the failure",
  recovery: "After recovery",
};

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? humanizeKey(phase);
}

export type FallbackVerdict = "Held" | "Missed" | "Not evidenced";

export const FALLBACK_META: Record<FallbackVerdict, Meta> = {
  Held: { label: "Held", tone: "completed" },
  Missed: { label: "Missed", tone: "failed" },
  "Not evidenced": { label: "Not evidenced", tone: "neutral" },
};
