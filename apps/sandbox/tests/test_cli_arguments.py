import pytest

from sandbox.cli.main import parser

BASE = ["rehearse", "--result", "r.json", "--candidate", "c", "--infra", "i.json"]


def test_the_traffic_rate_defaults_to_five_requests_a_second():
    assert parser().parse_args(BASE).requests_per_second == 5


def test_the_traffic_rate_can_be_set():
    assert parser().parse_args([*BASE, "--requests-per-second", "120"]).requests_per_second == 120


@pytest.mark.parametrize("rate", ["0", "201", "-3", "fast"])
def test_a_rate_outside_1_to_200_is_refused(rate):
    with pytest.raises(SystemExit):
        parser().parse_args([*BASE, "--requests-per-second", rate])
