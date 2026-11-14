from dataclasses import dataclass


@dataclass(frozen=True)
class Price:
    amount: float
    currency: str
    unit: str
    reference: str
    description: str
