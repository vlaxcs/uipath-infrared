from dataclasses import dataclass

from engine.domain.catalog import Catalog
from engine.domain.end_state import Placement
from engine.domain.model import Metric
from engine.domain.pricing import Price, catalog_price
from engine.domain.provenance import Provenance

ONPREM_ALLOCATED = "onprem_allocated"
ONPREM_SOURCE = "onprem"


@dataclass(frozen=True)
class ComponentCost:
    component: str
    monthly_eur: float
    source: str
    reported_eur: float | None
    catalog: Price | None
    flags: tuple[str, ...] = ()


def cost_placement(placement: Placement, catalog: Catalog) -> ComponentCost:
    component = placement.component
    reported = component.reported_cost.value if component.reported_cost else None
    if placement.removed:
        return ComponentCost(component.id, 0.0, "removed", reported, None)
    option = catalog.option(placement.option_id) if placement.option_id else None
    price = catalog_price(placement, option, catalog.hours_per_month) if option else None
    if placement.unchanged and reported is not None and not _estimate_the_catalog_replaces(component.reported_cost, price):
        return ComponentCost(component.id, reported, "reported", reported, price)
    if placement.unchanged and price is not None and price.complete:
        return ComponentCost(component.id, price.monthly_eur, "catalog", reported, price)
    if price is not None and ONPREM_ALLOCATED in price.gaps:
        return ComponentCost(component.id, 0.0, ONPREM_SOURCE, reported, price)
    if price is not None and price.complete:
        return ComponentCost(component.id, price.monthly_eur, "catalog", reported, price)
    if price is not None and price.lines:
        return ComponentCost(component.id, price.monthly_eur, "catalog", reported, price, ("partially_priced",))
    if not placement.running:
        return ComponentCost(component.id, 0.0, "stopped", reported, price)
    if reported is not None:
        return ComponentCost(component.id, reported, "reported", reported, price, ("change_unpriced",))
    return ComponentCost(component.id, 0.0, "unpriced", None, price, ("unpriced",))


def _estimate_the_catalog_replaces(reported: Metric, price: Price | None) -> bool:
    return reported.provenance < Provenance.OBSERVED and price is not None and price.complete
