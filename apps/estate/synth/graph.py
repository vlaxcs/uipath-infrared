"""Build a graph of the live floci estate: graph/graph.json, graph/graph.dot, graph/graph.html.

Nodes come from the live API state (so orphans without edges still show). Edges are the intended
dependencies in ground_truth/topology.json plus structural ones read from the API (placement, containment).
Stack is derived from naming/VPC, idle/orphan from observed state + CloudWatch -- NOT from the planted-issue ledger.

Usage: python -m synth.graph
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone

from .common import client

OUT = "graph"
N, E = {}, []                  # nodes by id, edge list
ROLE_USE = []                  # (node id, role arn, why) read from the API

ALIAS = {}                     # bare name / aws id -> node id
AMBIGUOUS = {"shop-orders": "sqs", "shop-sessions": "cache"}  # bare names that exist as 2 resource types in topology.json


def stack_of(name, vpc=None):
    n = name.lower()
    for pre, st in (("shop", "shop-prod"), ("web-", "shop-prod"), ("www.shop", "shop-prod"), ("data", "data-platform"),
                    ("ml-", "data-platform"), ("clickstream", "data-platform"), ("events-raw", "data-platform"),
                    ("legacy", "legacy"), ("www.legacy", "legacy"), ("old-etl", "data-platform"), ("dev", "dev")):
        if n.startswith(pre):
            return st
    return {"shop-prod-vpc": "shop-prod", "data-platform-vpc": "data-platform", "legacy-vpc": "legacy",
            "dev-sandbox-vpc": "dev"}.get(vpc or "", "shared")


def node(kind, name, category, stack=None, alias=(), **attrs):
    nid = f"{kind}:{name}"
    N[nid] = dict(id=nid, label=name, type=kind, category=category, stack=stack or stack_of(name), status="active", attrs=attrs)
    for a in (name, *alias):
        ALIAS.setdefault(a, nid)
    ALIAS[nid] = nid
    return nid


def edge(src, dst, kind, note="", source="topology"):
    s, d = ALIAS.get(src), ALIAS.get(dst)
    if s and d and s != d and not any(e["src"] == s and e["dst"] == d and e["kind"] == kind for e in E):
        E.append(dict(src=s, dst=d, kind=kind, note=note, source=source))
        return True
    return False


def avg(cw, ns, metric, dims, hours=24):
    now = datetime.now(timezone.utc)
    pts = cw.get_metric_statistics(Namespace=ns, MetricName=metric, Dimensions=[{"Name": k, "Value": v} for k, v in dims.items()],
                                   StartTime=now - timedelta(hours=hours), EndTime=now + timedelta(minutes=1), Period=3600,
                                   Statistics=["Average"])["Datapoints"]
    return round(sum(p["Average"] for p in pts) / len(pts), 2) if pts else None


def collect():
    ec2, eks, ecs, elb = client("ec2"), client("eks"), client("ecs"), client("elbv2")
    asg, rds, ec, ddb = client("autoscaling"), client("rds"), client("elasticache"), client("dynamodb")
    s3, efs, sqs, sns = client("s3"), client("efs"), client("sqs"), client("sns")
    kin, fh, lam, ev = client("kinesis"), client("firehose"), client("lambda"), client("events")
    r53, iam, ecr, cw = client("route53"), client("iam"), client("ecr"), client("cloudwatch")

    # ---- network ----
    vname = {}
    for v in ec2.describe_vpcs()["Vpcs"]:
        if v.get("IsDefault"):
            continue
        name = next((t["Value"] for t in v.get("Tags", []) if t["Key"] == "Name"), v["VpcId"])
        vname[v["VpcId"]] = name
        node("vpc", name, "network", cidr=v["CidrBlock"], id=v["VpcId"], stack=stack_of(name, name), alias=(v["VpcId"],))
        N[f"vpc:{name}"]["stack"] = stack_of(name, name)
    subnet_vpc = {}
    for s in ec2.describe_subnets()["Subnets"]:
        if s["VpcId"] in vname:
            subnet_vpc[s["SubnetId"]] = vname[s["VpcId"]]
            ALIAS[s["SubnetId"]] = f"vpc:{vname[s['VpcId']]}"
    sgs = {}
    for g in ec2.describe_security_groups()["SecurityGroups"]:
        if g["GroupName"] == "default" or g["VpcId"] not in vname:
            continue
        open_ports = [f'{p.get("IpProtocol")}:{p.get("FromPort", "*")}-{p.get("ToPort", "*")}' for p in g["IpPermissions"]
                      if any(r.get("CidrIp") == "0.0.0.0/0" for r in p.get("IpRanges", []))]
        nid = node("sg", g["GroupName"], "network", stack=stack_of(vname[g["VpcId"]], vname[g["VpcId"]]),
                   alias=(g["GroupId"],), open_to_world=open_ports)
        if open_ports:
            N[nid]["status"] = "exposed"
        sgs[g["GroupId"]] = nid
        edge(g["GroupId"], f"vpc:{vname[g['VpcId']]}", "network", "security group in VPC", "api")
    for n in ec2.describe_nat_gateways()["NatGateways"]:
        vpc = vname.get(n["VpcId"], "")
        nid = node("nat", n["NatGatewayId"], "network", stack=stack_of(vpc, vpc))
        edge(nid, f"vpc:{vpc}", "network", "NAT gateway", "api")
        v = avg(cw, "AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": n["NatGatewayId"]})
        N[nid]["attrs"]["bytes_out_per_hour"] = v
        if v is not None and v < 1e5:
            N[nid]["status"] = "idle"

    # ---- compute ----
    for c in eks.list_clusters()["clusters"]:
        d = eks.describe_cluster(name=c)["cluster"]
        ngs = []
        for ng in eks.list_nodegroups(clusterName=c)["nodegroups"]:
            x = eks.describe_nodegroup(clusterName=c, nodegroupName=ng)["nodegroup"]
            ngs.append(dict(name=ng, types=x.get("instanceTypes"), nodes=x["scalingConfig"].get("desiredSize")))
        nid = node("eks", c, "compute", version=d["version"], nodegroups=ngs, public_endpoint=d["resourcesVpcConfig"].get("endpointPublicAccess"))
        cpu = avg(cw, "ContainerInsights", "node_cpu_utilization", {"ClusterName": c})
        N[nid]["attrs"]["node_cpu_avg_24h"] = cpu
        if cpu is not None and cpu < 5:
            N[nid]["status"] = "idle"
        ROLE_USE.append((nid, d.get("roleArn"), "cluster role"))
        for ng in eks.list_nodegroups(clusterName=c)["nodegroups"]:
            ROLE_USE.append((nid, eks.describe_nodegroup(clusterName=c, nodegroupName=ng)["nodegroup"].get("nodeRole"), f"nodegroup {ng} node role"))
        sub = (d["resourcesVpcConfig"].get("subnetIds") or [None])[0]
        if sub in ALIAS:
            edge(nid, ALIAS[sub], "network", "cluster VPC placement", "api")
    for c in ecs.list_clusters()["clusterArns"]:
        cn = c.split("/")[-1]
        cid = node("ecs", cn, "compute", stack=stack_of(cn), alias=(f"ecs:{cn}",))
        for sa in ecs.list_services(cluster=cn)["serviceArns"]:
            for s in ecs.describe_services(cluster=cn, services=[sa])["services"]:
                td = ecs.describe_task_definition(taskDefinition=s["taskDefinition"])["taskDefinition"]
                nid = node("ecs-svc", f"{cn}/{s['serviceName']}", "compute", stack=stack_of(cn), desired=s["desiredCount"],
                           cpu=td["cpu"], memory=td["memory"], alias=(f"{cn}/{s['serviceName']}",))
                cpu = avg(cw, "AWS/ECS", "CPUUtilization", {"ClusterName": cn, "ServiceName": s["serviceName"]})
                N[nid]["attrs"]["cpu_avg_24h"] = cpu
                if cpu is not None and cpu < 5:
                    N[nid]["status"] = "idle"
                edge(cid, nid, "contains", "ECS service", "api")
                ROLE_USE.append((nid, td.get("taskRoleArn"), "task role"))
    for lb in elb.describe_load_balancers()["LoadBalancers"]:
        nid = node("alb", lb["LoadBalancerName"], "edge", dns=lb.get("DNSName"))
        for t in elb.describe_target_groups(LoadBalancerArn=lb["LoadBalancerArn"])["TargetGroups"]:
            N[nid]["attrs"]["targets"] = len(elb.describe_target_health(TargetGroupArn=t["TargetGroupArn"])["TargetHealthDescriptions"])
    for g in asg.describe_auto_scaling_groups()["AutoScalingGroups"]:
        nid = node("asg", g["AutoScalingGroupName"], "compute", desired=g["DesiredCapacity"], min=g["MinSize"], max=g["MaxSize"],
                   instance_type="m5.8xlarge")
        cpu = avg(cw, "AWS/EC2", "CPUUtilization", {"AutoScalingGroupName": g["AutoScalingGroupName"]})
        N[nid]["attrs"]["cpu_avg_24h"] = cpu
        if cpu is not None and cpu < 10:
            N[nid]["status"] = "idle"
    asg_ids = {i["InstanceId"] for g in asg.describe_auto_scaling_groups()["AutoScalingGroups"] for i in g["Instances"]}
    for r in ec2.describe_instances()["Reservations"]:
        for i in r["Instances"]:
            if i["InstanceId"] in asg_ids:
                continue
            name = next((t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"), i["InstanceId"])
            vpc = subnet_vpc.get(i.get("SubnetId"), "")
            nid = node("ec2", name, "compute", stack=stack_of(name, vpc), type_=i["InstanceType"], public_ip=i.get("PublicIpAddress"))
            N[nid]["attrs"]["instance_type"] = i["InstanceType"]
            cpu = avg(cw, "AWS/EC2", "CPUUtilization", {"InstanceId": i["InstanceId"]})
            N[nid]["attrs"]["cpu_avg_24h"] = cpu
            if cpu is not None and cpu < 5:
                N[nid]["status"] = "idle"
            if vpc:
                edge(nid, f"vpc:{vpc}", "network", "instance subnet", "api")
    for f in lam.list_functions()["Functions"]:
        nid = node("lambda", f["FunctionName"], "compute", memory=f["MemorySize"], timeout=f["Timeout"], runtime=f["Runtime"])
        ROLE_USE.append((nid, f.get("Role"), "execution role"))
        sub = (f.get("VpcConfig") or {}).get("SubnetIds") or []
        if sub and sub[0] in ALIAS:
            edge(nid, ALIAS[sub[0]], "network", "VPC-attached Lambda", "api")

    # ---- data ----
    for g in rds.describe_db_subnet_groups()["DBSubnetGroups"]:
        if g["VpcId"] in vname:
            ALIAS[g["DBSubnetGroupName"]] = f"vpc:{vname[g['VpcId']]}"
    for d in rds.describe_db_instances()["DBInstances"]:
        i = d["DBInstanceIdentifier"]
        nid = node("rds", i, "data", cls=d["DBInstanceClass"], engine=f'{d["Engine"]} {d["EngineVersion"]}', storage_gb=d["AllocatedStorage"],
                   public=d.get("PubliclyAccessible"), multi_az=d.get("MultiAZ"))
        cpu = avg(cw, "AWS/RDS", "CPUUtilization", {"DBInstanceIdentifier": i})
        conn = avg(cw, "AWS/RDS", "DatabaseConnections", {"DBInstanceIdentifier": i})
        N[nid]["attrs"].update(cpu_avg_24h=cpu, connections_avg_24h=conn)
        if conn is not None and conn < 2:
            N[nid]["status"] = "idle"
        sg = (d.get("VpcSecurityGroups") or [{}])[0].get("VpcSecurityGroupId")
        if sg in sgs and d.get("DBSubnetGroup"):
            edge(nid, sgs[sg], "network", "DB SG", "api")
    for c in rds.describe_db_clusters()["DBClusters"]:
        nid = node("rds-cluster", c["DBClusterIdentifier"], "data", engine=c["Engine"], alias=(c["DBClusterIdentifier"],))
        for m in c.get("DBClusterMembers", []):
            edge(f"rds:{m['DBInstanceIdentifier']}", nid, "data", "cluster member", "api")
        ALIAS["data-aurora"] = nid
    for c in ec.describe_cache_clusters()["CacheClusters"]:
        cid = c["CacheClusterId"]
        nid = node("cache", cid, "data", engine=c["Engine"], node_type=c["CacheNodeType"], nodes=c["NumCacheNodes"])
        cpu = avg(cw, "AWS/ElastiCache", "CPUUtilization", {"CacheClusterId": cid, "CacheNodeId": "0001"})
        N[nid]["attrs"]["cpu_avg_24h"] = cpu
        if c["Engine"] == "memcached":
            N[nid]["status"] = "idle"
    for t in ddb.list_tables()["TableNames"]:
        d = ddb.describe_table(TableName=t)["Table"]
        pt = d.get("ProvisionedThroughput", {})
        node("ddb", t, "data", stack=stack_of(t), key=d["KeySchema"][0]["AttributeName"], rcu=pt.get("ReadCapacityUnits"),
             wcu=pt.get("WriteCapacityUnits"), gsis=len(d.get("GlobalSecondaryIndexes", [])))
    for b in s3.list_buckets()["Buckets"]:
        if b["Name"].startswith("awslambda"):
            continue
        public = False
        try:
            public = '"Principal": "*"' in s3.get_bucket_policy(Bucket=b["Name"])["Policy"] or '"Principal":"*"' in s3.get_bucket_policy(Bucket=b["Name"])["Policy"]
        except Exception:  # noqa: BLE001
            pass
        nid = node("s3", b["Name"], "data", public_policy=public)
        if public:
            N[nid]["status"] = "exposed"
    for f in efs.describe_file_systems()["FileSystems"]:
        node("efs", f.get("Name") or f["CreationToken"], "data", stack=stack_of(f["CreationToken"]),
             throughput_mibps=f.get("ProvisionedThroughputInMibps"), alias=(f["CreationToken"],))

    # ---- messaging / events ----
    for u in sqs.list_queues().get("QueueUrls", []):
        q = u.split("/")[-1]
        a = sqs.get_queue_attributes(QueueUrl=u, AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]
        nid = node("sqs", q, "messaging", backlog=int(a.get("ApproximateNumberOfMessages", 0)))
        vis = avg(cw, "AWS/SQS", "ApproximateNumberOfMessagesVisible", {"QueueName": q}, hours=1)
        N[nid]["attrs"]["visible_now"] = vis
    for t in sns.list_topics()["Topics"]:
        node("sns", t["TopicArn"].split(":")[-1], "messaging")
    for s in kin.list_streams()["StreamNames"]:
        d = kin.describe_stream_summary(StreamName=s)["StreamDescriptionSummary"]
        node("kinesis", s, "messaging", shards=d["OpenShardCount"])
    for s in fh.list_delivery_streams()["DeliveryStreamNames"]:
        node("firehose", s, "messaging")
    for r in ev.list_rules()["Rules"]:
        node("rule", r["Name"], "messaging", schedule=r.get("ScheduleExpression"))
    for z in r53.list_hosted_zones()["HostedZones"]:
        for rr in r53.list_resource_record_sets(HostedZoneId=z["Id"])["ResourceRecordSets"]:
            if rr["Type"] == "CNAME":
                node("dns", rr["Name"].rstrip("."), "edge", ttl=rr.get("TTL"), target=rr["ResourceRecords"][0]["Value"])

    # ---- iam / registry / orphans ----
    for r in iam.list_roles()["Roles"]:
        node("iam-role", r["RoleName"], "iam", stack="shared", alias=(f"arn:aws:iam::000000000000:role/{r['RoleName']}",))
    for r in ecr.describe_repositories()["repositories"]:
        node("ecr", r["repositoryName"], "registry", stack=stack_of(r["repositoryName"]))
    for v in ec2.describe_volumes()["Volumes"]:
        if not v["Attachments"]:
            nid = node("ebs", v["VolumeId"], "storage", stack="shared", size_gb=v["Size"], vol_type=v["VolumeType"])
            N[nid]["status"] = "orphan"
    for a in ec2.describe_addresses()["Addresses"]:
        if "AssociationId" not in a and "InstanceId" not in a:
            nid = node("eip", a.get("PublicIp", a["AllocationId"]), "network", stack="shared")
            N[nid]["status"] = "orphan"


def edges():
    for nid, arn, why in ROLE_USE:
        if arn:
            edge(nid, arn, "config", why, "api")
    # floci backs every EKS cluster with a node instance and a cluster SG; attach them to their cluster
    for n in list(N.values()):
        if n["type"] == "eks":
            c = n["label"]
            for m in N.values():
                if (m["type"] == "ec2" and m["label"] == f"{c}-node") or (m["type"] == "sg" and m["label"].startswith(f"eks-cluster-sg-{c}-")):
                    m["attrs"]["managed_by"] = "eks (floci)"
                    m["stack"] = n["stack"]
                    edge(n["id"], m["id"], "contains", "EKS-managed", "api")
    topo = json.load(open("ground_truth/topology.json"))["edges"]
    dropped = 0
    for t in topo:
        s, d = t["src"], t["dst"]
        for end in ("src", "dst"):
            if t[end] in AMBIGUOUS:
                t[end] = f"{AMBIGUOUS[t[end]]}:{t[end]}"
        if not edge(t["src"], t["dst"], t["kind"], t["note"], "topology"):
            dropped += 1
    # the ASG is what the ALB talks to; DNS CNAMEs point at ALB DNS names
    for nid, n in list(N.items()):
        if n["type"] == "dns":
            for a in N.values():
                if a["type"] == "alb" and a["attrs"].get("dns") == n["attrs"]["target"]:
                    edge(nid, a["id"], "dns", "CNAME", "api")
    return dropped


def export(dropped):
    os.makedirs(OUT, exist_ok=True)
    deg = {k: 0 for k in N}
    for e in E:
        deg[e["src"]] += 1
        deg[e["dst"]] += 1
    for k, n in N.items():
        n["degree"] = deg[k]
    g = dict(generated=datetime.now(timezone.utc).isoformat(timespec="seconds"), nodes=list(N.values()), edges=E)
    json.dump(g, open(f"{OUT}/graph.json", "w"), indent=1)
    with open(f"{OUT}/graph.dot", "w") as f:
        f.write("digraph infra {\n  rankdir=LR; node [shape=box, fontsize=10];\n")
        for n in N.values():
            f.write(f'  "{n["id"]}" [label="{n["label"]}\\n({n["type"]})"];\n')
        for e in E:
            f.write(f'  "{e["src"]}" -> "{e["dst"]}" [label="{e["kind"]}"];\n')
        f.write("}\n")
    tpl = open(os.path.join(os.path.dirname(__file__), "graph_template.html")).read()
    open(f"{OUT}/graph.html", "w").write(tpl.replace("/*__GRAPH__*/null", json.dumps(g)))
    by = {}
    for n in N.values():
        by[n["type"]] = by.get(n["type"], 0) + 1
    print(f"{len(N)} nodes, {len(E)} edges ({dropped} topology edges skipped: self-loops/duplicates)")
    print("nodes by type:", dict(sorted(by.items())))
    print("status:", {s: sum(1 for n in N.values() if n["status"] == s) for s in ("active", "idle", "orphan", "exposed")})
    print(f"isolated nodes (no edges): {sum(1 for d in deg.values() if d == 0)}")


if __name__ == "__main__":
    collect()
    export(edges())
