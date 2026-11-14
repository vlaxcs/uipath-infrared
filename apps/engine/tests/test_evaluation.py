import pytest

from engine.domain.baseline import price_baseline
from engine.domain.candidate import DO_NOTHING, Action, ActionKind, Candidate
from engine.domain.evaluation import evaluate_candidate
from engine.domain.proposals import build_proposals


def keep_previous(previous, infra, catalog, forecast):
    return previous.extend("cleanup_orphans", ())


@pytest.fixture(scope="module")
def baseline(mock_infra, catalog):
    return price_baseline(mock_infra, catalog)


@pytest.fixture(scope="module")
def do_nothing(mock_infra, catalog, forecast, baseline):
    return evaluate_candidate(DO_NOTHING, (), mock_infra, catalog, forecast, baseline)


def test_do_nothing_runs_at_the_baseline_and_migrates_nothing(do_nothing, baseline):
    assert do_nothing.run_eur_month_now == pytest.approx(baseline.monthly_eur)
    assert (do_nothing.migration_eur, do_nothing.effort_hours, do_nothing.risk) == (0, 0, 0)


def test_expected_total_adds_run_migration_ops_and_outage(do_nothing):
    assert do_nothing.expected_total_eur == pytest.approx(
        do_nothing.projection.expected_horizon_eur + do_nothing.ops_horizon_eur + do_nothing.outage_horizon_eur
    )
    assert do_nothing.outage_eur_year > 0


def test_do_nothing_breaks_the_budget_at_the_horizon(do_nothing):
    budget = [v for v in do_nothing.check.violations if v.constraint == "budget"]
    assert budget and budget[0].actual == pytest.approx(do_nothing.projection.at_horizon_by_scenario["base"])


def test_every_strategy_gets_the_remediation_layer_and_pays_for_it(mock_infra, catalog, forecast, baseline):
    proposals = build_proposals({"cleanup_orphans": keep_previous}, mock_infra, catalog, forecast)
    cleanup = proposals.proposals[1]
    assert set(cleanup.layers) == {"security_remediation"}
    evaluation = evaluate_candidate(cleanup.candidate, cleanup.layers, mock_infra, catalog, forecast, baseline)
    assert not [v for v in evaluation.check.violations if v.constraint.startswith("security.")]
    assert evaluation.remediation_hours > 0
    assert evaluation.migration_eur == pytest.approx(evaluation.remediation_hours * forecast.business.engineer_hourly_eur)
    assert evaluation.run_eur_month_now == pytest.approx(baseline.monthly_eur)


def test_strategies_without_a_builder_are_reported_not_invented(mock_infra, catalog, forecast):
    proposals = build_proposals({}, mock_infra, catalog, forecast)
    assert [p.candidate.id for p in proposals.proposals] == ["do_nothing"]
    assert "rightsize_in_place" in proposals.not_built


def test_confidence_is_never_better_than_the_estimated_baseline(do_nothing):
    assert do_nothing.confidence.level == "medium"
    assert do_nothing.confidence.reason == "cost.monthly_eur is estimated"


def test_a_move_with_unknown_extensions_is_flagged_and_riskier(mock_infra, catalog, forecast, baseline):
    move = Action("rds-erp", ActionKind.MOVE, "cheaper elsewhere", option="neon-launch")
    check = Action("rds-erp", ActionKind.FLAG, "features_used unknown", signal="verify_extensions")
    plain = evaluate_candidate(Candidate("managed_services", (move,)), ("managed_services",), mock_infra, catalog, forecast, baseline)
    flagged = evaluate_candidate(Candidate("managed_services", (move, check)), ("managed_services",) * 2, mock_infra, catalog, forecast, baseline)
    assert "verify_extensions" in flagged.flags
    assert "verify_extensions" not in plain.flags
    assert flagged.risk == pytest.approx(plain.risk + 0.15)
