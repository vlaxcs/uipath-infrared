import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

from candidates_integrity import candidates_integrity_errors

HERE = Path(__file__).parent


def load(name):
    return json.loads((HERE / name).read_text())


SCHEMA = Draft202012Validator(load("candidates.schema.json"))
SAMPLE = load("candidates.example.json")
INFRA = load("mock/demo-shop.infra.json")
CATALOG = load("catalog.example.json")
STRATEGIES = set(load("forecast.schema.json")["properties"]["cto_settings"]["properties"]["strategies_enabled"]["items"]["enum"])

MOVE = (0, 0)
STOP = (1, 0)
SCALE = (1, 1)


def violations(doc):
    schema_errors = [error.message for error in SCHEMA.iter_errors(doc)]
    return schema_errors or candidates_integrity_errors(doc, STRATEGIES, INFRA, CATALOG)


def sample():
    return copy.deepcopy(SAMPLE)


def action(doc, at):
    candidate, index = at
    return doc["candidates"][candidate]["actions"][index]


class Sample(unittest.TestCase):
    def test_sample_is_valid(self):
        self.assertEqual(violations(SAMPLE), [])

    def test_sample_holds_the_demo_residency_break(self):
        move = action(SAMPLE, MOVE)
        self.assertEqual((move["component"], move["to"]["region"]), ("rds-orders", "us-east-1"))
        orders = next(c for c in INFRA["components"] if c["id"] == "rds-orders")
        self.assertEqual(orders["data_classification"], "pii")


class Rejected(unittest.TestCase):
    def assertRejected(self, doc, expected):
        found = violations(doc)
        self.assertTrue(any(expected in message for message in found), found)


class NoNumbersFromTheModel(Rejected):
    def test_no_saving_on_an_action(self):
        doc = sample()
        action(doc, STOP)["saving_eur_month"] = 32882
        self.assertRejected(doc, "'saving_eur_month' was unexpected")

    def test_no_score_on_a_candidate(self):
        doc = sample()
        doc["candidates"][0]["score"] = 0.2
        self.assertRejected(doc, "'score' was unexpected")

    def test_no_extensions_to_carry_one(self):
        doc = sample()
        doc["x_saving"] = 1
        self.assertRejected(doc, "'x_saving' was unexpected")
        doc = sample()
        action(doc, STOP)["x_saving"] = 1
        self.assertRejected(doc, "'x_saving' was unexpected")

    def test_no_price_in_a_target(self):
        doc = sample()
        action(doc, MOVE)["to"]["monthly_eur"] = 900
        self.assertRejected(doc, "'monthly_eur' was unexpected")


class Actions(Rejected):
    def test_keep_and_flag_are_not_proposals(self):
        for kind in ("keep", "flag"):
            doc = sample()
            action(doc, STOP)["action"] = kind
            self.assertRejected(doc, "is not one of")

    def test_every_action_has_a_reason(self):
        doc = sample()
        del action(doc, STOP)["reason"]
        self.assertRejected(doc, "'reason' is a required property")

    def test_a_move_names_the_option(self):
        doc = sample()
        del action(doc, MOVE)["to"]["option"]
        self.assertRejected(doc, "'option' is a required property")

    def test_a_scale_names_a_count_or_zones(self):
        doc = sample()
        action(doc, SCALE)["to"] = {"tier": "m6i.xlarge"}
        self.assertRejected(doc, "is not valid under any of the given schemas")

    def test_a_resize_names_a_size(self):
        doc = sample()
        action(doc, STOP).update({"action": "resize", "to": {"quantity": 2}})
        self.assertRejected(doc, "is not valid under any of the given schemas")

    def test_a_stop_has_no_target(self):
        doc = sample()
        action(doc, STOP)["to"] = {"quantity": 1}
        self.assertRejected(doc, "should not be valid")

    def test_one_action_per_component(self):
        doc = sample()
        doc["candidates"][1]["actions"].append(copy.deepcopy(action(doc, STOP)))
        self.assertRejected(doc, "agent-quiet-pools: more than one action on ng-data-gpu")

    def test_only_remediate_applies_to_the_account(self):
        doc = sample()
        action(doc, STOP)["component"] = "account"
        self.assertRejected(doc, "only remediate applies to account")
        action(doc, STOP)["action"] = "remediate"
        self.assertEqual(violations(doc), [])


class AgainstTheInfraAndCatalog(Rejected):
    def test_component_exists(self):
        doc = sample()
        action(doc, STOP)["component"] = "ng-data-tpu"
        self.assertRejected(doc, "component ng-data-tpu is not in the infra")

    def test_option_exists(self):
        doc = sample()
        action(doc, MOVE)["to"]["option"] = "neon-postgres"
        self.assertRejected(doc, "option neon-postgres is not in the catalog")

    def test_option_fits_the_kind(self):
        doc = sample()
        action(doc, MOVE)["to"] = {"option": "aws-s3"}
        self.assertRejected(doc, "option aws-s3 is for object_storage, the component is postgres")

    def test_option_runs_in_the_region(self):
        doc = sample()
        action(doc, MOVE)["to"]["region"] = "ap-south-1"
        self.assertRejected(doc, "option neon-launch does not run in ap-south-1")

    def test_option_has_the_tier(self):
        doc = sample()
        action(doc, MOVE)["to"]["tier"] = "db.m5.large"
        self.assertRejected(doc, "option neon-launch has no tier db.m5.large")

    def test_tier_without_option_is_offered_for_the_kind(self):
        doc = sample()
        action(doc, SCALE).update({"action": "resize", "to": {"tier": "db.m5.large"}})
        self.assertRejected(doc, "tier db.m5.large is not offered for kind node_group")

    def test_another_project_skips_the_infra_checks(self):
        doc = sample()
        doc["project"] = "other-shop"
        action(doc, STOP)["component"] = "ng-data-tpu"
        self.assertEqual(violations(doc), [])


class Candidates(Rejected):
    def test_ids_are_unique(self):
        doc = sample()
        doc["candidates"][1]["id"] = doc["candidates"][0]["id"]
        self.assertRejected(doc, "duplicate candidate id agent-orders-serverless")

    def test_an_id_is_never_an_engine_strategy(self):
        doc = sample()
        doc["candidates"][0]["id"] = "rightsize_in_place"
        self.assertRejected(doc, "rightsize_in_place: is the name of an engine strategy")

    def test_builds_on_a_strategy_or_an_earlier_candidate(self):
        doc = sample()
        doc["candidates"][1]["builds_on"] = "agent-quiet-pools-ha"
        self.assertRejected(doc, "builds_on agent-quiet-pools-ha is neither an engine strategy nor an earlier candidate")

    def test_every_candidate_says_why(self):
        doc = sample()
        doc["candidates"][0]["rationale"] = ""
        self.assertRejected(doc, "should be non-empty")

    def test_a_candidate_changes_something(self):
        doc = sample()
        doc["candidates"][0]["actions"] = []
        self.assertRejected(doc, "should be non-empty")

    def test_proposals_are_bounded(self):
        doc = sample()
        doc["candidates"] = [dict(copy.deepcopy(SAMPLE["candidates"][1]), id=f"agent-{n}") for n in range(11)]
        self.assertRejected(doc, "is too long")

    def test_revises_only_after_a_revision(self):
        doc = sample()
        doc["candidates"][0]["revises"] = "agent-orders-us"
        self.assertRejected(doc, "agent-orders-serverless: revises agent-orders-us at revision 0")
        doc["revision"] = 1
        self.assertEqual(violations(doc), [])


if __name__ == "__main__":
    unittest.main()
