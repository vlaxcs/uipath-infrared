import re
from dataclasses import dataclass

PROJECT_KEYS = ("project", "application", "app", "service", "product", "workload")
ENVIRONMENT_KEYS = ("environment", "env", "stage")
CLOUDFORMATION_KEY = "aws:cloudformation:stack-name"
NAMESPACE_KEYS = ("kubernetes.io/namespace", "k8s-namespace", "namespace")
ENVIRONMENTS = {"prod": "prod", "production": "prod", "prd": "prod", "live": "prod", "staging": "staging", "stage": "staging",
                "stg": "staging", "preprod": "staging", "dev": "dev", "development": "dev", "test": "dev", "sandbox": "dev"}
ENVIRONMENT_SUFFIX = re.compile(r"^(?P<project>[a-z0-9][a-z0-9-]*?)[-_](?P<environment>prod|production|prd|live|staging|stage|stg|preprod|dev|development|test|sandbox)$")
SHARED_STACK = "shared"
UNASSIGNED_STACK = "unassigned"


@dataclass(frozen=True)
class Ownership:
    project: str | None
    environment: str | None
    source: str
    shared_by: tuple[str, ...] = ()

    def stack(self):
        if self.source == "shared":
            return SHARED_STACK
        if self.project is None:
            return UNASSIGNED_STACK
        return f"{self.project}-{self.environment}" if self.environment else self.project

    def record(self):
        found = {"project": self.project, "environment": self.environment, "source": self.source}
        if self.shared_by:
            found["shared_by"] = list(self.shared_by)
        return found


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")


def environment_of(value):
    return ENVIRONMENTS.get(slug(value))


HEX_ID = re.compile(r"^[0-9a-f]{8,}$")


def resource_names(arn):
    parts = [part for part in re.split(r"[/:]", arn.split(":", 5)[-1]) if part]
    names = parts[-1:]
    if len(parts) >= 2 and HEX_ID.match(parts[-1]):
        names.append(parts[-2])
    return names


def tags_by_name(mappings):
    found = {}
    for mapping in mappings:
        tags = {tag["Key"]: tag["Value"] for tag in mapping.get("Tags") or []}
        for name in resource_names(mapping["ResourceARN"]):
            found.setdefault(name, {}).update(tags)
    return found


def _tag(tags, keys):
    lowered = {key.lower(): value for key, value in tags.items()}
    return next((lowered[key] for key in keys if lowered.get(key)), None)


def _split_environment(name):
    match = ENVIRONMENT_SUFFIX.match(slug(name))
    return (match.group("project"), ENVIRONMENTS[match.group("environment")]) if match else (slug(name), None)


def _environment_in_name(name):
    for part in slug(name).split("-"):
        if part in ENVIRONMENTS:
            return ENVIRONMENTS[part]
    return None


def own(component, tags, known_projects, accounts):
    name = component.get("name") or component["id"]
    environment = environment_of(_tag(tags, ENVIRONMENT_KEYS)) or _environment_in_name(name)
    tagged = _tag(tags, PROJECT_KEYS)
    if tagged:
        return Ownership(slug(tagged), environment, "tag")
    stack_name = tags.get(CLOUDFORMATION_KEY)
    if stack_name:
        project, from_stack = _split_environment(stack_name)
        return Ownership(project, environment or from_stack, "cloudformation")
    namespace = _tag(tags, NAMESPACE_KEYS) or (component.get("config") or {}).get("namespace")
    if namespace:
        project, from_namespace = _split_environment(namespace)
        return Ownership(project, environment or from_namespace, "namespace")
    account = (component.get("config") or {}).get("account_id")
    if account and account in accounts:
        return Ownership(accounts[account], environment, "account")
    lowered = slug(name)
    for project in sorted(known_projects, key=len, reverse=True):
        if lowered == project or lowered.startswith(f"{project}-"):
            return Ownership(project, environment, "name")
    return Ownership(None, environment, "none")


def component_tags(component, tags):
    name = component.get("name") or component["id"]
    return {**(component.get("tags") or {}), **tags.get(name, {}), **tags.get(component["id"], {})}


def resolve_ownership(components, edges, tags=None, known_projects=(), accounts=None):
    tags = tags or {}
    accounts = accounts or {}
    owned = {}
    for component in components:
        owned[component["id"]] = own(component, component_tags(component, tags), known_projects, accounts)
    if not any(ownership.project for ownership in owned.values()):
        return components
    neighbours = {component["id"]: set() for component in components}
    for edge in edges:
        if edge["from"] in neighbours and edge["to"] in neighbours:
            neighbours[edge["from"]].add(edge["to"])
            neighbours[edge["to"]].add(edge["from"])
    for component_id, ownership in list(owned.items()):
        if ownership.project:
            continue
        users = sorted({owned[other].project for other in neighbours[component_id] if owned[other].project})
        if len(users) >= 2:
            owned[component_id] = Ownership(None, ownership.environment, "shared", tuple(users))
        elif len(users) == 1:
            owned[component_id] = Ownership(users[0], ownership.environment, "dependency")
    return [{**component, "stack": owned[component["id"]].stack(), "x_ownership": owned[component["id"]].record()} for component in components]
