from extractor.domain.cost_estimate import instance_hours_cost
from extractor.domain.instance_capacity import instance_capacity
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of


def cache_dimensions(cluster):
    return {"CacheClusterId": cluster["CacheClusterId"], "CacheNodeId": "0001"}


def cache_cluster(component_id, cluster, cpu, connections, hit_rate, evictions):
    name, sku, quantity = cluster["CacheClusterId"], cluster["CacheNodeType"], cluster.get("NumCacheNodes", 1)
    return {"id": component_id, "name": name, "kind": "cache", "service": f"elasticache-{cluster['Engine']}", "sku": sku,
            "quantity": quantity, "stateful": False, "stack": stack_of(None, name), "zones": 1,
            "engine": {"name": cluster["Engine"], "version": cluster.get("EngineVersion")}, "capacity": instance_capacity(sku),
            "usage": present(cpu_pct=cpu, connections=connections, hit_rate_pct=hit_rate, evictions=evictions),
            "security": {"encryption_in_transit": cluster.get("TransitEncryptionEnabled"),
                         "encryption_at_rest": cluster.get("AtRestEncryptionEnabled"),
                         "backup_retention_days": cluster.get("SnapshotRetentionLimit")},
            "cost": instance_hours_cost(sku, quantity),
            "config": {"replicas": max(0, quantity - 1) if cluster["Engine"] == "redis" else None,
                       "auth_token_enabled": cluster.get("AuthTokenEnabled")}}
