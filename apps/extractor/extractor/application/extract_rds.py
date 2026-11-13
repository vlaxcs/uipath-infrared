from extractor.domain.components.postgres import aurora_cluster, cluster_member_ids, database_login, database_usage, endpoint_address, rds_instance


def read_database_usage(series, identifier):
    dimensions = {"DBInstanceIdentifier": identifier}
    free = series.read("AWS/RDS", "FreeStorageSpace", dimensions, "bytes", scale=1 / 2**30)
    usage = database_usage(series.read("AWS/RDS", "CPUUtilization", dimensions, "percent"),
                           series.read("AWS/RDS", "DatabaseConnections", dimensions, "count"),
                           series.read("AWS/RDS", "ReadIOPS", dimensions, "iops"),
                           series.read("AWS/RDS", "WriteIOPS", dimensions, "iops"))
    return free, usage


def extract_rds(context):
    rds, guard, refs = context.aws.rds, context.warnings.guard, context.references
    instances = guard("rds instances", rds.instances, [])
    clusters = guard("rds clusters", rds.clusters, [])
    members = cluster_member_ids(clusters)
    for instance in instances:
        identifier = instance["DBInstanceIdentifier"]
        if identifier in members:
            continue
        free, usage = read_database_usage(context.series, identifier)
        component_id = context.slugs.make(identifier, "rds-")
        refs.database_endpoints[endpoint_address(instance)] = component_id
        refs.database_logins[component_id] = database_login(instance)
        context.inventory.add(rds_instance(component_id, instance, context.network, usage, free, context.metric_provenance))
    for cluster in clusters:
        member_ids = [m["DBInstanceIdentifier"] for m in cluster.get("DBClusterMembers", [])]
        first = next((i for i in instances if i["DBInstanceIdentifier"] in member_ids), None)
        if not first:
            continue
        _, usage = read_database_usage(context.series, first["DBInstanceIdentifier"])
        component_id = context.slugs.make(cluster["DBClusterIdentifier"], "rds-")
        refs.database_endpoints[endpoint_address(first)] = component_id
        refs.database_logins[component_id] = database_login(first)
        context.inventory.add(aurora_cluster(component_id, cluster, member_ids, first, context.network, usage))
