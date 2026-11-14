"""Attribute components to the projects of the company's financial roadmap (forecast.json `projects[].match`).

A component belongs to a project when one of its project tags (Project, App, Application, any case) equals one of the
project's `tags`, case-insensitive; otherwise when its name (the component name or its Name tag) starts with one of the
project's `names`, also inside aggregate names such as "1 NAT gateway(s) in clinic-prod-vpc". Tag matches win over name
matches. A missing `match` (or a missing key in it) defaults to `tags = [id]`, `names = [id + "-"]`.
"""
import re
from dataclasses import dataclass

TAG_KEYS = ("project", "app", "application")


@dataclass(frozen=True)
class RoadmapProject:
    id: str
    tags: tuple[str, ...]
    names: tuple[str, ...]


def roadmap_projects(forecast):
    found = []
    for entry in (forecast or {}).get("projects") or []:
        match = entry.get("match") or {}
        tags = match.get("tags", [entry["id"]])
        names = match.get("names", [f"{entry['id']}-"])
        found.append(RoadmapProject(entry["id"], tuple(t.lower() for t in tags), tuple(n.lower() for n in names)))
    return tuple(found)


def _project_tags(tags):
    return {value.strip().lower() for key, value in tags.items() if key.lower() in TAG_KEYS and value and value.strip()}


def _claims(name, prefix):
    return re.search(rf"(^|[\s/]){re.escape(prefix)}", name.lower()) is not None


def match_component(component, tags, projects):
    """Return (project id, "tag" | "name") or (None, None)."""
    tagged = _project_tags(tags)
    for project in projects:
        if tagged & set(project.tags):
            return project.id, "tag"
    names = [n for n in (component.get("name") or component["id"], tags.get("Name")) if n]
    best = None
    for project in projects:
        for prefix in project.names:
            if any(_claims(name, prefix) for name in names) and (best is None or len(prefix) > best[1]):
                best = (project.id, len(prefix))
    return (best[0], "name") if best else (None, None)


def _kept_stacks(components, owner, order):
    """Stack -> the project that keeps it: the one with most components in it (the earlier in the roadmap on a tie)."""
    counts = {}
    for component in components:
        project, stack = owner.get(component["id"]), component.get("stack")
        if project and stack:
            counts.setdefault(stack, {}).setdefault(project, 0)
            counts[stack][project] += 1
    return {stack: max(found, key=lambda p: (found[p], -order[p])) for stack, found in counts.items()}


def _stack_for(project, stack, kept):
    if stack and kept.get(stack) == project:
        return stack
    own = [s for s, keeper in kept.items() if keeper == project]
    return own[0] if len(own) == 1 else project


def attribute_to_roadmap(components, tags_of, projects):
    """Match every component; return (components, x_projects, x_unassigned).

    `tags_of(component)` gives the component's merged tags. Each project's stacks must be its own, because the engine
    grows a project by its stacks: a stack holding several projects' components stays with the project that has most of
    them; a claimed component without a stack, or in a stack another project keeps, moves to its project's only stack,
    or to the stack `<project id>` when the project keeps none or several. Unclaimed components keep their stack.
    """
    if not projects:
        return components, None, None
    owner, how = {}, {}
    for component in components:
        owner[component["id"]], how[component["id"]] = match_component(component, tags_of(component), projects)
    kept = _kept_stacks(components, owner, {p.id: i for i, p in enumerate(projects)})
    result = []
    for component in components:
        project = owner[component["id"]]
        if project:
            stack = _stack_for(project, component.get("stack"), kept)
            if stack != component.get("stack"):
                component = {**component, "stack": stack}
        result.append(component)
    x_projects = {p.id: {"components": [], "by_tag": 0, "by_name": 0} for p in projects}
    for component in result:
        project = owner[component["id"]]
        if project:
            x_projects[project]["components"].append(component["id"])
            x_projects[project]["by_" + how[component["id"]]] += 1
    unassigned = [c["id"] for c in result if not owner[c["id"]]]
    return result, x_projects, unassigned
