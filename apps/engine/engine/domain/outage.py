from engine.domain.availability import Availability
from engine.domain.forecast import Business

HOURS_PER_YEAR = 8760


def expected_outage_loss_eur_year(availability: Availability, business: Business) -> float:
    worst_by_stack: dict[str, float] = {}
    for path in availability.paths:
        current = worst_by_stack.get(path.stack, 100.0)
        worst_by_stack[path.stack] = min(current, path.availability_pct)
    return sum(
        (1 - pct / 100) * HOURS_PER_YEAR * business.downtime_cost_for(stack)
        for stack, pct in sorted(worst_by_stack.items())
    )
