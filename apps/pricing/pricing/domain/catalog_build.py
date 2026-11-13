import copy
from dataclasses import dataclass
from typing import Any, Mapping

from pricing.domain.binding import PER_HOUR, Binding
from pricing.domain.catalog_targets import PLATFORM, money_targets, set_target
from pricing.domain.errors import BuildError
from pricing.domain.fx import FxRate
from pricing.domain.price import Price
from pricing.domain.rounding import significant
from pricing.domain.snapshot import Snapshot

SKELETON_VALUE = "illustrative value from the skeleton"


@dataclass(frozen=True)
class BuiltCatalog:
    document: dict[str, Any]
    sourced: tuple[str, ...]
    unsourced: tuple[str, ...]


def build_catalog(
    skeleton: Mapping[str, Any],
    bindings: tuple[Binding, ...],
    descriptions: Mapping[str, str],
    snapshots: tuple[Snapshot, ...],
    fx: FxRate,
) -> BuiltCatalog:
    document = copy.deepcopy(dict(skeleton))
    options = {option["id"]: option for option in document["options"]}
    prices = {f"{s.source}/{key}": (price, s) for s in snapshots for key, price in s.prices.items()}
    unverified = {f"{s.source}/{key}": reason for s in snapshots for key, reason in s.unverified.items()}
    sources: dict[str, dict[str, Any]] = {}
    skipped: dict[str, str] = {}
    problems: list[str] = []
    for binding in sorted(bindings, key=lambda b: b.name):
        if binding.price in unverified:
            skipped[binding.name] = unverified[binding.price]
            continue
        problem = _apply(binding, options, prices, fx, document["hours_per_month"], sources)
        if problem:
            problems.append(f"{binding.name}: {problem}")
    for option_id, text in descriptions.items():
        if option_id not in options:
            problems.append(f"description for unknown option {option_id}")
        else:
            options[option_id]["description"] = text
    if problems:
        raise BuildError("; ".join(problems))
    every = {f"{o['id']}/{t}" for o in document["options"] for t in money_targets(o)}
    every |= {f"{PLATFORM}/{p['id']}" for p in document.get("onprem_platforms", [])}
    unsourced = tuple(sorted(every - set(sources)))
    document["illustrative"] = bool(unsourced)
    document["disclaimer"] = _disclaimer(len(sources), len(unsourced))
    document["x_price_sources"] = dict(sorted(sources.items()))
    document["x_unsourced"] = {name: skipped.get(name, SKELETON_VALUE) for name in unsourced}
    document["x_snapshots"] = {
        s.source: {"url": s.url, "version": s.version, "fetched_on": s.fetched_on.isoformat()}
        for s in sorted(snapshots, key=lambda s: s.source)
    }
    document["x_fx"] = {
        "source": fx.source, "url": fx.url, "rate_date": fx.rate_date.isoformat(),
        "fetched_on": fx.fetched_on.isoformat(), "usd_per_eur": fx.usd_per_eur,
    }
    return BuiltCatalog(document, tuple(sorted(sources)), unsourced)


def _apply(
    binding: Binding,
    options: Mapping[str, dict[str, Any]],
    prices: Mapping[str, tuple[Price, Snapshot]],
    fx: FxRate,
    hours_per_month: float,
    sources: dict[str, dict[str, Any]],
) -> str | None:
    option = options.get(binding.option)
    if option is None:
        return "no such option in the skeleton"
    found = prices.get(binding.price)
    if found is None:
        return f"no price {binding.price} in the snapshots"
    price, snapshot = found
    if price.unit != binding.unit:
        return f"{binding.price} is per {price.unit}, the binding expects {binding.unit}"
    hours = hours_per_month if binding.per == PER_HOUR else 1.0
    eur = significant(fx.to_eur(price.amount, price.currency) * binding.multiplier * hours)
    try:
        set_target(option, binding.target, eur)
    except BuildError as error:
        return str(error)
    sources[binding.name] = {
        "price": binding.price,
        "amount": price.amount,
        "currency": price.currency,
        "unit": price.unit,
        "multiplier": binding.multiplier,
        "per": binding.per,
        "eur": eur,
        "reference": price.reference,
        "source_version": snapshot.version,
        "fetched_on": snapshot.fetched_on.isoformat(),
    }
    return None


def _disclaimer(sourced: int, unsourced: int) -> str:
    if not unsourced:
        return "Every price comes from a dated snapshot listed in x_price_sources. SLAs and migration figures are not prices and stay as written."
    return (
        f"{sourced} prices come from dated snapshots listed in x_price_sources; "
        f"{unsourced} stay illustrative, listed in x_unsourced. SLAs and migration figures are not prices and stay as written."
    )
