import time

from synth.common import client

ec2 = client("ec2")
autoscaling = client("autoscaling")
iam = client("iam")
rds = client("rds")
elasticache = client("elasticache")
sqs = client("sqs")
s3 = client("s3")
lam = client("lambda")

def delete_web_group():
    try:
        print("Deleting auto scaling group startup-web...")
        autoscaling.delete_auto_scaling_group(AutoScalingGroupName="startup-web", ForceDelete=True)
    except Exception as e:
        if "not found" not in str(e).lower():
            print(f"  ASG delete: {e}")
    try:
        ec2.delete_launch_template(LaunchTemplateName="startup-web")
    except Exception as e:
        if "not" not in str(e).lower():
            print(f"  Launch template delete: {e}")

def delete_worker_role():
    try:
        iam.delete_role(RoleName="startup-worker-role")
    except Exception as e:
        if "NoSuchEntity" not in str(e):
            print(f"  IAM role delete: {e}")

def delete_instances():
    r = ec2.describe_instances(Filters=[{"Name": "tag:Name", "Values": ["startup-*"]}])
    ids = [i["InstanceId"] for res in r["Reservations"] for i in res["Instances"] if i["State"]["Name"] != "terminated"]
    if ids:
        print(f"Terminating {len(ids)} instances...")
        ec2.terminate_instances(InstanceIds=ids)
        time.sleep(5)

def delete_rds():
    try:
        print("Deleting RDS instance...")
        rds.delete_db_instance(DBInstanceIdentifier="startup-app-db", SkipFinalSnapshot=True)
        time.sleep(3)
    except Exception as e:
        if "not found" not in str(e).lower():
            print(f"  RDS delete: {e}")

    try:
        time.sleep(2)
        rds.delete_db_subnet_group(DBSubnetGroupName="startup-db-subnets")
    except Exception:
        pass

def delete_elasticache():
    try:
        print("Deleting cache cluster...")
        elasticache.delete_cache_cluster(CacheClusterId="startup-cache")
        time.sleep(2)
    except Exception as e:
        if "not found" not in str(e).lower():
            print(f"  Cache delete: {e}")

    try:
        time.sleep(1)
        elasticache.delete_cache_subnet_group(CacheSubnetGroupName="startup-cache-subnets")
    except Exception:
        pass

def delete_lambda():
    try:
        print("Deleting Lambda...")
        lam.delete_function(FunctionName="startup-worker")
    except Exception as e:
        if "not found" not in str(e).lower():
            print(f"  Lambda delete: {e}")

def delete_nat():
    try:
        r = ec2.describe_nat_gateways(Filters=[{"Name": "tag:Name", "Values": ["startup-nat"]}])
        for ng in r["NatGateways"]:
            if ng["State"] != "deleted":
                print(f"Deleting NAT gateway {ng['NatGatewayId']}...")
                ec2.delete_nat_gateway(NatGatewayId=ng["NatGatewayId"])
        time.sleep(2)
    except Exception as e:
        print(f"  NAT delete: {e}")

def delete_s3():
    for b in ("startup-uploads", "startup-backup-storage"):
        try:
            print(f"Emptying and deleting bucket {b}...")
            r = s3.list_objects_v2(Bucket=b)
            if "Contents" in r:
                s3.delete_objects(Bucket=b, Delete={"Objects": [{"Key": o["Key"]} for o in r["Contents"]]})
            s3.delete_bucket(Bucket=b)
        except Exception as e:
            if "NoSuchBucket" not in str(e):
                print(f"  S3 {b} delete: {e}")

def delete_sqs():
    try:
        url = sqs.get_queue_url(QueueName="startup-queue")["QueueUrl"]
        print(f"Deleting SQS queue...")
        sqs.delete_queue(QueueUrl=url)
    except Exception as e:
        if "NonExistentQueue" not in str(e):
            print(f"  SQS delete: {e}")

def delete_volumes():
    r = ec2.describe_volumes(Filters=[{"Name": "tag:Name", "Values": ["startup-logs-volume"]}])
    for v in r["Volumes"]:
        if v["State"] == "available":
            print(f"Deleting volume {v['VolumeId']}...")
            ec2.delete_volume(VolumeId=v["VolumeId"])

def delete_network():
    time.sleep(3)
    for vpc in ec2.describe_vpcs(Filters=[{"Name": "tag:Name", "Values": ["startup-vpc"]}])["Vpcs"]:
        delete_vpc(vpc["VpcId"])

def delete_vpc(vid):
    try:
        for sg in ec2.describe_security_groups(Filters=[{"Name": "vpc-id", "Values": [vid]}])["SecurityGroups"]:
            if sg["GroupName"] != "default":
                print(f"Deleting SG {sg['GroupId']}...")
                try:
                    ec2.delete_security_group(GroupId=sg["GroupId"])
                except Exception as e:
                    print(f"  SG delete: {e}")

        for rt in ec2.describe_route_tables(Filters=[{"Name": "vpc-id", "Values": [vid]}])["RouteTables"]:
            if not any(a.get("Main") for a in rt.get("Associations", [])):
                print(f"Deleting route table {rt['RouteTableId']}...")
                ec2.delete_route_table(RouteTableId=rt["RouteTableId"])

        for s in ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vid]}])["Subnets"]:
            print(f"Deleting subnet {s['SubnetId']}...")
            ec2.delete_subnet(SubnetId=s["SubnetId"])

        for igw in ec2.describe_internet_gateways(Filters=[{"Name": "attachment.vpc-id", "Values": [vid]}])["InternetGateways"]:
            print(f"Detaching and deleting IGW {igw['InternetGatewayId']}...")
            ec2.detach_internet_gateway(InternetGatewayId=igw["InternetGatewayId"], VpcId=vid)
            ec2.delete_internet_gateway(InternetGatewayId=igw["InternetGatewayId"])

        print(f"Deleting VPC {vid}...")
        ec2.delete_vpc(VpcId=vid)
    except Exception as e:
        print(f"Network cleanup {vid}: {e}")

def delete_eips():
    r = ec2.describe_addresses(Filters=[{"Name": "tag:Name", "Values": ["startup-*"]}])
    for addr in r["Addresses"]:
        print(f"Releasing EIP {addr.get('AllocationId')}...")
        try:
            ec2.release_address(AllocationId=addr["AllocationId"])
        except Exception as e:
            print(f"  EIP release: {e}")

def teardown():
    print("Tearing down startup estate...")
    delete_web_group()
    delete_instances()
    delete_lambda()
    delete_worker_role()
    delete_elasticache()
    delete_rds()
    delete_sqs()
    delete_s3()
    time.sleep(5)
    delete_nat()
    delete_volumes()
    delete_eips()
    time.sleep(5)
    delete_network()
    print("Startup estate torn down.")

if __name__ == "__main__":
    teardown()
