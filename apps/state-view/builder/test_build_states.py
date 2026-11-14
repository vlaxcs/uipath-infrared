import json
import unittest
from pathlib import Path

import build_states

DATASET = build_states.build_document()["dataset"]
STATES = DATASET["states"]


class DocumentShapeTest(unittest.TestCase):
    def test_one_state_per_step_plus_baseline(self):
        self.assertEqual(len(STATES), DATASET["stepCount"] + 1)
        self.assertEqual([state["step"] for state in STATES], list(range(len(STATES))))

    def test_baseline_and_target_are_named(self):
        self.assertEqual(STATES[0]["label"], "Current estate")
        self.assertEqual(STATES[-1]["label"], "Target estate")
        self.assertEqual(STATES[0]["stageId"], "baseline")

    def test_costs_land_on_the_engine_endpoints(self):
        self.assertEqual(STATES[0]["summary"]["monthly_eur"], DATASET["baseline"]["monthly_eur"])
        self.assertEqual(STATES[-1]["summary"]["monthly_eur"], DATASET["target"]["monthly_eur"])
        self.assertEqual(STATES[0]["summary"]["monthly_eur"], 133308)
        self.assertEqual(STATES[-1]["summary"]["monthly_eur"], 74365)

    def test_every_state_snapshot_is_complete(self):
        for state in STATES:
            self.assertEqual(len(state["infra"]["stacks"]), 4)
            self.assertIn("components", state["infra"])
            self.assertIn("edges", state["infra"])
            self.assertIn("summary", state)
            self.assertIsInstance(state["summary"]["monthly_eur"], int)

    def test_edges_only_reference_live_components(self):
        for state in STATES:
            ids = {component["id"] for component in state["infra"]["components"]}
            for edge in state["infra"]["edges"]:
                self.assertIn(edge["from"], ids)
                self.assertIn(edge["to"], ids)


class TransitionsTest(unittest.TestCase):
    def test_every_step_has_exactly_one_change(self):
        for state in STATES[1:]:
            self.assertEqual(len(state["changes"]), 1)
            change = state["changes"][0]
            for key in ("component", "kind", "action", "verb", "reason", "saving_eur"):
                self.assertIn(key, change)

    def test_changed_component_is_marked_in_the_snapshot(self):
        for state in STATES[1:]:
            change = state["changes"][0]
            marked = [c for c in state["infra"]["components"] if c["changed"]]
            if change["kind"] == "removed":
                self.assertEqual(marked, [])
                continue
            self.assertEqual(len(marked), 1)
            self.assertEqual(marked[0]["id"], change["component"])
            self.assertEqual(marked[0]["changed"], change["kind"])
            self.assertEqual(marked[0]["changedAction"], change["action"])

    def test_removed_components_are_gone_and_ghosted(self):
        removed_ids = set()
        for state in STATES[1:]:
            change = state["changes"][0]
            live = {component["id"] for component in state["infra"]["components"]}
            if change["kind"] == "removed":
                removed_ids.add(change["component"])
                self.assertNotIn(change["component"], live)
            for ghost in state["removed"]:
                self.assertNotIn(ghost["id"], live)
                self.assertIn(ghost["tier"], {tier["id"] for tier in DATASET["tiers"]})
            self.assertEqual(state["summary"]["removed_total"], len(state["removed"]))
        self.assertEqual(len(removed_ids), 8)

    def test_target_estate_has_the_expected_size(self):
        target = STATES[-1]
        self.assertEqual(target["summary"]["components"], 30)
        self.assertEqual(len(target["removed"]), 8)

    def test_security_remediation_clears_the_addressed_issue(self):
        target = STATES[-1]
        # rds-orders and s3-uploads were public data stores: fully closed.
        for component_id in ("rds-orders", "s3-uploads"):
            component = next(c for c in target["infra"]["components"] if c["id"] == component_id)
            self.assertIsNone(component["securityIssue"], component_id)
        # rds-analytics was only flagged unencrypted; the plan encrypts it but
        # leaves public exposure alone, and the view must keep saying so.
        analytics = next(c for c in target["infra"]["components"] if c["id"] == "rds-analytics")
        self.assertEqual(analytics["securityIssue"], "public")

    def test_resize_updates_the_size_fact(self):
        state = next(s for s in STATES if s["shortLabel"] == "Resize rds-orders")
        change = state["changes"][0]
        component = next(c for c in state["infra"]["components"] if c["id"] == "rds-orders")
        self.assertEqual(component["facts"][0]["label"], "Size")
        self.assertIn(change["to"], component["facts"][0]["value"])
        self.assertEqual(component["changed"], "resized")

    def test_move_updates_the_placement_fact(self):
        state = next(s for s in STATES if s["shortLabel"] == "Move rds-orders")
        change = state["changes"][0]
        component = next(c for c in state["infra"]["components"] if c["id"] == "rds-orders")
        self.assertEqual(component["facts"][0]["label"], "Placement")
        self.assertEqual(component["facts"][0]["value"], change["to"])


class HonestyTest(unittest.TestCase):
    def test_availability_is_reported_only_at_the_ends(self):
        self.assertEqual(STATES[0]["summary"]["availability_source"], "observed")
        self.assertEqual(STATES[-1]["summary"]["availability_source"], "engine")
        for state in STATES[1:-1]:
            self.assertIsNone(state["summary"]["availability_pct"])
            self.assertIsNone(state["summary"]["availability_source"])

    def test_intermediate_costs_are_marked_modelled(self):
        for state in STATES[1:-1]:
            self.assertEqual(state["cost_source"], "modelled")
        self.assertEqual(STATES[0]["cost_source"], "observed")
        self.assertEqual(STATES[-1]["cost_source"], "engine")

    def test_stages_cover_every_step_once(self):
        seen = []
        for stage in DATASET["stages"]:
            self.assertGreaterEqual(stage["firstStateIndex"], 1)
            self.assertEqual(stage["stepCount"], len(stage["stateIds"]))
            seen.extend(stage["stateIds"])
        self.assertEqual(len(seen), DATASET["stepCount"])
        self.assertEqual(len(set(seen)), DATASET["stepCount"])


class DashboardMappingTest(unittest.TestCase):
    def test_component_shape_matches_the_dashboard_type(self):
        required = {
            "id", "kind", "stack", "status", "quantity", "monthlyEur",
            "securityIssue", "typeLabel", "facts",
        }
        for component in STATES[-1]["infra"]["components"]:
            self.assertTrue(required.issubset(component.keys()), component["id"])
            self.assertIsInstance(component["monthlyEur"], int)
            self.assertEqual(len(component["facts"]), 2)
            self.assertIn("value", component["facts"][0])

    def test_stack_shape_matches_the_dashboard_type(self):
        for stack in STATES[0]["infra"]["stacks"]:
            self.assertIn("id", stack)
            self.assertIn("name", stack)

    def test_checked_in_document_matches_the_builder(self):
        checked_in = json.loads((Path(build_states.DEFAULT_OUT)).read_text(encoding="utf-8"))
        built = build_states.build_document()
        self.assertEqual(checked_in["dataset"]["states"], built["dataset"]["states"])


if __name__ == "__main__":
    unittest.main()
