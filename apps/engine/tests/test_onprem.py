from dataclasses import replace

import pytest

from engine.domain.forecast import Event
from engine.domain.onprem import PlatformUse, capacity_share, platform_cost_for

CAPEX_MONTH = 310000 / 60
DISKS_MONTH = 96 * 0.02 * (420 + 2 * 85) / 12
STAFF_MONTH = (60 + 6 * 768 / 100) * 85
MAINTENANCE_MONTH = 310000 * 0.08 / 12
RUNNING_MONTH = 2400 + 1800 + DISKS_MONTH + STAFF_MONTH + MAINTENANCE_MONTH + 600 + 900
CONTINGENCY_MONTH = RUNNING_MONTH * 0.15
PLATFORM_MONTHLY_EUR = CAPEX_MONTH + RUNNING_MONTH + CONTINGENCY_MONTH
BASE_TRAFFIC_AT_HORIZON = 1.02 ** 36 * 1.4


@pytest.fixture(scope="module")
def platform(catalog):
    return catalog.platforms["onprem-dc1"]


def flat(forecast):
    scenarios = {
        sid: replace(s, traffic_multiplier=1.0, data_multiplier=1.0) for sid, s in forecast.scenarios.items()
    }
    return replace(forecast, scenarios=scenarios, events=())


def test_every_line_of_the_full_platform_cost(platform, forecast):
    lines = platform_cost_for(platform, PlatformUse(384, 0, 0), forecast).full
    assert lines.capex_amortised_eur_month == pytest.approx(CAPEX_MONTH)
    assert (lines.power_cooling_eur_month, lines.colocation_eur_month) == (2400, 1800)
    assert lines.disk_replacement_eur_month == pytest.approx(94.4)
    assert lines.staff_eur_month == pytest.approx(106.08 * 85)
    assert lines.maintenance_eur_month == pytest.approx(2066.67, abs=0.01)
    assert (lines.network_eur_month, lines.licences_eur_month) == (600, 900)
    assert lines.contingency_eur_month == pytest.approx(CONTINGENCY_MONTH)
    assert lines.total_eur_month == pytest.approx(PLATFORM_MONTHLY_EUR)
    assert PLATFORM_MONTHLY_EUR == pytest.approx(24576.21, abs=0.01)


def test_the_contingency_leaves_the_hardware_price_alone(platform, forecast):
    lines = platform_cost_for(replace(platform, contingency_pct=0), PlatformUse(384, 0, 0), forecast).full
    assert lines.total_eur_month == pytest.approx(CAPEX_MONTH + RUNNING_MONTH)


def test_a_catalog_without_the_new_lines_prices_as_before(platform, forecast):
    bare = replace(
        platform, maintenance_pct_of_capex_year=0, network_eur_month=0, licences_eur_month=0,
        setup_one_off_eur=0, contingency_pct=0,
    )
    cost = platform_cost_for(bare, PlatformUse(384, 0, 0), forecast)
    assert cost.full_monthly_eur == pytest.approx(18477.87, abs=0.01)
    assert cost.setup_eur == 0


def test_the_cost_is_allocated_by_the_scarcest_capacity(platform, forecast):
    use = PlatformUse(vcpu=76.8, memory_gb=3072, storage_tb=20)
    assert capacity_share(platform, use) == pytest.approx(0.5)
    cost = platform_cost_for(platform, use, flat(forecast))
    assert cost.allocated_monthly_eur == pytest.approx(PLATFORM_MONTHLY_EUR / 2)
    assert cost.allocated.staff_eur_month == pytest.approx(STAFF_MONTH / 2)


def test_one_offs_are_allocated_by_the_share_too(platform, forecast):
    cost = platform_cost_for(platform, PlatformUse(vcpu=192, memory_gb=0, storage_tb=0), forecast)
    assert cost.setup_eur == pytest.approx(30000 / 4)
    assert cost.upfront_hardware_eur == pytest.approx(310000 / 4)


def test_platforms_are_sized_for_the_base_scenario_at_the_horizon(platform, forecast):
    cost = platform_cost_for(platform, PlatformUse(vcpu=320, memory_gb=0, storage_tb=0), forecast)
    assert cost.capacity_share == pytest.approx(320 / 768)
    assert cost.capacity_share_at_horizon == pytest.approx(320 / 768 * BASE_TRAFFIC_AT_HORIZON)
    assert (cost.platforms_needed, cost.capex_eur) == (2, 620000)


def test_storage_grows_with_data_not_traffic(platform, forecast):
    data_only = replace(flat(forecast), events=(Event(month=1, description="", data_multiplier=3.0),))
    cost = platform_cost_for(platform, PlatformUse(vcpu=0, memory_gb=0, storage_tb=100), data_only)
    assert cost.capacity_share == pytest.approx(0.5)
    assert cost.capacity_share_at_horizon == pytest.approx(1.5)
    assert cost.platforms_needed == 2


def test_a_flat_forecast_needs_one_platform_below_full(platform, forecast):
    cost = platform_cost_for(platform, PlatformUse(vcpu=700, memory_gb=0, storage_tb=0), flat(forecast))
    assert (cost.platforms_needed, cost.capex_eur) == (1, 310000)


def test_a_missing_capacity_dimension_does_not_count(platform):
    bare = replace(platform, capacity={"vcpu": 768})
    assert capacity_share(bare, PlatformUse(vcpu=192, memory_gb=99999, storage_tb=999)) == pytest.approx(0.25)
