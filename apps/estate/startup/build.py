import json
from contextlib import contextmanager

from synth.common import ACCOUNT, attempt, client, lambda_zip

ec2 = client("ec2")
autoscaling = client("autoscaling")
rds = client("rds")
elasticache = client("elasticache")
sqs = client("sqs")
s3 = client("s3")
lam = client("lambda")
iam = client("iam")

AMI = "ami-0abcdef1234567890"
ZONE = "us-east-1a"
LIVE_INSTANCE_STATES = ["pending", "running", "stopping", "stopped"]


OWNER = {}


@contextmanager
def owned(project, environment):
    OWNER.clear()
    OWNER.update({"Project": project, "Environment": environment})
    try:
        yield
    finally:
        OWNER.clear()


def owner_tags():
    return [{"Key": key, "Value": value} for key, value in OWNER.items()]


def owner_map():
    return dict(OWNER)


def name_tag(resource_type, name):
    return [{"ResourceType": resource_type, "Tags": [{"Key": "Name", "Value": name}, *owner_tags()]}]


def tagged(describe, key, name, extra_filters=()):
    filters = [{"Name": "tag:Name", "Values": [name]}, *extra_filters]
    found = describe(Filters=filters)[key]
    return found[0] if found else None


def ensure(label, lookup, create):
    found = lookup()
    if found:
        print(f"  reuse {label}")
        return found, False
    print(f"  new   {label}")
    return create(), True


def vpc_and_subnet():
    vpc, _ = ensure("startup-vpc",
                    lambda: tagged(ec2.describe_vpcs, "Vpcs", "startup-vpc"),
                    lambda: ec2.create_vpc(CidrBlock="10.20.0.0/16", TagSpecifications=name_tag("vpc", "startup-vpc"))["Vpc"])
    vid = vpc["VpcId"]

    igw, igw_new = ensure("startup-igw",
                          lambda: tagged(ec2.describe_internet_gateways, "InternetGateways", "startup-igw"),
                          lambda: ec2.create_internet_gateway(TagSpecifications=name_tag("internet-gateway", "startup-igw"))["InternetGateway"])
    if igw_new:
        ec2.attach_internet_gateway(InternetGatewayId=igw["InternetGatewayId"], VpcId=vid)

    subnet, subnet_new = ensure("startup-public-a",
                                lambda: tagged(ec2.describe_subnets, "Subnets", "startup-public-a"),
                                lambda: ec2.create_subnet(VpcId=vid, CidrBlock="10.20.1.0/24", AvailabilityZone=ZONE,
                                                          TagSpecifications=name_tag("subnet", "startup-public-a"))["Subnet"])
    sid = subnet["SubnetId"]
    if subnet_new:
        ec2.modify_subnet_attribute(SubnetId=sid, MapPublicIpOnLaunch={"Value": True})

    rt, rt_new = ensure("startup-public-rt",
                        lambda: tagged(ec2.describe_route_tables, "RouteTables", "startup-public-rt"),
                        lambda: ec2.create_route_table(VpcId=vid, TagSpecifications=name_tag("route-table", "startup-public-rt"))["RouteTable"])
    if rt_new:
        ec2.create_route(RouteTableId=rt["RouteTableId"], DestinationCidrBlock="0.0.0.0/0", GatewayId=igw["InternetGatewayId"])
        ec2.associate_route_table(RouteTableId=rt["RouteTableId"], SubnetId=sid)
    return vid, sid


def security_group(vid, name, description, permissions):
    group, new = ensure(name,
                        lambda: next(iter(ec2.describe_security_groups(Filters=[
                            {"Name": "group-name", "Values": [name]}, {"Name": "vpc-id", "Values": [vid]}])["SecurityGroups"]), None),
                        lambda: ec2.create_security_group(GroupName=name, Description=description, VpcId=vid))
    if new:
        ec2.authorize_security_group_ingress(GroupId=group["GroupId"], IpPermissions=permissions)
    return group["GroupId"]


def world_open(*ports):
    return [{"IpProtocol": "tcp", "FromPort": p, "ToPort": p, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]} for p in ports]


def web_group(subnet, sg):
    ensure("startup-web launch template",
           lambda: next(iter(ec2.describe_launch_templates(Filters=[
               {"Name": "launch-template-name", "Values": ["startup-web"]}])["LaunchTemplates"]), None),
           lambda: ec2.create_launch_template(LaunchTemplateName="startup-web", LaunchTemplateData={
               "ImageId": AMI, "InstanceType": "m5.4xlarge", "SecurityGroupIds": [sg],
               "BlockDeviceMappings": [{"DeviceName": "/dev/xvda",
                                        "Ebs": {"VolumeSize": 100, "VolumeType": "gp2", "Encrypted": False}}]}))
    ensure("startup-web auto scaling group",
           lambda: next(iter(autoscaling.describe_auto_scaling_groups(AutoScalingGroupNames=["startup-web"])["AutoScalingGroups"]), None),
           lambda: autoscaling.create_auto_scaling_group(
               AutoScalingGroupName="startup-web", LaunchTemplate={"LaunchTemplateName": "startup-web", "Version": "$Latest"},
               MinSize=3, MaxSize=3, DesiredCapacity=3, VPCZoneIdentifier=subnet,
               Tags=[{"Key": "Name", "Value": "startup-web", "PropagateAtLaunch": True}]))


def database(subnet, sg):
    attempt("startup-db-subnets", rds.create_db_subnet_group,
            DBSubnetGroupName="startup-db-subnets", DBSubnetGroupDescription="Startup DB", SubnetIds=[subnet])
    attempt("startup-app-db", rds.create_db_instance, Tags=owner_tags(),
            DBInstanceIdentifier="startup-app-db", DBInstanceClass="db.r5.4xlarge",
            Engine="postgres", EngineVersion="12.18", AllocatedStorage=300, StorageType="gp2",
            DBSubnetGroupName="startup-db-subnets", VpcSecurityGroupIds=[sg],
            MasterUsername="admin_user", MasterUserPassword="Password123",
            PubliclyAccessible=True, MultiAZ=False, BackupRetentionPeriod=0,
            StorageEncrypted=False, DeletionProtection=False, AutoMinorVersionUpgrade=False)


def cache(subnet):
    attempt("startup-cache-subnets", elasticache.create_cache_subnet_group,
            CacheSubnetGroupName="startup-cache-subnets", CacheSubnetGroupDescription="Cache", SubnetIds=[subnet])
    attempt("startup-cache", elasticache.create_cache_cluster, Tags=owner_tags(),
            CacheClusterId="startup-cache", Engine="redis", CacheNodeType="cache.r5.xlarge",
            NumCacheNodes=1, CacheSubnetGroupName="startup-cache-subnets", PreferredAvailabilityZone=ZONE,
            AutoMinorVersionUpgrade=False, SnapshotRetentionLimit=0)


def storage():
    existing = {b["Name"] for b in s3.list_buckets()["Buckets"]}
    for bucket in ("startup-uploads", "startup-backup-storage"):
        if bucket in existing:
            print(f"  reuse {bucket}")
        else:
            print(f"  new   {bucket}")
            s3.create_bucket(Bucket=bucket)
            s3.put_bucket_tagging(Bucket=bucket, Tagging={"TagSet": owner_tags()})
    s3.put_bucket_policy(Bucket="startup-uploads", Policy=json.dumps({"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::startup-uploads/*"}]}))
    if "startup-uploads" not in existing:
        for i in range(10):
            s3.put_object(Bucket="startup-uploads", Key=f"upload-{i}.dat", Body=b"x" * 1024 * 1024)


def queue():
    attempt("startup-queue", sqs.create_queue, QueueName="startup-queue", tags=owner_map(), Attributes={
        "VisibilityTimeout": "30", "ReceiveMessageWaitTimeSeconds": "0", "MessageRetentionPeriod": "1209600",
        "SqsManagedSseEnabled": "false"})


def worker_role():
    trust = json.dumps({"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]})
    attempt("startup-worker-role", iam.create_role, RoleName="startup-worker-role", AssumeRolePolicyDocument=trust)
    return f"arn:aws:iam::{ACCOUNT}:role/startup-worker-role"


def lambda_worker(role):
    attempt("startup-worker", lam.create_function, Tags=owner_map(),
            FunctionName="startup-worker", Runtime="python3.9", Role=role,
            Handler="index.handler", Code={"ZipFile": lambda_zip()}, MemorySize=1024, Timeout=300,
            Environment={"Variables": {"DB_HOST": "startup-app-db", "SECRET_KEY": "hardcoded-secret"}})


def nat(subnet):
    eip, _ = ensure("startup-nat-eip",
                    lambda: tagged(ec2.describe_addresses, "Addresses", "startup-nat-eip"),
                    lambda: ec2.allocate_address(Domain="vpc", TagSpecifications=name_tag("elastic-ip", "startup-nat-eip")))
    ensure("startup-nat",
           lambda: tagged(ec2.describe_nat_gateways, "NatGateways", "startup-nat", [{"Name": "state", "Values": ["pending", "available"]}]),
           lambda: ec2.create_nat_gateway(SubnetId=subnet, AllocationId=eip["AllocationId"], TagSpecifications=name_tag("natgateway", "startup-nat")))


def orphan_volume():
    ensure("startup-logs-volume",
           lambda: tagged(ec2.describe_volumes, "Volumes", "startup-logs-volume"),
           lambda: ec2.create_volume(AvailabilityZone=ZONE, Size=500, VolumeType="gp2", Encrypted=False,
                                     TagSpecifications=name_tag("volume", "startup-logs-volume")))


def idle_bastion(subnet, sg):
    ensure("startup-old-bastion",
           lambda: next(iter(r["Instances"][0] for r in ec2.describe_instances(Filters=[
               {"Name": "tag:Name", "Values": ["startup-old-bastion"]},
               {"Name": "instance-state-name", "Values": LIVE_INSTANCE_STATES}])["Reservations"]), None),
           lambda: ec2.run_instances(ImageId=AMI, InstanceType="t3.large", MinCount=1, MaxCount=1,
                                     SubnetId=subnet, SecurityGroupIds=[sg],
                                     TagSpecifications=name_tag("instance", "startup-old-bastion"),
                                     BlockDeviceMappings=[{"DeviceName": "/dev/xvda",
                                                           "Ebs": {"VolumeSize": 50, "VolumeType": "gp2", "Encrypted": False}}]))


def build():
    print("Building the start-up estate (startup- prefix)...")
    vid, subnet = vpc_and_subnet()
    sg_web = security_group(vid, "startup-web", "Web tier", world_open(80, 443, 22))
    sg_db = security_group(vid, "startup-db", "Database", world_open(5432))
    with owned("receipts", "prod"):
        web_group(subnet, sg_web)
        database(subnet, sg_db)
        cache(subnet)
        storage()
        queue()
        lambda_worker(worker_role())
        orphan_volume()
        idle_bastion(subnet, sg_web)
    nat(subnet)
    print("Start-up estate built.")


if __name__ == "__main__":
    build()
