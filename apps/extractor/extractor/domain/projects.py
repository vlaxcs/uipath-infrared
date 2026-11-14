import re

NAME_PREFIXES = {"startup": "startup-", "clinic-booking": "clinic-", "fleet-telemetry": "fleet-"}
REMAINDER_PROJECT = "demo-shop"


def _claims(name, prefix):
    return re.search(rf"(^|[\s/]){re.escape(prefix)}", name or "") is not None


def owner_of(name):
    return next((project for project, prefix in NAME_PREFIXES.items() if _claims(name, prefix)), None)


def is_scoped(project):
    return project in NAME_PREFIXES or project == REMAINDER_PROJECT


def belongs(name, project):
    if project in NAME_PREFIXES:
        return owner_of(name) == project
    return owner_of(name) is None if project == REMAINDER_PROJECT else True


def tag_name(resource):
    return next((t["Value"] for t in resource.get("Tags") or [] if t["Key"] == "Name"), "")


def scoped_by_tag(component):
    return component["kind"] == "block_storage" and component.get("status") == "orphan"


def local_stack(stack, project):
    prefix = NAME_PREFIXES.get(project)
    return stack[len(prefix):] if prefix and stack and stack.startswith(prefix) else stack


def scope_to_project(inventory, project):
    if not is_scoped(project):
        return
    kept = [c for c in inventory.components if scoped_by_tag(c) or belongs(c.get("name", c["id"]), project)]
    ids = {c["id"] for c in kept}
    for component in kept:
        if component.get("stack"):
            component["stack"] = local_stack(component["stack"], project)
    inventory.components = kept
    inventory.edges = [e for e in inventory.edges if e["from"] in ids and e["to"] in ids]
