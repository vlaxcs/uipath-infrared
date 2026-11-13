import math
from dataclasses import dataclass

from engine.domain.catalog import Tier


@dataclass(frozen=True)
class TierChoice:
    tier: Tier
    units: int
    basis: str


def resolve_tier(
    tiers: tuple[Tier, ...],
    sku: str | None,
    vcpu: float | None,
    memory_gb: float | None,
    gpus: float | None = None,
) -> TierChoice | None:
    exact = [t for t in tiers if t.id == sku]
    if exact:
        return TierChoice(exact[0], 1, f"catalog tier {sku}")
    if vcpu is None or memory_gb is None or not tiers:
        return None
    need_gpus = gpus or 0
    pool = [t for t in tiers if t.gpus > 0] if need_gpus else list(tiers)
    if not pool:
        return None
    size = f"{vcpu:g} vCPU / {memory_gb:g} GB" + (f" / {need_gpus:g} GPU" if need_gpus else "")
    options = [(t, _units_to_cover(t, vcpu, memory_gb, need_gpus)) for t in pool]
    single = [t for t, units in options if units == 1]
    if single:
        tier = min(single, key=lambda t: (t.monthly_eur, t.id))
        return TierChoice(tier, 1, f"smallest tier covering {size}: {tier.id}")
    tier, units = min(options, key=lambda o: (o[1] * o[0].monthly_eur, o[1], o[0].id))
    return TierChoice(tier, units, f"no single tier covers {size}: {units} x {tier.id}")


def _units_to_cover(tier: Tier, vcpu: float, memory_gb: float, gpus: float) -> int:
    ratios = [vcpu / tier.vcpu, memory_gb / tier.memory_gb]
    if gpus:
        ratios.append(gpus / tier.gpus)
    return max(1, math.ceil(max(ratios)))
