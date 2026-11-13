from typing import Callable, Dict, List, Sequence, Tuple

from ..domain.build_plan import NotBuilt
from ..domain.built import BuiltComponent
from ..domain.candidate import Action

Builder = Callable[[Action, List[BuiltComponent]], BuiltComponent]


def build_components(actions: Sequence[Action], builders: Dict[str, Builder], log: Callable[[str], None]) -> Tuple[List[BuiltComponent], List[NotBuilt]]:
    built: List[BuiltComponent] = []
    failed: List[NotBuilt] = []
    for action in actions:
        try:
            component = builders[action.kind](action, built)
        except Exception as error:
            failed.append(NotBuilt(action.component_id, action.kind, action.action, f"build failed on Floci: {type(error).__name__}: {error}"))
            log(f"  {action.component_id} ({action.kind}) not built: {error}")
            continue
        built.append(component)
        log(f"  built {action.component_id} ({action.kind}): {component.detail}")
    return built, failed


def instance_ids(components: Sequence[BuiltComponent]) -> List[str]:
    return [
        resource.resource_id
        for component in components
        if component.kind == "virtual_machine"
        for resource in component.resources_of("instance")
    ]
