from dataclasses import dataclass

CATEGORICAL_DISTANCE = 1.0
HIGHER_IS_BETTER = frozenset({"min_availability_pct"})
FULL_PCT = 100.0


@dataclass(frozen=True)
class Violation:
    constraint: str
    component: str | None
    detail: str
    actual: float | None = None
    limit: float | None = None

    @property
    def distance(self) -> float:
        if self.actual is None or self.limit is None:
            return CATEGORICAL_DISTANCE
        if self.constraint in HIGHER_IS_BETTER:
            allowed_gap = FULL_PCT - self.limit
            return (self.limit - self.actual) / allowed_gap if allowed_gap > 0 else CATEGORICAL_DISTANCE
        return (self.actual - self.limit) / self.limit if self.limit > 0 else CATEGORICAL_DISTANCE


def total_distance(violations: tuple[Violation, ...]) -> float:
    return sum(v.distance for v in violations)
