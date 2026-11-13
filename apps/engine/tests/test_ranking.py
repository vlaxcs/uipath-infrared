from dataclasses import dataclass, field, replace
from types import SimpleNamespace

import pytest

from engine.domain.ranking import decide
from engine.domain.violation import Violation


@dataclass
class Fake:
    id: str
    cost: float = 1000.0
    risk: float = 0.0
    effort_hours: float = 0.0
    migration_eur: float = 0.0
    monthly_now_total_eur: float = 100.0
    by_scenario: dict = field(default_factory=dict)
    violations: tuple = ()

    @property
    def feasible(self):
        return not self.violations

    @property
    def expected_total_eur(self):
        return self.cost

    def total_for(self, scenario):
        return self.by_scenario.get(scenario, self.cost)

    @property
    def check(self):
        return SimpleNamespace(violations=self.violations)


def blocked(distance_actual, limit=100.0):
    return (Violation("budget", None, "over budget", distance_actual, limit),)


def test_lowest_score_wins_and_every_loser_says_why(forecast):
    decision = decide([
        Fake("do_nothing", cost=1000),
        Fake("cleanup_orphans", cost=800, risk=0.1, effort_hours=10, migration_eur=500, monthly_now_total_eur=80),
        Fake("move_to_onprem", cost=900, risk=0.7, effort_hours=900, migration_eur=900, monthly_now_total_eur=60),
    ], forecast)
    assert decision.winner == "cleanup_orphans"
    assert decision.standings["cleanup_orphans"].lost_because is None
    assert decision.standings["do_nothing"].lost_because.reason == "cost"
    assert decision.standings["move_to_onprem"].lost_because.reason == "risk"
    assert decision.order == ("cleanup_orphans", "do_nothing", "move_to_onprem")


def test_payback_is_migration_over_the_monthly_saving(forecast):
    decision = decide([Fake("do_nothing"), Fake("cleanup_orphans", migration_eur=600, monthly_now_total_eur=40)], forecast)
    assert decision.standings["cleanup_orphans"].payback_months == pytest.approx(10)
    assert decision.standings["do_nothing"].payback_months is None


def test_a_winner_that_does_not_pay_back_in_the_horizon_loses_to_do_nothing(forecast):
    decision = decide([
        Fake("do_nothing", cost=1000),
        Fake("managed_services", cost=500, migration_eur=100_000, monthly_now_total_eur=99),
    ], forecast)
    assert decision.winner == "do_nothing"
    assert decision.standings["managed_services"].lost_because.reason == "payback"


def test_infeasible_candidates_are_not_scored_and_lose_on_the_constraint(forecast):
    decision = decide([Fake("do_nothing", violations=blocked(150)), Fake("cleanup_orphans", cost=900)], forecast)
    standing = decision.standings["do_nothing"]
    assert (standing.score, standing.rank, standing.rank_by_scenario, standing.pareto) == (None, None, None, False)
    assert standing.lost_because.reason == "constraint"
    assert decision.winner == "cleanup_orphans"


def test_nothing_feasible_names_the_closest_candidate(forecast):
    decision = decide([
        Fake("do_nothing", violations=blocked(300)),
        Fake("cleanup_orphans", violations=blocked(120)),
        Fake("rightsize_in_place", violations=blocked(200)),
    ], forecast)
    assert decision.winner is None
    assert decision.closest == "cleanup_orphans"
    assert decision.order == ("cleanup_orphans", "rightsize_in_place", "do_nothing")


def test_pareto_drops_a_candidate_beaten_on_every_axis(forecast):
    decision = decide([
        Fake("do_nothing", cost=1000, risk=0.2, effort_hours=10),
        Fake("cleanup_orphans", cost=900, risk=0.1, effort_hours=5, monthly_now_total_eur=90),
        Fake("move_to_onprem", cost=700, risk=0.9, effort_hours=500, monthly_now_total_eur=50),
    ], forecast)
    assert not decision.standings["do_nothing"].pareto
    assert decision.standings["cleanup_orphans"].pareto
    assert decision.standings["move_to_onprem"].pareto


def test_ties_are_broken_by_the_cto_rule(forecast):
    lower_risk = decide([Fake("do_nothing", risk=0.2), Fake("cleanup_orphans", risk=0.2)], forecast)
    assert lower_risk.winner == "cleanup_orphans"
    prefer_nothing = replace(forecast, cto=replace(forecast.cto, tie_break="do_nothing"))
    assert decide([Fake("do_nothing"), Fake("cleanup_orphans")], prefer_nothing).winner == "do_nothing"


def test_robustness_warns_when_the_winner_is_last_in_a_scenario(forecast):
    decision = decide([
        Fake("do_nothing", cost=1000, by_scenario={"high": 1000}),
        Fake("cleanup_orphans", cost=900, monthly_now_total_eur=90, by_scenario={"high": 1500}),
    ], forecast)
    assert decision.winner == "cleanup_orphans"
    assert decision.standings["cleanup_orphans"].rank_by_scenario["high"] == 2
    assert "winner_last_in_high" in decision.flags
