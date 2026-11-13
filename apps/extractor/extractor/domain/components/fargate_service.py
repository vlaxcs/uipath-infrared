from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.instance_specs import HOURS_PER_MONTH
from extractor.domain.secret_heuristic import plaintext_secrets_suspected
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of
from extractor.domain.point_metric import point_metric

USD_PER_VCPU_HOUR = 0.04048
USD_PER_GB_HOUR = 0.004445


def task_environment(task_definition):
    return {e["name"]: e["value"] for c in task_definition["containerDefinitions"] for e in c.get("environment", [])}


def container_insights_setting(cluster):
    return next((s["value"] for s in cluster.get("settings", []) if s["name"] == "containerInsights"), None)


def fargate_service(component_id, cluster_name, service, task_definition, cluster, network, cpu, memory, admin):
    containers = task_definition["containerDefinitions"]
    environment = task_environment(task_definition)
    vpc = service.get("networkConfiguration", {}).get("awsvpcConfiguration", {})
    subnets = vpc.get("subnets") or [""]
    quantity = service["desiredCount"]
    vcpu, memory_gb = int(task_definition["cpu"]) / 1024, int(task_definition["memory"]) / 1024
    usd = (USD_PER_VCPU_HOUR * vcpu + USD_PER_GB_HOUR * memory_gb) * HOURS_PER_MONTH * quantity
    return {"id": component_id, "name": f"{cluster_name}/{service['serviceName']}", "kind": "container", "service": "ecs-fargate",
            "sku": f"{vcpu:g}vcpu/{memory_gb:g}GB", "quantity": quantity, "stateful": False,
            "stack": stack_of(network.vpc_name_of_subnet(subnets[0]), cluster_name),
            "zones": network.zone_count(vpc.get("subnets", [])) or None,
            "capacity": {"vcpu": point_metric(vcpu, "count"), "memory_gb": point_metric(memory_gb, "GB")},
            "usage": present(cpu_pct=cpu, memory_pct=memory),
            "scaling": {"desired": quantity},
            "security": {"public_exposure": "internet" if vpc.get("assignPublicIp") == "ENABLED" else "vpc_only",
                         "world_open_ports": network.world_ports(vpc.get("securityGroups")),
                         "plaintext_secrets_suspected": plaintext_secrets_suspected(environment),
                         "admin_privileges": admin},
            "cost": monthly_cost(usd, f"Fargate 0.04048 USD/vCPU-h + 0.004445 USD/GB-h x {HOURS_PER_MONTH} h x {quantity} tasks"),
            "config": {"images": [c["image"] for c in containers], "runs_as": [c.get("user", "default") for c in containers],
                       "log_configuration_present": any("logConfiguration" in c for c in containers),
                       "container_health_check_present": any("healthCheck" in c for c in containers),
                       "min_healthy_percent": service.get("deploymentConfiguration", {}).get("minimumHealthyPercent"),
                       "container_insights": container_insights_setting(cluster)}}
