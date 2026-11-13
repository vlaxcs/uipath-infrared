from typing import List

from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients
from .network_builder import APP_PORT, Network

NAME_LIMIT = 32


def build_load_balancer(clients: AwsClients, network: Network, prefix: str, action: Action, instance_ids: List[str]) -> BuiltComponent:
    subnet_count = max(2, min(action.zones, len(network.subnet_ids)))
    balancer = clients.elbv2.create_load_balancer(
        Name=resource_name(prefix, action.component_id, NAME_LIMIT),
        Subnets=network.subnet_ids[:subnet_count],
        SecurityGroups=[network.security_group_id],
        Scheme="internet-facing",
        Type="application",
    )["LoadBalancers"][0]
    group = clients.elbv2.create_target_group(
        Name=resource_name(prefix, action.component_id, NAME_LIMIT, "-tg"),
        Protocol="HTTP",
        Port=APP_PORT,
        VpcId=network.vpc_id,
        TargetType="instance",
        HealthCheckPath="/",
        HealthCheckIntervalSeconds=5,
        HealthCheckTimeoutSeconds=2,
        HealthyThresholdCount=2,
        UnhealthyThresholdCount=2,
    )["TargetGroups"][0]
    clients.elbv2.create_listener(
        LoadBalancerArn=balancer["LoadBalancerArn"],
        Protocol="HTTP",
        Port=80,
        DefaultActions=[{"Type": "forward", "TargetGroupArn": group["TargetGroupArn"]}],
    )
    if instance_ids:
        clients.elbv2.register_targets(TargetGroupArn=group["TargetGroupArn"], Targets=[{"Id": instance_id} for instance_id in instance_ids])
    return BuiltComponent(
        action.component_id,
        action.kind,
        action.sku,
        action.zones,
        [
            BuiltResource("load_balancer", balancer["LoadBalancerArn"], balancer["LoadBalancerName"], address=f"http://{balancer['DNSName']}/"),
            BuiltResource("target_group", group["TargetGroupArn"], group["TargetGroupName"]),
        ],
        f"application load balancer over {subnet_count} subnets, {len(instance_ids)} instance target(s) on port {APP_PORT}",
    )
