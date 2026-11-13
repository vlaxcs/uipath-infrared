from collections import Counter
from dataclasses import dataclass

from engine.domain.catalog import Catalog
from engine.domain.forecast import Residency
from engine.domain.model import Component, Infra
from engine.domain.regions import region_matches

WILDCARD = "*"


@dataclass(frozen=True)
class Relocation:
    option: str
    region: str
    reason: str


def residency_relocation(
    component: Component, infra: Infra, catalog: Catalog, residency: Residency,
) -> Relocation | None:
    if region_matches(component.region, residency.allowed_regions):
        return None
    option = catalog.current_option(component)
    if option is None:
        return None
    stack_regions = Counter(c.region for c in infra.components if c.stack == component.stack and c.id != component.id)
    estate_regions = Counter(c.region for c in infra.components if c.id != component.id)
    ranked = sorted(
        set(stack_regions) | set(estate_regions),
        key=lambda region: (-stack_regions[region], -estate_regions[region], region),
    )
    concrete = [r for r in residency.allowed_regions + option.regions if WILDCARD not in r]
    for region in ranked + sorted(set(concrete) - set(ranked)):
        if region_matches(region, residency.allowed_regions) and option.serves_region(region):
            return Relocation(option.id, region, _reason(component, residency, region, stack_regions))
    return None


def _reason(component: Component, residency: Residency, region: str, stack_regions: Counter) -> str:
    broken = (
        f"{component.data_classification} data in {component.region} breaks residency "
        f"({', '.join(residency.allowed_regions)})"
    )
    peers = stack_regions[region]
    if peers:
        where = f"where {peers} of the other {sum(stack_regions.values())} {component.stack} components already run"
        return f"{broken}: move it to {region}, {where}"
    return f"{broken}: move it to {region}, the first allowed region its service offers"
