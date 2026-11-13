from dataclasses import dataclass

from engine.domain.model import Component, Edge, Infra, StayTogether

ENTRY_EDGE_KINDS = frozenset({"dns", "traffic"})
DATA_EDGE_KIND = "data"
NON_SERVING_ENVIRONMENTS = frozenset({"dev", "staging"})
KNOWN_ENVIRONMENTS = frozenset({"prod", "staging", "dev", "shared", "unknown"})
ENVIRONMENT_TAG = "env"
STAY_TOGETHER_EDGE_KINDS = frozenset({"data", "traffic"})
STAY_TOGETHER_MIN_GB_MONTH = 100.0
DERIVED_GROUP_SCOPE = "region"


@dataclass(frozen=True)
class CriticalPath:
    stack: str
    entry: str
    components: tuple[str, ...]


@dataclass(frozen=True)
class EnvironmentLeak:
    edge: str
    source: str
    source_environment: str
    target: str
    target_environment: str


def environment_of(infra: Infra, component: Component) -> str:
    tagged = component.tags.get(ENVIRONMENT_TAG)
    if tagged in KNOWN_ENVIRONMENTS:
        return tagged
    return infra.environment_of(component)


def serves_production(infra: Infra, component: Component) -> bool:
    return environment_of(infra, component) not in NON_SERVING_ENVIRONMENTS


def critical_paths(infra: Infra) -> tuple[CriticalPath, ...]:
    edges = _known_edges(infra)
    paths = []
    for stack in sorted(infra.stacks):
        members = {
            c.id for c in infra.components
            if c.stack == stack and serves_production(infra, c)
        }
        if not members:
            continue
        path = _traffic_path(members, edges) or _data_path(members, edges)
        if path:
            paths.append(CriticalPath(stack, path[0], tuple(sorted(path[1]))))
    return tuple(paths)


def stay_together_groups(infra: Infra) -> tuple[StayTogether, ...]:
    if infra.stay_together:
        return infra.stay_together
    group_of: dict[str, str] = {}
    for edge in _known_edges(infra):
        if _binds(edge):
            _union(group_of, edge.source, edge.target)
    groups: dict[str, list[str]] = {}
    for member in sorted(group_of):
        groups.setdefault(_find(group_of, member), []).append(member)
    return tuple(
        StayTogether(f"derived-{members[0]}", tuple(members), DERIVED_GROUP_SCOPE, derived=True)
        for members in sorted(groups.values())
    )


def environment_leaks(infra: Infra) -> tuple[EnvironmentLeak, ...]:
    leaks = []
    for edge in _known_edges(infra):
        source, target = infra.component(edge.source), infra.component(edge.target)
        if not target.stateful or not serves_production(infra, target):
            continue
        if serves_production(infra, source):
            continue
        leaks.append(EnvironmentLeak(
            edge.id, source.id, environment_of(infra, source), target.id, environment_of(infra, target),
        ))
    return tuple(sorted(leaks, key=lambda leak: leak.edge))


def _known_edges(infra: Infra) -> tuple[Edge, ...]:
    ids = {c.id for c in infra.components}
    return tuple(e for e in infra.edges if e.source in ids and e.target in ids)


def _traffic_path(members: set[str], edges: tuple[Edge, ...]) -> tuple[str, set[str]] | None:
    entry_edges = [e for e in edges if e.kind in ENTRY_EDGE_KINDS]
    targets = {e.target for e in entry_edges}
    front: set[str] = set()
    for root in sorted({e.source for e in entry_edges} - targets):
        reached = _reach(root, entry_edges)
        if reached & members:
            front |= reached
    if not front:
        return None
    return "traffic", front | _data_targets(front, edges)


def _reach(root: str, edges: list[Edge]) -> set[str]:
    reached = {root}
    pending = [root]
    while pending:
        current = pending.pop()
        for edge in edges:
            if edge.source == current and edge.target not in reached:
                reached.add(edge.target)
                pending.append(edge.target)
    return reached


def _data_path(members: set[str], edges: tuple[Edge, ...]) -> tuple[str, set[str]] | None:
    data_edges = [e for e in edges if e.kind == DATA_EDGE_KIND]
    fed = {e.target for e in edges if e.kind == DATA_EDGE_KIND or e.kind in ENTRY_EDGE_KINDS}
    roots = {e.source for e in data_edges if e.source in members and e.source not in fed}
    if not roots:
        return None
    return "data", roots | _data_targets(roots, edges)


def _data_targets(sources: set[str], edges: tuple[Edge, ...]) -> set[str]:
    return {e.target for e in edges if e.kind == DATA_EDGE_KIND and e.source in sources}


def _binds(edge: Edge) -> bool:
    if edge.kind not in STAY_TOGETHER_EDGE_KINDS:
        return False
    heavy = edge.gb_month is not None and edge.gb_month.value > STAY_TOGETHER_MIN_GB_MONTH
    return edge.latency_sensitive or heavy


def _find(group_of: dict[str, str], member: str) -> str:
    group_of.setdefault(member, member)
    while group_of[member] != member:
        member = group_of[member]
    return member


def _union(group_of: dict[str, str], left: str, right: str) -> None:
    first, second = sorted((_find(group_of, left), _find(group_of, right)))
    group_of[second] = first
