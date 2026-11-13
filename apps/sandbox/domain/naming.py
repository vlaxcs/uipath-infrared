import re

BASE_PREFIX = "sandbox-"


def run_prefix(run_id: str) -> str:
    return f"{BASE_PREFIX}{run_id}-"


def resource_name(prefix: str, component_id: str, max_length: int = 63, suffix: str = "") -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", component_id.lower()).strip("-")
    return f"{prefix}{slug}{suffix}"[:max_length].rstrip("-")
