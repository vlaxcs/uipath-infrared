from extractor.domain.components.cache import cache_cluster, cache_dimensions


def extract_cache(context):
    series = context.series
    for cluster in context.warnings.guard("elasticache", context.aws.elasticache.clusters, []):
        dimensions = cache_dimensions(cluster)
        component_id = context.slugs.make(cluster["CacheClusterId"], "cache-")
        context.inventory.add(cache_cluster(component_id, cluster,
                                            series.read("AWS/ElastiCache", "CPUUtilization", dimensions, "percent"),
                                            series.read("AWS/ElastiCache", "CurrConnections", dimensions, "count"),
                                            series.read("AWS/ElastiCache", "CacheHitRate", dimensions, "percent"),
                                            series.read("AWS/ElastiCache", "Evictions", dimensions, "count")))
