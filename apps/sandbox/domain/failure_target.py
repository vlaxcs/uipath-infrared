from dataclasses import dataclass
from typing import Optional, Sequence

from .built import BuiltComponent, BuiltResource
from .failure import FailureType


@dataclass(frozen=True)
class FailureTarget:
    component_id: str
    kind: str
    resource: BuiltResource
    type: FailureType
    reason: str


def choose_failure_target(components: Sequence[BuiltComponent]) -> Optional[FailureTarget]:
    balanced = any(component.kind == "load_balancer" and component.resources for component in components)
    machines = [component for component in components if component.kind == "virtual_machine" and component.resources_of("instance")]
    redundant = [component for component in machines if len(component.resources_of("instance")) >= 2]
    if redundant:
        component = max(redundant, key=lambda candidate: len(candidate.resources_of("instance")))
        instance = component.resources_of("instance")[0]
        behind = "behind the load balancer" if balanced else "with no load balancer in front"
        return FailureTarget(
            component.component_id,
            component.kind,
            instance,
            FailureType.INSTANCE_STOP,
            f"stop instance {instance.resource_id} in {instance.zone}, one of {len(component.resources_of('instance'))} {behind}",
        )
    databases = [component for component in components if component.kind == "postgres" and component.resources_of("db_instance")]
    if databases:
        database = databases[0].resources_of("db_instance")[0]
        return FailureTarget(
            databases[0].component_id,
            databases[0].kind,
            database,
            FailureType.INSTANCE_STOP,
            f"reboot the primary of {database.resource_id} with a forced failover",
        )
    if machines:
        instance = machines[0].resources_of("instance")[0]
        return FailureTarget(
            machines[0].component_id,
            machines[0].kind,
            instance,
            FailureType.INSTANCE_STOP,
            f"stop instance {instance.resource_id} in {instance.zone}",
        )
    return None
