from dataclasses import dataclass, field
from typing import Mapping

from engine.domain.provenance import Evidence, Provenance

KINDS = frozenset({
    "postgres", "nosql", "cache", "stream", "queue", "object_storage", "block_storage",
    "file_system", "container", "kubernetes_cluster", "node_group", "virtual_machine",
    "function", "load_balancer", "nat", "cdn", "dns", "other",
})


@dataclass(frozen=True)
class Metric:
    name: str
    value: float
    unit: str | None
    provenance: Provenance

    @property
    def evidence(self) -> Evidence:
        return Evidence(self.name, self.provenance)


@dataclass(frozen=True)
class Usage:
    name: str
    unit: str | None
    window_days: float
    provenance: Provenance
    avg: float | None = None
    min: float | None = None
    p50: float | None = None
    p95: float | None = None
    max: float | None = None
    sum: float | None = None

    @property
    def monthly_sum(self) -> float | None:
        if self.sum is None or not self.window_days:
            return None
        return self.sum * 30 / self.window_days

    @property
    def evidence(self) -> Evidence:
        return Evidence(self.name, self.provenance)


@dataclass(frozen=True)
class Scaling:
    min: int | None
    max: int | None
    desired: int | None
    autoscaling_enabled: bool | None

    @property
    def is_static(self) -> bool:
        return (
            self.autoscaling_enabled is False
            and self.min is not None
            and self.min == self.max == self.desired
        )


@dataclass(frozen=True)
class Component:
    id: str
    kind: str
    provider: str
    service: str
    quantity: int
    region: str
    zones: int | None
    status: str
    stateful: bool
    stack: str | None = None
    parent: str | None = None
    sku: str | None = None
    engine_name: str | None = None
    engine_version: str | None = None
    features_used: frozenset[str] | None = None
    data_gb: Metric | None = None
    data_classification: str = "unknown"
    capacity: Mapping[str, Metric] = field(default_factory=dict)
    usage: Mapping[str, Usage] = field(default_factory=dict)
    scaling: Scaling | None = None
    security: Mapping[str, object] = field(default_factory=dict)
    config: Mapping[str, object] = field(default_factory=dict)
    reported_cost: Metric | None = None
    tags: Mapping[str, str] = field(default_factory=dict)

    def capacity_value(self, key: str) -> float | None:
        metric = self.capacity.get(key)
        return None if metric is None else metric.value

    def total_capacity(self, key: str) -> float | None:
        value = self.capacity_value(key)
        return None if value is None else value * self.quantity


@dataclass(frozen=True)
class Edge:
    id: str
    source: str
    target: str
    kind: str
    evidence: str
    gb_month: Metric | None = None
    latency_sensitive: bool = False


@dataclass(frozen=True)
class Stack:
    id: str
    environment: str


@dataclass(frozen=True)
class StayTogether:
    id: str
    members: tuple[str, ...]
    scope: str
    derived: bool = False


@dataclass(frozen=True)
class Infra:
    schema_version: str
    project: str
    is_mock: bool
    stacks: Mapping[str, Stack]
    controls: Mapping[str, object]
    components: tuple[Component, ...]
    edges: tuple[Edge, ...]
    stay_together: tuple[StayTogether, ...]
    _by_id: Mapping[str, Component] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_by_id", {c.id: c for c in self.components})

    def component(self, component_id: str) -> Component:
        return self._by_id[component_id]

    def environment_of(self, component: Component) -> str:
        stack = self.stacks.get(component.stack or "")
        return stack.environment if stack else "unknown"
