from extractor.domain.cost_estimate import instance_hours_cost
from extractor.domain.instance_capacity import instance_capacity
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

GP2_USD_PER_GB_MONTH = 0.115
EKS_NODE_SUFFIX = "-node"
GONE_STATES = ("terminated", "shutting-down")


def is_gone(instance):
    return (instance.get("State") or {}).get("Name") in GONE_STATES


def instance_tags(instance):
    return {t["Key"]: t["Value"] for t in instance.get("Tags", [])}


def instance_name(instance):
    return instance_tags(instance).get("Name", instance["InstanceId"])


def backed_eks_cluster(name, cluster_names):
    if name.endswith(EKS_NODE_SUFFIX) and name[:-len(EKS_NODE_SUFFIX)] in cluster_names:
        return name[:-len(EKS_NODE_SUFFIX)]
    return None


def instance_volume_ids(instance):
    return [m["Ebs"]["VolumeId"] for m in instance.get("BlockDeviceMappings", []) if "Ebs" in m]


def standalone_instance(component_id, instance, volume_sizes, network, cpu):
    tags, name, sku = instance_tags(instance), instance_name(instance), instance["InstanceType"]
    capacity = instance_capacity(sku)
    if volume_sizes:
        capacity["disk_gb"] = point_metric(sum(volume_sizes), "GB")
    groups = [g["GroupId"] for g in instance.get("SecurityGroups", [])]
    return {"id": component_id, "name": name, "kind": "virtual_machine", "service": "ec2", "sku": sku, "stateful": True,
            "stack": stack_of(network.vpc_names.get(instance.get("VpcId")), name), "zones": 1,
            "capacity": capacity, "tags": {k: v for k, v in tags.items() if not k.startswith("aws:")},
            "usage": present(cpu_pct=cpu),
            "security": {"public_exposure": "internet" if instance.get("PublicIpAddress") else "vpc_only",
                         "world_open_ports": network.world_ports(groups),
                         "encryption_at_rest": None, "admin_privileges": None},
            "cost": instance_hours_cost(sku, 1, GP2_USD_PER_GB_MONTH * sum(volume_sizes) if volume_sizes else 0),
            "config": {"imds_v2_required": (instance.get("MetadataOptions") or {}).get("HttpTokens") == "required",
                       "detailed_monitoring": (instance.get("Monitoring") or {}).get("State") == "enabled"}}
