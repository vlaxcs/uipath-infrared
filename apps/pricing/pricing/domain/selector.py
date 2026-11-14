from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class Selector:
    filters: Mapping[str, str]

    def matches(self, row: Mapping[str, str]) -> bool:
        return all(row.get(column) == value for column, value in self.filters.items())

    def describe(self) -> str:
        return ", ".join(f"{column}={value}" for column, value in sorted(self.filters.items()))
