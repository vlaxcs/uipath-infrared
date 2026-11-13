NAME_PREFIXES = (("shop", "shop"), ("web-", "shop"), ("data", "data"), ("ml-", "data"), ("clickstream", "data"),
                 ("events-raw", "data"), ("legacy", "legacy"), ("old-etl", "data"), ("dev", "dev"))
VPC_STACKS = {"shop-prod-vpc": "shop", "data-platform-vpc": "data", "legacy-vpc": "legacy", "dev-sandbox-vpc": "dev"}
STACK_LABELS = {"shop": ("Shop", "unknown"), "data": ("Data platform", "unknown"), "legacy": ("Legacy", "unknown"),
                "dev": ("Dev sandbox", "dev")}


def stack_of(vpc_name=None, name=""):
    lowered = (name or "").lower()
    for prefix, stack in NAME_PREFIXES:
        if lowered.startswith(prefix):
            return stack
    return VPC_STACKS.get(vpc_name or "")


def stack_entries(components):
    used = sorted({c["stack"] for c in components if c.get("stack")})
    return [{"id": s, "name": STACK_LABELS.get(s, (s, "unknown"))[0], "environment": STACK_LABELS.get(s, (s, "unknown"))[1],
             "description": "Derived from VPC membership and name prefix."} for s in used]
