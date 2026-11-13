import pytest

from engine.domain.baseline import MISMATCH_THRESHOLD_PCT, price_baseline
from engine.domain.candidate import Action, ActionKind, Candidate
from engine.domain.costing import cost_placement
from engine.domain.end_state import apply_candidate


@pytest.fixture(scope="module")
def baseline(mock_infra, catalog):
    return price_baseline(mock_infra, catalog)


def cost_after(infra, catalog, action):
    end_state = apply_candidate(infra, catalog, Candidate("probe", (action,)))
    return cost_placement(end_state.placements[action.component], catalog)


def test_mock_baseline_matches_the_reported_estate(baseline):
    assert baseline.monthly_eur == pytest.approx(133_308)


def test_every_reported_component_keeps_its_reported_cost(baseline):
    assert all(c.source == "reported" for c in baseline.costs if c.reported_eur is not None)


def test_cross_check_lists_only_differences_above_the_threshold(baseline):
    mismatches = {m.component: m for m in baseline.mismatches()}
    assert all(abs(m.diff_pct) > MISMATCH_THRESHOLD_PCT for m in mismatches.values())
    assert "ddb-orders" in mismatches
    assert mismatches["ddb-orders"].diff_pct < 0
    assert "nat-dev" not in mismatches


def test_kinds_without_a_catalog_option_stay_at_their_reported_cost(baseline):
    cache = next(c for c in baseline.costs if c.component == "cache-sessions")
    assert cache.catalog is None
    assert cache.monthly_eur == cache.reported_eur


def test_deleted_component_costs_nothing(mock_infra, catalog):
    cost = cost_after(mock_infra, catalog, Action("rds-orders-clone", ActionKind.DELETE, "orphan"))
    assert cost.monthly_eur == 0


def test_stopped_vm_keeps_paying_for_its_disks_only(mock_infra, catalog):
    cost = cost_after(mock_infra, catalog, Action("vm-dev-jump", ActionKind.STOP, "idle"))
    assert [line.driver for line in cost.catalog.lines] == ["storage_gb_month"]
    assert cost.monthly_eur == pytest.approx(500 * 2 * 0.08)


def test_multi_az_database_pays_the_multi_az_multiplier(mock_infra, catalog):
    single = cost_after(mock_infra, catalog, Action("rds-orders", ActionKind.RESIZE, "probe", tier="db.r6g.8xlarge"))
    multi = cost_after(mock_infra, catalog, Action("rds-orders", ActionKind.SCALE, "probe", zones=2))
    instance = lambda cost: next(l for l in cost.catalog.lines if l.driver == "instance")
    assert instance(multi).monthly_eur == pytest.approx(2 * instance(single).monthly_eur)


def test_changed_component_is_priced_from_the_catalog(mock_infra, catalog):
    cost = cost_after(mock_infra, catalog, Action("rds-orders", ActionKind.RESIZE, "oversized", tier="db.m5.2xlarge"))
    assert cost.source == "catalog"
    assert cost.monthly_eur == pytest.approx(500 + 2000 * 0.11)


def test_real_extraction_prices_without_crashing_and_flags_unpriced(real_infra, catalog):
    baseline = price_baseline(real_infra, catalog)
    assert baseline.monthly_eur >= baseline.reported_monthly_eur
    assert "fn-shop-resize-image" in baseline.unpriced
    assert all(c.monthly_eur == 0 for c in baseline.costs if c.source == "unpriced")
