from dataclasses import replace

import pytest

from engine.domain.pricing import Growth
from engine.domain.projection import discounted_months, project, run_cost_at


@pytest.fixture
def undiscounted(forecast):
    return replace(forecast, business=replace(forecast.business, discount_rate_annual=0.0))


def test_traffic_costs_grow_with_the_scenario_and_the_launch_event(forecast):
    cost = run_cost_at({Growth.TRAFFIC: 1000.0}, forecast, "base", 36)
    assert cost == pytest.approx(1000 * 1.02 ** 36 * 1.4)


def test_an_event_only_applies_from_its_month_on(forecast):
    before = run_cost_at({Growth.TRAFFIC: 1000.0}, forecast, "base", 5)
    assert before == pytest.approx(1000 * 1.02 ** 5)


def test_storage_costs_grow_with_data_not_traffic(forecast):
    cost = run_cost_at({Growth.DATA: 1000.0}, forecast, "base", 12)
    assert cost == pytest.approx(1000 * 1.03 ** 12 * 1.5)


def test_fixed_costs_do_not_grow(forecast):
    assert run_cost_at({Growth.FIXED: 1000.0}, forecast, "high", 36) == pytest.approx(1000)


def test_horizon_without_discount_is_the_plain_sum_of_months(undiscounted):
    projection = project({Growth.FIXED: 100.0}, undiscounted)
    assert projection.horizon_by_scenario["base"] == pytest.approx(100 * 36)


def test_discounting_makes_the_horizon_cheaper_than_the_plain_sum(forecast):
    assert discounted_months(forecast) < forecast.horizon_months
    assert project({Growth.FIXED: 100.0}, forecast).horizon_by_scenario["base"] < 3600


def test_expected_horizon_weights_scenarios_by_probability(forecast):
    projection = project({Growth.TRAFFIC: 1000.0}, forecast)
    weighted = sum(forecast.scenarios[s].probability * v for s, v in projection.horizon_by_scenario.items())
    assert projection.expected_horizon_eur == pytest.approx(weighted)
    assert projection.horizon_by_scenario["low"] < projection.horizon_by_scenario["base"] < projection.horizon_by_scenario["high"]
