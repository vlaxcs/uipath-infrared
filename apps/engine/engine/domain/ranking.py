from dataclasses import dataclass
from typing import Callable, Mapping, Sequence

from engine.domain.candidate import DO_NOTHING
from engine.domain.evaluation import Evaluation
from engine.domain.forecast import Forecast
from engine.domain.violation import total_distance

CRITERIA = ("cost", "risk", "effort")


@dataclass(frozen=True)
class LostBecause:
    reason: str
    detail: str


@dataclass(frozen=True)
class Standing:
    score: float | None
    pareto: bool
    rank: int | None
    rank_by_scenario: Mapping[str, int] | None
    payback_months: float | None
    violation_distance: float
    lost_because: LostBecause | None


@dataclass(frozen=True)
class Decision:
    standings: Mapping[str, Standing]
    order: tuple[str, ...]
    winner: str | None
    closest: str | None
    flags: tuple[str, ...]


def decide(evaluations: Sequence[Evaluation], forecast: Forecast) -> Decision:
    by_id = {e.id: e for e in evaluations}
    baseline = by_id[DO_NOTHING.id]
    payback = {e.id: _payback(e, baseline) for e in evaluations}
    feasible = [e for e in evaluations if e.feasible]
    late = {
        e.id for e in feasible
        if baseline.feasible and payback[e.id] is not None and payback[e.id] > forecast.horizon_months
    }
    weights = _weights(forecast)
    tie_break = forecast.cto.tie_break
    ordered, scores = _rank(feasible, weights, tie_break, late, lambda e: e.expected_total_eur)
    by_scenario = {
        scenario: _positions(_rank(feasible, weights, tie_break, late, lambda e, s=scenario: e.total_for(s))[0])
        for scenario in forecast.scenarios
    }
    positions = _positions(ordered)
    winner = ordered[0] if ordered else None
    pareto = _pareto(feasible)
    normalised = _normalised(feasible, lambda e: e.expected_total_eur)
    standings = {}
    for e in evaluations:
        rank = positions.get(e.id)
        standings[e.id] = Standing(
            score=scores.get(e.id),
            pareto=e.id in pareto,
            rank=rank,
            rank_by_scenario=None if rank is None else {s: by_scenario[s][e.id] for s in sorted(forecast.scenarios)},
            payback_months=payback[e.id],
            violation_distance=total_distance(e.check.violations),
            lost_because=_lost_because(e, winner, late, payback[e.id], weights, normalised, forecast),
        )
    infeasible = sorted((e for e in evaluations if not e.feasible), key=lambda e: (standings[e.id].violation_distance, e.id))
    closest = None if winner or not infeasible else infeasible[0].id
    return Decision(
        standings=standings,
        order=tuple(e.id for e in ordered) + tuple(e.id for e in infeasible),
        winner=winner.id if winner else None,
        closest=closest,
        flags=_robustness_flags(winner, standings, len(ordered)),
    )


def _positions(ordered: Sequence[Evaluation]) -> dict[str, int]:
    return {e.id: index + 1 for index, e in enumerate(ordered)}


def _payback(evaluation: Evaluation, baseline: Evaluation) -> float | None:
    if evaluation.id == baseline.id:
        return None
    saving = baseline.monthly_now_cash_eur - evaluation.monthly_now_cash_eur
    return (evaluation.migration_eur + evaluation.upfront_hardware_eur) / saving if saving > 0 else None


def _weights(forecast: Forecast) -> dict[str, float]:
    raw = {key: max(0.0, forecast.cto.weights.get(key, 0.0)) for key in CRITERIA}
    total = sum(raw.values())
    return {key: value / total for key, value in raw.items()}


def _criteria(evaluation: Evaluation, cost: Callable[[Evaluation], float]) -> dict[str, float]:
    return {"cost": cost(evaluation), "risk": evaluation.risk, "effort": evaluation.effort_hours}


def _normalised(evaluations: Sequence[Evaluation], cost: Callable[[Evaluation], float]) -> dict[str, dict[str, float]]:
    values = {e.id: _criteria(e, cost) for e in evaluations}
    if not values:
        return {}
    normalised = {e.id: {} for e in evaluations}
    for key in CRITERIA:
        low = min(v[key] for v in values.values())
        high = max(v[key] for v in values.values())
        for candidate_id, v in values.items():
            normalised[candidate_id][key] = 0.0 if high == low else (v[key] - low) / (high - low)
    return normalised


def _rank(
    feasible: Sequence[Evaluation],
    weights: Mapping[str, float],
    tie_break: str,
    late: set[str],
    cost: Callable[[Evaluation], float],
) -> tuple[list[Evaluation], dict[str, float]]:
    if not feasible:
        return [], {}
    normalised = _normalised(feasible, cost)
    scores = {cid: sum(weights[k] * n[k] for k in CRITERIA) for cid, n in normalised.items()}
    ordered = sorted(feasible, key=lambda e: (e.id in late, scores[e.id], _tie_key(e, tie_break, cost), e.id))
    return ordered, scores


def _tie_key(evaluation: Evaluation, tie_break: str, cost: Callable[[Evaluation], float]) -> float:
    match tie_break:
        case "lower_cost":
            return cost(evaluation)
        case "lower_effort":
            return evaluation.effort_hours
        case "do_nothing":
            return 0.0 if evaluation.id == DO_NOTHING.id else 1.0
    return evaluation.risk


def _pareto(feasible: Sequence[Evaluation]) -> set[str]:
    points = {e.id: (e.expected_total_eur, e.risk, e.effort_hours) for e in feasible}
    return {
        cid for cid, point in points.items()
        if not any(
            all(o <= p for o, p in zip(other, point)) and other != point
            for oid, other in points.items() if oid != cid
        )
    }


def _lost_because(
    evaluation: Evaluation,
    winner: Evaluation | None,
    late: set[str],
    payback: float | None,
    weights: Mapping[str, float],
    normalised: Mapping[str, Mapping[str, float]],
    forecast: Forecast,
) -> LostBecause | None:
    if not evaluation.feasible:
        worst = max(evaluation.check.violations, key=lambda v: (v.distance, v.constraint))
        others = len(evaluation.check.violations) - 1
        suffix = f" (and {others} more)" if others else ""
        return LostBecause("constraint", f"{worst.constraint}: {worst.detail}{suffix}")
    if winner is None or evaluation.id == winner.id:
        return None
    if evaluation.id in late:
        return LostBecause(
            "payback",
            f"pays back in {payback:.0f} months, beyond the {forecast.horizon_months}-month horizon",
        )
    gaps = {k: weights[k] * (normalised[evaluation.id][k] - normalised[winner.id][k]) for k in CRITERIA}
    reason = max(CRITERIA, key=lambda k: (gaps[k], -CRITERIA.index(k)))
    if gaps[reason] <= 0:
        reason = {"lower_cost": "cost", "lower_effort": "effort"}.get(forecast.cto.tie_break, "risk")
        return LostBecause(reason, f"same score as {winner.id}; the tie goes to {forecast.cto.tie_break.replace('_', ' ')}")
    return LostBecause(reason, _gap_detail(reason, evaluation, winner))


def _gap_detail(reason: str, evaluation: Evaluation, winner: Evaluation) -> str:
    if reason == "cost":
        extra = evaluation.expected_total_eur - winner.expected_total_eur
        return f"EUR {extra:,.0f} more expected over the horizon than {winner.id}"
    if reason == "risk":
        return f"migration risk {evaluation.risk:.2f} against {winner.risk:.2f} for {winner.id}"
    extra = evaluation.effort_hours - winner.effort_hours
    return f"{extra:,.0f} more hours of effort than {winner.id}"


def _robustness_flags(winner: Evaluation | None, standings: Mapping[str, Standing], feasible_count: int) -> tuple[str, ...]:
    if winner is None or feasible_count < 2:
        return ()
    ranks = standings[winner.id].rank_by_scenario or {}
    return tuple(sorted(f"winner_last_in_{s}" for s, r in ranks.items() if r == feasible_count))
