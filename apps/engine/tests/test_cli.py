import json

from engine.cli import EXIT_INVALID_INPUT, main
from tests.conftest import CATALOG, FORECAST, MOCK_INFRA


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
