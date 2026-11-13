from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class Sample:
    timestamp_s: float
    success: bool
    latency_ms: float


@dataclass(frozen=True)
class PhaseMeasurement:
    duration_s: float
    availability_pct: float
    latency_p50_ms: float
    latency_p95_ms: float
    latency_p99_ms: float
    requests_total: int
    requests_successful: int
    requests_failed: int
    error_rate_pct: float


def compute_phase_measurement(samples: List[Sample], duration_s: float) -> PhaseMeasurement:
    if not samples:
        return PhaseMeasurement(
            duration_s=duration_s,
            availability_pct=0.0,
            latency_p50_ms=0.0,
            latency_p95_ms=0.0,
            latency_p99_ms=0.0,
            requests_total=0,
            requests_successful=0,
            requests_failed=0,
            error_rate_pct=100.0,
        )

    total = len(samples)
    successful = sum(1 for s in samples if s.success)
    failed = total - successful

    availability_pct = (successful / total * 100.0) if total > 0 else 0.0
    error_rate_pct = (failed / total * 100.0) if total > 0 else 0.0

    latencies = sorted(s.latency_ms for s in samples if s.success)

    if latencies:
        p50_ms = percentile(latencies, 50)
        p95_ms = percentile(latencies, 95)
        p99_ms = percentile(latencies, 99)
    else:
        p50_ms = p95_ms = p99_ms = 0.0

    return PhaseMeasurement(
        duration_s=duration_s,
        availability_pct=availability_pct,
        latency_p50_ms=p50_ms,
        latency_p95_ms=p95_ms,
        latency_p99_ms=p99_ms,
        requests_total=total,
        requests_successful=successful,
        requests_failed=failed,
        error_rate_pct=error_rate_pct,
    )


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    n = len(values)
    k = (n - 1) * p / 100.0
    f = int(k)
    c = f + 1
    if c >= n:
        return values[-1]
    d0 = values[f] * (c - k)
    d1 = values[c] * (k - f)
    return d0 + d1
