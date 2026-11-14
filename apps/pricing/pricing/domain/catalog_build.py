import copy
from dataclasses import dataclass
from typing import Any, Mapping

from pricing.domain.binding import PER_HOUR, Binding
from pricing.domain.catalog_targets import PLATFORM, get_target, money_targets, set_target
from pricing.domain.errors import BuildError
from pricing.domain.fx import FxRate
from pricing.domain.price import Price
from pricing.domain.rounding import significant
from pricing.domain.sla import SLA_FIELDS, SlaEntry, SlaSnapshot
from pricing.domain.snapshot import Snapshot

SKELETON_VALUE = "illustrative value from the skeleton"


@dataclass(frozen=True)
class BuiltCatalog:
    document: dict[str, Any]
    sourced: tuple[str, ...]
    unsourced: tuple[str, ...]
    sla_sourced: tuple[str, ...] = ()
    sla_unsourced: tuple[str, ...] = ()


def build_catalog(
    skeleton: Mapping[str, Any],
    bindings: tuple[Binding, ...],
    descriptions: Mapping[str, str],
    snapshots: tuple[Snapshot, ...],
    fx: FxRate,
    slas: SlaSnapshot | None = None,
) -> BuiltCatalog:
    document = copy.deepcopy(dict(skeleton))
    options = {option["id"]: option for option in document["options"]}
    prices = {f"{s.source}/{key}": (price, s) for s in snapshots for key, price in s.prices.items()}
    unverified = {f"{s.source}/{key}": reason for s in snapshots for key, reason in s.unverified.items()}
    sources: dict[str, dict[str, Any]] = {}
    skipped: dict[str, str] = {}
    problems: list[str] = []
    totals: dict[str, float] = {}
    for binding in sorted(bindings, key=lambda b: (b.name, b.part)):
        if binding.price in unverified:
            skipped[binding.name] = unverified[binding.price]
            continue
        problem = _apply(binding, options, prices, fx, document["hours_per_month"], sources, totals)
        if problem:
            problems.append(f"{binding.name}: {problem}")
    for name in sorted(set(skipped) & set(sources)):
        option_id, _, target = name.partition("/")
        original = next(o for o in skeleton["options"] if o["id"] == option_id)
        set_target(options[option_id], target, get_target(original, target))
        del sources[name]
    for option_id, text in descriptions.items():
        if option_id not in options:
            problems.append(f"description for unknown option {option_id}")
        else:
            options[option_id]["description"] = text
    platforms = {platform["id"]: platform for platform in document.get("onprem_platforms", [])}
    sla_sources: dict[str, dict[str, Any]] = {}
    if slas is not None:
        for key, entry in sorted(slas.entries.items()):
            problem = _apply_sla(key, entry, options, platforms, slas.fetched_on.isoformat(), sla_sources)
            if problem:
                problems.append(problem)
    if problems:
        raise BuildError("; ".join(problems))
    every = {f"{o['id']}/{t}" for o in document["options"] for t in money_targets(o)}
    every |= {f"{PLATFORM}/{p['id']}" for p in document.get("onprem_platforms", [])}
    unsourced = tuple(sorted(every - set(sources)))
    expected_sla = {f"{o['id']}/availability_pct" for o in document["options"]}
    expected_sla |= {
        f"{o['id']}/multi_az_availability_pct" for o in document["options"]
        if "multi_az_availability_pct" in o.get("sla", {})
    }
    expected_sla |= {f"{PLATFORM}/{p['id']}/availability_pct" for p in document.get("onprem_platforms", [])}
    sla_unsourced = tuple(sorted(expected_sla - set(sla_sources)))
    document["illustrative"] = bool(unsourced)
    document["disclaimer"] = _disclaimer(len(sources), len(unsourced), len(sla_sources), len(sla_unsourced))
    document["x_price_sources"] = dict(sorted(sources.items()))
    reasons = dict(document.get("x_unsourced_reasons", {}))
    document["x_unsourced"] = {name: skipped.get(name, reasons.get(name, SKELETON_VALUE)) for name in unsourced}
    if slas is not None:
        document["x_sla_sources"] = dict(sorted(sla_sources.items()))
        sla_reasons = dict(document.get("x_sla_unsourced_reasons", {}))
        document["x_sla_unsourced"] = {
            name: sla_reasons.get(name, SKELETON_VALUE) for name in sla_unsourced
        }
    document["x_migration_estimates"] = {
        "note": "Migration effort, cutover downtime and risk figures are handwritten estimates; there is no public vendor data for them.",
        "options": sorted(options),
    }
    document["x_features_estimates"] = {
        "note": "features_supported lists remain handwritten; they are not checked against every vendor's feature list.",
        "options": sorted(options),
    }
    document["x_snapshots"] = {
        s.source: {"url": s.url, "version": s.version, "fetched_on": s.fetched_on.isoformat()}
        for s in sorted(snapshots, key=lambda s: s.source)
    }
    if slas is not None:
        document["x_snapshots"][slas.source] = {
            "url": slas.url, "version": slas.version, "fetched_on": slas.fetched_on.isoformat(),
        }
    document["x_fx"] = {
        "source": fx.source, "url": fx.url, "rate_date": fx.rate_date.isoformat(),
        "fetched_on": fx.fetched_on.isoformat(), "usd_per_eur": fx.usd_per_eur,
    }
    return BuiltCatalog(
        document, tuple(sorted(sources)), unsourced, tuple(sorted(sla_sources)), sla_unsourced,
    )


def _apply_sla(
    key: str,
    entry: SlaEntry,
    options: Mapping[str, dict[str, Any]],
    platforms: Mapping[str, dict[str, Any]],
    fetched_on: str,
    sources: dict[str, dict[str, Any]],
) -> str | None:
    owner, _, field = key.rpartition("/")
    if field not in SLA_FIELDS:
        return f"SLA {key}: unknown field {field}"
    if owner.startswith(f"{PLATFORM}/"):
        platform = platforms.get(owner.split("/", 1)[1])
        if platform is None:
            return f"SLA {key}: no such platform"
        platform[field] = entry.value
    else:
        option = options.get(owner)
        if option is None:
            return f"SLA {key}: no such option"
        option.setdefault("sla", {})[field] = entry.value
    sources[key] = {
        "value": entry.value,
        "url": entry.url,
        "quote": entry.quote,
        "read_on": entry.read_on.isoformat(),
        "fetched_on": fetched_on,
        "note": entry.note,
    }
    return None


def _apply(
    binding: Binding,
    options: Mapping[str, dict[str, Any]],
    prices: Mapping[str, tuple[Price, Snapshot]],
    fx: FxRate,
    hours_per_month: float,
    sources: dict[str, dict[str, Any]],
    totals: dict[str, float],
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
    if binding.part:
        totals[binding.name] = totals.get(binding.name, 0.0) + eur
    try:
        set_target(option, binding.target, significant(totals[binding.name]) if binding.part else eur)
    except BuildError as error:
        return str(error)
    record = {
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
    if binding.part:
        entry = sources.setdefault(binding.name, {"eur": 0.0, "parts": {}})
        entry["parts"][binding.part] = record
        entry["eur"] = significant(totals[binding.name])
    else:
        sources[binding.name] = record
    return None


def _disclaimer(sourced: int, unsourced: int, sla_sourced: int, sla_unsourced: int) -> str:
    price = f"{sourced} prices come from dated snapshots listed in x_price_sources"
    if unsourced:
        price += f"; {unsourced} still illustrative, listed in x_unsourced"
    sla = ""
    if sla_sourced or sla_unsourced:
        sla = f" {sla_sourced} SLA commitments come from dated vendor pages listed in x_sla_sources"
        if sla_unsourced:
            sla += f"; {sla_unsourced} remain estimates, listed in x_sla_unsourced"
        sla += "."
    return f"{price}.{sla} Migration figures and feature lists stay estimates."
