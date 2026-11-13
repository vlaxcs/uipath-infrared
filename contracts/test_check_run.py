import copy
import json
import unittest
from pathlib import Path

from check_run import run_errors

EXAMPLE = json.loads((Path(__file__).resolve().parent / "run.example.json").read_text(encoding="utf-8"))


class CheckRunTest(unittest.TestCase):
    def test_the_example_run_passes(self):
        self.assertEqual(run_errors(EXAMPLE), [])

    def test_a_schema_break_is_reported(self):
        broken = copy.deepcopy(EXAMPLE)
        broken["status"] = "paused"
        self.assertTrue(any(error.startswith("[schema] status") for error in run_errors(broken)))

    def test_a_summary_that_disagrees_with_the_log_is_reported(self):
        broken = copy.deepcopy(EXAMPLE)
        broken["revision"] = 0
        self.assertTrue(any(error.startswith("[integrity]") for error in run_errors(broken)))


if __name__ == "__main__":
    unittest.main()
