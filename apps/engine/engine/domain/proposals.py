from dataclasses import dataclass
from typing import Callable, Mapping

from engine.domain.candidate import DO_NOTHING, Candidate
from engine.domain.catalog import Catalog
from engine.domain.end_state import apply_candidate
from engine.domain.forecast import Forecast
from engine.domain.model import Infra
from engine.domain.remediation import remediation_actions

STRATEGY_ORDER = (
    "do_nothing", "cleanup_orphans", "rightsize_in_place", "managed_services", "consolidate", "move_to_onprem",
)
REMEDIATION_LAYER = "security_remediation"

Builder = Callable[[Candidate, Infra, Catalog, Forecast], Candidate]


@dataclass(frozen=True)
class Proposal:
    candidate: Candidate
    layers: tuple[str, ...]


@dataclass(frozen=True)
class Proposals:
    proposals: tuple[Proposal, ...]
    not_built: tuple[str, ...]


def build_proposals(builders: Mapping[str, Builder], infra: Infra, catalog: Catalog, forecast: Forecast) -> Proposals:
    layer = DO_NOTHING
    layer_names: tuple[str, ...] = ()
    proposals = [Proposal(DO_NOTHING, ())]
    not_built = []
    for name in STRATEGY_ORDER[1:]:
        if name not in forecast.cto.strategies_enabled:
            continue
        builder = builders.get(name)
        if builder is None:
            not_built.append(name)
            continue
        next_layer = builder(layer, infra, catalog, forecast)
        layer_names += (name,) * (len(next_layer.actions) - len(layer.actions))
        layer = next_layer
        fixes = remediation_actions(apply_candidate(infra, catalog, layer), infra, forecast)
        proposals.append(Proposal(
            Candidate(name, layer.actions + fixes, builds_on=layer.builds_on),
            layer_names + (REMEDIATION_LAYER,) * len(fixes),
        ))
    return Proposals(tuple(proposals), tuple(not_built))
