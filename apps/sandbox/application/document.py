from typing import Dict, List

from ..domain.component_result import summarize_component
from ..domain.measurement import PhaseMeasurement, compute_phase_measurement
from ..domain.teardown_selection import TEARDOWN_ORDER
from ..domain.traffic_observations import record_observations, served_by
from ..domain.traffic_record import PHASES, measured_records, samples_for_phase
from ..domain.verdict import decide_verdict
from .run_outcome import RunOutcome


def metric(value: float, unit: str, basis: str = "") -> Dict:
    document = {"value": round(value, 3), "unit": unit, "provenance": "synthetic"}
    if basis:
        document["basis"] = basis
    return document


def phase_document(phase: PhaseMeasurement, basis: str) -> Dict:
    document = {
        "duration_s": round(phase.duration_s, 2),
        "requests_total": phase.requests_total,
        "requests_successful": phase.requests_successful,
        "requests_failed": phase.requests_failed,
    }
    if phase.requests_total:
        document["availability_pct"] = metric(phase.availability_pct, "percent", basis)
        document["error_rate_pct"] = metric(phase.error_rate_pct, "percent", basis)
    if phase.requests_successful:
        for key, value in (("latency_p50_ms", phase.latency_p50_ms), ("latency_p95_ms", phase.latency_p95_ms), ("latency_p99_ms", phase.latency_p99_ms)):
            document[key] = metric(value, "ms", f"{basis}, successful requests only")
    return document


def served_note(component, counts) -> str:
    own = {resource.resource_id: counts.get(resource.resource_id, 0) for resource in component.resources_of("instance")}
    if not own:
        return ""
    return "served " + ", ".join(f"{instance_id} {count}" for instance_id, count in own.items()) + " successful HTTP responses"


def component_documents(outcome: RunOutcome) -> List[Dict]:
    observations = outcome.observations + record_observations(outcome.records)
    counts = served_by(outcome.records)
    documents = []
    for component in outcome.components:
        extra = "; ".join(part for part in (component.detail, served_note(component, counts)) if part)
        result = summarize_component(component, observations, outcome.failure_target, extra)
        document = {"component_id": result.component_id, "kind": result.kind, "status": result.status, "note": result.note}
        if result.availability_pct is not None:
            document["availability_pct"] = metric(result.availability_pct, "percent", result.basis)
        documents.append(document)
    return documents


def decision(passed: bool, reason: str, outcome: RunOutcome) -> Dict:
    target = outcome.failure_target
    tested = f" with {target.reason}" if target else " with no failure injected"
    return {"kind": "proceed" if passed else "revise", "reason": f"{reason}{tested}"}


def build_document(outcome: RunOutcome) -> Dict:
    records = measured_records(outcome.records)
    protocol = records[0].protocol if records else "http"
    basis = f"{protocol} probes from the in-VPC load generator at {outcome.requests_per_second}/s" if protocol == "http" else "tcp handshakes from the in-VPC load generator, no HTTP entry point was built"
    phases = {phase: compute_phase_measurement(samples_for_phase(records, phase), outcome.phase_seconds.get(phase, 0.0)) for phase in PHASES}
    total = sum(phase.requests_total for phase in phases.values())
    successful = sum(phase.requests_successful for phase in phases.values())
    measured = successful / total * 100.0 if total else 0.0
    verdict = decide_verdict(measured, outcome.min_availability_pct)
    reason = verdict.reason if total else "No traffic was measured, so availability is 0 and the rehearsal fails"
    target = outcome.failure_target
    completed_at = outcome.completed_at
    return {
        "schema_version": "1.0",
        "candidate_id": outcome.candidate_id,
        "forecast_id": outcome.forecast_id,
        "traffic_profile": {
            "pattern": "constant",
            "duration_s": max(1, int(round(sum(outcome.phase_seconds.values())))),
            "target_endpoint": outcome.target_endpoint,
            "requests_per_second": outcome.requests_per_second,
            "total_requests": total,
        },
        "failure": {
            "type": target.type.value if target else "instance_stop",
            "target_component": target.component_id if target else "",
            "injected_at_s": round(outcome.injected_at_s, 2),
            "duration_s": round(max(0.0, outcome.restored_at_s - outcome.injected_at_s), 2),
            "detail": f"{target.reason}. {outcome.inject_detail}; restore: {outcome.restore_detail}" if target else "no failure injected: nothing the candidate built can take one",
        },
        "phases": {phase: phase_document(measurement, basis) for phase, measurement in phases.items()},
        "component_results": component_documents(outcome),
        "verdict": {
            "passed": verdict.passed and total > 0,
            "forecast_min_availability_pct": verdict.forecast_min_availability_pct,
            "measured_availability_pct": round(measured, 3),
            "gap_pct": round(verdict.gap_pct, 3),
            "reason": reason,
        },
        "timestamps": {
            "started_at": outcome.started_at.isoformat(),
            "completed_at": completed_at.isoformat() if completed_at else outcome.started_at.isoformat(),
            "elapsed_s": round((completed_at - outcome.started_at).total_seconds(), 2) if completed_at else 0.0,
        },
        "infrastructure": {
            "vpc_id": outcome.vpc_id,
            "name_prefix": outcome.prefix,
            "endpoint": outcome.endpoint,
            "components_created": [component.component_id for component in outcome.components],
            "teardown_status": "success" if not outcome.remaining else "partial",
        },
        "x_decision": decision(verdict.passed and total > 0, reason, outcome),
        "x_actions_skipped": [
            {"component": item.component, "action": item.action, "to": item.to, "reason": item.reason}
            for item in outcome.skipped
        ],
        "x_actions_not_built": [
            {"component_id": item.component_id, "kind": item.kind, "action": item.action, "reason": item.reason}
            for item in outcome.not_built
        ],
        "x_components_built": [
            {
                "component_id": component.component_id,
                "kind": component.kind,
                "sku": component.sku,
                "zones": component.zones,
                "detail": component.detail,
                "resources": [
                    {"type": resource.resource_type, "name": resource.name, "id": resource.resource_id, "zone": resource.zone}
                    for resource in component.resources
                ],
            }
            for component in outcome.components
        ],
        "x_readiness": outcome.readiness,
        "x_measurement_notes": outcome.notes,
        "x_teardown": {
            "prefix": outcome.prefix,
            "checked_resource_types": list(TEARDOWN_ORDER),
            "remaining": [{"type": item.resource_type, "name": item.name, "id": item.resource_id} for item in outcome.remaining],
        },
    }
