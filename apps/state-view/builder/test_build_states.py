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
        self.assertEqual(len(removed_ids), 7)

    def test_target_estate_has_the_expected_size(self):
        target = STATES[-1]
        self.assertEqual(target["summary"]["components"], 31)
        self.assertEqual(len(target["removed"]), 7)

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


def step(short_label):
    return next(s for s in STATES if s["shortLabel"] == short_label)


def component_in(state, component_id):
    return next(c for c in state["infra"]["components"] if c["id"] == component_id)


class PlacementTest(unittest.TestCase):
    def test_zones_list_the_home_zone_first(self):
        zones = [zone["id"] for zone in DATASET["zones"]]
        self.assertEqual(zones[0], "aws:eu-west-1")
        self.assertIn("aws:us-east-1", zones)
        self.assertIn("neon:eu-west-1", zones)

    def test_every_component_sits_in_a_listed_zone(self):
        zones = {zone["id"] for zone in DATASET["zones"]}
        for state in STATES:
            for component in state["infra"]["components"]:
                self.assertIn(component["zone"], zones, component["id"])

    def test_move_to_another_provider_takes_the_catalog_provider(self):
        state = step("Move rds-erp")
        change = state["changes"][0]
        erp = component_in(state, "rds-erp")
        self.assertEqual(erp["provider"], "neon")
        self.assertEqual(erp["service"], "neon-launch")
        self.assertEqual((change["fromZone"], change["toZone"]), ("aws:eu-west-1", "neon:eu-west-1"))

    def test_region_move_changes_zone(self):
        change = step("Move s3-legacy-reports")["changes"][0]
        self.assertEqual((change["fromZone"], change["toZone"]), ("aws:us-east-1", "aws:eu-west-1"))

    def test_same_zone_move_has_no_zone_change(self):
        change = step("Move rds-orders")["changes"][0]
        self.assertNotIn("fromZone", change)

    def test_on_prem_move_lands_on_the_platform_site(self):
        dataset = build_states.build_dataset(candidate_id="move_to_onprem")
        target = dataset["states"][-1]
        for component_id in ("s3-legacy-reports", "rds-orders", "ng-shop-general"):
            self.assertEqual(component_in(target, component_id)["zone"], "onprem:onprem-dc1", component_id)
        self.assertEqual(dataset["zones"][-1]["label"], "On-prem · dc1")


class HandoffTest(unittest.TestCase):
    def test_consolidating_delete_names_where_the_work_goes(self):
        state = STATES[-1]
        change = state["changes"][0] if state["changes"][0]["component"] == "ng-shop-cpu" else step("Delete ng-shop-cpu")["changes"][0]
        self.assertEqual(change["into"], "ng-shop-general")
        ghost = next(r for r in STATES[-1]["removed"] if r["id"] == "ng-shop-cpu")
        self.assertEqual(ghost["into"], "ng-shop-general")

    def test_plain_delete_has_no_absorber(self):
        ghost = next(r for r in STATES[-1]["removed"] if r["id"] == "vm-bastion")
        self.assertIsNone(ghost["into"])

    def test_shared_move_names_the_cluster_it_joins(self):
        self.assertEqual(STATES[-1]["changes"][0]["component"], "pg-lake")
        self.assertEqual(STATES[-1]["changes"][0]["into"], "rds-analytics")

    def test_absorbed_edges_follow_the_absorber(self):
        edges = [{"from": "a", "to": "old"}, {"from": "a", "to": "new"}, {"from": "old", "to": "b"}]
        out = build_states.public_edges(edges, {"a", "new", "b"}, {"old": "new"})
        self.assertEqual([(e["from"], e["to"]) for e in out], [("a", "new"), ("new", "b")])
        self.assertEqual(out[1]["rehomedFrom"], "old")
        self.assertNotIn("rehomedFrom", out[0])


class StopTest(unittest.TestCase):
    def test_stop_keeps_the_resource_as_stopped(self):
        state = step("Stop vm-dev-jump")
        self.assertEqual(state["changes"][0]["kind"], "stopped")
        self.assertEqual(component_in(state, "vm-dev-jump")["status"], "stopped")
        self.assertNotIn("vm-dev-jump", {r["id"] for r in state["removed"]})


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


class EstateTodayTest(unittest.TestCase):
    def test_the_estate_alone_is_one_observed_state_with_no_plan(self):
        dataset = build_states.build_document(build_states.INFRA_PATH, None)["dataset"]
        self.assertEqual(len(dataset["states"]), 1)
        self.assertEqual(dataset["stepCount"], 0)
        self.assertEqual(dataset["stages"], [])
        self.assertEqual(dataset["states"][0]["label"], "Current estate")
        self.assertEqual(dataset["states"][0]["summary"]["components"], 38)
        self.assertIsNone(dataset["source"]["result"])
        self.assertTrue(dataset["subtitle"].startswith("Estate today"))

    def test_estate_mode_refuses_a_result(self):
        with self.assertRaises(SystemExit):
            build_states.main(["--estate", "--infra", str(build_states.INFRA_PATH), "--result", str(build_states.RESULT_PATH)])


class ARunsOwnFilesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import subprocess, sys, tempfile
        repo = Path(__file__).resolve().parents[3]
        cls.scratch = Path(tempfile.mkdtemp(prefix="states-"))
        cls.infra = repo / "contracts" / "mock" / "startup.infra.json"
        cls.result = cls.scratch / "result.json"
        subprocess.run(
            [sys.executable, "-m", "engine", "evaluate", str(cls.infra), str(repo / "contracts" / "mock" / "startup.forecast.json"),
             str(repo / "contracts" / "real" / "catalog.json"), "--out", str(cls.result)],
            check=True, cwd=repo / "apps" / "engine",
        )
        cls.document = json.loads(cls.result.read_text(encoding="utf-8"))

    def build(self, candidate):
        out = self.scratch / f"states.{candidate}.json"
        code = build_states.main(["--infra", str(self.infra), "--result", str(self.result), "--candidate", candidate, "--out", str(out)])
        self.assertEqual(code, 0)
        return json.loads(out.read_text(encoding="utf-8"))["dataset"]

    def test_the_winner_runs_from_the_estate_today_to_its_target(self):
        winner = next(c for c in self.document["candidates"] if c["id"] == self.document["winner"])
        dataset = self.build(winner["id"])
        self.assertEqual(dataset["project"], "startup")
        self.assertEqual(dataset["states"][0]["summary"]["monthly_eur"], round(self.document["baseline"]["monthly_eur"]))
        self.assertEqual(dataset["states"][-1]["summary"]["monthly_eur"], round(winner["cost"]["run_eur_month_now"]))
        self.assertEqual(dataset["source"]["candidate"], winner["id"])

    def test_a_feasible_candidate_that_did_not_win_can_be_shown(self):
        other = next(c for c in self.document["candidates"] if c["feasible"] and c["id"] != self.document["winner"])
        dataset = self.build(other["id"])
        self.assertEqual(dataset["source"]["candidate"], other["id"])
        self.assertEqual(dataset["states"][-1]["summary"]["monthly_eur"], round(other["cost"]["run_eur_month_now"]))

    def test_an_unknown_candidate_stops_naming_it(self):
        with self.assertRaises(SystemExit) as stopped:
            self.build("no-such-candidate")
        self.assertIn("no-such-candidate", str(stopped.exception))


if __name__ == "__main__":
    unittest.main()
