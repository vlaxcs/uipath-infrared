from engine.domain.catalog import Catalog
from engine.domain.end_state import EndState
from engine.domain.forecast import Business


def ops_monthly_eur(end_state: EndState, catalog: Catalog, business: Business) -> float:
    hours = sum(
        catalog.option(p.option_id).ops_hours_month_per_unit * p.quantity
        for p in end_state.live()
        if p.running and p.option_id
    )
    return hours * business.engineer_hourly_eur
