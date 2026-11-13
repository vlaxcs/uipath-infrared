from dataclasses import dataclass
from datetime import date
from typing import Iterable, Mapping


@dataclass(frozen=True)
class SourceAge:
    source: str
    fetched_on: date
    age_days: int
    problems: tuple[str, ...]

    @property
    def healthy(self) -> bool:
        return not self.problems


def source_ages(
    dated: Iterable[tuple[str, date, Mapping[str, str]]], today: date, max_age_days: int,
) -> tuple[SourceAge, ...]:
    ages = []
    for source, fetched_on, unverified in sorted(dated, key=lambda d: d[0]):
        age = (today - fetched_on).days
        problems = [f"{age} days old, limit {max_age_days}"] if age > max_age_days else []
        problems += [f"{key}: {reason}" for key, reason in sorted(unverified.items())]
        ages.append(SourceAge(source, fetched_on, age, tuple(problems)))
    return tuple(ages)
