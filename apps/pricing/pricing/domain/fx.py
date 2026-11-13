from dataclasses import dataclass
from datetime import date

from pricing.domain.errors import PricingError

EUR = "EUR"
USD = "USD"


@dataclass(frozen=True)
class FxRate:
    source: str
    url: str
    rate_date: date
    fetched_on: date
    usd_per_eur: float

    def to_eur(self, amount: float, currency: str) -> float:
        if currency == EUR:
            return amount
        if currency == USD:
            return amount / self.usd_per_eur
        raise PricingError(f"no exchange rate for {currency}")
