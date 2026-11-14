import { humanizeKey } from "~/candidates/format";
import type { ActionKind, Confidence, LostReason, Source } from "~/candidates/types";
import type { StatusTone } from "~/ui/StatusBadge";

export const ACTION_LABELS: Record<ActionKind, string> = {
  keep: "Keep as is",
  delete: "Delete",
  stop: "Stop",
  resize: "Resize",
  scale: "Scale",
  autoscale: "Autoscale",
  move: "Move",
  remediate: "Remediate",
  flag: "Finding",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action as ActionKind] ?? humanizeKey(action);
}

export function isNoOpAction(action: string): boolean {
  return action === "keep" || action === "flag";
}

type Meta = { label: string; tone: StatusTone };

export const LOST_REASON_META: Record<LostReason, Meta> = {
  constraint: { label: "Hard constraint", tone: "failed" },
  cost: { label: "Cost", tone: "awaiting" },
  risk: { label: "Risk", tone: "awaiting" },
  effort: { label: "Effort", tone: "awaiting" },
  payback: { label: "Payback", tone: "awaiting" },
};

export function lostReasonMeta(reason: string): Meta {
  return LOST_REASON_META[reason as LostReason] ?? { label: humanizeKey(reason), tone: "neutral" };
}

export const CONFIDENCE_META: Record<Confidence, Meta> = {
  high: { label: "High confidence", tone: "completed" },
  medium: { label: "Medium confidence", tone: "neutral" },
  low: { label: "Low confidence", tone: "awaiting" },
};

export function confidenceMeta(confidence: string): Meta {
  return CONFIDENCE_META[confidence as Confidence] ?? { label: humanizeKey(confidence), tone: "neutral" };
}

export const SOURCE_LABELS: Record<Source, string> = {
  engine: "Engine",
  agent: "Agent",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as Source] ?? humanizeKey(source);
}

export const LAYER_LABELS: Record<string, string> = {
  cleanup_orphans: "Cleanup orphans",
  rightsize_in_place: "Rightsize in place",
  managed_services: "Managed services",
  move_to_onprem: "Move to on-prem",
  consolidate: "Consolidate",
  security_remediation: "Security remediation",
  agent: "Agent proposal",
};

export const OTHER_LAYER_LABEL = "Other changes";

export function layerLabel(layer: string | undefined): string {
  if (!layer) return OTHER_LAYER_LABEL;
  return LAYER_LABELS[layer] ?? humanizeKey(layer);
}

export const CONSTRAINT_LABELS: Record<string, string> = {
  data_residency: "Data residency",
  budget: "Monthly budget",
  migration_budget: "Migration budget",
  min_availability_pct: "Minimum availability",
  allowed_providers: "Allowed providers",
  forbidden_providers: "Forbidden providers",
  max_migration_effort_hours: "Maximum migration effort",
  max_cutover_downtime_hours: "Maximum cutover downtime",
  "security.forbid_public_datastores": "No public datastores",
  "security.require_encryption_at_rest": "Encryption at rest",
  "security.forbid_world_open_admin_ports": "No world-open admin ports",
  "security.require_audit_logging": "Audit logging",
  "security.require_backups": "Backups required",
};

export function constraintLabel(constraint: string): string {
  return CONSTRAINT_LABELS[constraint] ?? humanizeKey(constraint);
}

export const FLAG_LABELS: Record<string, string> = {
  catalog_illustrative: "Prices are illustrative",
  catalog_mismatch: "Catalog differs from the estate",
  change_unpriced: "Some changes are unpriced",
  egress_unpriced: "Egress is not priced",
  usage_synthetic: "Usage data is synthetic",
  sample_values: "Sample values",
  unpriced_components: "Some components are unpriced",
  verify_extensions: "Verify extension fields",
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? humanizeKey(flag);
}

export function flagLabels(flags: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const flag of flags ?? []) {
    const label = flagLabel(flag);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}
