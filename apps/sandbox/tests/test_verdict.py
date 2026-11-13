import pytest
from sandbox.domain.verdict import decide_verdict


def test_verdict_passes():
    verdict = decide_verdict(
        measured_availability_pct=99.95,
        forecast_min_availability_pct=99.9,
    )

    assert verdict.passed is True
    assert verdict.measured_availability_pct == 99.95
    assert verdict.forecast_min_availability_pct == 99.9
    assert verdict.gap_pct == pytest.approx(0.05)
    assert "exceeds" in verdict.reason


def test_verdict_fails():
    verdict = decide_verdict(
        measured_availability_pct=99.5,
        forecast_min_availability_pct=99.9,
    )

    assert verdict.passed is False
    assert verdict.measured_availability_pct == 99.5
    assert verdict.forecast_min_availability_pct == 99.9
    assert verdict.gap_pct == pytest.approx(-0.4)
    assert "falls short" in verdict.reason


def test_verdict_exactly_meets_threshold():
    verdict = decide_verdict(
        measured_availability_pct=99.9,
        forecast_min_availability_pct=99.9,
    )

    assert verdict.passed is True
    assert verdict.gap_pct == 0.0
