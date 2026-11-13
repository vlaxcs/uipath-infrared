import pytest
from sandbox.domain.measurement import Sample, compute_phase_measurement, percentile


def test_compute_phase_measurement_all_successful():
    samples = [
        Sample(timestamp_s=1.0, success=True, latency_ms=50.0),
        Sample(timestamp_s=2.0, success=True, latency_ms=60.0),
        Sample(timestamp_s=3.0, success=True, latency_ms=70.0),
        Sample(timestamp_s=4.0, success=True, latency_ms=80.0),
        Sample(timestamp_s=5.0, success=True, latency_ms=90.0),
    ]

    result = compute_phase_measurement(samples, 5.0)

    assert result.duration_s == 5.0
    assert result.availability_pct == 100.0
    assert result.requests_total == 5
    assert result.requests_successful == 5
    assert result.requests_failed == 0
    assert result.error_rate_pct == 0.0
    assert 60.0 <= result.latency_p50_ms <= 70.0
    assert 80.0 <= result.latency_p95_ms <= 90.0


def test_compute_phase_measurement_with_failures():
    samples = [
        Sample(timestamp_s=1.0, success=True, latency_ms=50.0),
        Sample(timestamp_s=2.0, success=False, latency_ms=5000.0),
        Sample(timestamp_s=3.0, success=True, latency_ms=60.0),
        Sample(timestamp_s=4.0, success=True, latency_ms=55.0),
    ]

    result = compute_phase_measurement(samples, 4.0)

    assert result.availability_pct == 75.0
    assert result.requests_total == 4
    assert result.requests_successful == 3
    assert result.requests_failed == 1
    assert result.error_rate_pct == 25.0


def test_compute_phase_measurement_empty_samples():
    result = compute_phase_measurement([], 10.0)

    assert result.duration_s == 10.0
    assert result.availability_pct == 0.0
    assert result.requests_total == 0
    assert result.error_rate_pct == 100.0


def test_percentile():
    values = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]

    assert percentile(values, 50) == pytest.approx(55.0, abs=1.0)
    assert percentile(values, 95) == pytest.approx(95.5, abs=1.0)
    assert percentile(values, 99) == pytest.approx(99.1, abs=1.0)


def test_percentile_single_value():
    values = [42.0]

    assert percentile(values, 50) == 42.0
    assert percentile(values, 95) == 42.0
    assert percentile(values, 99) == 42.0


def test_percentile_empty_list():
    assert percentile([], 50) == 0.0
