import pytest

from sandbox.domain.end_state import CandidateNotFound, ResultAction, candidate_actions, end_state, infra_actions

INFRA = {
    "components": [
        {"id": "web", "kind": "virtual_machine", "sku": "m5.4xlarge", "quantity": 3, "zones": 1},
        {"id": "db", "kind": "postgres", "sku": "db.r5.4xlarge", "quantity": 1, "zones": 1},
        {"id": "files", "kind": "object_storage", "sku": "standard", "quantity": 1, "zones": None},
        {"id": "bastion", "kind": "virtual_machine", "sku": "t3.large", "quantity": 1, "zones": 1},
        {"id": "jump", "kind": "virtual_machine", "sku": "t3.small", "quantity": 1, "zones": 1},
    ]
}


def state_of(actions):
    state = end_state("pick", infra_actions(INFRA), actions)
    return {action.component_id: action for action in state.candidate.actions}, state.skipped


def test_components_without_an_action_are_kept_as_they_are():
    components, skipped = state_of([])

    assert components["web"].action == "keep"
    assert (components["web"].quantity, components["web"].sku, components["web"].zones) == (3, "m5.4xlarge", 1)
    assert components["files"].zones == 1
    assert skipped == []


def test_delete_and_stop_mark_the_component_as_not_built():
    components, _ = state_of([ResultAction("bastion", "delete"), ResultAction("jump", "stop")])

    assert components["bastion"].action == "delete"
    assert components["jump"].action == "stop"


def test_resize_and_scale_take_what_to_states_and_keep_the_rest():
    components, _ = state_of([ResultAction("web", "resize", "2 x m5.2xlarge"), ResultAction("web", "scale", "2 zones"), ResultAction("db", "resize", "db.r5.2xlarge")])

    assert (components["web"].quantity, components["web"].sku, components["web"].zones, components["web"].action) == (2, "m5.2xlarge", 2, "resize+scale")
    assert (components["db"].quantity, components["db"].sku, components["db"].zones) == (1, "db.r5.2xlarge", 1)


def test_move_applies_zones_and_records_what_is_not_rehearsed():
    components, skipped = state_of([ResultAction("db", "move", "aws-aurora-postgres, 2 zones"), ResultAction("files", "move", "aws-s3 eu-west-1")])

    assert components["db"].zones == 2
    assert components["files"].action == "keep"
    assert [item.component for item in skipped] == ["db", "files"]
    assert "applied zones 2" in skipped[0].reason
    assert "built as in infra.json" in skipped[1].reason


def test_untranslatable_actions_are_skipped_with_a_reason():
    components, skipped = state_of([ResultAction("web", "resize", "bursting"), ResultAction("web", "autoscale"), ResultAction("account", "remediate")])

    assert components["web"].quantity == 3
    assert [(item.component, item.action) for item in skipped] == [("web", "resize"), ("web", "autoscale"), ("account", "remediate")]
    assert "not an infra.json component" in skipped[2].reason


def test_actions_after_a_delete_are_ignored():
    components, skipped = state_of([ResultAction("bastion", "delete"), ResultAction("bastion", "resize", "t3.small")])

    assert components["bastion"].action == "delete"
    assert skipped == []


def test_candidate_actions_come_from_the_picked_candidate():
    result = {"candidates": [{"id": "a", "actions": [{"component": "web", "action": "resize", "to": "t3.small"}]}, {"id": "b", "actions": []}]}

    assert candidate_actions(result, "a") == [ResultAction("web", "resize", "t3.small")]
    with pytest.raises(CandidateNotFound):
        candidate_actions(result, "missing")
