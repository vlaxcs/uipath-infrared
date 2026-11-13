from extractor.domain.cost_estimate import instance_hours_cost, monthly_cost
from extractor.domain.instance_capacity import instance_capacity
from extractor.domain.instance_specs import HOURS_PER_MONTH
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

GPU_FAMILIES = ("p3", "p4", "g4", "g5")
CONTROL_PLANE_USD_PER_HOUR = 0.10


def cluster_vpc_name(cluster, network):
    vpc_config = cluster["resourcesVpcConfig"]
    first_subnet = (vpc_config.get("subnetIds") or [""])[0]
    return network.vpc_names.get(vpc_config.get("vpcId"), None) or network.vpc_name_of_subnet(first_subnet)


def nodegroup_sku(nodegroup):
    return (nodegroup.get("instanceTypes") or [""])[0]


def has_gpus(sku):
    return sku.startswith(GPU_FAMILIES)


def public_exposure(vpc_config):
    open_to_world = "0.0.0.0/0" in vpc_config.get("publicAccessCidrs", ["0.0.0.0/0"])
    return "internet" if vpc_config.get("endpointPublicAccess") and open_to_world else "vpc_only"


def kubernetes_cluster(component_id, name, cluster, nodegroups, network, cpu, memory):
    vpc_config = cluster["resourcesVpcConfig"]
    logging_on = any(t.get("enabled") for t in cluster.get("logging", {}).get("clusterLogging", []))
    return {"id": component_id, "name": name, "kind": "kubernetes_cluster", "service": "eks", "stateful": False,
            "stack": stack_of(cluster_vpc_name(cluster, network), name),
            "zones": network.zone_count(nodegroups[0].get("subnets", [])) if nodegroups else None,
            "engine": {"name": "kubernetes", "version": cluster["version"]}, "usage": present(cpu_pct=cpu, memory_pct=memory),
            "security": {"public_exposure": public_exposure(vpc_config),
                         "world_open_ports": network.world_ports(vpc_config.get("securityGroupIds")),
                         "encryption_at_rest": bool(cluster.get("encryptionConfig"))},
            "cost": monthly_cost(CONTROL_PLANE_USD_PER_HOUR * HOURS_PER_MONTH,
                                 "EKS control plane 0.10 USD/h x 730 h (extended-support surcharge not included)"),
            "config": {"k8s_version": cluster["version"], "control_plane_logging_enabled": logging_on,
                       "endpoint_public": vpc_config.get("endpointPublicAccess"), "endpoint_private": vpc_config.get("endpointPrivateAccess"),
                       "secrets_envelope_encryption": bool(cluster.get("encryptionConfig")),
                       "note": "Usage metrics are cluster-level (Container Insights), not per node group."}}


def node_group(component_id, parent_id, cluster_name, cluster, nodegroup, network, cpu, memory, gpu):
    scaling = nodegroup["scalingConfig"]
    quantity, sku = scaling["desiredSize"], nodegroup_sku(nodegroup)
    capacity = {"disk_gb": point_metric(nodegroup.get("diskSize", 0), "GB")}
    capacity.update(instance_capacity(sku))
    return {"id": component_id, "name": f"{cluster_name}/{nodegroup['nodegroupName']}", "kind": "node_group",
            "parent": parent_id, "service": "eks-managed-nodegroup", "sku": sku, "quantity": quantity, "stateful": False,
            "stack": stack_of(cluster_vpc_name(cluster, network), cluster_name),
            "zones": network.zone_count(nodegroup.get("subnets", [])) or None,
            "scaling": {"min": scaling["minSize"], "max": scaling["maxSize"], "desired": quantity,
                        "autoscaling_enabled": scaling["minSize"] != scaling["maxSize"]},
            "capacity": capacity, "usage": present(cpu_pct=cpu, memory_pct=memory, gpu_pct=gpu),
            "cost": instance_hours_cost(sku, quantity),
            "config": {"ami_type": nodegroup.get("amiType"), "capacity_type": nodegroup.get("capacityType"),
                       "usage_scope": "cpu/memory/gpu are CLUSTER-level Container Insights series, shared by all node groups of the cluster"}}
