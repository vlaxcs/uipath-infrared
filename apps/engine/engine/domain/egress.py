from dataclasses import dataclass

from engine.domain.catalog import Catalog
from engine.domain.end_state import EndState
from engine.domain.model import Infra


@dataclass(frozen=True)
class Egress:
    monthly_eur: float
    unpriced_edges: tuple[str, ...]


def new_boundary_egress(end_state: EndState, infra: Infra, catalog: Catalog) -> Egress:
    monthly = 0.0
    unpriced = []
    for edge in infra.edges:
        source = end_state.placements.get(edge.source)
        target = end_state.placements.get(edge.target)
        if source is None or target is None or source.removed or target.removed:
            continue
        if not (source.moved or target.moved):
            continue
        if (source.provider, source.region) == (target.provider, target.region):
            continue
        if edge.gb_month is None:
            unpriced.append(edge.id)
            continue
        option = catalog.option(target.option_id) if target.option_id else None
        if option is None:
            unpriced.append(edge.id)
            continue
        monthly += edge.gb_month.value * option.pricing.egress_per_gb_eur
    return Egress(monthly, tuple(unpriced))
