from extractor.domain.components.kubernetes import has_gpus, kubernetes_cluster, node_group, nodegroup_sku


def extract_eks(context):
    eks, series, slugs, inventory = context.aws.eks, context.series, context.slugs, context.inventory
    for name in context.eks_cluster_names:
        cluster = eks.cluster(name)
        cluster_id = slugs.make(name, "eks-")
        cpu = series.read("ContainerInsights", "node_cpu_utilization", {"ClusterName": name}, "percent")
        memory = series.read("ContainerInsights", "node_memory_utilization", {"ClusterName": name}, "percent")
        nodegroups = eks.nodegroups(name)
        inventory.add(kubernetes_cluster(cluster_id, name, cluster, nodegroups, context.network, cpu, memory))
        for nodegroup in nodegroups:
            gpu = series.read("ContainerInsights", "node_gpu_utilization", {"ClusterName": name}, "percent") \
                if has_gpus(nodegroup_sku(nodegroup)) else None
            group_id = slugs.make(f"{name}-{nodegroup['nodegroupName']}", "ng-")
            inventory.add(node_group(group_id, cluster_id, name, cluster, nodegroup, context.network, cpu, memory, gpu))
