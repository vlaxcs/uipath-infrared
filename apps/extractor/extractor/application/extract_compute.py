from extractor.domain.components.autoscaling_group import autoscaling_group
from extractor.domain.components.instance import backed_eks_cluster, instance_name, is_gone, instance_volume_ids, standalone_instance


def extract_autoscaling_groups(context):
    api, series, refs = context.aws.autoscaling, context.series, context.references
    groups = context.warnings.guard("asg", api.groups, [])
    policies = context.warnings.guard("asg policies", api.policies_by_group, {}) if groups else {}
    backing = set()
    for group in groups:
        name = group["AutoScalingGroupName"]
        component_id = context.slugs.make(name, "asg-")
        for arn in group.get("TargetGroupARNs", []):
            refs.target_group_backends.setdefault(arn, component_id)
        cpu = series.read("AWS/EC2", "CPUUtilization", {"AutoScalingGroupName": name}, "percent")
        context.inventory.add(autoscaling_group(component_id, group, policies.get(name, []), context.network, cpu))
        backing |= {i["InstanceId"] for i in group["Instances"]}
    return backing


def extract_instances(context, backing):
    sizes = {v["VolumeId"]: v["Size"] for v in context.volumes}
    clusters = set(context.eks_cluster_names)
    instances = context.warnings.guard("describe_instances", context.aws.ec2.instances, [])
    gone = [instance_name(i) for i in instances if is_gone(i)]
    if gone:
        context.warnings.note(f"skipped {len(gone)} terminated or shutting-down EC2 instance(s): {', '.join(sorted(gone))}")
    for instance in [i for i in instances if not is_gone(i)]:
        name = instance_name(instance)
        if instance["InstanceId"] in backing:
            continue
        cluster = backed_eks_cluster(name, clusters)
        if cluster:
            context.warnings.note(f"skipped {name}: Floci-created node backing EKS cluster '{cluster}' (not a user instance)")
            continue
        volume_sizes = [sizes[v] for v in instance_volume_ids(instance) if v in sizes]
        component_id = context.slugs.make(name, "vm-")
        cpu = context.series.read("AWS/EC2", "CPUUtilization", {"InstanceId": instance["InstanceId"]}, "percent")
        context.inventory.add(standalone_instance(component_id, instance, volume_sizes, context.network, cpu))


def extract_compute(context):
    extract_instances(context, extract_autoscaling_groups(context))
