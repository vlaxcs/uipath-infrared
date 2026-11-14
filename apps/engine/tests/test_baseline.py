from dataclasses import replace

import pytest

from engine.domain.baseline import MISMATCH_THRESHOLD_PCT, price_baseline
from engine.domain.provenance import Provenance
from engine.domain.candidate import Action, ActionKind, Candidate
from engine.domain.costing import cost_placement
from engine.domain.end_state import apply_candidate


@pytest.fixture(scope="module")
def baseline(mock_infra, catalog):
    return price_baseline(mock_infra, catalog)


def cost_after(infra, catalog, *actions):
    end_state = apply_candidate(infra, catalog, Candidate("probe", tuple(actions)))
    return cost_placement(end_state.placements[actions[0].component], catalog)


def with_reported_provenance(infra, component_id, provenance):
    components = tuple(
        replace(c, reported_cost=replace(c.reported_cost, provenance=provenance)) if c.id == component_id else c
        for c in infra.components
    )
    return replace(infra, components=components)


def test_an_estimated_cost_gives_way_to_a_complete_catalog_price(baseline):
    priced = [c for c in baseline.costs if c.reported_eur is not None and c.catalog is not None and c.catalog.complete]
    assert priced
    assert all(c.source == "catalog" and c.monthly_eur == pytest.approx(c.catalog.monthly_eur) for c in priced)


def test_an_observed_cost_is_what_the_client_pays_and_wins(mock_infra, catalog):
    observed = with_reported_provenance(mock_infra, "ddb-orders", Provenance.OBSERVED)
    cost = next(c for c in price_baseline(observed, catalog).costs if c.component == "ddb-orders")
    assert cost.source == "reported"
    assert cost.monthly_eur == cost.reported_eur
    assert cost.catalog.monthly_eur != pytest.approx(cost.reported_eur)


def test_an_estimated_cost_stays_when_the_catalog_cannot_price_it_completely(baseline):
    unpriceable = [c for c in baseline.costs if c.reported_eur is not None and (c.catalog is None or not c.catalog.complete)]
    assert unpriceable
    assert all(c.source == "reported" and c.monthly_eur == c.reported_eur for c in unpriceable)


def test_cross_check_lists_only_differences_above_the_threshold(baseline):
    mismatches = {m.component: m for m in baseline.mismatches()}
    assert all(abs(m.diff_pct) > MISMATCH_THRESHOLD_PCT for m in mismatches.values())
    assert "ddb-orders" in mismatches
    assert mismatches["ddb-orders"].diff_pct < 0
    assert "nat-dev" not in mismatches


def test_kinds_without_a_catalog_option_stay_at_their_reported_cost(mock_infra, catalog):
    as_cdn = replace(
        mock_infra,
        components=tuple(
            replace(c, kind="cdn") if c.id == "cache-sessions" else c for c in mock_infra.components
        ),
    )
    cache = next(c for c in price_baseline(as_cdn, catalog).costs if c.component == "cache-sessions")
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
    multi = cost_after(
        mock_infra, catalog,
        Action("rds-orders", ActionKind.RESIZE, "probe", tier="db.r6g.8xlarge"),
        Action("rds-orders", ActionKind.SCALE, "probe", zones=2),
    )
    instance = lambda cost: next(l for l in cost.catalog.lines if l.driver == "instance")
    assert instance(multi).monthly_eur == pytest.approx(2 * instance(single).monthly_eur)


def test_changed_component_is_priced_from_the_catalog(mock_infra, catalog):
    cost = cost_after(mock_infra, catalog, Action("rds-orders", ActionKind.RESIZE, "oversized", tier="db.m5.2xlarge"))
    assert cost.source == "catalog"
    assert cost.monthly_eur == pytest.approx(500 + 2000 * 0.11)


def test_real_extraction_prices_without_crashing_and_flags_unpriced(real_infra, catalog):
    baseline = price_baseline(real_infra, catalog)
    assert "topic-shop-alerts" in baseline.unpriced
    assert all(c.monthly_eur == 0 for c in baseline.costs if c.source == "unpriced")


def test_an_other_kind_component_without_an_exact_service_match_stays_unpriced(real_infra, catalog):
    baseline = price_baseline(real_infra, catalog)
    ecr = next(c for c in baseline.costs if c.component == "ecr-repositories")
    assert ecr.catalog is None
    assert ecr.source == "unpriced"


def test_a_hosted_zone_prices_from_the_catalog(real_infra, catalog):
    baseline = price_baseline(real_infra, catalog)
    dns = next(c for c in baseline.costs if c.component == "dns-shop-example-com")
    assert dns.source == "catalog"
    assert dns.monthly_eur == pytest.approx(0.46)
