import time
from typing import Callable, Dict, List, Sequence

from botocore.exceptions import BotoCoreError, ClientError

from ..domain.teardown_selection import InventoryItem, select_owned, teardown_order
from .aws_clients import AwsClients
from .inventory import list_inventory

PASSES = 6
PAUSE_S = 5


def empty_bucket(clients: AwsClients, bucket: str) -> None:
    for page in clients.s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        keys = [{"Key": item["Key"]} for item in page.get("Contents", [])]
        if keys:
            clients.s3.delete_objects(Bucket=bucket, Delete={"Objects": keys})
    clients.s3.delete_bucket(Bucket=bucket)


def deleters(clients: AwsClients) -> Dict[str, Callable[[str], object]]:
    return {
        "auto_scaling_group": lambda name: clients.autoscaling.delete_auto_scaling_group(AutoScalingGroupName=name, ForceDelete=True),
        "load_balancer": lambda arn: clients.elbv2.delete_load_balancer(LoadBalancerArn=arn),
        "target_group": lambda arn: clients.elbv2.delete_target_group(TargetGroupArn=arn),
        "function": lambda name: clients.awslambda.delete_function(FunctionName=name),
        "queue": lambda url: clients.sqs.delete_queue(QueueUrl=url),
        "bucket": lambda name: empty_bucket(clients, name),
        "cache_cluster": lambda cluster_id: clients.elasticache.delete_cache_cluster(CacheClusterId=cluster_id),
        "db_instance": lambda db_id: clients.rds.delete_db_instance(DBInstanceIdentifier=db_id, SkipFinalSnapshot=True),
        "nat_gateway": lambda gateway_id: clients.ec2.delete_nat_gateway(NatGatewayId=gateway_id),
        "cache_subnet_group": lambda name: clients.elasticache.delete_cache_subnet_group(CacheSubnetGroupName=name),
        "db_subnet_group": lambda name: clients.rds.delete_db_subnet_group(DBSubnetGroupName=name),
        "elastic_ip": lambda allocation_id: clients.ec2.release_address(AllocationId=allocation_id),
        "security_group": lambda group_id: clients.ec2.delete_security_group(GroupId=group_id),
        "subnet": lambda subnet_id: clients.ec2.delete_subnet(SubnetId=subnet_id),
        "vpc": lambda vpc_id: clients.ec2.delete_vpc(VpcId=vpc_id),
    }


def delete_items(clients: AwsClients, items: Sequence[InventoryItem], log: Callable[[str], None]) -> None:
    actions = deleters(clients)
    ordered = teardown_order(items)
    instances = [item.resource_id for item in ordered if item.resource_type == "instance"]
    if instances:
        clients.ec2.terminate_instances(InstanceIds=instances)
    for item in ordered:
        if item.resource_type == "instance":
            continue
        try:
            actions[item.resource_type](item.resource_id)
        except (BotoCoreError, ClientError) as error:
            log(f"  {item.resource_type} {item.name}: {type(error).__name__} {error}")


def teardown_prefix(clients: AwsClients, prefix: str, log: Callable[[str], None]) -> List[InventoryItem]:
    remaining = select_owned(list_inventory(clients), prefix)
    for attempt in range(PASSES):
        if not remaining:
            break
        log(f"teardown pass {attempt + 1}: {len(remaining)} resource(s) under {prefix}")
        delete_items(clients, remaining, log)
        time.sleep(PAUSE_S)
        remaining = select_owned(list_inventory(clients), prefix)
    return remaining
