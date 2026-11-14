"""Layout selection and the snapshot CLI (no Chrome needed: --html-only)."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import build_states

APP_ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = APP_ROOT / "snapshot.py"
sys.path.insert(0, str(APP_ROOT))

import snapshot  # noqa: E402

RESULT = build_states.load_json(build_states.RESULT_PATH)
LAYOUTS = build_states.candidate_ids(RESULT)


def ids(state):
    return {c["id"] for c in state["infra"]["components"]}


class LayoutParameterTest(unittest.TestCase):
    def test_default_is_the_winner(self):
        default = build_states.build_dataset()
        explicit = build_states.build_dataset(candidate_id=RESULT["winner"])
        self.assertEqual(default["states"], explicit["states"])
        self.assertTrue(default["layout"]["winner"])

    def test_every_candidate_builds(self):
        self.assertEqual(len(LAYOUTS), 6)
        for layout in LAYOUTS:
            candidate = next(c for c in RESULT["candidates"] if c["id"] == layout)
            dataset = build_states.build_dataset(candidate_id=layout)
            actions = candidate.get("actions") or []
            self.assertEqual(dataset["layout"]["id"], layout)
            self.assertEqual(dataset["layout"]["feasible"], candidate["feasible"])
            self.assertEqual(dataset["stepCount"], len(actions), layout)
            self.assertEqual(len(dataset["states"]), len(actions) + 1, layout)
            self.assertEqual(dataset["states"][0]["summary"]["monthly_eur"], 133308)
            if actions:
                self.assertEqual(
                    dataset["states"][-1]["summary"]["monthly_eur"],
                    candidate["cost"]["run_eur_month_now"],
                    layout,
                )

    def test_infeasible_candidates_still_build(self):
        infeasible = [c["id"] for c in RESULT["candidates"] if not c["feasible"]]
        self.assertTrue(infeasible)
        for layout in infeasible:
            self.assertFalse(build_states.build_dataset(candidate_id=layout)["layout"]["feasible"])

    def test_do_nothing_target_is_the_current_estate(self):
        dataset = build_states.build_dataset(candidate_id="do_nothing")
        self.assertEqual(len(dataset["states"]), 1)
        current = build_states.build_dataset()["states"][0]
        self.assertEqual(dataset["states"][-1]["infra"], current["infra"])

    def test_unknown_layout_errors_clearly(self):
        with self.assertRaises(build_states.LayoutError) as caught:
            build_states.build_dataset(candidate_id="no_such_layout")
        self.assertIn("no_such_layout", str(caught.exception))
        self.assertIn("consolidate", str(caught.exception))


class DiffTest(unittest.TestCase):
    def test_target_diff_against_current(self):
        dataset = build_states.build_dataset(candidate_id="consolidate")
        diff = snapshot.diff_against_current(dataset, len(dataset["states"]) - 1)
        self.assertEqual(len(diff["removed"]), 7)
        self.assertEqual(diff["added"], [])
        self.assertIn("rds-orders", diff["changed"])
        self.assertNotIn("ddb-orders", diff["changed"])  # flagged only
        self.assertEqual(diff["moved"], ["rds-erp", "s3-legacy-reports"])
        self.assertNotIn("rds-erp", diff["changed"])
        total = sum(len(v) for k, v in diff.items() if k != "removed")
        self.assertEqual(total, len(ids(dataset["states"][-1])))

    def test_current_has_no_changes(self):
        dataset = build_states.build_dataset(candidate_id="consolidate")
        diff = snapshot.diff_against_current(dataset, 0)
        self.assertEqual((diff["changed"], diff["added"], diff["removed"]), ([], [], []))

    def test_state_resolution(self):
        dataset = build_states.build_dataset(candidate_id="consolidate")
        self.assertEqual(snapshot.resolve_state(dataset, "current"), 0)
        self.assertEqual(snapshot.resolve_state(dataset, "target"), 21)
        self.assertEqual(snapshot.resolve_state(dataset, "5"), 5)
        for bad in ("22", "-1", "later"):
            with self.assertRaises(snapshot.SnapshotError):
                snapshot.resolve_state(dataset, bad)


class CliTest(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, str(SNAPSHOT), *args],
            capture_output=True, text=True, cwd=tempfile.gettempdir(), timeout=60,
        )

    def test_html_only_writes_the_card_and_one_json_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "card.html"
            proc = self.run_cli("--layout", "consolidate", "--state", "target", "--out", str(out), "--html-only")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            lines = proc.stdout.strip().splitlines()
            self.assertEqual(len(lines), 1)
            payload = json.loads(lines[0])
            self.assertEqual(set(payload), {"path", "layout", "state", "title", "caption", "alt"})
            self.assertEqual(payload["path"], str(out.resolve()))
            self.assertEqual(payload["layout"], "consolidate")
            self.assertEqual(payload["state"], "target")
            self.assertIn("21 changes", payload["title"])
            self.assertEqual(payload["caption"], "€133,308/mo → €74,365/mo · 7 changed · 2 moved · 0 added · 7 removed")
            self.assertTrue(payload["alt"].endswith("."))
            html = out.read_text(encoding="utf-8")
            self.assertIn('window.ESTATE_CARD = {"state":"target"}', html)
            self.assertIn("function renderCard", html)
            self.assertIn('"id":"consolidate"', html)
            self.assertIn("rds-orders", html)

    def test_every_layout_and_current_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            for layout in LAYOUTS:
                for state in ("current", "target", "1"):
                    if layout == "do_nothing" and state == "1":
                        continue
                    proc = self.run_cli("--layout", layout, "--state", state, "--out", str(Path(tmp) / "c.html"), "--html-only")
                    self.assertEqual(proc.returncode, 0, (layout, state, proc.stderr))
                    payload = json.loads(proc.stdout)
                    self.assertEqual(payload["layout"], layout)
                    self.assertEqual(payload["state"], state)

    def test_failures_go_to_stderr_with_nonzero_exit(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = str(Path(tmp) / "c.html")
            for args in (
                ("--layout", "nope", "--state", "target"),
                ("--layout", "consolidate", "--state", "99"),
                ("--layout", "do_nothing", "--state", "1"),
            ):
                proc = self.run_cli(*args, "--out", out, "--html-only")
                self.assertNotEqual(proc.returncode, 0, args)
                self.assertEqual(proc.stdout, "", args)
                self.assertTrue(proc.stderr.strip(), args)

    def test_missing_chrome_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            proc = self.run_cli("--layout", "consolidate", "--state", "target",
                                "--out", str(Path(tmp) / "c.png"), "--chrome", str(Path(tmp) / "no-chrome"))
            self.assertEqual(proc.returncode, 3)
            self.assertEqual(proc.stdout, "")
            self.assertIn("Chrome not found", proc.stderr)


if __name__ == "__main__":
    unittest.main()
