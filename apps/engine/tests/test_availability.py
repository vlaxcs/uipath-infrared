from dataclasses import replace

import pytest

from engine.domain.availability import (
    DEFAULT_SINGLE_ZONE_AVAILABILITY_PCT, availability_of, placement_availability,
)
from engine.domain.candidate import DO_NOTHING, Action, ActionKind
from engine.domain.end_state import apply_candidate


def state(infra, catalog, *actions):
    return apply_candidate(infra, catalog, DO_NOTHING.extend("test", tuple(actions)))


def component_pct(end_state, catalog, component_id):
    return placement_availability(end_state.placements[component_id], catalog).availability_pct


def test_single_zone_rds_gets_the_single_zone_sla(mock_infra, catalog):
    assert component_pct(state(mock_infra, catalog), catalog, "rds-orders") == 99.5


def test_a_second_zone_uses_the_catalog_multi_az_sla(mock_infra, catalog):
    scaled = state(mock_infra, catalog, Action("rds-orders", ActionKind.SCALE, "test", zones=2))
    assert component_pct(scaled, catalog, "rds-orders") == 99.95


def test_without_a_multi_az_sla_zones_fail_independently(mock_infra, catalog):
    scaled = state(mock_infra, catalog, Action("vmfleet-web", ActionKind.SCALE, "test", zones=2))
    assert component_pct(scaled, catalog, "vmfleet-web") == pytest.approx(99.9975)


def test_a_multi_zone_service_keeps_its_sla_whatever_the_zone_count(mock_infra, catalog):
    assert component_pct(state(mock_infra, catalog), catalog, "ddb-orders") == 99.99


def test_a_kind_without_a_catalog_option_gets_the_default(mock_infra, catalog):
    as_cdn = replace(
        mock_infra,
        components=tuple(
            replace(c, kind="cdn") if c.id == "cache-sessions" else c for c in mock_infra.components
        ),
    )
    end_state = state(as_cdn, catalog)
    assert component_pct(end_state, catalog, "cache-sessions") == DEFAULT_SINGLE_ZONE_AVAILABILITY_PCT


def test_a_path_is_the_product_of_its_components(mock_infra, catalog):
    availability = availability_of(state(mock_infra, catalog), mock_infra, catalog)
    shop = next(path for path in availability.paths if path.stack == "shop")
    expected = 0.9999 * 0.999 * 0.9999 * 0.995 * 0.995 * 100
    assert shop.availability_pct == pytest.approx(expected)
    assert availability.availability_pct == min(path.availability_pct for path in availability.paths)


def test_a_removed_component_no_longer_counts(mock_infra, catalog):
    removed = state(mock_infra, catalog, Action("cache-sessions", ActionKind.DELETE, "test"))
    shop = next(p for p in availability_of(removed, mock_infra, catalog).paths if p.stack == "shop")
    assert "cache-sessions" not in {c.component for c in shop.components}
