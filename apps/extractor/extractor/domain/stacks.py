import re

NAME_PREFIXES = (("shop", "shop"), ("web-", "shop"), ("data", "data"), ("ml-", "data"), ("clickstream", "data"),
                 ("events-raw", "data"), ("legacy", "legacy"), ("old-etl", "data"), ("dev", "dev"))
VPC_STACKS = {"shop-prod-vpc": "shop", "data-platform-vpc": "data", "legacy-vpc": "legacy", "dev-sandbox-vpc": "dev"}
STACK_LABELS = {"shop": ("Shop", "unknown"), "data": ("Data platform", "unknown"), "legacy": ("Legacy", "unknown"),
                "dev": ("Dev sandbox", "dev")}

ENVIRONMENT_NAME = re.compile(r"^((?:[a-z0-9]+-)?(prod|staging|dev))(?:-|$)")
ENVIRONMENT_LABELS = {"prod": "Production", "staging": "Staging", "dev": "Development"}


def environment_stack(name):
    match = ENVIRONMENT_NAME.match(name)
    return match.group(1) if match else None


def stack_of(vpc_name=None, name=""):
    lowered = (name or "").lower()
    for prefix, stack in NAME_PREFIXES:
        if lowered.startswith(prefix):
            return stack
    return VPC_STACKS.get(vpc_name or "") or environment_stack(lowered) or environment_stack((vpc_name or "").lower())


def stack_label(stack):
    if stack in STACK_LABELS:
        return STACK_LABELS[stack]
    environment = stack.rsplit("-", 1)[-1]
    return (ENVIRONMENT_LABELS[environment], environment) if environment in ENVIRONMENT_LABELS else (stack, "unknown")


def stack_entries(components):
    used = sorted({c["stack"] for c in components if c.get("stack")})
    return [{"id": s, "name": stack_label(s)[0], "environment": stack_label(s)[1],
             "description": "Derived from VPC membership and name prefix."} for s in used]
