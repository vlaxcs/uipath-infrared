import time

from startup.teardown import delete_vpc

from projects.floci import dynamodb, ec2, ecs, elasticache, elb, iam, kinesis, lam, rds, s3, sqs


def report(label, call, *args, **kwargs):
    try:
        call(*args, **kwargs)
        print(f"  deleted {label}")
    except Exception as error:
        print(f"  {label}: {str(error)[:160]}")


def by_name(prefix):
    return lambda name: name.startswith(f"{prefix}-")


def delete_services(mine):
    for cluster in ecs.list_clusters()["clusterArns"]:
        name = cluster.split("/")[-1]
        if not mine(name):
            continue
        for service in ecs.list_services(cluster=cluster)["serviceArns"]:
            report(service.split("/")[-1], ecs.delete_service, cluster=cluster, service=service, force=True)
        report(f"cluster {name}", ecs.delete_cluster, cluster=cluster)
    for family in ecs.list_task_definition_families(status="ACTIVE")["families"]:
        if mine(family):
            for arn in ecs.list_task_definitions(familyPrefix=family)["taskDefinitionArns"]:
                report(arn.split("/")[-1], ecs.deregister_task_definition, taskDefinition=arn)


def delete_load_balancers(mine):
    for balancer in elb.describe_load_balancers()["LoadBalancers"]:
        if mine(balancer["LoadBalancerName"]):
            report(balancer["LoadBalancerName"], elb.delete_load_balancer, LoadBalancerArn=balancer["LoadBalancerArn"])
    for group in elb.describe_target_groups()["TargetGroups"]:
        if mine(group["TargetGroupName"]):
            report(group["TargetGroupName"], elb.delete_target_group, TargetGroupArn=group["TargetGroupArn"])


def delete_functions(mine):
    for function in lam.list_functions()["Functions"]:
        name = function["FunctionName"]
        if mine(name):
            for mapping in lam.list_event_source_mappings(FunctionName=name)["EventSourceMappings"]:
                report(f"{name} mapping", lam.delete_event_source_mapping, UUID=mapping["UUID"])
            report(name, lam.delete_function, FunctionName=name)


def delete_roles(mine):
    for role in iam.list_roles()["Roles"]:
        name = role["RoleName"]
        if mine(name):
            for policy in iam.list_attached_role_policies(RoleName=name)["AttachedPolicies"]:
                iam.detach_role_policy(RoleName=name, PolicyArn=policy["PolicyArn"])
            report(name, iam.delete_role, RoleName=name)


def delete_databases(mine):
    for db in rds.describe_db_instances()["DBInstances"]:
        name = db["DBInstanceIdentifier"]
        if mine(name):
            if db.get("DeletionProtection"):
                rds.modify_db_instance(DBInstanceIdentifier=name, DeletionProtection=False, ApplyImmediately=True)
            report(name, rds.delete_db_instance, DBInstanceIdentifier=name, SkipFinalSnapshot=True)
    time.sleep(3)
    for group in rds.describe_db_subnet_groups()["DBSubnetGroups"]:
        if mine(group["DBSubnetGroupName"]):
            report(group["DBSubnetGroupName"], rds.delete_db_subnet_group, DBSubnetGroupName=group["DBSubnetGroupName"])


def delete_caches(mine):
    for cluster in elasticache.describe_cache_clusters()["CacheClusters"]:
        if mine(cluster["CacheClusterId"]):
            report(cluster["CacheClusterId"], elasticache.delete_cache_cluster, CacheClusterId=cluster["CacheClusterId"])
    time.sleep(2)
    for group in elasticache.describe_cache_subnet_groups()["CacheSubnetGroups"]:
        if mine(group["CacheSubnetGroupName"]):
            report(group["CacheSubnetGroupName"], elasticache.delete_cache_subnet_group, CacheSubnetGroupName=group["CacheSubnetGroupName"])


def delete_messaging(mine):
    for url in sqs.list_queues().get("QueueUrls", []):
        if mine(url.split("/")[-1]):
            report(url.split("/")[-1], sqs.delete_queue, QueueUrl=url)
    for name in kinesis.list_streams()["StreamNames"]:
        if mine(name):
            report(name, kinesis.delete_stream, StreamName=name, EnforceConsumerDeletion=True)
    for name in dynamodb.list_tables()["TableNames"]:
        if mine(name):
            report(name, dynamodb.delete_table, TableName=name)


def delete_buckets(mine):
    for bucket in s3.list_buckets()["Buckets"]:
        name = bucket["Name"]
        if not mine(name):
            continue
        versions = s3.list_object_versions(Bucket=name)
        objects = [{"Key": v["Key"], "VersionId": v["VersionId"]} for v in versions.get("Versions", []) + versions.get("DeleteMarkers", [])]
        if objects:
            s3.delete_objects(Bucket=name, Delete={"Objects": objects})
        report(name, s3.delete_bucket, Bucket=name)


def tagged_with(prefix):
    return [{"Name": "tag:Name", "Values": [f"{prefix}-*"]}]


def delete_compute(prefix):
    reservations = ec2.describe_instances(Filters=tagged_with(prefix))["Reservations"]
    ids = [i["InstanceId"] for r in reservations for i in r["Instances"] if i["State"]["Name"] != "terminated"]
    if ids:
        report(f"{len(ids)} instance(s)", ec2.terminate_instances, InstanceIds=ids)
    for gateway in ec2.describe_nat_gateways(Filters=tagged_with(prefix))["NatGateways"]:
        if gateway["State"] != "deleted":
            report(gateway["NatGatewayId"], ec2.delete_nat_gateway, NatGatewayId=gateway["NatGatewayId"])
    time.sleep(3)
    for volume in ec2.describe_volumes(Filters=tagged_with(prefix))["Volumes"]:
        if volume["State"] == "available":
            report(volume["VolumeId"], ec2.delete_volume, VolumeId=volume["VolumeId"])
    for address in ec2.describe_addresses(Filters=tagged_with(prefix))["Addresses"]:
        report(address["AllocationId"], ec2.release_address, AllocationId=address["AllocationId"])


def teardown(prefix):
    print(f"Tearing down every {prefix}- resource...")
    mine = by_name(prefix)
    delete_services(mine)
    delete_load_balancers(mine)
    delete_functions(mine)
    delete_roles(mine)
    delete_databases(mine)
    delete_caches(mine)
    delete_messaging(mine)
    delete_buckets(mine)
    delete_compute(prefix)
    time.sleep(5)
    for vpc in ec2.describe_vpcs(Filters=tagged_with(prefix))["Vpcs"]:
        delete_vpc(vpc["VpcId"])
    print(f"{prefix}- estate torn down.")
