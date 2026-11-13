import json
import subprocess
import sys

from engine.cli import EXIT_INVALID_INPUT, main
from tests.conftest import CATALOG, CONTRACTS, FORECAST, MOCK_INFRA, REAL_INFRA


def run(capsys, *argv):
    code = main(list(argv))
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def test_baseline_command_prints_the_priced_estate(capsys):
    code, out, _ = run(capsys, "baseline", str(MOCK_INFRA), str(CATALOG))
    assert code == 0
    document = json.loads(out)
    assert document["project"] == "demo-shop"
    assert document["monthly_eur"] == 133308
    assert document["cross_check"]["mismatches"]


def test_same_inputs_give_the_same_bytes(capsys):
    _, first, _ = run(capsys, "baseline", str(MOCK_INFRA), str(CATALOG))
    _, second, _ = run(capsys, "baseline", str(MOCK_INFRA), str(CATALOG))
    assert first == second


def test_a_file_that_breaks_its_schema_stops_with_the_reason(capsys):
    code, out, err = run(capsys, "baseline", str(FORECAST), str(CATALOG))
    assert code == EXIT_INVALID_INPUT
    assert out == ""
    assert "infra.schema.json" in err


def test_evaluate_writes_a_result_that_passes_the_contract_checker(tmp_path):
    out = tmp_path / "result.json"
    assert main(["evaluate", str(MOCK_INFRA), str(FORECAST), str(CATALOG), "--out", str(out)]) == 0
    checker = subprocess.run(
        [sys.executable, str(CONTRACTS / "check_mock.py"), str(out)], capture_output=True, text=True,
    )
    assert checker.returncode == 0, checker.stdout


def test_evaluate_is_byte_for_byte_deterministic(tmp_path):
    first, second = tmp_path / "a.json", tmp_path / "b.json"
    main(["evaluate", str(MOCK_INFRA), str(FORECAST), str(CATALOG), "--out", str(first)])
    main(["evaluate", str(MOCK_INFRA), str(FORECAST), str(CATALOG), "--out", str(second)])
    assert first.read_bytes() == second.read_bytes()


def test_evaluate_runs_on_the_real_extraction(tmp_path):
    out = tmp_path / "real.json"
    assert main(["evaluate", str(REAL_INFRA), str(FORECAST), str(CATALOG), "--out", str(out)]) == 0
    assert json.loads(out.read_text())["inputs"]["infra"]
