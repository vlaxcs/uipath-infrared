from extractor.application.role_privileges import role_is_admin
from extractor.domain.components.fargate_service import fargate_service, task_environment


def extract_ecs(context):
    ecs, series, refs = context.aws.ecs, context.series, context.references
    cluster_names = context.warnings.guard("ecs list_clusters", ecs.cluster_names, [])
    clusters = ecs.clusters_with_settings(cluster_names)
    for cluster_name in cluster_names:
        for service in ecs.services(cluster_name):
            task_definition = ecs.task_definition(service["taskDefinition"])
            component_id = context.slugs.make(f"{cluster_name}-{service['serviceName']}", "svc-")
            for balancer in service.get("loadBalancers", []):
                refs.target_group_backends.setdefault(balancer["targetGroupArn"], component_id)
            refs.environments[component_id] = task_environment(task_definition)
            dimensions = {"ClusterName": cluster_name, "ServiceName": service["serviceName"]}
            cpu = series.read("AWS/ECS", "CPUUtilization", dimensions, "percent")
            memory = series.read("AWS/ECS", "MemoryUtilization", dimensions, "percent")
            admin = role_is_admin(context, task_definition.get("taskRoleArn"))
            context.inventory.add(fargate_service(component_id, cluster_name, service, task_definition, clusters[cluster_name],
                                                  context.network, cpu, memory, admin))
