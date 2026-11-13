"""EKS / ECS clusters, EC2, ASG, ALB. Oversized, fixed-size, unhealthy-by-design."""
from .common import client, attempt, plant, link

eks = client("eks")
ecs = client("ecs")
ec2 = client("ec2")
elb = client("elbv2")
asg = client("autoscaling")
ecr = client("ecr")


def eks_cluster(stack, name, version, subnets, sg, ctx, nodegroups, public=True, fargate=False):
    if not attempt(f"eks {name}", eks.create_cluster, name=name, version=version,
            roleArn=ctx["eks_cluster_role"],
            resourcesVpcConfig={"subnetIds": subnets, "securityGroupIds": [sg],
                                "endpointPublicAccess": public, "endpointPrivateAccess": False},
            logging={"clusterLogging": [{"types": ["api", "audit", "authenticator", "controllerManager", "scheduler"], "enabled": False}]}):
        return
    link(name, subnets[0], "network", "cluster VPC config / nodegroups in this subnet only")
    link(name, sg, "network", "cluster security group")
    plant(stack, "eks", name, f"Kubernetes {version} is out of standard support (extended support surcharge ~$0.60/hr)", "cost", "high")
    plant(stack, "eks", name, "API endpoint public with 0.0.0.0/0, private access disabled", "security", "high")
    plant(stack, "eks", name, "Control-plane logging fully disabled (api/audit/authenticator...)", "ops", "medium")
    plant(stack, "eks", name, "No KMS envelope encryption for Kubernetes secrets", "security", "medium")
    for ng, (itype, n, disk, cap) in nodegroups.items():
        if not attempt(f"nodegroup {name}/{ng}", eks.create_nodegroup, clusterName=name, nodegroupName=ng,
                subnets=subnets[:1], nodeRole=ctx["eks_node_role"], instanceTypes=[itype],
                scalingConfig={"minSize": n, "maxSize": n, "desiredSize": n}, diskSize=disk,
                amiType="AL2_x86_64", capacityType=cap):
            continue
        plant(stack, "eks", f"{name}/{ng}", f"Nodegroup {n}x {itype} pinned min=max=desired; no Cluster Autoscaler/Karpenter headroom, {disk}GB disks", "cost", "high")
        plant(stack, "eks", f"{name}/{ng}", "Single subnet / single AZ nodegroup", "reliability", "high")
        plant(stack, "eks", f"{name}/{ng}", "AL2 AMI (EOL) and on-demand only - no Spot or Graviton for stateless work", "cost", "medium")
    if fargate:
        attempt(f"fargate {name}", eks.create_fargate_profile, fargateProfileName="default", clusterName=name,
                podExecutionRoleArn=ctx["eks_node_role"], subnets=subnets[:1], selectors=[{"namespace": "default"}])


def ecs_cluster(stack, name, services, ctx, tg=None):
    if not attempt(f"ecs {name}", ecs.create_cluster, clusterName=name,
                   settings=[{"name": "containerInsights", "value": "disabled"}]):
        return
    plant(stack, "ecs", name, "Container Insights disabled - no CPU/mem/network metrics per task", "ops", "medium")
    for svc, (cpu, mem, count, image) in services.items():
        if not attempt(f"taskdef {svc}", ecs.register_task_definition, family=svc, networkMode="awsvpc",
                requiresCompatibilities=["FARGATE"], cpu=str(cpu), memory=str(mem),
                taskRoleArn=ctx["ecs_task_role"], executionRoleArn=ctx["ecs_task_role"],
                containerDefinitions=[{
                    "name": svc, "image": image, "essential": True, "privileged": False,
                    "user": "root", "portMappings": [{"containerPort": 8080}],
                    "environment": [{"name": "DB_HOST", "value": ctx["db"].get("legacy-erp-db", "")},
                                    {"name": "JOBS_QUEUE_URL", "value": ctx["queues"].get("legacy-jobs", "")},
                                    {"name": "REPORT_BUCKET", "value": "legacy-reports"},
                                    {"name": "DB_PASSWORD", "value": "Summer2019!"},
                                    {"name": "AWS_SECRET_ACCESS_KEY", "value": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"},
                                    {"name": "LOG_LEVEL", "value": "DEBUG"}],
                    # no logConfiguration, no healthCheck, no ulimits
                }]):
            continue
        plant(stack, "ecs", svc, f"Task sized {cpu} CPU / {mem} MiB for a trivial web container (<5% typical use)", "cost", "high")
        plant(stack, "ecs", svc, "Plaintext secrets in container environment; task runs as root", "security", "critical")
        plant(stack, "ecs", svc, f"Image tag is mutable ({image}); no logConfiguration, no container healthCheck", "ops", "medium")
        lb = ([{"targetGroupArn": tg, "containerName": svc, "containerPort": 8080}]
              if tg and svc == "orders-api" else [])
        attempt(f"service {svc}", ecs.create_service, cluster=name, serviceName=svc, taskDefinition=svc,
                desiredCount=count, launchType="FARGATE", loadBalancers=lb,
                networkConfiguration={"awsvpcConfiguration": {"subnets": ctx["legacy_subnets"][:1],
                                                              "securityGroups": [ctx["legacy_sg"]],
                                                              "assignPublicIp": "ENABLED"}},
                deploymentConfiguration={"minimumHealthyPercent": 0, "maximumPercent": 100})
        link(f"{name}/{svc}", "legacy-erp-db", "data", "DB_HOST env var; also has plaintext DB_PASSWORD")
        link(f"{name}/{svc}", "legacy-jobs", "event", "JOBS_QUEUE_URL env var (queue has no consumer)")
        link(f"{name}/{svc}", "legacy-reports", "data", "REPORT_BUCKET env var (public bucket)")
        link(f"{name}/{svc}", ctx["legacy_sg"], "network", "awsvpc SG, public subnet, public IP")
        if lb:
            link("legacy-alb", f"{name}/{svc}", "traffic", "target group -> ECS service orders-api:8080")
        plant(stack, "ecs", svc, f"Fixed desiredCount={count}, no Application Auto Scaling target; minHealthy=0 means deploys cause downtime", "reliability", "high")


def alb(stack, name, vpc, subnets, sg, port=80):
    r = attempt(f"alb {name}", elb.create_load_balancer, Name=name, Subnets=subnets, SecurityGroups=[sg],
                Scheme="internet-facing", Type="application")
    if not r:
        return None, None
    arn = r["LoadBalancers"][0]["LoadBalancerArn"]
    dns = r["LoadBalancers"][0].get("DNSName", f"{name}.elb.local")
    link(name, vpc, "network", "internet-facing, public subnets")
    link(name, sg, "network", "ALB security group")
    tg = attempt(f"tg {name}", elb.create_target_group, Name=f"{name}-tg", Protocol="HTTP", Port=port, VpcId=vpc,
                 HealthCheckPath="/", HealthCheckIntervalSeconds=300, HealthCheckTimeoutSeconds=60,
                 HealthyThresholdCount=10, UnhealthyThresholdCount=10, TargetType="ip")
    tgarn = tg["TargetGroups"][0]["TargetGroupArn"] if tg else None
    attempt(f"listener {name}", elb.create_listener, LoadBalancerArn=arn, Protocol="HTTP", Port=80,
            DefaultActions=[{"Type": "forward", "TargetGroupArn": tgarn}])
    attempt(f"alb attrs {name}", elb.modify_load_balancer_attributes, LoadBalancerArn=arn, Attributes=[
        {"Key": "idle_timeout.timeout_seconds", "Value": "4000"},
        {"Key": "access_logs.s3.enabled", "Value": "false"},
        {"Key": "deletion_protection.enabled", "Value": "false"}])
    if tgarn:
        attempt(f"tg attrs {name}", elb.modify_target_group_attributes, TargetGroupArn=tgarn,
                Attributes=[{"Key": "deregistration_delay.timeout_seconds", "Value": "3600"}])
    plant(stack, "elbv2", name, "HTTP-only listener on :80, no HTTPS/redirect, no WAF", "security", "high")
    plant(stack, "elbv2", name, "Health check every 300s, 10 failures to mark unhealthy (~50 min to eject a dead target)", "reliability", "high")
    plant(stack, "elbv2", name, "Deregistration delay 3600s makes deploys/scale-in glacial; idle timeout 4000s", "performance", "medium")
    plant(stack, "elbv2", name, "Access logs disabled, deletion protection off", "ops", "low")
    return tgarn, dns


def ec2_fleet(ctx):
    specs = [
        ("shop-bastion", "m5.4xlarge", "shop_subnets", "ssh_sg", "shop-prod", "Bastion is m5.4xlarge with public IP, SSH open to world, used ~1h/week"),
        ("shop-legacy-batch", "c5.9xlarge", "shop_subnets", "shop_sg", "shop-prod", "c5.9xlarge running 24/7 for a nightly 10-minute cron job"),
        ("dev-jumpbox-1", "r5.2xlarge", "dev_subnets", "shop_sg", "dev", "Forgotten dev instance, r5.2xlarge, ~0% CPU"),
        ("dev-jumpbox-2", "r5.2xlarge", "dev_subnets", "shop_sg", "dev", "Forgotten dev instance, r5.2xlarge, ~0% CPU"),
        ("old-etl-worker", "m4.2xlarge", "data_subnets", "data_sg", "data-platform", "Previous-generation m4 instance (worse price/perf than m6i/m7g)")]
    for name, itype, sn, sgk, stack, issue in specs:
        if not attempt(f"ec2 {name}", ec2.run_instances, ImageId="ami-0abcdef1234567890", InstanceType=itype,
                MinCount=1, MaxCount=1, SubnetId=ctx[sn][0], SecurityGroupIds=[ctx[sgk]],
                TagSpecifications=[{"ResourceType": "instance", "Tags": [{"Key": "Name", "Value": name}]}],
                BlockDeviceMappings=[{"DeviceName": "/dev/xvda", "Ebs": {"VolumeSize": 500, "VolumeType": "gp2", "Encrypted": False}}],
                Monitoring={"Enabled": False}, MetadataOptions={"HttpTokens": "optional"}):
            continue
        plant(stack, "ec2", name, issue, "cost", "high")
        plant(stack, "ec2", name, "IMDSv1 enabled (HttpTokens=optional), 500GB unencrypted gp2 root, no detailed monitoring, only a Name tag", "security", "medium")

    for i in range(6):
        attempt(f"orphan vol {i}", ec2.create_volume, AvailabilityZone="us-east-1a", Size=1000, VolumeType="gp2")
    plant("shared", "ec2", "6x 1000GB gp2 volumes", "Unattached EBS volumes (~$600/mo), gp2 instead of gp3, unencrypted", "cost", "high")
    for i in range(5):
        attempt(f"orphan eip {i}", ec2.allocate_address, Domain="vpc")
    plant("shared", "ec2", "5 Elastic IPs", "Unassociated Elastic IPs billed hourly", "cost", "low")

    attempt("launch template", ec2.create_launch_template, LaunchTemplateName="web-lt",
            LaunchTemplateData={"ImageId": "ami-0abcdef1234567890", "InstanceType": "m5.8xlarge",
                                "SecurityGroupIds": [ctx["shop_sg"]]})
    if attempt("asg web", asg.create_auto_scaling_group, AutoScalingGroupName="web-asg",
            LaunchTemplate={"LaunchTemplateName": "web-lt", "Version": "$Latest"},
            MinSize=8, MaxSize=8, DesiredCapacity=8, VPCZoneIdentifier=ctx["shop_subnets"][0],
            HealthCheckType="EC2", HealthCheckGracePeriod=3600,
            TargetGroupARNs=[ctx["shop_tg"]] if ctx.get("shop_tg") else []):
        link("shop-alb", "web-asg", "traffic", "ASG attached to ALB target group (port 80)")
        plant("shop-prod", "autoscaling", "web-asg", "8x m5.8xlarge, min=max=desired (no scaling), single subnet, EC2-only health checks, 1h grace period, no scaling policies", "cost", "high")


def build(ctx):
    # stack 1: shop-prod -- prod plus a full-size staging clone
    eks_cluster("shop-prod", "shop-prod", "1.28", ctx["shop_subnets"], ctx["shop_sg"], ctx,
                {"general": ("m5.8xlarge", 12, 500, "ON_DEMAND"), "cpu-heavy": ("c5.12xlarge", 6, 500, "ON_DEMAND")})
    eks_cluster("shop-prod", "shop-staging", "1.28", ctx["shop_subnets"], ctx["shop_sg"], ctx,
                {"general": ("m5.8xlarge", 12, 500, "ON_DEMAND")})
    plant("shop-prod", "eks", "shop-staging", "Staging is a full-size clone of prod running 24/7 with idle workloads", "cost", "high")
    # stack 2: data-platform
    eks_cluster("data-platform", "data-platform", "1.29", ctx["data_subnets"], ctx["data_sg"], ctx,
                {"spark": ("r5.16xlarge", 10, 1000, "ON_DEMAND"), "gpu-ml": ("p3.8xlarge", 4, 500, "ON_DEMAND")},
                fargate=True)
    plant("data-platform", "eks", "data-platform/gpu-ml", "4x p3.8xlarge GPU nodes (~$49/hr) always on; ML jobs run a few hrs/week", "cost", "critical")
    eks_cluster("data-platform", "ml-experiments", "1.28", ctx["data_subnets"], ctx["data_sg"], ctx,
                {"scratch": ("m5.24xlarge", 6, 800, "ON_DEMAND")})
    # stack 3: legacy ECS
    ctx["shop_tg"], ctx["shop_alb_dns"] = alb("shop-prod", "shop-alb", ctx["shop_vpc"], ctx["shop_subnets"], ctx["shop_sg"])
    ctx["legacy_tg"], ctx["legacy_alb_dns"] = alb("legacy", "legacy-alb", ctx["legacy_vpc"], ctx["legacy_subnets"], ctx["legacy_sg"], port=8080)
    ecs_cluster("legacy", "legacy-ecs", {
        "orders-api": (4096, 16384, 8, "nginx:latest"),
        "invoice-worker": (4096, 30720, 5, "nginx:latest"),
        "admin-portal": (2048, 8192, 4, "nginx:latest"),
        "report-gen": (4096, 16384, 3, "nginx:latest")}, ctx, tg=ctx["legacy_tg"])
    ecs_cluster("legacy", "legacy-ecs-ec2", {}, ctx)
    plant("legacy", "ecs", "legacy-ecs-ec2", "Empty cluster left behind, no capacity provider", "ops", "low")
    for repo in ("shop-web", "shop-api", "legacy-orders"):
        attempt(f"ecr {repo}", ecr.create_repository, repositoryName=repo, imageTagMutability="MUTABLE",
                imageScanningConfiguration={"scanOnPush": False})
    plant("shared", "ecr", "shop-web,shop-api,legacy-orders", "Mutable tags, no scan-on-push, no lifecycle policy (images accumulate)", "security", "medium")
    ec2_fleet(ctx)
