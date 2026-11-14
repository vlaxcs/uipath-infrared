import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

from project_integrity import expected_users, project_integrity_errors

HERE = Path(__file__).parent
PROJECTS = ("startup", "demo-shop", "clinic-booking", "fleet-telemetry")


def load(name):
    return json.loads((HERE / name).read_text())


SCHEMA = Draft202012Validator(load("project.schema.json"))
INFRA = load("mock/clinic-booking.infra.json")
FORECAST = load("mock/clinic-booking.forecast.json")
SAMPLE = load("mock/clinic-booking.project.json")


def violations(doc, infra=INFRA, forecast=FORECAST):
    schema_errors = [error.message for error in SCHEMA.iter_errors(doc)]
    return schema_errors or project_integrity_errors(doc, infra, forecast)


def changed(edit):
    doc = copy.deepcopy(SAMPLE)
    edit(doc)
    return doc


class EveryMockProject(unittest.TestCase):
    def test_each_project_has_a_valid_profile(self):
        for project in PROJECTS:
            with self.subTest(project=project):
                profile = load(f"mock/{project}.project.json")
                infra, forecast = load(f"mock/{project}.infra.json"), load(f"mock/{project}.forecast.json")
                self.assertEqual(violations(profile, infra, forecast), [])

    def test_the_orchestrator_copy_of_the_demo_shop_forecast_matches_the_example(self):
        self.assertEqual(load("mock/demo-shop.forecast.json"), load("forecast.example.json"))


class Schema(unittest.TestCase):
    def test_an_environment_outside_dev_staging_prod_is_rejected(self):
        doc = changed(lambda d: d["environments"][0].update(name="qa"))
        self.assertTrue(violations(doc))

    def test_users_are_required(self):
        doc = changed(lambda d: d.pop("users"))
        self.assertTrue(violations(doc))

    def test_a_fractional_user_count_is_rejected(self):
        doc = changed(lambda d: d["users"]["current"].update(value=41000.5))
        self.assertTrue(violations(doc))


class Environments(unittest.TestCase):
    def test_an_environment_listed_twice(self):
        doc = changed(lambda d: d["environments"].append(copy.deepcopy(d["environments"][0])))
        self.assertIn("environment prod listed 2 times", violations(doc))

    def test_a_stack_missing_from_the_infra(self):
        doc = changed(lambda d: d["environments"][0]["stacks"].append("billing"))
        self.assertIn("environment prod: stack billing is not in the infra", violations(doc))

    def test_an_infra_stack_left_out_of_its_environment(self):
        doc = changed(lambda d: d["environments"].pop(1))
        self.assertIn("stack staging is staging in the infra but not listed under environment staging", violations(doc))

    def test_a_profile_for_another_project(self):
        doc = changed(lambda d: d.update(project="fleet-telemetry"))
        self.assertIn("project fleet-telemetry but the infra is for clinic-booking", violations(doc))


class ExpectedUsers(unittest.TestCase):
    def test_growth_compounds_and_events_apply_from_their_month(self):
        forecast = {"scenarios": {"base": {"monthly_multiplier": {"traffic": 1.1}}},
                    "events": [{"month": 2, "description": "launch", "traffic_multiplier": 2}]}
        self.assertEqual(expected_users(1000, forecast, 1, "base"), 1100)
        self.assertEqual(expected_users(1000, forecast, 2, "base"), 2400)

    def test_a_number_the_forecast_does_not_give(self):
        doc = changed(lambda d: d["users"]["expected"][-1].update(base=150000))
        self.assertIn("expected users at month 24 (base) is 150000, the forecast gives 112500", violations(doc))

    def test_the_last_row_must_reach_the_horizon(self):
        doc = changed(lambda d: d["users"]["expected"].pop())
        self.assertIn("last expected month is 12, the forecast horizon is 24", violations(doc))

    def test_months_must_increase(self):
        doc = changed(lambda d: d["users"]["expected"].reverse())
        self.assertTrue(any("not strictly increasing" in e for e in violations(doc)))

    def test_the_forecast_id_must_match(self):
        doc = changed(lambda d: d.update(forecast_id="startup-2027-plan"))
        self.assertIn("forecast_id startup-2027-plan but the forecast is clinic-booking-2027-plan", violations(doc))


if __name__ == "__main__":
    unittest.main()
