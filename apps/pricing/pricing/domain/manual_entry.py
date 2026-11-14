from dataclasses import dataclass
from datetime import date

from pricing.domain.price import Price


@dataclass(frozen=True)
class ManualEntry:
    key: str
    price: Price
    read_on: date
    quote: str

    @property
    def url(self) -> str:
        return self.price.reference


def quote_found(quote: str, page_text: str) -> bool:
    return _squeezed(quote) in _squeezed(page_text)


def _squeezed(text: str) -> str:
    return "".join(text.split()).casefold()
