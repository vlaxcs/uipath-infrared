from dataclasses import dataclass
from typing import Mapping

from engine.domain.forecast import Forecast
from engine.domain.growth import CurveKey, curve_factor
from engine.domain.pricing import Growth

MONTHS_PER_YEAR = 12


@dataclass(frozen=True)
class Projection:
    monthly_now_eur: float
    at_horizon_by_scenario: Mapping[str, float]
    horizon_by_scenario: Mapping[str, float]
    expected_horizon_eur: float


def monthly_discount(forecast: Forecast, month: int) -> float:
    monthly_rate = (1 + forecast.business.discount_rate_annual) ** (1 / MONTHS_PER_YEAR) - 1
    return 1 / (1 + monthly_rate) ** month


def discounted_months(forecast: Forecast) -> float:
    return sum(monthly_discount(forecast, month) for month in range(1, forecast.horizon_months + 1))


def run_cost_at(split: Mapping[CurveKey, float] | Mapping[Growth, float], forecast: Forecast, scenario_id: str, month: int) -> float:
    return sum(eur * curve_factor(forecast, scenario_id, key, month) for key, eur in split.items())


def project(split: Mapping[CurveKey, float] | Mapping[Growth, float], forecast: Forecast) -> Projection:
    months = range(1, forecast.horizon_months + 1)
    horizon = {
        scenario_id: sum(
            run_cost_at(split, forecast, scenario_id, month) * monthly_discount(forecast, month)
            for month in months
        )
        for scenario_id in forecast.scenarios
    }
    return Projection(
        monthly_now_eur=sum(split.values()),
        at_horizon_by_scenario={
            scenario_id: run_cost_at(split, forecast, scenario_id, forecast.horizon_months)
            for scenario_id in forecast.scenarios
        },
        horizon_by_scenario=horizon,
        expected_horizon_eur=sum(
            forecast.scenarios[scenario_id].probability * eur for scenario_id, eur in horizon.items()
        ),
    )
