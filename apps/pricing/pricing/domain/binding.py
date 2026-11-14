from dataclasses import dataclass

PER_HOUR = "hour"
PER_UNIT = "unit"


@dataclass(frozen=True)
class Binding:
    option: str
    target: str
    price: str
    unit: str
    per: str
    multiplier: float = 1.0
    part: str = ""

    @property
    def name(self) -> str:
        return f"{self.option}/{self.target}"
