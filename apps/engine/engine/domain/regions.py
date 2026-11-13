from fnmatch import fnmatchcase
from typing import Iterable


def region_matches(region: str, patterns: Iterable[str]) -> bool:
    return any(fnmatchcase(region, pattern) for pattern in patterns)
