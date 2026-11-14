from typing import Any, Mapping

from pricing.domain.errors import BuildError

TIER = "tier"
PER_UNIT = "per_unit"
PRICING_FIELD = "pricing"
MONEY_FIELDS = ("egress_per_gb_eur", "fixed_monthly_eur")
PLATFORM = "platform"


def money_targets(option: Mapping[str, Any]) -> tuple[str, ...]:
    pricing = option.get("pricing", {})
    targets = [f"{TIER}:{tier['id']}" for tier in pricing.get("tiers", [])]
    targets += [f"{PER_UNIT}:{unit['driver']}" for unit in pricing.get("per_unit", [])]
    targets += [f"{PRICING_FIELD}:{name}" for name in MONEY_FIELDS if name in pricing]
    return tuple(targets)


def get_target(option: Mapping[str, Any], target: str) -> float:
    kind, _, name = target.partition(":")
    pricing = option.get("pricing", {})
    if kind == TIER:
        return _one(pricing.get("tiers", []), "id", name)["monthly_eur"]
    if kind == PER_UNIT:
        return _one(pricing.get("per_unit", []), "driver", name)["eur_per_unit"]
    if kind == PRICING_FIELD and name in MONEY_FIELDS:
        return pricing[name]
    raise BuildError(f"unknown target {target}")


def set_target(option: dict[str, Any], target: str, eur: float) -> None:
    kind, _, name = target.partition(":")
    pricing = option.get("pricing", {})
    if kind == TIER:
        _one(pricing.get("tiers", []), "id", name)["monthly_eur"] = eur
    elif kind == PER_UNIT:
        _one(pricing.get("per_unit", []), "driver", name)["eur_per_unit"] = eur
    elif kind == PRICING_FIELD and name in MONEY_FIELDS:
        pricing[name] = eur
    else:
        raise BuildError(f"unknown target {target}")


def _one(items: list[dict[str, Any]], key: str, value: str) -> dict[str, Any]:
    found = [item for item in items if item.get(key) == value]
    if len(found) != 1:
        raise BuildError(f"{len(found)} entries with {key} {value}")
    return found[0]
