import json

from startup.build import AMI, LIVE_INSTANCE_STATES, OWNER, ensure, name_tag, owner_map, owner_tags, tagged
from synth.common import ACCOUNT, attempt, client, lambda_zip

ec2 = client("ec2")
rds = client("rds")
elasticache = client("elasticache")
sqs = client("sqs")
s3 = client("s3")
lam = client("lambda")
iam = client("iam")
ecs = client("ecs")
elb = client("elbv2")
kinesis = client("kinesis")
dynamodb = client("dynamodb")

ZONES = ("us-east-1a", "us-east-1b")
NGINX = "nginx:latest"


def network(name, cidr_prefix):
    vpc, _ = ensure(f"{name}-vpc",
                    lambda: tagged(ec2.describe_vpcs, "Vpcs", f"{name}-vpc"),
                    lambda: ec2.create_vpc(CidrBlock=f"{cidr_prefix}.0.0/16", TagSpecifications=name_tag("vpc", f"{name}-vpc"))["Vpc"])
    vid = vpc["VpcId"]
    igw, igw_new = ensure(f"{name}-igw",
                          lambda: tagged(ec2.describe_internet_gateways, "InternetGateways", f"{name}-igw"),
                          lambda: ec2.create_internet_gateway(TagSpecifications=name_tag("internet-gateway", f"{name}-igw"))["InternetGateway"])
    if igw_new:
        ec2.attach_internet_gateway(InternetGatewayId=igw["InternetGatewayId"], VpcId=vid)
    subnets = []
    for i, zone in enumerate(ZONES):
        label = f"{name}-public-{zone[-1]}"
        subnet, new = ensure(label,
                             lambda: tagged(ec2.describe_subnets, "Subnets", label),
                             lambda: ec2.create_subnet(VpcId=vid, CidrBlock=f"{cidr_prefix}.{i + 1}.0/24", AvailabilityZone=zone,
                                                       TagSpecifications=name_tag("subnet", label))["Subnet"])
        if new:
            ec2.modify_subnet_attribute(SubnetId=subnet["SubnetId"], MapPublicIpOnLaunch={"Value": True})
        subnets.append(subnet["SubnetId"])
    rt, rt_new = ensure(f"{name}-public-rt",
                        lambda: tagged(ec2.describe_route_tables, "RouteTables", f"{name}-public-rt"),
                        lambda: ec2.create_route_table(VpcId=vid, TagSpecifications=name_tag("route-table", f"{name}-public-rt"))["RouteTable"])
    if rt_new:
        ec2.create_route(RouteTableId=rt["RouteTableId"], DestinationCidrBlock="0.0.0.0/0", GatewayId=igw["InternetGatewayId"])
        for subnet in subnets:
            ec2.associate_route_table(RouteTableId=rt["RouteTableId"], SubnetId=subnet)
    return vid, subnets


def ecs_tags():
    return [{"key": key, "value": value} for key, value in OWNER.items()]


def from_group(group, *ports):
    return [{"IpProtocol": "tcp", "FromPort": p, "ToPort": p, "UserIdGroupPairs": [{"GroupId": group}]} for p in ports]


def postgres(name, instance_class, version, storage_gb, subnets, group, public=False, multi_az=False, encrypted=True,
             backup_days=7, deletion_protection=False):
    attempt(f"{name}-subnets", rds.create_db_subnet_group,
            DBSubnetGroupName=f"{name}-subnets", DBSubnetGroupDescription=name, SubnetIds=subnets)
    attempt(name, rds.create_db_instance,
            DBInstanceIdentifier=name, DBInstanceClass=instance_class, Engine="postgres", EngineVersion=version,
            AllocatedStorage=storage_gb, StorageType="gp2", DBSubnetGroupName=f"{name}-subnets", VpcSecurityGroupIds=[group],
            MasterUsername="app_admin", MasterUserPassword="Password123", PubliclyAccessible=public, MultiAZ=multi_az,
            BackupRetentionPeriod=backup_days, StorageEncrypted=encrypted, DeletionProtection=deletion_protection,
            AutoMinorVersionUpgrade=False, Tags=owner_tags())


def redis(name, node_type, subnets):
    attempt(f"{name}-subnets", elasticache.create_cache_subnet_group,
            CacheSubnetGroupName=f"{name}-subnets", CacheSubnetGroupDescription=name, SubnetIds=subnets)
    attempt(name, elasticache.create_cache_cluster,
            CacheClusterId=name, Engine="redis", CacheNodeType=node_type, NumCacheNodes=1,
            CacheSubnetGroupName=f"{name}-subnets", PreferredAvailabilityZone=ZONES[0],
            AutoMinorVersionUpgrade=False, SnapshotRetentionLimit=0, Tags=owner_tags())


def queue(name, encrypted, visibility_s, wait_s, retention_s):
    attempt(name, sqs.create_queue, QueueName=name, tags=owner_map(), Attributes={
        "VisibilityTimeout": str(visibility_s), "ReceiveMessageWaitTimeSeconds": str(wait_s),
        "MessageRetentionPeriod": str(retention_s), "SqsManagedSseEnabled": "true" if encrypted else "false"})
    url = sqs.get_queue_url(QueueName=name)["QueueUrl"]
    return sqs.get_queue_attributes(QueueUrl=url, AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]


def bucket(name, versioned=False):
    if name in {b["Name"] for b in s3.list_buckets()["Buckets"]}:
        print(f"  reuse {name}")
        return
    print(f"  new   {name}")
    s3.create_bucket(Bucket=name)
    if OWNER:
        s3.put_bucket_tagging(Bucket=name, Tagging={"TagSet": owner_tags()})
    if versioned:
        s3.put_bucket_versioning(Bucket=name, VersioningConfiguration={"Status": "Enabled"})


def role(name, service, admin=False):
    trust = json.dumps({"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Principal": {"Service": service}, "Action": "sts:AssumeRole"}]})
    attempt(name, iam.create_role, RoleName=name, AssumeRolePolicyDocument=trust)
    if admin:
        attempt(f"{name} admin", iam.attach_role_policy, RoleName=name, PolicyArn="arn:aws:iam::aws:policy/AdministratorAccess")
    return f"arn:aws:iam::{ACCOUNT}:role/{name}"


def function(name, runtime, memory_mb, timeout_s, role_arn, environment, subnets=None, group=None):
    vpc = {"VpcConfig": {"SubnetIds": subnets, "SecurityGroupIds": [group]}} if subnets else {}
    attempt(name, lam.create_function, FunctionName=name, Runtime=runtime, Role=role_arn, Handler="index.handler",
            Code={"ZipFile": lambda_zip()}, MemorySize=memory_mb, Timeout=timeout_s,
            Environment={"Variables": environment}, Tags=owner_map(), **vpc)


def event_source(function_name, source_arn, batch_size, **extra):
    existing = lam.list_event_source_mappings(FunctionName=function_name)["EventSourceMappings"]
    if any(m["EventSourceArn"] == source_arn for m in existing):
        print(f"  reuse {function_name} <- {source_arn.split(':')[-1]}")
        return
    print(f"  new   {function_name} <- {source_arn.split(':')[-1]}")
    lam.create_event_source_mapping(FunctionName=function_name, EventSourceArn=source_arn, BatchSize=batch_size, **extra)


def load_balancer(name, vid, subnets, group):
    found = next((b for b in elb.describe_load_balancers()["LoadBalancers"] if b["LoadBalancerName"] == name), None)
    if found:
        print(f"  reuse {name}")
        arn = found["LoadBalancerArn"]
    else:
        print(f"  new   {name}")
        arn = elb.create_load_balancer(Name=name, Subnets=subnets, SecurityGroups=[group], Scheme="internet-facing",
                                       Type="application", Tags=owner_tags())["LoadBalancers"][0]["LoadBalancerArn"]
    groups = [g for g in elb.describe_target_groups()["TargetGroups"] if g["TargetGroupName"] == f"{name}-tg"]
    target_group = groups[0]["TargetGroupArn"] if groups else elb.create_target_group(
        Name=f"{name}-tg", Protocol="HTTP", Port=8080, VpcId=vid, TargetType="ip", Tags=owner_tags())["TargetGroups"][0]["TargetGroupArn"]
    if not elb.describe_listeners(LoadBalancerArn=arn)["Listeners"]:
        elb.create_listener(LoadBalancerArn=arn, Protocol="HTTP", Port=80,
                            DefaultActions=[{"Type": "forward", "TargetGroupArn": target_group}])
    return target_group


def fargate_service(cluster, service, cpu, memory, count, subnets, group, public_ip, role_arn, environment, target_group=None):
    attempt(f"{cluster} cluster", ecs.create_cluster, clusterName=cluster, tags=ecs_tags())
    if any(arn.endswith(f"/{cluster}/{service}") for arn in ecs.list_services(cluster=cluster)["serviceArns"]):
        print(f"  reuse {cluster}/{service}")
        return
    print(f"  new   {cluster}/{service}")
    family = f"{cluster}-{service}"
    ecs.register_task_definition(
        family=family, networkMode="awsvpc", requiresCompatibilities=["FARGATE"], cpu=str(cpu), memory=str(memory),
        taskRoleArn=role_arn, executionRoleArn=role_arn,
        containerDefinitions=[{"name": service, "image": NGINX, "essential": True, "portMappings": [{"containerPort": 8080}],
                               "environment": [{"name": k, "value": v} for k, v in environment.items()]}])
    balancers = [{"targetGroupArn": target_group, "containerName": service, "containerPort": 8080}] if target_group else []
    ecs.create_service(cluster=cluster, serviceName=service, taskDefinition=family, desiredCount=count, launchType="FARGATE", tags=ecs_tags(),
                       loadBalancers=balancers,
                       networkConfiguration={"awsvpcConfiguration": {"subnets": subnets[:1], "securityGroups": [group],
                                                                     "assignPublicIp": "ENABLED" if public_ip else "DISABLED"}})


def stream(name, shards, retention_hours=24):
    if attempt(name, kinesis.create_stream, StreamName=name, ShardCount=shards):
        kinesis.get_waiter("stream_exists").wait(StreamName=name)
        if OWNER:
            kinesis.add_tags_to_stream(StreamName=name, Tags=owner_map())
        if retention_hours > 24:
            kinesis.increase_stream_retention_period(StreamName=name, RetentionPeriodHours=retention_hours)
    return kinesis.describe_stream_summary(StreamName=name)["StreamDescriptionSummary"]["StreamARN"]


def provisioned_table(name, key, rcu, wcu, index_key):
    attempt(name, dynamodb.create_table, TableName=name,
            AttributeDefinitions=[{"AttributeName": key, "AttributeType": "S"}, {"AttributeName": index_key, "AttributeType": "S"}],
            KeySchema=[{"AttributeName": key, "KeyType": "HASH"}],
            ProvisionedThroughput={"ReadCapacityUnits": rcu, "WriteCapacityUnits": wcu},
            GlobalSecondaryIndexes=[{"IndexName": f"by-{index_key}", "KeySchema": [{"AttributeName": index_key, "KeyType": "HASH"}],
                                     "Projection": {"ProjectionType": "ALL"},
                                     "ProvisionedThroughput": {"ReadCapacityUnits": rcu, "WriteCapacityUnits": wcu}}],
            Tags=owner_tags())


def nat(name, subnet):
    eip, _ = ensure(f"{name}-nat-eip",
                    lambda: tagged(ec2.describe_addresses, "Addresses", f"{name}-nat-eip"),
                    lambda: ec2.allocate_address(Domain="vpc", TagSpecifications=name_tag("elastic-ip", f"{name}-nat-eip")))
    ensure(f"{name}-nat",
           lambda: tagged(ec2.describe_nat_gateways, "NatGateways", f"{name}-nat", [{"Name": "state", "Values": ["pending", "available"]}]),
           lambda: ec2.create_nat_gateway(SubnetId=subnet, AllocationId=eip["AllocationId"], TagSpecifications=name_tag("natgateway", f"{name}-nat")))


def instance(name, instance_type, disk_gb, subnet, group):
    ensure(name,
           lambda: next(iter(r["Instances"][0] for r in ec2.describe_instances(Filters=[
               {"Name": "tag:Name", "Values": [name]}, {"Name": "instance-state-name", "Values": LIVE_INSTANCE_STATES}])["Reservations"]), None),
           lambda: ec2.run_instances(ImageId=AMI, InstanceType=instance_type, MinCount=1, MaxCount=1, SubnetId=subnet,
                                     SecurityGroupIds=[group], TagSpecifications=name_tag("instance", name),
                                     BlockDeviceMappings=[{"DeviceName": "/dev/xvda",
                                                           "Ebs": {"VolumeSize": disk_gb, "VolumeType": "gp2", "Encrypted": False}}]))


def loose_volume(name, size_gb, volume_type):
    ensure(name,
           lambda: tagged(ec2.describe_volumes, "Volumes", name),
           lambda: ec2.create_volume(AvailabilityZone=ZONES[0], Size=size_gb, VolumeType=volume_type, Encrypted=False,
                                     TagSpecifications=name_tag("volume", name)))


def instance_id(name):
    reservations = ec2.describe_instances(Filters=[{"Name": "tag:Name", "Values": [name]},
                                                   {"Name": "instance-state-name", "Values": LIVE_INSTANCE_STATES}])["Reservations"]
    return reservations[0]["Instances"][0]["InstanceId"]


def nat_id(name):
    gateways = ec2.describe_nat_gateways(Filters=[{"Name": "tag:Name", "Values": [f"{name}-nat"]},
                                                  {"Name": "state", "Values": ["pending", "available"]}])["NatGateways"]
    return gateways[0]["NatGatewayId"]


def load_balancer_dimension(name):
    arn = next(b["LoadBalancerArn"] for b in elb.describe_load_balancers()["LoadBalancers"] if b["LoadBalancerName"] == name)
    return arn.split(":loadbalancer/")[1]
