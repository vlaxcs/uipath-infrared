from typing import List

from ..domain.teardown_selection import InventoryItem
from .aws_clients import AwsClients
from .tags import name_of

GONE_INSTANCE_STATES = {"terminated"}
GONE_GATEWAY_STATES = {"deleted"}


def list_inventory(clients: AwsClients) -> List[InventoryItem]:
    ec2 = clients.ec2
    items = [InventoryItem("vpc", vpc["VpcId"], name_of(vpc.get("Tags"))) for vpc in ec2.describe_vpcs()["Vpcs"]]
    items += [InventoryItem("subnet", subnet["SubnetId"], name_of(subnet.get("Tags"))) for subnet in ec2.describe_subnets()["Subnets"]]
    items += [InventoryItem("security_group", group["GroupId"], group["GroupName"]) for group in ec2.describe_security_groups()["SecurityGroups"]]
    items += [
        InventoryItem("instance", instance["InstanceId"], name_of(instance.get("Tags")))
        for reservation in ec2.describe_instances()["Reservations"]
        for instance in reservation["Instances"]
        if instance["State"]["Name"] not in GONE_INSTANCE_STATES
    ]
    items += [
        InventoryItem("nat_gateway", gateway["NatGatewayId"], name_of(gateway.get("Tags")))
        for gateway in ec2.describe_nat_gateways()["NatGateways"]
        if gateway["State"] not in GONE_GATEWAY_STATES
    ]
    items += [InventoryItem("elastic_ip", address.get("AllocationId", ""), name_of(address.get("Tags"))) for address in ec2.describe_addresses()["Addresses"]]
    items += [InventoryItem("auto_scaling_group", group["AutoScalingGroupName"], group["AutoScalingGroupName"]) for group in clients.autoscaling.describe_auto_scaling_groups()["AutoScalingGroups"]]
    items += [InventoryItem("load_balancer", balancer["LoadBalancerArn"], balancer["LoadBalancerName"]) for balancer in clients.elbv2.describe_load_balancers()["LoadBalancers"]]
    items += [InventoryItem("target_group", group["TargetGroupArn"], group["TargetGroupName"]) for group in clients.elbv2.describe_target_groups()["TargetGroups"]]
    items += [InventoryItem("db_instance", db["DBInstanceIdentifier"], db["DBInstanceIdentifier"]) for db in clients.rds.describe_db_instances()["DBInstances"]]
    items += [InventoryItem("db_subnet_group", group["DBSubnetGroupName"], group["DBSubnetGroupName"]) for group in clients.rds.describe_db_subnet_groups()["DBSubnetGroups"]]
    items += [InventoryItem("cache_cluster", cluster["CacheClusterId"], cluster["CacheClusterId"]) for cluster in clients.elasticache.describe_cache_clusters()["CacheClusters"]]
    items += [InventoryItem("cache_subnet_group", group["CacheSubnetGroupName"], group["CacheSubnetGroupName"]) for group in clients.elasticache.describe_cache_subnet_groups()["CacheSubnetGroups"]]
    items += [InventoryItem("queue", url, url.rstrip("/").rsplit("/", 1)[-1]) for url in clients.sqs.list_queues().get("QueueUrls", [])]
    items += [InventoryItem("bucket", bucket["Name"], bucket["Name"]) for bucket in clients.s3.list_buckets()["Buckets"]]
    items += [
        InventoryItem("function", function["FunctionName"], function["FunctionName"])
        for page in clients.awslambda.get_paginator("list_functions").paginate()
        for function in page["Functions"]
    ]
    return items
