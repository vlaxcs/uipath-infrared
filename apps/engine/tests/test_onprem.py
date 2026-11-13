from dataclasses import replace

import pytest

from engine.domain.onprem import PlatformUse, capacity_share, platform_cost_for

PLATFORM_MONTHLY_EUR = 310000 / 60 + 2400 + 1800 + 96 * 0.02 * (420 + 2 * 85) / 12 + (60 + 6 * 768 / 100) * 85


@pytest.fixture(scope="module")
def platform(catalog):
    return catalog.platforms["onprem-dc1"]


def test_the_full_platform_cost_adds_capex_cooling_colocation_disks_and_staff(platform, forecast):
    cost = platform_cost_for(platform, PlatformUse(384, 0, 0), forecast.business)
    assert cost.capex_amortised_eur_month == pytest.approx(310000 / 60)
    assert cost.power_cooling_eur_month == 2400
    assert cost.colocation_eur_month == 1800
    assert cost.disk_replacement_eur_month == pytest.approx(94.4)
    assert cost.staff_hours_month == pytest.approx(106.08)
    assert cost.staff_eur_month == pytest.approx(106.08 * 85)
    assert cost.full_monthly_eur == pytest.approx(PLATFORM_MONTHLY_EUR)


def test_the_cost_is_allocated_by_the_scarcest_capacity(platform, forecast):
    use = PlatformUse(vcpu=76.8, memory_gb=3072, storage_tb=20)
    assert capacity_share(platform, use) == pytest.approx(0.5)
    cost = platform_cost_for(platform, use, forecast.business)
    assert cost.allocated_monthly_eur == pytest.approx(PLATFORM_MONTHLY_EUR / 2)
    assert (cost.platforms_needed, cost.capex_eur) == (1, 310000)


def test_a_share_above_one_adds_another_platform(platform, forecast):
    cost = platform_cost_for(platform, PlatformUse(vcpu=1152, memory_gb=0, storage_tb=0), forecast.business)
    assert cost.capacity_share == pytest.approx(1.5)
    assert (cost.platforms_needed, cost.capex_eur) == (2, 620000)
    assert cost.allocated_monthly_eur == pytest.approx(PLATFORM_MONTHLY_EUR * 1.5)


def test_a_missing_capacity_dimension_does_not_count(platform, forecast):
    bare = replace(platform, capacity={"vcpu": 768})
    assert capacity_share(bare, PlatformUse(vcpu=192, memory_gb=99999, storage_tb=999)) == pytest.approx(0.25)
