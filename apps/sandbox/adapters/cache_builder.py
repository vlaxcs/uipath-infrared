from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients
from .floci_endpoints import in_vpc_host
from .network_builder import Network

CLUSTER_ID_LIMIT = 40


def build_cache(clients: AwsClients, network: Network, prefix: str, action: Action) -> BuiltComponent:
    group_name = resource_name(prefix, action.component_id, suffix="-subnets")
    clients.elasticache.create_cache_subnet_group(CacheSubnetGroupName=group_name, CacheSubnetGroupDescription=group_name, SubnetIds=network.subnet_ids)
    cluster_id = resource_name(prefix, action.component_id, CLUSTER_ID_LIMIT)
    clients.elasticache.create_cache_cluster(
        CacheClusterId=cluster_id,
        CacheNodeType=action.sku,
        Engine="redis",
        NumCacheNodes=1,
        CacheSubnetGroupName=group_name,
        SecurityGroupIds=[network.security_group_id],
    )
    cluster = clients.elasticache.describe_cache_clusters(CacheClusterId=cluster_id, ShowCacheNodeInfo=True)["CacheClusters"][0]
    nodes = cluster.get("CacheNodes") or [{}]
    endpoint = nodes[0].get("Endpoint") or {}
    return BuiltComponent(
        action.component_id,
        action.kind,
        action.sku,
        action.zones,
        [
            BuiltResource("cache_subnet_group", group_name, group_name),
            BuiltResource("cache_cluster", cluster_id, cluster_id, address=f"{in_vpc_host(endpoint.get('Address', ''))}:{endpoint.get('Port', '')}"),
        ],
        f"redis {action.sku}, 1 node",
    )
