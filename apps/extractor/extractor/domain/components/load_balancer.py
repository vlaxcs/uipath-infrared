from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.instance_specs import HOURS_PER_MONTH
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

USD_PER_HOUR = 0.0225


def balancer_dimension(balancer):
    return balancer["LoadBalancerArn"].split("loadbalancer/")[1]


def key_values(pairs):
    return {p["Key"]: p["Value"] for p in pairs}


def load_balancer(component_id, balancer, attributes, target_groups, last_group_attributes, listeners, registered_targets,
                  network, requests, target_5xx, response_time):
    name = balancer["LoadBalancerName"]
    first_group = target_groups[0] if target_groups else None
    return {"id": component_id, "name": name, "kind": "load_balancer", "service": "alb", "stateful": False,
            "stack": stack_of(network.vpc_names.get(balancer.get("VpcId")), name),
            "zones": len(balancer.get("AvailabilityZones", [])) or None,
            "usage": present(requests=requests, target_5xx=target_5xx, response_time_s=response_time),
            "security": {"public_exposure": "internet" if balancer.get("Scheme") == "internet-facing" else "vpc_only",
                         "world_open_ports": network.world_ports(balancer.get("SecurityGroups")),
                         "encryption_in_transit": any(l["Protocol"] in ("HTTPS", "TLS") for l in listeners) if listeners else None},
            "cost": monthly_cost(USD_PER_HOUR * HOURS_PER_MONTH, f"ALB 0.0225 USD/h x {HOURS_PER_MONTH} h (LCU charges excluded)"),
            "config": {"listeners": [f"{l['Protocol']}:{l['Port']}" for l in listeners],
                       "idle_timeout_s": int(attributes.get("idle_timeout.timeout_seconds", 0)) or None,
                       "access_logs_enabled": attributes.get("access_logs.s3.enabled") == "true",
                       "deletion_protection": attributes.get("deletion_protection.enabled") == "true",
                       "health_check_interval_s": first_group["HealthCheckIntervalSeconds"] if first_group else None,
                       "unhealthy_threshold": first_group["UnhealthyThresholdCount"] if first_group else None,
                       "deregistration_delay_s": int(last_group_attributes.get("deregistration_delay.timeout_seconds", 0)) or None,
                       "registered_targets": registered_targets}}
