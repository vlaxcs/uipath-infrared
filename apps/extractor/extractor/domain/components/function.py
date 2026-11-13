from extractor.domain.secret_heuristic import plaintext_secrets_suspected
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of


def function_environment(function):
    return (function.get("Environment") or {}).get("Variables", {})


def lambda_function(component_id, function, network, admin, invocations, duration, errors):
    name, vpc = function["FunctionName"], function.get("VpcConfig") or {}
    return {"id": component_id, "name": name, "kind": "function", "service": "lambda", "stateful": False, "stack": stack_of(None, name),
            "engine": {"name": "lambda-runtime", "version": function["Runtime"]},
            "capacity": {"memory_gb": point_metric(function["MemorySize"] / 1024, "GB"), "timeout_s": point_metric(function["Timeout"], "s")},
            "usage": present(invocations=invocations, duration_ms=duration, errors=errors),
            "security": {"plaintext_secrets_suspected": plaintext_secrets_suspected(function_environment(function)),
                         "admin_privileges": admin, "public_exposure": "vpc_only" if vpc.get("SubnetIds") else "unknown",
                         "world_open_ports": network.world_ports(vpc.get("SecurityGroupIds"))},
            "config": {"vpc_attached": bool(vpc.get("SubnetIds")), "vpc_subnets": len(vpc.get("SubnetIds") or []),
                       "dead_letter_config": bool(function.get("DeadLetterConfig")),
                       "tracing": (function.get("TracingConfig") or {}).get("Mode"), "reserved_concurrency": None}}
