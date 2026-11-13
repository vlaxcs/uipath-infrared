from typing import Mapping

from engine.domain.proposals import Builder
from engine.domain.strategies.cleanup_orphans import cleanup_orphans
from engine.domain.strategies.rightsize_in_place import rightsize_in_place

BUILDERS: Mapping[str, Builder] = {
    "cleanup_orphans": cleanup_orphans,
    "rightsize_in_place": rightsize_in_place,
}
