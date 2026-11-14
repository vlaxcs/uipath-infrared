from typing import Iterable, Mapping

from pricing.domain.errors import SelectionError
from pricing.domain.selector import Selector


def select_one_each(
    rows: Iterable[Mapping[str, str]], wanted: Mapping[str, Selector],
) -> dict[str, Mapping[str, str]]:
    matches: dict[str, list[Mapping[str, str]]] = {key: [] for key in wanted}
    for row in rows:
        for key, selector in wanted.items():
            if selector.matches(row):
                matches[key].append(row)
    problems = [
        f"{key}: {len(found)} rows match {wanted[key].describe()}"
        for key, found in sorted(matches.items()) if len(found) != 1
    ]
    if problems:
        raise SelectionError("; ".join(problems))
    return {key: found[0] for key, found in matches.items()}
