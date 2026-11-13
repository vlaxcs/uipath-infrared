from extractor.domain.cost_estimate import instance_hours_cost, monthly_cost
from extractor.domain.instance_capacity import instance_capacity
from extractor.domain.instance_specs import HOURS_PER_MONTH, INSTANCE_SPECS
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

GP2_USD_PER_GB_MONTH = 0.115
DEFAULT_DATABASE = "postgres"
EXTENSIONS_NOTE = "not extractable via the RDS API; needs SQL access (pg_extension) -> features_used omitted"


def database_login(instance):
    return {"endpoint": endpoint_address(instance), "user": instance.get("MasterUsername"),
            "database": instance.get("DBName") or DEFAULT_DATABASE}


def endpoint_address(instance):
    endpoint = instance.get("Endpoint") or {}
    return f"{endpoint.get('Address')}:{endpoint.get('Port')}" if endpoint else None


def security_group_ids(described):
    return [g["VpcSecurityGroupId"] for g in described.get("VpcSecurityGroups", [])]


def cluster_member_ids(clusters):
    return {m["DBInstanceIdentifier"] for c in clusters for m in c.get("DBClusterMembers", [])}


def database_usage(cpu, connections, read_iops, write_iops):
    return present(cpu_pct=cpu, connections=connections, read_iops=read_iops, write_iops=write_iops)


def database_capacity(instance):
    capacity = instance_capacity(instance["DBInstanceClass"])
    if instance.get("AllocatedStorage"):
        capacity["storage_gb"] = point_metric(instance["AllocatedStorage"], "GB")
    return capacity


def used_storage(instance, free_storage, metric_provenance):
    allocated = instance.get("AllocatedStorage")
    if not free_storage or not allocated:
        return None
    return point_metric(round(max(0, allocated - free_storage["avg"]), 1), "GB", "estimated",
                        "AllocatedStorage minus average FreeStorageSpace (metric is " + metric_provenance + ")")


def instance_cost(instance):
    sku, storage = instance["DBInstanceClass"], instance.get("AllocatedStorage", 0)
    if sku not in INSTANCE_SPECS:
        return None
    price = INSTANCE_SPECS[sku][3]
    return monthly_cost(price * HOURS_PER_MONTH + GP2_USD_PER_GB_MONTH * storage,
                        f"{sku} {price} USD/h x {HOURS_PER_MONTH} h + gp2 0.115 USD/GB-mo x {instance.get('AllocatedStorage')} GB")


def rds_instance(component_id, instance, network, usage, free_storage, metric_provenance):
    identifier = instance["DBInstanceIdentifier"]
    return {"id": component_id, "name": identifier, "kind": "postgres", "service": "rds", "sku": instance["DBInstanceClass"],
            "stateful": True, "stack": stack_of(None, identifier), "zones": 2 if instance.get("MultiAZ") else 1,
            "engine": {"name": instance["Engine"], "version": instance["EngineVersion"]},
            "data_gb": used_storage(instance, free_storage, metric_provenance), "capacity": database_capacity(instance), "usage": usage,
            "security": {"public_exposure": "internet" if instance.get("PubliclyAccessible") else "vpc_only",
                         "encryption_at_rest": instance.get("StorageEncrypted"), "backup_retention_days": instance.get("BackupRetentionPeriod"),
                         "deletion_protection": instance.get("DeletionProtection"),
                         "world_open_ports": network.world_ports(security_group_ids(instance))},
            "cost": instance_cost(instance),
            "config": {"endpoint": endpoint_address(instance), "storage_type": instance.get("StorageType"), "multi_az": instance.get("MultiAZ"),
                       "performance_insights": instance.get("PerformanceInsightsEnabled"),
                       "auto_minor_upgrade": instance.get("AutoMinorVersionUpgrade"), "extensions": EXTENSIONS_NOTE}}


def aurora_cluster(component_id, cluster, members, first, network, usage):
    sku, quantity = first["DBInstanceClass"], len(members)
    capacity = {k: v for k, v in database_capacity(first).items() if k != "storage_gb"}
    groups = security_group_ids(first) or security_group_ids(cluster)
    return {"id": component_id, "name": cluster["DBClusterIdentifier"], "kind": "postgres", "service": "aurora-postgresql", "sku": sku,
            "quantity": quantity, "stateful": True, "stack": stack_of(None, cluster["DBClusterIdentifier"]), "zones": 1,
            "engine": {"name": cluster["Engine"], "version": cluster.get("EngineVersion")}, "capacity": capacity,
            "usage": usage, "security": {"public_exposure": "internet" if first.get("PubliclyAccessible") else "vpc_only",
                                         "encryption_at_rest": cluster.get("StorageEncrypted"),
                                         "backup_retention_days": cluster.get("BackupRetentionPeriod"),
                                         "deletion_protection": cluster.get("DeletionProtection"),
                                         "world_open_ports": network.world_ports(groups)},
            "cost": instance_hours_cost(sku, quantity),
            "config": {"members": members, "endpoint": endpoint_address(first),
                       "note": "Aurora storage is usage-billed; storage cost not estimated."}}
