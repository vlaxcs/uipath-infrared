import re
from dataclasses import dataclass
from typing import Optional

SKU_PATTERN = re.compile(r"(?:db\.|cache\.)?[a-z][a-z0-9-]*\.[a-z0-9]+")
COUNT_TIMES_SKU = re.compile(r"(?<![\w.])(\d+)\s*x\s+([^\s,]+)", re.IGNORECASE)
ZONES = re.compile(r"(\d+)\s*(?:zones?|azs?)\b", re.IGNORECASE)
UNITS = re.compile(r"(\d+)\s*(?:nodes?|instances?|replicas?|units?)\b", re.IGNORECASE)


@dataclass(frozen=True)
class TargetSpec:
    quantity: Optional[int] = None
    sku: Optional[str] = None
    zones: Optional[int] = None

    def is_empty(self) -> bool:
        return self.quantity is None and self.sku is None and self.zones is None

    def describe(self) -> str:
        parts = [f"{name} {value}" for name, value in (("count", self.quantity), ("size", self.sku), ("zones", self.zones)) if value is not None]
        return ", ".join(parts)


def parse_target(text: str) -> TargetSpec:
    quantity = None
    sku = None
    counted = COUNT_TIMES_SKU.search(text)
    if counted:
        quantity = int(counted.group(1))
        sku = counted.group(2) if SKU_PATTERN.fullmatch(counted.group(2)) else None
    if sku is None:
        sku = next((token for token in re.split(r"[\s,]+", text) if SKU_PATTERN.fullmatch(token)), None)
    units = UNITS.search(text)
    if quantity is None and units:
        quantity = int(units.group(1))
    zones = ZONES.search(text)
    return TargetSpec(quantity=quantity, sku=sku, zones=int(zones.group(1)) if zones else None)
