from dataclasses import dataclass


@dataclass(frozen=True)
class Verdict:
    passed: bool
    forecast_min_availability_pct: float
    measured_availability_pct: float
    gap_pct: float
    reason: str


def decide_verdict(
    measured_availability_pct: float,
    forecast_min_availability_pct: float,
) -> Verdict:
    gap_pct = measured_availability_pct - forecast_min_availability_pct
    passed = measured_availability_pct >= forecast_min_availability_pct

    if passed:
        reason = (
            f"Overall availability {measured_availability_pct:.2f}% "
            f"exceeds threshold {forecast_min_availability_pct:.2f}%"
        )
    else:
        reason = (
            f"Overall availability {measured_availability_pct:.2f}% "
            f"falls short of threshold {forecast_min_availability_pct:.2f}% "
            f"by {abs(gap_pct):.2f}%"
        )

    return Verdict(
        passed=passed,
        forecast_min_availability_pct=forecast_min_availability_pct,
        measured_availability_pct=measured_availability_pct,
        gap_pct=gap_pct,
        reason=reason,
    )
