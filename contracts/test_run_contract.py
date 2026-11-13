import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

from run_integrity import run_integrity_errors

HERE = Path(__file__).parent
SCHEMA = Draft202012Validator(json.loads((HERE / "run.schema.json").read_text()))
SAMPLE = json.loads((HERE / "run.example.json").read_text())

EVALUATE_REVISED = 8
PROPOSE_AGAIN = 9
EVALUATE_HELD = 12
LAYOUT_GATE_OPENED = 14
ANALYSES_KEPT = 15
LAYOUT_PICKED = 16
PRESENT_COMPLETED = 17
PLAN_GATE_OPENED = 20
PLAN_APPROVED = 21


def violations(run):
    schema_errors = [error.message for error in SCHEMA.iter_errors(run)]
    return schema_errors or run_integrity_errors(run)


def sample():
    return copy.deepcopy(SAMPLE)


def event(run, seq):
    return run["events"][seq - 1]


def cut_after(run, seq, status, awaiting=None):
    run["events"] = run["events"][:seq]
    last = run["events"][-1]
    run["status"] = status
    run["step"] = last["step"]
    run["revision"] = last["revision"]
    run["updated_at"] = last["at"]
    run.pop("finished_at", None)
    run.pop("awaiting", None)
    if awaiting:
        run["awaiting"] = awaiting
    return run


class SampleRun(unittest.TestCase):
    def test_sample_is_valid(self):
        self.assertEqual(violations(SAMPLE), [])

    def test_sample_walks_the_demo_path_with_exactly_one_revision(self):
        decisions = [e["decision"]["kind"] for e in SAMPLE["events"] if "decision" in e]
        self.assertEqual(decisions, ["revise", "proceed", "keep_analyses", "pick_layout", "proceed", "approve_plan"])
        self.assertEqual(event(SAMPLE, LAYOUT_PICKED)["actor"]["surface"], "dashboard")
        self.assertEqual(event(SAMPLE, PLAN_APPROVED)["actor"]["surface"], "slack")


class RunStates(unittest.TestCase):
    def test_running_mid_step(self):
        self.assertEqual(violations(cut_after(sample(), 3, "running")), [])

    def test_paused_at_the_layout_gate(self):
        self.assertEqual(violations(cut_after(sample(), LAYOUT_GATE_OPENED, "awaiting_approval", "layout")), [])

    def test_still_paused_after_analyses_are_kept(self):
        self.assertEqual(violations(cut_after(sample(), ANALYSES_KEPT, "awaiting_approval", "layout")), [])

    def test_running_again_once_the_layout_is_picked(self):
        self.assertEqual(violations(cut_after(sample(), LAYOUT_PICKED, "running")), [])

    def test_paused_at_the_plan_gate(self):
        self.assertEqual(violations(cut_after(sample(), PLAN_GATE_OPENED, "awaiting_approval", "plan")), [])

    def test_failed_at_extract_with_the_reason(self):
        run = cut_after(sample(), 2, "failed")
        failed = event(run, 2)
        failed["status"] = "failed"
        del failed["output"]
        failed["decision"] = {"kind": "stop", "reason": "infra.json fails its schema: /components/3/kind"}
        run["finished_at"] = failed["at"]
        self.assertEqual(violations(run), [])

    def test_failed_when_the_revision_cap_is_reached(self):
        run = cut_after(sample(), EVALUATE_REVISED, "failed")
        run["max_revisions"] = 0
        run["revision"] = 0
        stopped = event(run, EVALUATE_REVISED)
        stopped["status"] = "failed"
        stopped["decision"] = {"kind": "stop", "reason": "a candidate breaks data_residency and no revisions are left"}
        run["finished_at"] = stopped["at"]
        self.assertEqual(violations(run), [])


class SummaryMustAgreeWithTheLog(unittest.TestCase):
    def assertRejected(self, run, expected):
        found = violations(run)
        self.assertTrue(any(expected in message for message in found), found)

    def test_status(self):
        run = sample()
        run["status"] = "running"
        del run["finished_at"]
        self.assertRejected(run, "status is running, the events say completed")

    def test_step(self):
        run = sample()
        run["step"] = "present"
        self.assertRejected(run, "step is present")

    def test_open_gate(self):
        run = cut_after(sample(), LAYOUT_GATE_OPENED, "awaiting_approval", "plan")
        self.assertRejected(run, "awaiting is plan, the events say layout")

    def test_awaiting_run_names_its_gate(self):
        run = cut_after(sample(), LAYOUT_GATE_OPENED, "awaiting_approval")
        self.assertRejected(run, "'awaiting' is a required property")

    def test_finished_run_has_finished_at(self):
        run = sample()
        del run["finished_at"]
        self.assertRejected(run, "'finished_at' is a required property")

    def test_unfinished_run_has_no_finished_at(self):
        run = cut_after(sample(), 3, "running")
        run["finished_at"] = run["updated_at"]
        self.assertRejected(run, "should not be valid")

    def test_timestamps(self):
        for field in ("started_at", "updated_at", "finished_at"):
            run = sample()
            run[field] = "2026-11-14T08:00:00Z"
            self.assertRejected(run, f"{field} is 2026-11-14T08:00:00Z")

    def test_revision_count(self):
        run = sample()
        run["revision"] = 0
        self.assertRejected(run, "revision is 0, the events hold 1 revise decisions")


class EventLog(unittest.TestCase):
    assertRejected = SummaryMustAgreeWithTheLog.assertRejected

    def test_seq_has_no_gaps(self):
        run = sample()
        event(run, 5)["seq"] = 6
        self.assertRejected(run, "seq 6, expected 5")

    def test_events_are_in_time_order(self):
        run = sample()
        event(run, 5)["at"] = "2026-11-14T09:00:01Z"
        self.assertRejected(run, "event 5: at 2026-11-14T09:00:01Z is before the event it follows")

    def test_timestamps_are_utc(self):
        run = sample()
        event(run, 5)["at"] = "2026-11-14T11:04:11+02:00"
        self.assertRejected(run, "does not match")

    def test_timestamps_are_real_dates(self):
        run = sample()
        event(run, 5)["at"] = "2026-13-40T09:04:11Z"
        self.assertRejected(run, "not a real date and time")

    def test_revision_goes_up_right_after_a_revise(self):
        run = sample()
        event(run, PROPOSE_AGAIN)["revision"] = 0
        self.assertRejected(run, "event 9: revision 0, expected 1")

    def test_revisions_are_capped(self):
        run = sample()
        run["max_revisions"] = 0
        self.assertRejected(run, "1 revise decisions, max_revisions is 0")

    def test_nothing_happens_after_the_run_ended(self):
        run = sample()
        extra = copy.deepcopy(event(run, 1))
        extra["seq"] = PLAN_APPROVED + 1
        extra["at"] = run["updated_at"]
        extra["revision"] = 1
        run["events"].append(extra)
        self.assertRejected(run, "event 22: the run ended at event 21")

    def test_unknown_fields_are_rejected_and_extensions_allowed(self):
        run = sample()
        event(run, 1)["note"] = "x"
        self.assertRejected(run, "'note' does not match any of the regexes")
        run = sample()
        run["x_trace"] = "abc"
        event(run, 1)["x_duration_ms"] = 42
        self.assertEqual(violations(run), [])

    def test_phase_two_steps_are_not_in_this_version(self):
        run = sample()
        event(run, 1)["step"] = "migrate"
        self.assertRejected(run, "'migrate' is not one of")

    def test_file_references_carry_a_sha256(self):
        run = sample()
        del run["inputs"]["forecast"]["sha256"]
        self.assertRejected(run, "'sha256' is a required property")


class Decisions(unittest.TestCase):
    assertRejected = SummaryMustAgreeWithTheLog.assertRejected

    def test_every_decision_has_a_reason(self):
        for seq in (EVALUATE_REVISED, LAYOUT_PICKED, PLAN_APPROVED):
            run = sample()
            del event(run, seq)["decision"]["reason"]
            self.assertRejected(run, "'reason' is a required property")

    def test_evaluate_and_rehearse_end_in_proceed_or_revise(self):
        run = sample()
        del event(run, EVALUATE_HELD)["decision"]
        self.assertRejected(run, "event 12: evaluate completed without a proceed or revise decision")

    def test_a_failure_carries_a_stop(self):
        run = cut_after(sample(), 2, "failed")
        event(run, 2)["status"] = "failed"
        del event(run, 2)["output"]
        run["finished_at"] = run["updated_at"]
        self.assertRejected(run, "'decision' is a required property")

    def test_only_a_person_approves(self):
        run = sample()
        event(run, PLAN_APPROVED)["actor"] = {"kind": "orchestrator"}
        self.assertRejected(run, "'human' was expected")

    def test_a_person_is_identified_with_the_surface(self):
        for field in ("id", "surface"):
            run = sample()
            del event(run, PLAN_APPROVED)["actor"][field]
            self.assertRejected(run, f"'{field}' is a required property")

    def test_a_person_does_not_decide_for_the_engine(self):
        run = sample()
        event(run, EVALUATE_HELD)["actor"] = {"kind": "human", "id": "cto", "surface": "dashboard"}
        self.assertRejected(run, "'orchestrator' was expected")

    def test_picking_a_layout_names_it(self):
        run = sample()
        del event(run, LAYOUT_PICKED)["decision"]["layout"]
        self.assertRejected(run, "'layout' is a required property")

    def test_keeping_analyses_names_them(self):
        run = sample()
        event(run, ANALYSES_KEPT)["decision"]["analyses"] = []
        self.assertRejected(run, "[] should be non-empty")
        run = sample()
        del event(run, ANALYSES_KEPT)["decision"]["analyses"]
        self.assertRejected(run, "'analyses' is a required property")

    def test_a_plan_is_approved_only_at_the_plan_gate(self):
        run = sample()
        event(run, LAYOUT_PICKED)["decision"] = {"kind": "approve_plan", "reason": "skip the rehearsal"}
        self.assertRejected(run, "event 16: approve_plan needs gate plan open, open gate is layout")

    def test_a_layout_is_picked_only_at_the_layout_gate(self):
        run = sample()
        event(run, PLAN_APPROVED)["decision"] = {"kind": "pick_layout", "reason": "late pick", "layout": "consolidate"}
        self.assertRejected(run, "event 21: pick_layout needs gate layout open, open gate is plan")

    def test_the_run_waits_while_a_gate_is_open(self):
        run = sample()
        del run["events"][LAYOUT_PICKED - 1]
        for position, later in enumerate(run["events"], start=1):
            later["seq"] = position
        self.assertRejected(run, "event 16: present completed while gate layout waits for a person")

    def test_each_gate_belongs_to_its_step(self):
        run = sample()
        event(run, LAYOUT_GATE_OPENED)["gate"] = "plan"
        self.assertRejected(run, "event 14: step present cannot open gate plan")


if __name__ == "__main__":
    unittest.main()
