import re

from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.point_metric import point_metric
from extractor.domain.stacks import stack_of

INTERNAL_PREFIX = "awslambda-"
PUBLIC_PRINCIPAL = re.compile(r'"Principal"\s*:\s*("\*"|\{\s*"AWS"\s*:\s*"\*"\s*\})')
STANDARD_USD_PER_GB_MONTH = 0.023


def is_internal_bucket(name):
    return name.startswith(INTERNAL_PREFIX)


def policy_is_public(policy):
    return bool(policy and PUBLIC_PRINCIPAL.search(policy))


def bucket(component_id, name, policy, encrypted, versioned, lifecycle, size, objects, metric_provenance):
    return {"id": component_id, "name": name, "kind": "object_storage", "service": "s3", "stateful": True, "stack": stack_of(None, name),
            "data_gb": point_metric(round(size["avg"], 1), "GB", metric_provenance, "CloudWatch AWS/S3 BucketSizeBytes (14d average)") if size else None,
            "capacity": {"object_count": point_metric(round(objects["avg"]), "count", metric_provenance, "CloudWatch AWS/S3 NumberOfObjects")} if objects else None,
            "security": {"public_exposure": "internet" if policy_is_public(policy) else "none", "encryption_at_rest": encrypted},
            "cost": monthly_cost(size["avg"] * STANDARD_USD_PER_GB_MONTH, f"S3 Standard 0.023 USD/GB-mo x {size['avg']:.0f} GB") if size else None,
            "config": {"versioning": versioned, "lifecycle_rules_present": lifecycle}}
