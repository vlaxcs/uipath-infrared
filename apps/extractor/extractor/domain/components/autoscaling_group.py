from extractor.domain.cost_estimate import instance_hours_cost
from extractor.domain.instance_capacity import instance_capacity
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of


def group_subnets(group):
    return [s for s in (group.get("VPCZoneIdentifier") or "").split(",") if s]


def group_sku(group):
    return group["Instances"][0]["InstanceType"] if group["Instances"] else ""


def autoscaling_group(component_id, group, policies, network, cpu):
    name, subnets, sku = group["AutoScalingGroupName"], group_subnets(group), group_sku(group)
    return {"id": component_id, "name": name, "kind": "virtual_machine", "service": "ec2-autoscaling", "sku": sku,
            "quantity": group["DesiredCapacity"], "stateful": False,
            "stack": stack_of(network.vpc_name_of_subnet(subnets[0]) if subnets else None, name),
            "zones": network.zone_count(subnets) or None, "capacity": instance_capacity(sku),
            "scaling": {"min": group["MinSize"], "max": group["MaxSize"], "desired": group["DesiredCapacity"],
                        "autoscaling_enabled": bool(policies)},
            "usage": present(cpu_pct=cpu),
            "cost": instance_hours_cost(sku, group["DesiredCapacity"]),
            "config": {"health_check_type": group.get("HealthCheckType"),
                       "health_check_grace_period_s": group.get("HealthCheckGracePeriod"), "scaling_policies": len(policies)}}
