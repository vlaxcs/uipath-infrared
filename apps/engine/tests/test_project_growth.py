import pytest

from engine.domain.forecast import forecast_from_document
from engine.domain.pricing import Growth
from engine.domain.projection import run_cost_at


def document(projects):
    return {
        "schema_version": "1.0",
        "id": "f",
        "horizon_months": 24,
        "currency": "EUR",
        "scenarios": {
            "base": {"probability": 0.6, "monthly_multiplier": {"traffic": 1.05, "data": 1.02}},
            "high": {"probability": 0.4, "monthly_multiplier": {"traffic": 1.08, "data": 1.04}},
        },
        "hard_constraints": {},
        "cto_settings": {"ha_level": "multi_az", "min_zones": 2, "weights": {"cost": 0.5, "risk": 0.3, "effort": 0.2}, "tie_break": "lowest_cost", "strategies_enabled": ["do_nothing"]},
        "business": {"downtime_cost_per_hour_eur": 1000, "engineer_hourly_eur": 80, "discount_rate_annual": 0.0},
        "projects": projects,
    }


BOOKING = {
    "id": "booking",
    "name": "Clinic booking",
    "stacks": ["booking-prod", "booking-staging"],
    "users": {"metric": "monthly_active_users", "current": 41000, "expected": [{"month": 12, "base": 60000}, {"month": 24, "base": 112500, "high": 178500}]},
}


def test_a_project_grows_on_its_users_from_its_last_expected_month():
    forecast = forecast_from_document(document([BOOKING]))
    [booking] = forecast.projects
    assert booking.monthly_by_scenario["base"] == pytest.approx((112500 / 41000) ** (1 / 24))
    assert booking.monthly_by_scenario["high"] == pytest.approx((178500 / 41000) ** (1 / 24))
    assert forecast.project_of("booking-staging") is booking
    assert forecast.project_of("shop") is None


def test_a_project_scenario_without_its_own_column_reads_base():
    project = {**BOOKING, "users": {**BOOKING["users"], "expected": [{"month": 24, "base": 112500}]}}
    [booking] = forecast_from_document(document([project])).projects
    assert booking.monthly_by_scenario["high"] == booking.monthly_by_scenario["base"]


def test_project_costs_follow_the_project_and_the_rest_follows_the_estate():
    forecast = forecast_from_document(document([BOOKING]))
    split = {("booking", Growth.TRAFFIC): 1000.0, (None, Growth.TRAFFIC): 1000.0, ("booking", Growth.FIXED): 500.0}
    at_24 = run_cost_at(split, forecast, "base", 24)
    assert at_24 == pytest.approx(1000 * 112500 / 41000 + 1000 * 1.05 ** 24 + 500)


def test_a_split_keyed_by_growth_alone_is_the_estate_as_before():
    forecast = forecast_from_document(document([BOOKING]))
    assert run_cost_at({Growth.TRAFFIC: 1000.0}, forecast, "base", 12) == pytest.approx(1000 * 1.05 ** 12)


def test_a_stack_can_belong_to_one_project_only():
    other = {**BOOKING, "id": "other", "stacks": ["booking-prod"]}
    with pytest.raises(ValueError, match="booking-prod belongs to both booking and other"):
        forecast_from_document(document([BOOKING, other]))


def test_users_now_must_be_above_zero():
    broken = {**BOOKING, "users": {**BOOKING["users"], "current": 0}}
    with pytest.raises(ValueError, match="above 0"):
        forecast_from_document(document([broken]))
