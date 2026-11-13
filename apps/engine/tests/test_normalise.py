import copy
import json

import pytest

from engine.domain.normalise import UnsupportedSchemaVersion, infra_from_document
from tests.conftest import MOCK_INFRA


@pytest.fixture
def mock_document():
    return json.loads(MOCK_INFRA.read_text())


def test_rejects_a_major_version_it_does_not_know(mock_document):
    mock_document["schema_version"] = "2.0"
    with pytest.raises(UnsupportedSchemaVersion):
        infra_from_document(mock_document)


def test_accepts_any_minor_version_of_1(mock_document):
    mock_document["schema_version"] = "1.7"
    assert infra_from_document(mock_document).schema_version == "1.7"


def test_unknown_kind_from_a_newer_minor_is_kept_as_other(mock_document):
    mock_document["components"][0]["kind"] = "vector_index"
    first_id = mock_document["components"][0]["id"]
    assert infra_from_document(mock_document).component(first_id).kind == "other"


def test_extension_fields_and_unknown_usage_keys_are_tolerated(mock_document):
    component = mock_document["components"][0]
    component["x_owner"] = "team-a"
    component.setdefault("usage", {})["x_new_metric"] = {"unit": "count", "window_days": 14, "provenance": "observed", "avg": 1}
    infra_from_document(mock_document)


def test_capacity_is_per_unit_and_totals_multiply_by_quantity(mock_infra):
    nodes = mock_infra.component("ng-shop-general")
    assert nodes.quantity == 12
    assert nodes.capacity_value("vcpu") == 32
    assert nodes.total_capacity("vcpu") == 384


def test_usage_sum_is_scaled_from_the_window_to_a_month(mock_infra):
    requests = mock_infra.component("alb-shop").usage["requests"]
    assert requests.window_days == 14
    assert requests.monthly_sum == pytest.approx(9_800_000 * 30 / 14)


def test_missing_fields_stay_unknown_instead_of_being_filled(mock_document):
    document = copy.deepcopy(mock_document)
    component = next(c for c in document["components"] if c["id"] == "rds-orders")
    del component["features_used"]
    assert infra_from_document(document).component("rds-orders").features_used is None


def test_components_come_out_in_a_stable_order(mock_document):
    reversed_document = copy.deepcopy(mock_document)
    reversed_document["components"].reverse()
    assert infra_from_document(reversed_document).components == infra_from_document(mock_document).components
