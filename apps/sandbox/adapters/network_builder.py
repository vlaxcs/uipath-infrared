import ipaddress
from dataclasses import dataclass
from typing import List

from ..domain.built import BuiltResource
from .aws_clients import AwsClients
from .tags import name_tags

APP_PORT = 8080


@dataclass(frozen=True)
class Network:
    vpc_id: str
    cidr: str
    subnet_ids: List[str]
    zones: List[str]
    security_group_id: str
    resources: List[BuiltResource]


def free_cidr(clients: AwsClients) -> str:
    used = [ipaddress.ip_network(vpc["CidrBlock"]) for vpc in clients.ec2.describe_vpcs()["Vpcs"]]
    for second_octet in range(100, 250):
        candidate = ipaddress.ip_network(f"10.{second_octet}.0.0/16")
        if not any(candidate.overlaps(network) for network in used):
            return str(candidate)
    raise RuntimeError("no free 10.x.0.0/16 block for the sandbox VPC")


def build_network(clients: AwsClients, prefix: str, region: str, zone_count: int) -> Network:
    cidr = free_cidr(clients)
    vpc_id = clients.ec2.create_vpc(CidrBlock=cidr, TagSpecifications=name_tags("vpc", f"{prefix}vpc"))["Vpc"]["VpcId"]
    resources = [BuiltResource("vpc", vpc_id, f"{prefix}vpc")]
    blocks = list(ipaddress.ip_network(cidr).subnets(new_prefix=24))
    zones = [f"{region}{chr(ord('a') + index)}" for index in range(zone_count)]
    subnet_ids = []
    for index, zone in enumerate(zones):
        name = f"{prefix}subnet-{zone}"
        subnet_id = clients.ec2.create_subnet(
            VpcId=vpc_id,
            CidrBlock=str(blocks[index + 1]),
            AvailabilityZone=zone,
            TagSpecifications=name_tags("subnet", name),
        )["Subnet"]["SubnetId"]
        subnet_ids.append(subnet_id)
        resources.append(BuiltResource("subnet", subnet_id, name, zone))
    group_name = f"{prefix}sg"
    group_id = clients.ec2.create_security_group(GroupName=group_name, Description=group_name, VpcId=vpc_id)["GroupId"]
    clients.ec2.authorize_security_group_ingress(
        GroupId=group_id,
        IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": port, "ToPort": port, "IpRanges": [{"CidrIp": cidr}]}
            for port in (80, APP_PORT)
        ],
    )
    resources.append(BuiltResource("security_group", group_id, group_name))
    return Network(vpc_id, cidr, subnet_ids, zones, group_id, resources)
