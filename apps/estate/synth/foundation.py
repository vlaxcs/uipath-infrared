"""VPCs, subnets, security groups, IAM roles/users. Intentionally sloppy."""
import json
from .common import client, attempt, plant

ec2 = client("ec2")
iam = client("iam")

TRUST = lambda svc: json.dumps({"Version": "2012-10-17", "Statement": [
    {"Effect": "Allow", "Principal": {"Service": svc}, "Action": "sts:AssumeRole"}]})


def role(name, svc, policies=(), inline=None):
    attempt(f"iam role {name}", iam.create_role, RoleName=name, AssumeRolePolicyDocument=TRUST(svc))
    for p in policies:
        attempt(f"attach {p} -> {name}", iam.attach_role_policy, RoleName=name,
                PolicyArn=f"arn:aws:iam::aws:policy/{p}")
    if inline:
        attempt(f"inline policy {name}", iam.put_role_policy, RoleName=name, PolicyName="inline",
                PolicyDocument=json.dumps(inline))
    return f"arn:aws:iam::000000000000:role/{name}"


def vpc(stack, name, cidr, subnets):
    """subnets: list of (cidr, az). Everything public, no flow logs, default SG untouched."""
    r = attempt(f"vpc {name}", ec2.create_vpc, CidrBlock=cidr)
    vid = r["Vpc"]["VpcId"]
    ec2.create_tags(Resources=[vid], Tags=[{"Key": "Name", "Value": name}])
    igw = ec2.create_internet_gateway()["InternetGateway"]["InternetGatewayId"]
    ec2.attach_internet_gateway(InternetGatewayId=igw, VpcId=vid)
    rt = ec2.create_route_table(VpcId=vid)["RouteTable"]["RouteTableId"]
    ec2.create_route(RouteTableId=rt, DestinationCidrBlock="0.0.0.0/0", GatewayId=igw)
    ids = []
    for c, az in subnets:
        s = ec2.create_subnet(VpcId=vid, CidrBlock=c, AvailabilityZone=az)["Subnet"]["SubnetId"]
        ec2.modify_subnet_attribute(SubnetId=s, MapPublicIpOnLaunch={"Value": True})
        ec2.associate_route_table(RouteTableId=rt, SubnetId=s)
        ids.append(s)
    plant(stack, "ec2", vid, "VPC has no flow logs; all subnets public (route to IGW), no private tier", "security", "high")
    plant(stack, "ec2", vid, "No VPC endpoints for S3/DynamoDB; all AWS traffic goes via internet/NAT", "cost", "medium")
    if len({az for _, az in subnets}) == 1:
        plant(stack, "ec2", vid, "All subnets in a single AZ - no zonal redundancy", "reliability", "high")
    return vid, ids


def sg(stack, vid, name, ingress, why):
    r = attempt(f"sg {name}", ec2.create_security_group, GroupName=name, Description=name, VpcId=vid)
    gid = r["GroupId"]
    ec2.authorize_security_group_ingress(GroupId=gid, IpPermissions=[
        {"IpProtocol": proto, "FromPort": lo, "ToPort": hi, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}
        for proto, lo, hi in ingress])
    plant(stack, "ec2", gid, why, "security", "critical")
    return gid


def build():
    out = {}

    # ---- IAM: shared sins ----
    admin = {"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*"}]}
    out["eks_cluster_role"] = role("eks-cluster-role", "eks.amazonaws.com", ["AmazonEKSClusterPolicy"])
    out["eks_node_role"] = role("eks-node-role", "ec2.amazonaws.com",
                                ["AmazonEKSWorkerNodePolicy", "AmazonEC2ContainerRegistryReadOnly", "AmazonS3FullAccess"],
                                inline=admin)
    plant("shared", "iam", "eks-node-role", "Node role has inline Action:* Resource:* + AmazonS3FullAccess; every pod inherits it (no IRSA)", "security", "critical")
    out["ecs_task_role"] = role("ecs-task-role", "ecs-tasks.amazonaws.com", ["AdministratorAccess"])
    plant("shared", "iam", "ecs-task-role", "ECS task role has AdministratorAccess", "security", "critical")
    out["lambda_role"] = role("lambda-all-powerful", "lambda.amazonaws.com", ["AdministratorAccess"])
    plant("shared", "iam", "lambda-all-powerful", "Single AdministratorAccess role shared by every Lambda", "security", "high")
    out["generic_role"] = role("rds-monitoring", "monitoring.rds.amazonaws.com")

    attempt("iam role cross-account-any", iam.create_role, RoleName="cross-account-any",
            AssumeRolePolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [
                {"Effect": "Allow", "Principal": {"AWS": "*"}, "Action": "sts:AssumeRole"}]}))
    plant("shared", "iam", "cross-account-any", "Trust policy Principal:* (any AWS account can assume)", "security", "critical")

    for u, grp in [("deploy-bot", True), ("alice.admin", True), ("bob.contractor", True), ("jenkins", True)]:
        attempt(f"iam user {u}", iam.create_user, UserName=u)
        attempt(f"admin {u}", iam.attach_user_policy, UserName=u, PolicyArn="arn:aws:iam::aws:policy/AdministratorAccess")
        attempt(f"key {u}", iam.create_access_key, UserName=u)
    plant("shared", "iam", "4 IAM users", "Human & CI users with AdministratorAccess, static access keys, no MFA, never rotated", "security", "critical")
    attempt("pwd policy", iam.update_account_password_policy, MinimumPasswordLength=6,
            RequireSymbols=False, RequireNumbers=False)
    plant("shared", "iam", "account password policy", "Min length 6, no complexity requirements", "security", "medium")

    # ---- VPCs ----
    azs = ["us-east-1a", "us-east-1b", "us-east-1c"]
    out["shop_vpc"], out["shop_subnets"] = vpc("shop-prod", "shop-prod-vpc", "10.0.0.0/16",
                                                [("10.0.1.0/24", azs[0]), ("10.0.2.0/24", azs[1])])
    out["data_vpc"], out["data_subnets"] = vpc("data-platform", "data-platform-vpc", "10.1.0.0/16",
                                                [(f"10.1.{i}.0/24", azs[0]) for i in (1, 2, 3)])
    out["legacy_vpc"], out["legacy_subnets"] = vpc("legacy", "legacy-vpc", "10.0.0.0/16",
                                                    [("10.0.10.0/24", azs[0]), ("10.0.11.0/24", azs[1])])
    plant("legacy", "ec2", out["legacy_vpc"], "CIDR 10.0.0.0/16 overlaps shop-prod-vpc - peering/TGW impossible", "ops", "medium")

    # dev VPC with 3 NAT gateways for a tiny workload
    out["dev_vpc"], out["dev_subnets"] = vpc("dev", "dev-sandbox-vpc", "10.9.0.0/16",
                                              [(f"10.9.{i}.0/24", azs[i]) for i in range(3)])
    for i, s in enumerate(out["dev_subnets"]):
        eip = attempt(f"eip nat{i}", ec2.allocate_address, Domain="vpc")
        if eip:
            attempt(f"nat gw {i}", ec2.create_nat_gateway, SubnetId=s, AllocationId=eip["AllocationId"])
    plant("dev", "ec2", out["dev_vpc"], "3 NAT gateways (one per AZ) in a sandbox with ~no traffic: ~$100/mo idle + data processing", "cost", "high")

    # ---- security groups ----
    out["shop_sg"] = sg("shop-prod", out["shop_vpc"], "shop-wide-open", [("tcp", 0, 65535)],
                        "Security group allows ALL TCP ports from 0.0.0.0/0")
    out["db_sg"] = sg("shop-prod", out["shop_vpc"], "shop-db-public", [("tcp", 5432, 5432), ("tcp", 3306, 3306), ("tcp", 6379, 6379)],
                      "DB/cache ports (5432/3306/6379) open to the world")
    out["ssh_sg"] = sg("shop-prod", out["shop_vpc"], "bastion-ssh", [("tcp", 22, 22), ("tcp", 3389, 3389)],
                       "SSH/RDP open to 0.0.0.0/0")
    out["data_sg"] = sg("data-platform", out["data_vpc"], "data-wide-open", [("tcp", 0, 65535), ("udp", 0, 65535)],
                        "All TCP+UDP open to 0.0.0.0/0")
    out["legacy_sg"] = sg("legacy", out["legacy_vpc"], "legacy-http-ssh", [("tcp", 22, 22), ("tcp", 80, 80), ("tcp", 8080, 8080), ("tcp", 9200, 9200)],
                          "SSH + Elasticsearch 9200 open to the world")
    return out
