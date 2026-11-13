#!/usr/bin/env python3
"""Reference extractor: reads a live Floci/AWS endpoint and writes contract/infra.schema.json output.

    ../.venv/bin/python extract_floci.py [--endpoint http://localhost:4566] [--out real/floci-estate.infra.json]

Rules it follows (see README.md):
  * API calls only. It never reads ground_truth/ or synth/ (that would be reading the answer key).
  * Emits FACTS, never findings. Unknown values are omitted/null, not guessed.
  * Config fields are 'observed'. CloudWatch series are 'synthetic' when the endpoint is Floci (its metrics are
    injected by synth/metrics.py), 'observed' otherwise. Cost and spec-table values are 'estimated' with a basis.
  * `x_extraction_warnings` lists every call that failed or was skipped, so gaps are visible, not silent.
"""
import argparse
import json
import re
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3
from botocore.config import Config

import settings

AWS = settings.aws()

ap = argparse.ArgumentParser()
ap.add_argument("--endpoint", default=AWS.endpoint_url)
ap.add_argument("--region", default=AWS.region)
ap.add_argument("--project", default="floci-estate")
ap.add_argument("--window-days", type=int, default=14)
ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "contracts" / "real" / "floci-estate.infra.json"))
A = ap.parse_args()

IS_FLOCI = "localhost" in A.endpoint or "127.0.0.1" in A.endpoint
METRIC_PROV = "synthetic" if IS_FLOCI else "observed"
USD_EUR, HOURS = 0.92, 730
CFG = Config(retries={"max_attempts": 2}, connect_timeout=5, read_timeout=60)
WARN = []


def cl(svc):
    return boto3.client(svc, endpoint_url=A.endpoint, region_name=A.region, aws_access_key_id=AWS.access_key_id,
                        aws_secret_access_key=AWS.secret_access_key, config=CFG)


ec2, eks, ecs, elb, asg = cl("ec2"), cl("eks"), cl("ecs"), cl("elbv2"), cl("autoscaling")
rds, ec, ddb, s3, efs = cl("rds"), cl("elasticache"), cl("dynamodb"), cl("s3"), cl("efs")
sqs, sns, kin, fh, lam = cl("sqs"), cl("sns"), cl("kinesis"), cl("firehose"), cl("lambda")
ev, r53, iam, ecr, cw = cl("events"), cl("route53"), cl("iam"), cl("ecr"), cl("cloudwatch")


def safe(label, fn, default=None):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        WARN.append(f"{label}: {str(e)[:140]}")
        return default


# ---------------------------------------------------------------- helpers
USED = set()
REF = {}  # api identifier -> component id (for edge building)


def slug(s, prefix=""):
    base = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", f"{prefix}{s}".lower())).strip("-") or "x"
    i, out = 2, base
    while out in USED:
        out, i = f"{base}-{i}", i + 1
    USED.add(out)
    return out


def sm(value, unit, prov="observed", basis=None):
    d = {"value": value, "unit": unit, "provenance": prov}
    if basis:
        d["basis"] = basis
    return d


NOW = datetime.now(timezone.utc)


def series(ns, name, dims, unit, stat="Average", scale=1.0, basis_extra=""):
    """14d hourly summary. stat=Average|Sum|Maximum; scale converts the unit (e.g. 1/3600 hourly-sum -> per second)."""
    pts = safe(f"metric {ns}/{name} {list(dims.values())}", lambda: cw.get_metric_statistics(
        Namespace=ns, MetricName=name, Dimensions=[{"Name": k, "Value": v} for k, v in dims.items()],
        StartTime=NOW - timedelta(days=A.window_days), EndTime=NOW + timedelta(minutes=1), Period=3600,
        Statistics=[stat, "Maximum"])["Datapoints"], [])
    vals = sorted(p[stat] * scale for p in pts)
    if not vals:
        return None
    mx = max(p["Maximum"] * scale for p in pts) if stat == "Average" else vals[-1]
    pct = lambda q: vals[min(len(vals) - 1, int(q * (len(vals) - 1) + 0.5))]  # noqa: E731
    d = {"unit": unit, "window_days": A.window_days, "resolution_seconds": 3600, "provenance": METRIC_PROV,
         "avg": round(statistics.fmean(vals), 4), "min": round(vals[0], 4), "p50": round(pct(.5), 4), "p95": round(pct(.95), 4),
         "max": round(mx, 4), "basis": f"CloudWatch {ns} {name}, {stat}, period 3600{basis_extra}"}
    if stat == "Sum":
        d["sum"] = round(sum(vals), 2)
    return d


def usage(**kw):
    return {k: v for k, v in kw.items() if v}


# ---------------------------------------------------------------- spec + price tables (NOT read from the API)
# vcpu, memory_gb, gpus, usd/hour (approximate on-demand list price, us-east-1; for cost ESTIMATES only)
SPECS = {
    "m5.large": (2, 8, 0, 0.096), "m5.4xlarge": (16, 64, 0, 0.768), "m5.8xlarge": (32, 128, 0, 1.536),
    "m5.24xlarge": (96, 384, 0, 4.608), "c5.9xlarge": (36, 72, 0, 1.53), "c5.12xlarge": (48, 96, 0, 2.04),
    "r5.2xlarge": (8, 64, 0, 0.504), "r5.16xlarge": (64, 512, 0, 4.032), "m4.2xlarge": (8, 32, 0, 0.40),
    "p3.8xlarge": (32, 244, 4, 12.24),
    "db.r5.8xlarge": (32, 256, 0, 4.80), "db.r5.4xlarge": (16, 128, 0, 2.40), "db.m4.4xlarge": (16, 64, 0, 1.61),
    "db.r4.4xlarge": (16, 122, 0, 2.30),
    "cache.r5.4xlarge": (16, 104.7, 0, 2.0), "cache.m4.2xlarge": (8, 35.2, 0, 0.78),
}
SPEC_BASIS = "published instance specs table inside the extractor (the API only returns the type name)"


def spec_cap(sku, cap):
    if sku in SPECS:
        v, m, g, _ = SPECS[sku]
        cap["vcpu"] = sm(v, "count", "estimated", SPEC_BASIS)
        cap["memory_gb"] = sm(m, "GB", "estimated", SPEC_BASIS)
        if g:
            cap["gpus"] = sm(g, "count", "estimated", SPEC_BASIS)


def cost(total_usd_month, basis):
    if total_usd_month is None:
        return None
    return {"monthly_eur": sm(round(total_usd_month * USD_EUR), "EUR/month", "estimated",
                              f"{basis} x {USD_EUR} EUR/USD; approximate list price, no discounts")}


def hourly_cost(sku, qty, extra=0.0):
    return None if sku not in SPECS else cost(SPECS[sku][3] * HOURS * qty + extra, f"{SPECS[sku][3]} USD/h x {HOURS} h x {qty} unit(s)")


# ---------------------------------------------------------------- shared lookups
SECRET_RE = re.compile(r"(pass(word)?|secret|token|api[_-]?key|private[_-]?key|stripe)", re.I)


def role_is_admin(arn):
    if not arn:
        return None
    name = arn.split("/")[-1]
    pols = safe(f"iam attached {name}", lambda: iam.list_attached_role_policies(RoleName=name)["AttachedPolicies"])
    inline = safe(f"iam inline {name}", lambda: iam.list_role_policies(RoleName=name)["PolicyNames"], [])
    if pols is None:
        return None
    if any(p["PolicyName"] == "AdministratorAccess" for p in pols):
        return True
    for pn in inline:
        doc = safe(f"iam inline doc {name}/{pn}", lambda: iam.get_role_policy(RoleName=name, PolicyName=pn)["PolicyDocument"])
        if doc:
            for st in (doc["Statement"] if isinstance(doc["Statement"], list) else [doc["Statement"]]):
                acts = st.get("Action"), st.get("Resource")
                if st.get("Effect") == "Allow" and "*" in (acts[0] if isinstance(acts[0], list) else [acts[0]]) \
                        and "*" in (acts[1] if isinstance(acts[1], list) else [acts[1]]):
                    return True
    return False


VPCNAME, SUBNET_AZ, SUBNET_VPC, SG_PORTS = {}, {}, {}, {}


def load_network():
    for v in safe("describe_vpcs", lambda: ec2.describe_vpcs()["Vpcs"], []):
        VPCNAME[v["VpcId"]] = next((t["Value"] for t in v.get("Tags", []) if t["Key"] == "Name"), v["VpcId"])
    for s in safe("describe_subnets", lambda: ec2.describe_subnets()["Subnets"], []):
        SUBNET_AZ[s["SubnetId"]] = s["AvailabilityZone"]
        SUBNET_VPC[s["SubnetId"]] = s["VpcId"]
    for g in safe("describe_security_groups", lambda: ec2.describe_security_groups()["SecurityGroups"], []):
        ports = set()
        for p in g["IpPermissions"]:
            if any(r.get("CidrIp") == "0.0.0.0/0" for r in p.get("IpRanges", [])):
                lo, hi = p.get("FromPort", -1), p.get("ToPort", -1)
                if p.get("IpProtocol") == "-1" or (lo == 0 and hi == 65535):
                    ports.add(-1)
                elif lo is not None:
                    ports.update(range(lo, min(hi, lo + 20) + 1) if hi - lo < 20 else {lo, hi})
        SG_PORTS[g["GroupId"]] = ports


def world_ports(sg_ids):
    s = set()
    for g in sg_ids or []:
        s |= SG_PORTS.get(g, set())
    return sorted(s)


def stack_of(vpc_name=None, name=""):
    n = (name or "").lower()
    for pre, st in (("shop", "shop"), ("web-", "shop"), ("data", "data"), ("ml-", "data"), ("clickstream", "data"),
                    ("events-raw", "data"), ("legacy", "legacy"), ("old-etl", "data"), ("dev", "dev")):
        if n.startswith(pre):
            return st
    return {"shop-prod-vpc": "shop", "data-platform-vpc": "data", "legacy-vpc": "legacy", "dev-sandbox-vpc": "dev"}.get(vpc_name or "")


COMP, EDGES = [], []


def add(c):
    c.setdefault("provider", "aws")
    c.setdefault("region", A.region)
    c.setdefault("quantity", 1)
    c.setdefault("status", "active")
    for k in [k for k, v in c.items() if v in (None, {}, [])]:
        if k not in ("quantity",):
            del c[k]
    COMP.append(c)
    return c


def edge(src, dst, kind, evidence="declared", note=None):
    if src and dst and src != dst and not any(e["from"] == src and e["to"] == dst and e["kind"] == kind for e in EDGES):
        e = {"from": src, "to": dst, "kind": kind, "evidence": evidence}
        if note:
            e["note"] = note
        EDGES.append(e)


# ---------------------------------------------------------------- extraction per service
def x_eks():
    for name in safe("eks list", lambda: eks.list_clusters()["clusters"], []):
        d = eks.describe_cluster(name=name)["cluster"]
        vc = d["resourcesVpcConfig"]
        vname = VPCNAME.get(vc.get("vpcId"), None) or VPCNAME.get(SUBNET_VPC.get((vc.get("subnetIds") or [""])[0]))
        logging_on = any(t.get("enabled") for t in d.get("logging", {}).get("clusterLogging", []))
        cid = slug(name, "eks-")
        REF[f"eks:{name}"] = cid
        cpu = series("ContainerInsights", "node_cpu_utilization", {"ClusterName": name}, "percent")
        mem = series("ContainerInsights", "node_memory_utilization", {"ClusterName": name}, "percent")
        ngs = [eks.describe_nodegroup(clusterName=name, nodegroupName=n)["nodegroup"]
               for n in eks.list_nodegroups(clusterName=name)["nodegroups"]]
        ng_cost = 0
        for n in ngs:
            q, sku = n["scalingConfig"]["desiredSize"], (n.get("instanceTypes") or [""])[0]
            if sku in SPECS:
                ng_cost += SPECS[sku][3] * HOURS * q
        add({"id": cid, "name": name, "kind": "kubernetes_cluster", "service": "eks", "stateful": False,
             "stack": stack_of(vname, name), "zones": len({SUBNET_AZ.get(s) for s in ngs[0].get("subnets", [])}) if ngs else None,
             "engine": {"name": "kubernetes", "version": d["version"]}, "usage": usage(cpu_pct=cpu, memory_pct=mem),
             "security": {"public_exposure": "internet" if vc.get("endpointPublicAccess") and "0.0.0.0/0" in vc.get("publicAccessCidrs", ["0.0.0.0/0"]) else "vpc_only",
                          "world_open_ports": world_ports(vc.get("securityGroupIds")),
                          "encryption_at_rest": bool(d.get("encryptionConfig"))},
             "cost": cost(0.10 * HOURS, "EKS control plane 0.10 USD/h x 730 h (extended-support surcharge not included)"),
             "config": {"k8s_version": d["version"], "control_plane_logging_enabled": logging_on,
                        "endpoint_public": vc.get("endpointPublicAccess"), "endpoint_private": vc.get("endpointPrivateAccess"),
                        "secrets_envelope_encryption": bool(d.get("encryptionConfig")),
                        "note": "Usage metrics are cluster-level (Container Insights), not per node group."}})
        for n in ngs:
            q, sku = n["scalingConfig"]["desiredSize"], (n.get("instanceTypes") or [""])[0]
            cap = {"disk_gb": sm(n.get("diskSize", 0), "GB")}
            spec_cap(sku, cap)
            gpu = series("ContainerInsights", "node_gpu_utilization", {"ClusterName": name}, "percent") \
                if sku.startswith(("p3", "p4", "g4", "g5")) else None
            add({"id": slug(f"{name}-{n['nodegroupName']}", "ng-"), "name": f"{name}/{n['nodegroupName']}", "kind": "node_group",
                 "parent": cid, "service": "eks-managed-nodegroup", "sku": sku, "quantity": q, "stateful": False,
                 "stack": stack_of(vname, name), "zones": len({SUBNET_AZ.get(s) for s in n.get("subnets", [])}) or None,
                 "scaling": {"min": n["scalingConfig"]["minSize"], "max": n["scalingConfig"]["maxSize"], "desired": q,
                             "autoscaling_enabled": n["scalingConfig"]["minSize"] != n["scalingConfig"]["maxSize"]},
                 "capacity": cap, "usage": usage(cpu_pct=cpu, memory_pct=mem, gpu_pct=gpu),
                 "cost": hourly_cost(sku, q), "config": {"ami_type": n.get("amiType"), "capacity_type": n.get("capacityType"),
                                                    "usage_scope": "cpu/memory/gpu are CLUSTER-level Container Insights series, shared by all node groups of the cluster"}})


def x_ecs():
    for ca in safe("ecs list_clusters", lambda: ecs.list_clusters()["clusterArns"], []):
        cname = ca.split("/")[-1]
        for sa in ecs.list_services(cluster=cname)["serviceArns"]:
            s = ecs.describe_services(cluster=cname, services=[sa])["services"][0]
            td = ecs.describe_task_definition(taskDefinition=s["taskDefinition"])["taskDefinition"]
            cdefs = td["containerDefinitions"]
            env = {e["name"]: e["value"] for c in cdefs for e in c.get("environment", [])}
            net = s.get("networkConfiguration", {}).get("awsvpcConfiguration", {})
            cpu_u, mem_mb, q = int(td["cpu"]), int(td["memory"]), s["desiredCount"]
            vcpu, gb = cpu_u / 1024, mem_mb / 1024
            usd = (0.04048 * vcpu + 0.004445 * gb) * HOURS * q
            cid = slug(f"{cname}-{s['serviceName']}", "svc-")
            REF[f"ecs:{cname}/{s['serviceName']}"] = cid
            for lb in s.get("loadBalancers", []):
                REF.setdefault("tg:" + lb["targetGroupArn"], cid)
            REF[f"ecs-env:{cid}"] = env
            add({"id": cid, "name": f"{cname}/{s['serviceName']}", "kind": "container", "service": "ecs-fargate",
                 "sku": f"{vcpu:g}vcpu/{gb:g}GB", "quantity": q, "stateful": False,
                 "stack": stack_of(VPCNAME.get(SUBNET_VPC.get((net.get("subnets") or [""])[0])), cname),
                 "zones": len({SUBNET_AZ.get(x) for x in net.get("subnets", [])}) or None,
                 "capacity": {"vcpu": sm(vcpu, "count"), "memory_gb": sm(gb, "GB")},
                 "usage": usage(cpu_pct=series("AWS/ECS", "CPUUtilization", {"ClusterName": cname, "ServiceName": s["serviceName"]}, "percent"),
                                memory_pct=series("AWS/ECS", "MemoryUtilization", {"ClusterName": cname, "ServiceName": s["serviceName"]}, "percent")),
                 "scaling": {"desired": q, "autoscaling_enabled": None} if False else {"desired": q},
                 "security": {"public_exposure": "internet" if net.get("assignPublicIp") == "ENABLED" else "vpc_only",
                              "world_open_ports": world_ports(net.get("securityGroups")),
                              "plaintext_secrets_suspected": any(SECRET_RE.search(k) and v for k, v in env.items()),
                              "admin_privileges": role_is_admin(td.get("taskRoleArn"))},
                 "cost": cost(usd, f"Fargate 0.04048 USD/vCPU-h + 0.004445 USD/GB-h x {HOURS} h x {q} tasks"),
                 "config": {"images": [c["image"] for c in cdefs], "runs_as": [c.get("user", "default") for c in cdefs],
                            "log_configuration_present": any("logConfiguration" in c for c in cdefs),
                            "container_health_check_present": any("healthCheck" in c for c in cdefs),
                            "min_healthy_percent": s.get("deploymentConfiguration", {}).get("minimumHealthyPercent"),
                            "container_insights": next((x["value"] for x in (ecs.describe_clusters(clusters=[cname], include=["SETTINGS"])["clusters"][0].get("settings", [])) if x["name"] == "containerInsights"), None)}})


def x_ec2_asg():
    eks_backing = set()
    for g in safe("asg", lambda: asg.describe_auto_scaling_groups()["AutoScalingGroups"], []):
        n = g["AutoScalingGroupName"]
        ids = [i["InstanceId"] for i in g["Instances"]]
        sku = (g["Instances"][0]["InstanceType"] if g["Instances"] else "")
        pols = safe(f"asg policies {n}", lambda: asg.describe_policies(AutoScalingGroupName=n)["ScalingPolicies"], [])
        cid = slug(n, "asg-")
        REF[f"asg:{n}"] = cid
        for t in g.get("TargetGroupARNs", []):
            REF.setdefault("tg:" + t, cid)
        cap = {}
        spec_cap(sku, cap)
        subs = [x for x in (g.get("VPCZoneIdentifier") or "").split(",") if x]
        add({"id": cid, "name": n, "kind": "virtual_machine", "service": "ec2-autoscaling", "sku": sku, "quantity": g["DesiredCapacity"],
             "stateful": False, "stack": stack_of(VPCNAME.get(SUBNET_VPC.get(subs[0])) if subs else None, n),
             "zones": len({SUBNET_AZ.get(s) for s in subs}) or None, "capacity": cap,
             "scaling": {"min": g["MinSize"], "max": g["MaxSize"], "desired": g["DesiredCapacity"], "autoscaling_enabled": bool(pols)},
             "usage": usage(cpu_pct=series("AWS/EC2", "CPUUtilization", {"AutoScalingGroupName": n}, "percent")),
             "cost": hourly_cost(sku, g["DesiredCapacity"]),
             "config": {"health_check_type": g.get("HealthCheckType"), "health_check_grace_period_s": g.get("HealthCheckGracePeriod"),
                        "scaling_policies": len(pols)}})
        eks_backing |= set(ids)
    clusters = set(safe("eks names", lambda: eks.list_clusters()["clusters"], []))
    for r in safe("describe_instances", lambda: ec2.describe_instances()["Reservations"], []):
        for i in r["Instances"]:
            tags = {t["Key"]: t["Value"] for t in i.get("Tags", [])}
            name = tags.get("Name", i["InstanceId"])
            if i["InstanceId"] in eks_backing:
                continue
            if name.endswith("-node") and name[:-5] in clusters:
                WARN.append(f"skipped {name}: Floci-created node backing EKS cluster '{name[:-5]}' (not a user instance)")
                continue
            sku = i["InstanceType"]
            cap = {}
            spec_cap(sku, cap)
            vols = [m["Ebs"]["VolumeId"] for m in i.get("BlockDeviceMappings", []) if "Ebs" in m]
            vsz = [v["Size"] for v in safe(f"volumes {name}", lambda: ec2.describe_volumes(VolumeIds=vols)["Volumes"], [])] if vols else []
            if vsz:
                cap["disk_gb"] = sm(sum(vsz), "GB")
            cid = slug(name, "vm-")
            REF[f"ec2:{i['InstanceId']}"] = cid
            sgs = [g["GroupId"] for g in i.get("SecurityGroups", [])]
            add({"id": cid, "name": name, "kind": "virtual_machine", "service": "ec2", "sku": sku, "stateful": True,
                 "stack": stack_of(VPCNAME.get(i.get("VpcId")), name), "zones": 1,
                 "capacity": cap, "tags": {k: v for k, v in tags.items() if not k.startswith("aws:")},
                 "usage": usage(cpu_pct=series("AWS/EC2", "CPUUtilization", {"InstanceId": i["InstanceId"]}, "percent")),
                 "security": {"public_exposure": "internet" if i.get("PublicIpAddress") else "vpc_only",
                              "world_open_ports": world_ports(sgs),
                              "encryption_at_rest": None, "admin_privileges": None},
                 "cost": hourly_cost(sku, 1, 0.115 * sum(vsz) if vsz else 0),
                 "config": {"imds_v2_required": (i.get("MetadataOptions") or {}).get("HttpTokens") == "required",
                            "detailed_monitoring": (i.get("Monitoring") or {}).get("State") == "enabled"}})


def x_rds():
    inst = safe("rds instances", lambda: rds.describe_db_instances()["DBInstances"], [])
    clusters = safe("rds clusters", lambda: rds.describe_db_clusters()["DBClusters"], [])
    member_ids = {m["DBInstanceIdentifier"] for c in clusters for m in c.get("DBClusterMembers", [])}
    sgmap = lambda d: [g["VpcSecurityGroupId"] for g in d.get("VpcSecurityGroups", [])]  # noqa: E731

    def common(d, name, ident_dim):
        ep = d.get("Endpoint") or {}
        free = series("AWS/RDS", "FreeStorageSpace", {"DBInstanceIdentifier": ident_dim}, "bytes", scale=1 / 2**30)
        alloc = d.get("AllocatedStorage")
        cap = {}
        spec_cap(d["DBInstanceClass"], cap)
        if alloc:
            cap["storage_gb"] = sm(alloc, "GB")
        used = None
        if free and alloc:
            used = sm(round(max(0, alloc - free["avg"]), 1), "GB", "estimated", "AllocatedStorage minus average FreeStorageSpace (metric is " + METRIC_PROV + ")")
        us = usage(cpu_pct=series("AWS/RDS", "CPUUtilization", {"DBInstanceIdentifier": ident_dim}, "percent"),
                   connections=series("AWS/RDS", "DatabaseConnections", {"DBInstanceIdentifier": ident_dim}, "count"),
                   read_iops=series("AWS/RDS", "ReadIOPS", {"DBInstanceIdentifier": ident_dim}, "iops"),
                   write_iops=series("AWS/RDS", "WriteIOPS", {"DBInstanceIdentifier": ident_dim}, "iops"))
        return ep, cap, used, us

    for d in inst:
        ident = d["DBInstanceIdentifier"]
        if ident in member_ids:
            continue
        ep, cap, used, us = common(d, ident, ident)
        cid = slug(ident, "rds-")
        endpoint = f"{ep.get('Address')}:{ep.get('Port')}" if ep else None
        REF[f"rds-ep:{endpoint}"] = cid
        REF[f"rds:{ident}"] = cid
        add({"id": cid, "name": ident, "kind": "postgres", "service": "rds", "sku": d["DBInstanceClass"], "stateful": True,
             "stack": stack_of(None, ident), "zones": 2 if d.get("MultiAZ") else 1,
             "engine": {"name": d["Engine"], "version": d["EngineVersion"]}, "data_gb": used, "capacity": cap, "usage": us,
             "security": {"public_exposure": "internet" if d.get("PubliclyAccessible") else "vpc_only",
                          "encryption_at_rest": d.get("StorageEncrypted"), "backup_retention_days": d.get("BackupRetentionPeriod"),
                          "deletion_protection": d.get("DeletionProtection"), "world_open_ports": world_ports(sgmap(d))},
             "cost": cost(SPECS[d["DBInstanceClass"]][3] * HOURS + 0.115 * d.get("AllocatedStorage", 0), f"{d['DBInstanceClass']} {SPECS[d['DBInstanceClass']][3]} USD/h x {HOURS} h + gp2 0.115 USD/GB-mo x {d.get('AllocatedStorage')} GB") if d["DBInstanceClass"] in SPECS else None,
             "config": {"endpoint": endpoint, "storage_type": d.get("StorageType"), "multi_az": d.get("MultiAZ"),
                        "performance_insights": d.get("PerformanceInsightsEnabled"), "auto_minor_upgrade": d.get("AutoMinorVersionUpgrade"),
                        "extensions": "not extractable via the RDS API; needs SQL access (pg_extension) -> features_used omitted"}})
    for c in clusters:
        members = [m["DBInstanceIdentifier"] for m in c.get("DBClusterMembers", [])]
        first = next((d for d in inst if d["DBInstanceIdentifier"] in members), None)
        if not first:
            continue
        ep, cap, used, us = common(first, c["DBClusterIdentifier"], first["DBInstanceIdentifier"])
        cid = slug(c["DBClusterIdentifier"], "rds-")
        endpoint = f"{ep.get('Address')}:{ep.get('Port')}" if ep else None
        for m in members:
            REF[f"rds:{m}"] = cid
        REF[f"rds-ep:{endpoint}"] = cid
        q = len(members)
        sku = first["DBInstanceClass"]
        add({"id": cid, "name": c["DBClusterIdentifier"], "kind": "postgres", "service": "aurora-postgresql", "sku": sku, "quantity": q,
             "stateful": True, "stack": stack_of(None, c["DBClusterIdentifier"]), "zones": 1,
             "engine": {"name": c["Engine"], "version": c.get("EngineVersion")}, "capacity": {k: v for k, v in cap.items() if k != "storage_gb"},
             "usage": us, "security": {"public_exposure": "internet" if first.get("PubliclyAccessible") else "vpc_only",
                                       "encryption_at_rest": c.get("StorageEncrypted"), "backup_retention_days": c.get("BackupRetentionPeriod"),
                                       "deletion_protection": c.get("DeletionProtection"), "world_open_ports": world_ports(sgmap(first) or [g["VpcSecurityGroupId"] for g in c.get("VpcSecurityGroups", [])])},
             "cost": hourly_cost(sku, q) if sku in SPECS else None,
             "config": {"members": members, "endpoint": endpoint, "note": "Aurora storage is usage-billed; storage cost not estimated."}})


def x_cache():
    for c in safe("elasticache", lambda: ec.describe_cache_clusters()["CacheClusters"], []):
        cid_raw = c["CacheClusterId"]
        sku, q = c["CacheNodeType"], c.get("NumCacheNodes", 1)
        cap = {}
        spec_cap(sku, cap)
        dims = {"CacheClusterId": cid_raw, "CacheNodeId": "0001"}
        cid = slug(cid_raw, "cache-")
        REF[f"cache:{cid_raw}"] = cid
        add({"id": cid, "name": cid_raw, "kind": "cache", "service": f"elasticache-{c['Engine']}", "sku": sku, "quantity": q, "stateful": False,
             "stack": stack_of(None, cid_raw), "zones": 1, "engine": {"name": c["Engine"], "version": c.get("EngineVersion")}, "capacity": cap,
             "usage": usage(cpu_pct=series("AWS/ElastiCache", "CPUUtilization", dims, "percent"),
                            connections=series("AWS/ElastiCache", "CurrConnections", dims, "count"),
                            hit_rate_pct=series("AWS/ElastiCache", "CacheHitRate", dims, "percent"),
                            evictions=series("AWS/ElastiCache", "Evictions", dims, "count")),
             "security": {"encryption_in_transit": c.get("TransitEncryptionEnabled"), "encryption_at_rest": c.get("AtRestEncryptionEnabled"),
                          "backup_retention_days": c.get("SnapshotRetentionLimit")},
             "cost": hourly_cost(sku, q), "config": {"replicas": max(0, q - 1) if c["Engine"] == "redis" else None, "auth_token_enabled": c.get("AuthTokenEnabled")}})


def x_dynamo():
    for t in safe("ddb list", lambda: ddb.list_tables()["TableNames"], []):
        d = ddb.describe_table(TableName=t)["Table"]
        pt = d.get("ProvisionedThroughput", {})
        on_demand = d.get("BillingModeSummary", {}).get("BillingMode") == "PAY_PER_REQUEST" or not pt.get("ReadCapacityUnits")
        pitr = safe(f"pitr {t}", lambda: ddb.describe_continuous_backups(TableName=t)["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"] == "ENABLED")
        ttl = safe(f"ttl {t}", lambda: ddb.describe_time_to_live(TableName=t)["TimeToLiveDescription"]["TimeToLiveStatus"] in ("ENABLED", "ENABLING"))
        gsis = d.get("GlobalSecondaryIndexes", [])
        dims = {"TableName": t}
        cap = {} if on_demand else {"provisioned_rcu": sm(pt["ReadCapacityUnits"], "count"), "provisioned_wcu": sm(pt["WriteCapacityUnits"], "count")}
        cid = slug(t, "ddb-")
        REF[f"ddb:{t}"] = cid
        add({"id": cid, "name": t, "kind": "nosql", "service": "dynamodb", "stateful": True, "stack": stack_of(None, t),
             "data_gb": sm(round(d.get("TableSizeBytes", 0) / 2**30, 3), "GB") if d.get("TableSizeBytes") else None, "capacity": cap,
             "usage": usage(consumed_rcu=series("AWS/DynamoDB", "ConsumedReadCapacityUnits", dims, "per_second", "Sum", 1 / 3600),
                            consumed_wcu=series("AWS/DynamoDB", "ConsumedWriteCapacityUnits", dims, "per_second", "Sum", 1 / 3600),
                            throttled_requests=series("AWS/DynamoDB", "WriteThrottleEvents", dims, "count", "Sum")),
             "security": {"backup_retention_days": 35 if pitr else 0, "deletion_protection": d.get("DeletionProtectionEnabled")},
             "cost": None if on_demand else cost((pt["ReadCapacityUnits"] * 0.00013 + pt["WriteCapacityUnits"] * 0.00065) * HOURS * (1 + len(gsis)),
                                                 f"RCU 0.00013 + WCU 0.00065 USD/h x {HOURS} h x (table + {len(gsis)} GSI at same provisioning)"),
             "config": {"partition_key": d["KeySchema"][0]["AttributeName"], "billing_mode": "on_demand" if on_demand else "provisioned",
                        "gsi_count": len(gsis), "gsi_projection_all": sum(1 for g in gsis if g["Projection"]["ProjectionType"] == "ALL"),
                        "pitr_enabled": pitr, "ttl_enabled": ttl}})


def x_s3():
    for b in safe("s3 list", lambda: s3.list_buckets()["Buckets"], []):
        n = b["Name"]
        if n.startswith("awslambda-"):
            WARN.append(f"skipped {n}: Floci-internal bucket")
            continue
        try:
            pol = s3.get_bucket_policy(Bucket=n)["Policy"]
        except Exception as e:  # noqa: BLE001
            pol = None
            if "NoSuchBucketPolicy" not in str(e):
                WARN.append(f"policy {n}: {str(e)[:140]}")
        public = bool(pol and re.search(r'"Principal"\s*:\s*("\*"|\{\s*"AWS"\s*:\s*"\*"\s*\})', pol))
        enc = None
        try:
            enc = bool(s3.get_bucket_encryption(Bucket=n)["ServerSideEncryptionConfiguration"])
        except Exception as e:  # noqa: BLE001
            enc = False if "ServerSideEncryptionConfigurationNotFound" in str(e) else None
        ver = safe(f"versioning {n}", lambda: s3.get_bucket_versioning(Bucket=n).get("Status") == "Enabled")
        life = None
        try:
            life = bool(s3.get_bucket_lifecycle_configuration(Bucket=n)["Rules"])
        except Exception as e:  # noqa: BLE001
            life = False if "NoSuchLifecycleConfiguration" in str(e) else None
        size = series("AWS/S3", "BucketSizeBytes", {"BucketName": n, "StorageType": "StandardStorage"}, "gb", scale=1 / 2**30)
        objs = series("AWS/S3", "NumberOfObjects", {"BucketName": n, "StorageType": "AllStorageTypes"}, "count")
        cid = slug(n, "s3-")
        REF[f"s3:{n}"] = cid
        add({"id": cid, "name": n, "kind": "object_storage", "service": "s3", "stateful": True, "stack": stack_of(None, n),
             "data_gb": sm(round(size["avg"], 1), "GB", METRIC_PROV, "CloudWatch AWS/S3 BucketSizeBytes (14d average)") if size else None,
             "capacity": {"object_count": sm(round(objs["avg"]), "count", METRIC_PROV, "CloudWatch AWS/S3 NumberOfObjects")} if objs else None,
             "security": {"public_exposure": "internet" if public else "none", "encryption_at_rest": enc},
             "cost": cost(size["avg"] * 0.023, f"S3 Standard 0.023 USD/GB-mo x {size['avg']:.0f} GB") if size else None,
             "config": {"versioning": ver, "lifecycle_rules_present": life}})


def x_efs():
    for f in safe("efs", lambda: efs.describe_file_systems()["FileSystems"], []):
        name = f.get("Name") or f["CreationToken"]
        prov = f.get("ProvisionedThroughputInMibps")
        cid = slug(name, "efs-")
        REF[f"efs:{name}"] = cid
        add({"id": cid, "name": name, "kind": "file_system", "service": "efs", "stateful": True, "stack": stack_of(None, name),
             "capacity": {"throughput_mibps": sm(prov, "MiB/s")} if prov else None,
             "usage": usage(io_limit_pct=series("AWS/EFS", "PercentIOLimit", {"FileSystemId": f["FileSystemId"]}, "percent")),
             "security": {"encryption_at_rest": f.get("Encrypted")},
             "cost": cost(prov * 6.0, f"EFS provisioned throughput 6 USD/MiB/s-mo x {prov}") if prov else None,
             "config": {"throughput_mode": f.get("ThroughputMode")}})


def x_messaging():
    for u in safe("sqs", lambda: sqs.list_queues().get("QueueUrls", []), []):
        q = u.split("/")[-1]
        a = sqs.get_queue_attributes(QueueUrl=u, AttributeNames=["All"])["Attributes"]
        dims = {"QueueName": q}
        cid = slug(q, "q-")
        REF[f"sqs:{u}"] = cid
        REF[f"sqs-arn:{a.get('QueueArn')}"] = cid
        REF[f"sqs-name:{q}"] = cid
        add({"id": cid, "name": q, "kind": "queue", "service": "sqs", "stateful": True, "stack": stack_of(None, q),
             "usage": usage(messages_visible=series("AWS/SQS", "ApproximateNumberOfMessagesVisible", dims, "count"),
                            messages_sent=series("AWS/SQS", "NumberOfMessagesSent", dims, "count", "Sum"),
                            messages_received=series("AWS/SQS", "NumberOfMessagesReceived", dims, "count", "Sum"),
                            empty_receives=series("AWS/SQS", "NumberOfEmptyReceives", dims, "count", "Sum")),
             "security": {"encryption_at_rest": bool(a.get("KmsMasterKeyId") or a.get("SqsManagedSseEnabled") == "true")},
             "config": {"visibility_timeout_s": int(a.get("VisibilityTimeout", 0)), "receive_wait_s": int(a.get("ReceiveMessageWaitTimeSeconds", 0)),
                        "retention_s": int(a.get("MessageRetentionPeriod", 0)), "has_dlq": "RedrivePolicy" in a,
                        "messages_in_queue_now": int(a.get("ApproximateNumberOfMessages", 0))}})
    for t in safe("sns", lambda: sns.list_topics()["Topics"], []):
        n = t["TopicArn"].split(":")[-1]
        cid = slug(n, "topic-")
        REF[f"sns:{t['TopicArn']}"] = cid
        add({"id": cid, "name": n, "kind": "queue", "service": "sns", "stateful": False, "stack": stack_of(None, n),
             "config": {"subscriptions": [{"protocol": s["Protocol"], "endpoint": s["Endpoint"]}
                                          for s in safe("sns subs", lambda: sns.list_subscriptions_by_topic(TopicArn=t["TopicArn"])["Subscriptions"], [])]}})
    for s in safe("kinesis", lambda: kin.list_streams()["StreamNames"], []):
        d = kin.describe_stream_summary(StreamName=s)["StreamDescriptionSummary"]
        shards = d["OpenShardCount"]
        cid = slug(s, "stream-")
        REF[f"kinesis:{s}"] = cid
        REF[f"kinesis-arn:{d['StreamARN']}"] = cid
        add({"id": cid, "name": s, "kind": "stream", "service": "kinesis", "stateful": True, "stack": stack_of(None, s),
             "capacity": {"shards": sm(shards, "count")},
             "usage": usage(incoming_bytes_per_s=series("AWS/Kinesis", "IncomingBytes", {"StreamName": s}, "bytes_per_second", "Sum", 1 / 3600),
                            incoming_records=series("AWS/Kinesis", "IncomingRecords", {"StreamName": s}, "count", "Sum")),
             "security": {"encryption_at_rest": d.get("EncryptionType", "NONE") != "NONE"},
             "cost": cost(shards * 0.015 * HOURS, f"{shards} shards x 0.015 USD/shard-h x {HOURS} h (PUT payload units excluded)"),
             "config": {"mode": d.get("StreamModeDetails", {}).get("StreamMode"), "retention_hours": d.get("RetentionPeriodHours")}})
    for s in safe("firehose", lambda: fh.list_delivery_streams()["DeliveryStreamNames"], []):
        d = fh.describe_delivery_stream(DeliveryStreamName=s)["DeliveryStreamDescription"]
        dest = (d.get("Destinations") or [{}])[0]
        s3d = dest.get("ExtendedS3DestinationDescription") or dest.get("S3DestinationDescription") or {}
        src = (d.get("Source") or {}).get("KinesisStreamSourceDescription", {}).get("KinesisStreamARN")
        cid = slug(s, "fh-")
        REF[f"firehose:{s}"] = cid
        add({"id": cid, "name": s, "kind": "stream", "service": "firehose", "stateful": False, "stack": stack_of(None, s),
             "config": {"buffer_seconds": (s3d.get("BufferingHints") or {}).get("IntervalInSeconds"),
                        "buffer_mb": (s3d.get("BufferingHints") or {}).get("SizeInMBs"),
                        "compression": s3d.get("CompressionFormat"), "prefix": s3d.get("Prefix") or "(none)",
                        "source_stream": src, "destination_bucket": (s3d.get("BucketARN") or "").split(":::")[-1]}})
        REF[f"firehose-src:{s}"], REF[f"firehose-dst:{s}"] = src, (s3d.get("BucketARN") or "").split(":::")[-1]


def x_lambda():
    for f in safe("lambda", lambda: lam.list_functions()["Functions"], []):
        n, env = f["FunctionName"], (f.get("Environment") or {}).get("Variables", {})
        dims = {"FunctionName": n}
        vpc = f.get("VpcConfig") or {}
        cid = slug(n, "fn-")
        REF[f"lambda:{n}"] = cid
        REF[f"lambda-arn:{f['FunctionArn']}"] = cid
        REF[f"lambda-env:{cid}"] = env
        mem = f["MemorySize"] / 1024
        add({"id": cid, "name": n, "kind": "function", "service": "lambda", "stateful": False, "stack": stack_of(None, n),
             "engine": {"name": "lambda-runtime", "version": f["Runtime"]},
             "capacity": {"memory_gb": sm(mem, "GB"), "timeout_s": sm(f["Timeout"], "s")},
             "usage": usage(invocations=series("AWS/Lambda", "Invocations", dims, "count", "Sum"),
                            duration_ms=series("AWS/Lambda", "Duration", dims, "ms"),
                            errors=series("AWS/Lambda", "Errors", dims, "count", "Sum")),
             "security": {"plaintext_secrets_suspected": any(SECRET_RE.search(k) and v for k, v in env.items()),
                          "admin_privileges": role_is_admin(f.get("Role")), "public_exposure": "vpc_only" if vpc.get("SubnetIds") else "unknown",
                          "world_open_ports": world_ports(vpc.get("SecurityGroupIds"))},
             "config": {"vpc_attached": bool(vpc.get("SubnetIds")), "vpc_subnets": len(vpc.get("SubnetIds") or []),
                        "dead_letter_config": bool(f.get("DeadLetterConfig")), "tracing": (f.get("TracingConfig") or {}).get("Mode"),
                        "reserved_concurrency": None}})


def x_network_edge():
    for lb in safe("elbv2", lambda: elb.describe_load_balancers()["LoadBalancers"], []):
        n, arn = lb["LoadBalancerName"], lb["LoadBalancerArn"]
        suffix = arn.split("loadbalancer/")[1]
        dims = {"LoadBalancer": suffix}
        attrs = {a["Key"]: a["Value"] for a in safe(f"lb attrs {n}", lambda: elb.describe_load_balancer_attributes(LoadBalancerArn=arn)["Attributes"], [])}
        tgs = safe(f"tgs {n}", lambda: elb.describe_target_groups(LoadBalancerArn=arn)["TargetGroups"], [])
        listeners = safe(f"listeners {n}", lambda: elb.describe_listeners(LoadBalancerArn=arn)["Listeners"], [])
        cid = slug(n, "alb-")
        REF[f"alb-dns:{lb['DNSName']}"] = cid
        for t in tgs:
            REF[f"alb-of-tg:{t['TargetGroupArn']}"] = cid
        tga = {}
        for t in tgs:
            tga = {a["Key"]: a["Value"] for a in safe("tg attrs", lambda: elb.describe_target_group_attributes(TargetGroupArn=t["TargetGroupArn"])["Attributes"], [])}
        add({"id": cid, "name": n, "kind": "load_balancer", "service": "alb", "stateful": False, "stack": stack_of(VPCNAME.get(lb.get("VpcId")), n),
             "zones": len(lb.get("AvailabilityZones", [])) or None,
             "usage": usage(requests=series("AWS/ApplicationELB", "RequestCount", dims, "count", "Sum"),
                            target_5xx=series("AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", dims, "count", "Sum"),
                            response_time_s=series("AWS/ApplicationELB", "TargetResponseTime", dims, "s")),
             "security": {"public_exposure": "internet" if lb.get("Scheme") == "internet-facing" else "vpc_only",
                          "world_open_ports": world_ports(lb.get("SecurityGroups")),
                          "encryption_in_transit": any(l["Protocol"] in ("HTTPS", "TLS") for l in listeners) if listeners else None},
             "cost": cost(0.0225 * HOURS, f"ALB 0.0225 USD/h x {HOURS} h (LCU charges excluded)"),
             "config": {"listeners": [f"{l['Protocol']}:{l['Port']}" for l in listeners],
                        "idle_timeout_s": int(attrs.get("idle_timeout.timeout_seconds", 0)) or None,
                        "access_logs_enabled": attrs.get("access_logs.s3.enabled") == "true",
                        "deletion_protection": attrs.get("deletion_protection.enabled") == "true",
                        "health_check_interval_s": tgs[0]["HealthCheckIntervalSeconds"] if tgs else None,
                        "unhealthy_threshold": tgs[0]["UnhealthyThresholdCount"] if tgs else None,
                        "deregistration_delay_s": int(tga.get("deregistration_delay.timeout_seconds", 0)) or None,
                        "registered_targets": sum(len(elb.describe_target_health(TargetGroupArn=t["TargetGroupArn"])["TargetHealthDescriptions"]) for t in tgs)}})
    # NAT gateways, grouped per VPC
    by_vpc = {}
    for n in safe("nat", lambda: ec2.describe_nat_gateways()["NatGateways"], []):
        if n["State"] == "available":
            by_vpc.setdefault(n["VpcId"], []).append(n)
    for vpc, ns in by_vpc.items():
        vn = VPCNAME.get(vpc, vpc)
        bytes_out = [series("AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": n["NatGatewayId"]}, "gb_per_hour", scale=1 / 2**30) for n in ns]
        bytes_out = [b for b in bytes_out if b]
        mean = (lambda k: round(statistics.fmean(b[k] for b in bytes_out), 6)) if bytes_out else None  # noqa: E731
        us = {"unit": "gb_per_hour", "window_days": A.window_days, "resolution_seconds": 3600, "provenance": METRIC_PROV,
              "avg": mean("avg"), "p95": mean("p95"), "max": max(b["max"] for b in bytes_out),
              "basis": "CloudWatch AWS/NATGateway BytesOutToDestination per gateway, averaged across gateways"} if bytes_out else None
        cid = slug(vn, "nat-")
        add({"id": cid, "name": f"{len(ns)} NAT gateway(s) in {vn}", "kind": "nat", "service": "nat-gateway", "quantity": len(ns), "stateful": False,
             "stack": stack_of(vn), "zones": len({n["SubnetId"] and SUBNET_AZ.get(n["SubnetId"]) for n in ns}),
             "usage": usage(bytes_out=us), "cost": cost(0.045 * HOURS * len(ns), f"0.045 USD/h x {HOURS} h x {len(ns)} (data processing charges excluded)")})
    # orphan volumes + EIPs
    orphans = [v for v in safe("volumes", lambda: ec2.describe_volumes()["Volumes"], []) if not v.get("Attachments")]
    groups = {}
    for v in orphans:
        groups.setdefault((v["Size"], v["VolumeType"], v.get("Encrypted")), []).append(v)
    for (size, vt, encd), vs in groups.items():
        add({"id": slug(f"orphan-{vt}-{size}gb", "vol-"), "name": f"{len(vs)} unattached {vt} volume(s) of {size} GB", "kind": "block_storage",
             "service": "ebs", "sku": vt, "quantity": len(vs), "status": "orphan", "stateful": True, "zones": 1,
             "capacity": {"storage_gb": sm(size, "GB")}, "security": {"encryption_at_rest": encd},
             "cost": cost(size * len(vs) * (0.115 if vt == "gp2" else 0.08), f"{vt} {0.115 if vt == 'gp2' else 0.08} USD/GB-mo x {size} GB x {len(vs)}"),
             "config": {"volume_ids": [v["VolumeId"] for v in vs], "state": vs[0]["State"]}})
    eips = [a for a in safe("addresses", lambda: ec2.describe_addresses()["Addresses"], []) if "AssociationId" not in a and "InstanceId" not in a]
    if eips:
        add({"id": "eip-unassociated", "name": f"{len(eips)} unassociated Elastic IP(s)", "kind": "other", "service": "ec2-eip",
             "quantity": len(eips), "status": "orphan", "stateful": False,
             "cost": cost(0.005 * HOURS * len(eips), f"idle EIP 0.005 USD/h x {HOURS} h x {len(eips)}"), "config": {"public_ips": [a.get("PublicIp") for a in eips]}})
    # DNS
    for z in safe("route53", lambda: r53.list_hosted_zones()["HostedZones"], []):
        recs = safe("rrs", lambda: r53.list_resource_record_sets(HostedZoneId=z["Id"])["ResourceRecordSets"], [])
        cn = [r for r in recs if r["Type"] in ("CNAME", "A") and r.get("ResourceRecords")]
        cid = slug(z["Name"].rstrip("."), "dns-")
        add({"id": cid, "name": z["Name"].rstrip("."), "kind": "dns", "service": "route53", "stateful": False, "stack": stack_of(None, "www." + z["Name"]),
             "config": {"records": [{"name": r["Name"].rstrip("."), "type": r["Type"], "ttl": r.get("TTL"), "target": r["ResourceRecords"][0]["Value"]} for r in cn],
                        "health_checks": any("HealthCheckId" in r for r in recs)}})
        for r in cn:
            REF[f"dns:{cid}:{r['ResourceRecords'][0]['Value']}"] = cid
    # EventBridge rules and registry
    for r in safe("events", lambda: ev.list_rules()["Rules"], []):
        cid = slug(r["Name"], "rule-")
        REF[f"rule:{r['Name']}"] = cid
        add({"id": cid, "name": r["Name"], "kind": "other", "service": "eventbridge-rule", "stateful": False, "stack": stack_of(None, r["Name"]),
             "config": {"schedule": r.get("ScheduleExpression"), "state": r.get("State")}})
    repos = safe("ecr", lambda: ecr.describe_repositories()["repositories"], [])
    if repos:
        add({"id": "ecr-repositories", "name": f"{len(repos)} ECR repositories", "kind": "other", "service": "ecr", "quantity": len(repos), "stateful": True,
             "config": {"repositories": [{"name": r["repositoryName"], "mutable_tags": r.get("imageTagMutability") == "MUTABLE",
                                          "scan_on_push": (r.get("imageScanningConfiguration") or {}).get("scanOnPush")} for r in repos]}})


# ---------------------------------------------------------------- edges (API-derived only)
def build_edges():
    # DNS -> ALB
    for c in COMP:
        if c["kind"] == "dns":
            for r in c["config"].get("records", []):
                alb = REF.get(f"alb-dns:{r['target']}")
                edge(c["id"], alb, "dns", note=f"{r['type']} {r['name']}, TTL {r.get('ttl')}")
    # ALB -> backends via target groups (ASG attachment or ECS service load balancer)
    for key, backend in list(REF.items()):
        if key.startswith("tg:"):
            edge(REF.get("alb-of-tg:" + key[3:]), backend, "traffic", note="target group")
    # env-var references: DB host:port, queue URL, bucket name
    for key, env in [(k, v) for k, v in REF.items() if k.startswith(("lambda-env:", "ecs-env:"))]:
        src = key.split(":", 1)[1]
        for var, val in env.items():
            if not isinstance(val, str) or not val:
                continue
            tgt = REF.get(f"rds-ep:{val}")
            if tgt:
                edge(src, tgt, "data", note=f"env {var}={val}")
            q = REF.get(f"sqs:{val}")
            if q:
                edge(src, q, "event", note=f"env {var}")
            b = REF.get(f"s3:{val}")
            if b:
                edge(src, b, "data", note=f"env {var}")
    # SQS -> Lambda mappings, SNS -> SQS, S3 notifications, rules -> targets, Kinesis -> Firehose -> S3
    for m in safe("event source mappings", lambda: lam.list_event_source_mappings()["EventSourceMappings"], []):
        edge(REF.get(f"sqs-arn:{m['EventSourceArn']}"), REF.get(f"lambda-arn:{m['FunctionArn']}"), "event",
             note=f"event source mapping, batch size {m.get('BatchSize')}")
    for t in [k for k in REF if k.startswith("sns:")]:
        for s in safe("sns subs", lambda: sns.list_subscriptions_by_topic(TopicArn=t[4:])["Subscriptions"], []):
            if s["Protocol"] == "sqs":
                edge(REF[t], REF.get(f"sqs-arn:{s['Endpoint']}"), "event", note="SNS subscription")
    for k, cid in list(REF.items()):
        if k.startswith("s3:") and not k.startswith("s3://"):
            conf = safe(f"s3 notif {k}", lambda: s3.get_bucket_notification_configuration(Bucket=k[3:]), {})
            for lc in conf.get("LambdaFunctionConfigurations", []):
                edge(cid, REF.get(f"lambda-arn:{lc['LambdaFunctionArn']}"), "event", note="S3 event notification " + ",".join(lc["Events"]))
    for k, cid in list(REF.items()):
        if k.startswith("rule:"):
            for t in safe("rule targets", lambda: ev.list_targets_by_rule(Rule=k[5:])["Targets"], []):
                edge(cid, REF.get(f"lambda-arn:{t['Arn']}"), "event", note="EventBridge target")
    for k, cid in list(REF.items()):
        if k.startswith("firehose:"):
            n = k[9:]
            edge(REF.get(f"kinesis-arn:{REF.get(f'firehose-src:{n}')}"), cid, "data", note="Kinesis source")
            edge(cid, REF.get(f"s3:{REF.get(f'firehose-dst:{n}')}"), "data", note="Firehose S3 destination")


def derive_status():
    """idle/orphan from API facts + the metrics just read. Orphan = nothing references it; idle = referenced but ~no load."""
    inbound = {e["to"] for e in EDGES}
    outbound = {e["from"] for e in EDGES}
    for c in COMP:
        if c["status"] == "orphan":
            continue
        u = c.get("usage", {})
        conns = u.get("connections", {}).get("avg")
        cpu = u.get("cpu_pct", {}).get("avg")
        gpu = u.get("gpu_pct", {}).get("avg")
        if c["kind"] in ("postgres", "cache") and conns is not None and conns < 2:
            c["status"] = "orphan" if c["id"] not in inbound else "idle"
        elif c["kind"] == "cache" and c["service"] == "elasticache-memcached" and c["id"] not in inbound:
            c["status"] = "orphan" if (conns or 0) < 2 else "idle"
        elif c["kind"] == "nat" and u.get("bytes_out", {}).get("avg", 1) < 0.001:
            c["status"] = "idle"
        elif c["kind"] in ("virtual_machine", "node_group") and c["service"] != "ec2-autoscaling" and cpu is not None and cpu < 3:
            c["status"] = "idle"
        elif c["kind"] == "node_group" and gpu is not None and gpu < 5:
            c["status"] = "idle"
        elif c["kind"] == "queue" and c["service"] == "sqs":
            traffic = (u.get("messages_sent", {}).get("avg") or 0) + (u.get("messages_received", {}).get("avg") or 0)
            if traffic < 1 and c["id"] not in outbound and c["id"] not in inbound:
                c["status"] = "idle"


def controls():
    def flag(label, fn):
        return safe(label, fn)
    ct = cl("cloudtrail")
    return {
        "audit_logging_enabled": flag("cloudtrail", lambda: bool(ct.describe_trails()["trailList"])),
        "threat_detection_enabled": flag("guardduty", lambda: bool(cl("guardduty").list_detectors()["DetectorIds"])),
        "config_recording_enabled": flag("config", lambda: bool(cl("config").describe_configuration_recorders()["ConfigurationRecorders"])),
        "backup_plans_exist": flag("backup", lambda: bool(cl("backup").list_backup_plans()["BackupPlansList"])),
        "vpc_flow_logs_enabled": flag("flow logs", lambda: bool(ec2.describe_flow_logs()["FlowLogs"])),
        "mfa_enforced": flag("mfa", lambda: all(iam.list_mfa_devices(UserName=u["UserName"])["MFADevices"] for u in iam.list_users()["Users"]) if iam.list_users()["Users"] else None),
    }


def main():
    load_network()
    for fn in (x_eks, x_ecs, x_ec2_asg, x_rds, x_cache, x_dynamo, x_s3, x_efs, x_messaging, x_lambda, x_network_edge):
        safe(fn.__name__, fn)
    build_edges()
    derive_status()
    used_stacks = sorted({c["stack"] for c in COMP if c.get("stack")})
    meta = {"shop": ("Shop", "unknown"), "data": ("Data platform", "unknown"), "legacy": ("Legacy", "unknown"), "dev": ("Dev sandbox", "dev")}
    doc = {
        "schema_version": "1.0", "project": A.project,
        "source": {"extractor": "infrared-floci-extractor", "extractor_version": "0.1", "generated_at": NOW.isoformat(timespec="seconds").replace("+00:00", "Z"),
                   "endpoint": A.endpoint, "regions_scanned": [A.region], "is_mock": False,
                   "notes": ("Extracted from a live Floci emulator. Config fields are observed. Usage series are SYNTHETIC (Floci has no telemetry; they are injected by synth/metrics.py). "
                             "Costs are ESTIMATES from approximate list prices. Stacks are derived from VPC/name prefixes (no tags exist). "
                             "features_used is omitted: Postgres extensions are not visible through the RDS API. Edges are declared by configuration only (no flow logs). "
                             "The extractor never read ground_truth/.")},
        "stacks": [{"id": s, "name": meta.get(s, (s, "unknown"))[0], "environment": meta.get(s, (s, "unknown"))[1],
                    "description": "Derived from VPC membership and name prefix."} for s in used_stacks],
        "controls": controls(), "components": COMP, "edges": EDGES, "x_extraction_warnings": WARN,
    }
    out = Path(A.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2) + "\n")
    kinds = {}
    for c in COMP:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    st = {s: sum(1 for c in COMP if c["status"] == s) for s in ("active", "idle", "orphan")}
    print(f"wrote {out}\n  {len(COMP)} components {dict(sorted(kinds.items()))}\n  {len(EDGES)} edges, status {st}\n  {len(WARN)} warnings")
    for w in WARN[:15]:
        print("   -", w)


if __name__ == "__main__":
    main()
