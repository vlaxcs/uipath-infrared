import { formatPercent } from "~/rehearsal/format";
import {
  componentStatusMeta,
  failureNoun,
  FALLBACK_META,
  type FallbackVerdict,
} from "~/rehearsal/labels";
import type { ComponentResult, RehearsalDocument } from "~/rehearsal/types";
import type { StatusTone } from "~/ui/StatusBadge";

export type FallbackView = {
  headline: string;
  tone: StatusTone;
  verdictLabel: FallbackVerdict;
  evidence: string[];
  caveat: string | null;
  derivedLabel: string;
};

const DERIVED_LABEL = "Derived from component results, phase measurements and the verdict";

function availabilityText(phase: RehearsalDocument["phases"]["baseline"] | undefined): string | null {
  const value = phase?.availability_pct?.value;
  return value !== undefined && Number.isFinite(value) ? formatPercent(value) : null;
}

function componentEvidence(component: ComponentResult): string {
  const status = componentStatusMeta(component.status).label.toLowerCase();
  const availability = component.availability_pct?.value;
  const measured =
    availability !== undefined && Number.isFinite(availability)
      ? `, ${formatPercent(availability)} availability`
      : "";
  return `${component.component_id}: ${status}${measured}.`;
}

function phaseEvidence(rehearsal: RehearsalDocument): string[] {
  const evidence: string[] = [];
  const before = availabilityText(rehearsal.phases.baseline);
  const during = availabilityText(rehearsal.phases.failure);
  const after = availabilityText(rehearsal.phases.recovery);
  if (before) evidence.push(`Availability before the failure: ${before}.`);
  if (during) evidence.push(`Availability during the failure: ${during}.`);
  if (after) evidence.push(`Availability after recovery: ${after}.`);
  return evidence;
}

export function buildFallback(rehearsal: RehearsalDocument): FallbackView {
  const target = rehearsal.failure?.target_component?.trim() ?? "";
  const passed = rehearsal.verdict.passed === true;
  const baseVerdict: FallbackVerdict = passed ? "Held" : "Missed";
  const baseTone = FALLBACK_META[baseVerdict].tone;
  const notes = rehearsal.x_measurement_notes ?? [];
  const components = rehearsal.component_results ?? [];
  const phases = phaseEvidence(rehearsal);

  if (!target) {
    return {
      headline: "No failure was injected in this rehearsal.",
      tone: FALLBACK_META["Not evidenced"].tone,
      verdictLabel: "Not evidenced",
      evidence: phases,
      caveat: "The fallback cannot be assessed without a failure.",
      derivedLabel: DERIVED_LABEL,
    };
  }

  if (components.length > 0) {
    const targetRow = components.find((component) => component.component_id === target);
    const loadBalancer = components.find((component) => component.kind === "load_balancer");
    const noun = failureNoun(rehearsal.failure.type);
    const evidence: string[] = [];

    evidence.push(
      targetRow
        ? componentEvidence(targetRow)
        : `The failure target ${target} does not appear among the component results.`,
    );
    evidence.push(
      loadBalancer
        ? componentEvidence(loadBalancer)
        : `No load balancer appears among the ${components.length} component results.`,
    );

    const peer = components.find(
      (component) =>
        component.kind === targetRow?.kind &&
        component.component_id !== target &&
        component.status === "healthy",
    );
    if (peer && targetRow && targetRow.status !== "healthy") {
      evidence.push(`${peer.component_id} stayed healthy.`);
    }

    evidence.push(...phases);

    if (targetRow?.status === "healthy") {
      return {
        headline: `The failure target ${target} stayed healthy throughout.`,
        tone: baseTone,
        verdictLabel: baseVerdict,
        evidence,
        caveat: null,
        derivedLabel: DERIVED_LABEL,
      };
    }

    if (!targetRow) {
      return {
        headline: "The failure target is not in the component results.",
        tone: baseTone,
        verdictLabel: baseVerdict,
        evidence,
        caveat: "The component-level fallback cannot be identified from this file.",
        derivedLabel: DERIVED_LABEL,
      };
    }

    const adjective = targetRow.status === "failed" ? "failed" : "degraded";
    if (loadBalancer?.status === "healthy") {
      return {
        headline: `The load balancer routed traffic around the ${adjective} ${noun}.`,
        tone: baseTone,
        verdictLabel: baseVerdict,
        evidence,
        caveat: null,
        derivedLabel: DERIVED_LABEL,
      };
    }

    const note = notes.find((candidate) => /load balancer|round[\s-]?robin/i.test(candidate));
    if (note) evidence.push(`Measurement note: “${note}”`);

    return {
      headline: `No load balancer: the ${adjective} ${noun} kept receiving its share of traffic.`,
      tone: baseTone,
      verdictLabel: baseVerdict,
      evidence,
      caveat: null,
      derivedLabel: DERIVED_LABEL,
    };
  }

  const during = rehearsal.phases.failure?.availability_pct?.value;
  const before = rehearsal.phases.baseline?.availability_pct?.value;
  if (during !== undefined && Number.isFinite(during)) {
    const headline =
      before !== undefined && Number.isFinite(before) && during < before
        ? `Availability fell from ${formatPercent(before)} before the failure to ${formatPercent(during)} during it.`
        : `Availability during the failure was ${formatPercent(during)}.`;
    return {
      headline,
      tone: baseTone,
      verdictLabel: baseVerdict,
      evidence: phases,
      caveat:
        "No component results were recorded, so the fallback mechanism cannot be identified from this file.",
      derivedLabel: DERIVED_LABEL,
    };
  }

  return {
    headline: "Not enough evidence to describe the fallback.",
    tone: FALLBACK_META["Not evidenced"].tone,
    verdictLabel: "Not evidenced",
    evidence: phases,
    caveat: "This file has no component results and no measured availability.",
    derivedLabel: DERIVED_LABEL,
  };
}
