from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class BuiltResource:
    resource_type: str
    resource_id: str
    name: str
    zone: str = ""
    address: str = ""


@dataclass
class BuiltComponent:
    component_id: str
    kind: str
    sku: str
    zones: int
    resources: List[BuiltResource] = field(default_factory=list)
    detail: str = ""

    def resources_of(self, resource_type: str) -> List[BuiltResource]:
        return [resource for resource in self.resources if resource.resource_type == resource_type]
