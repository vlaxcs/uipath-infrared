from typing import Any, Sequence

from engine.domain.action_savings import ActionOutcome
from engine.domain.baseline import Baseline
from engine.domain.candidate import DO_NOTHING, ActionKind
from engine.domain.catalog import Catalog
from engine.domain.evaluation import Evaluation, baseline_evidence
from engine.domain.forecast import Forecast
from engine.domain.model import Infra
from engine.domain.provenance import confidence_of
from engine.domain.ranking import Decision, Standing
from engine.domain.remediation import EFFORT_HOURS_BY_GATE
from engine.domain.violation import Violation

SCHEMA_VERSION = "1.0"
SCENARIOS = ("low", "base", "high")


def result_document(
    infra: Infra,
    catalog: Catalog,
    forecast: Forecast,
    baseline: Baseline,
    evaluations: Sequence[Evaluation],
    decision: Decision,
    not_built: Sequence[str],
) -> dict[str, Any]:
    by_id = {e.id: e for e in evaluations}
    do_nothing = by_id[DO_NOTHING.id]
    closest = decision.closest
    return {
        "schema_version": SCHEMA_VERSION,
        "inputs": {
            "infra": infra.project,
            "forecast": forecast.id,
            "catalog_illustrative": catalog.illustrative,
            "horizon_months": forecast.horizon_months,
            "currency": "EUR",
        },
        "baseline": _baseline(baseline, do_nothing),
        "candidates": [_candidate(by_id[cid], decision.standings[cid]) for cid in decision.order],
        "winner": decision.winner,
        "closest_if_none_feasible": None if closest is None else {
            "candidate": closest,
            "violation_distance": decision.standings[closest].violation_distance,
            "blocked_by": _violations(by_id[closest].check.violations),
        },
        "flags": sorted(set(decision.flags) | {f"strategy_not_built_{name}" for name in not_built}),
    }


def _baseline(baseline: Baseline, do_nothing: Evaluation) -> dict[str, Any]:
    confidence = confidence_of(baseline_evidence(baseline))
    flags = set()
    if baseline.unpriced:
        flags.add("unpriced_components")
    if baseline.mismatches():
        flags.add("catalog_mismatch")
    return {
        "monthly_eur": baseline.monthly_eur,
        "availability_pct": do_nothing.check.availability.availability_pct,
        "violations": _violations(do_nothing.check.violations),
        "confidence": confidence.level,
        "confidence_reason": confidence.reason,
        "flags": sorted(flags),
    }


def _candidate(evaluation: Evaluation, standing: Standing) -> dict[str, Any]:
    projection = evaluation.projection
    cost = {
        "run_eur_month_now": projection.monthly_now_eur,
        "run_eur_month_at_horizon": _scenarios(projection.at_horizon_by_scenario),
        "horizon_by_scenario": _scenarios(projection.horizon_by_scenario),
        "horizon_run_eur": projection.expected_horizon_eur,
        "migration_eur": evaluation.migration_eur,
        "ops_eur_month": evaluation.ops_eur_month,
        "expected_outage_loss_eur_year": evaluation.outage_eur_year,
        "expected_total_eur": evaluation.expected_total_eur,
    }
    if evaluation.remediation_hours:
        cost["security_remediation"] = {
            "effort_hours": evaluation.remediation_hours,
            "one_off_eur": evaluation.remediation_eur,
            "run_delta_eur_month": 0.0,
        }
    lost = standing.lost_because
    return {
        "id": evaluation.id,
        "source": "engine",
        "builds_on": evaluation.candidate.builds_on,
        "feasible": evaluation.feasible,
        "violations": _violations(evaluation.check.violations),
        "violation_distance": standing.violation_distance,
        "actions": [_action(o, layer) for o, layer in zip(evaluation.outcomes, evaluation.layers)],
        "cost": cost,
        "availability_pct": evaluation.check.availability.availability_pct,
        "risk": evaluation.risk,
        "effort_hours": evaluation.effort_hours,
        "cutover_downtime_hours": evaluation.migration.cutover_hours,
        "payback_months": standing.payback_months,
        "score": standing.score,
        "pareto": standing.pareto,
        "rank": standing.rank,
        "rank_by_scenario": None if standing.rank_by_scenario is None else dict(standing.rank_by_scenario),
        "lost_because": None if lost is None else {"reason": lost.reason, "detail": lost.detail},
        "confidence": evaluation.confidence.level,
        "confidence_reason": evaluation.confidence.reason,
        "flags": list(evaluation.flags),
    }


def _action(outcome: ActionOutcome, layer: str) -> dict[str, Any]:
    action = outcome.action
    confidence = action.confidence
    document = {
        "component": action.component,
        "action": action.kind.value,
        "layer": layer,
        "reason": action.reason,
        "from": outcome.before,
        "to": outcome.after,
        "saving_eur_month": 0.0 if action.kind == ActionKind.FLAG else outcome.saving_eur_month,
        "confidence": confidence.level,
        "confidence_reason": confidence.reason,
    }
    if action.signal:
        document["signal"] = action.signal
    if action.kind == ActionKind.REMEDIATE:
        document["effort_hours"] = EFFORT_HOURS_BY_GATE[action.signal]
    return document


def _violations(violations: Sequence[Violation]) -> list[dict[str, Any]]:
    ordered = sorted(violations, key=lambda v: (-v.distance, v.constraint, v.component or ""))
    return [
        {
            "constraint": v.constraint,
            "component": v.component,
            "detail": v.detail,
            "actual": v.actual,
            "limit": v.limit,
            "distance": v.distance,
        }
        for v in ordered
    ]


def _scenarios(values: Any) -> dict[str, float]:
    return {scenario: values[scenario] for scenario in SCENARIOS}
