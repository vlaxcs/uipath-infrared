from engine.domain.catalog import Catalog
from engine.domain.end_state import Placement


def unit_size(placement: Placement, catalog: Catalog) -> tuple[float | None, float | None]:
    if placement.tier_id:
        for option_id in (placement.option_id, placement.origin_option_id):
            if not option_id:
                continue
            for tier in catalog.option(option_id).pricing.tiers:
                if tier.id == placement.tier_id:
                    return tier.vcpu, tier.memory_gb
    return placement.unit_vcpu(), placement.unit_memory_gb()
