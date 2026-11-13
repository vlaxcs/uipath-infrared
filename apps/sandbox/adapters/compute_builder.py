import time
from typing import Dict, List

from ..domain.build_plan import units_per_zone
from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients
from .network_builder import Network
from .tags import name_tags


def launch_instances(clients: AwsClients, network: Network, image_id: str, name: str, instance_type: str, count: int, zone_index: int, user_data: str) -> List[BuiltResource]:
    response = clients.ec2.run_instances(
        ImageId=image_id,
        InstanceType=instance_type,
        MinCount=count,
        MaxCount=count,
        SubnetId=network.subnet_ids[zone_index],
        SecurityGroupIds=[network.security_group_id],
        UserData=user_data,
        TagSpecifications=name_tags("instance", name),
    )
    return [
        BuiltResource("instance", instance["InstanceId"], name, network.zones[zone_index], instance.get("PrivateIpAddress", ""))
        for instance in response["Instances"]
    ]


def build_virtual_machines(clients: AwsClients, network: Network, prefix: str, action: Action, image_id: str, user_data: str) -> BuiltComponent:
    component = BuiltComponent(action.component_id, action.kind, action.sku, action.zones)
    for zone_index, count in enumerate(units_per_zone(action.quantity, action.zones)):
        if count:
            name = resource_name(prefix, action.component_id, suffix=f"-{network.zones[zone_index]}")
            component.resources.extend(launch_instances(clients, network, image_id, name, action.sku, count, zone_index, user_data))
    component.detail = f"{action.quantity} x {action.sku} over {action.zones} zone(s)"
    return component


def instance_states(clients: AwsClients, instance_ids: List[str]) -> Dict[str, str]:
    if not instance_ids:
        return {}
    reservations = clients.ec2.describe_instances(InstanceIds=instance_ids)["Reservations"]
    return {instance["InstanceId"]: instance["State"]["Name"] for reservation in reservations for instance in reservation["Instances"]}


def wait_until_running(clients: AwsClients, instance_ids: List[str], timeout_s: float) -> Dict[str, str]:
    deadline = time.time() + timeout_s
    states = instance_states(clients, instance_ids)
    while time.time() < deadline and any(state != "running" for state in states.values()):
        time.sleep(3)
        states = instance_states(clients, instance_ids)
    return states
