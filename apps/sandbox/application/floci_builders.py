from typing import Dict

from ..adapters.aws_clients import AwsClients
from ..adapters.bucket_builder import build_bucket
from ..adapters.cache_builder import build_cache
from ..adapters.compute_builder import build_virtual_machines
from ..adapters.database_builder import build_postgres
from ..adapters.function_builder import build_function
from ..adapters.load_balancer_builder import build_load_balancer
from ..adapters.nat_builder import build_nat
from ..adapters.network_builder import Network
from ..adapters.queue_builder import build_queue
from ..adapters.web_user_data import web_server_script
from .component_builder import Builder, instance_ids


def floci_builders(clients: AwsClients, network: Network, prefix: str, image_id: str) -> Dict[str, Builder]:
    return {
        "nat": lambda action, built: build_nat(clients, network, prefix, action),
        "virtual_machine": lambda action, built: build_virtual_machines(clients, network, prefix, action, image_id, web_server_script()),
        "load_balancer": lambda action, built: build_load_balancer(clients, network, prefix, action, instance_ids(built)),
        "postgres": lambda action, built: build_postgres(clients, network, prefix, action),
        "cache": lambda action, built: build_cache(clients, network, prefix, action),
        "queue": lambda action, built: build_queue(clients, prefix, action),
        "object_storage": lambda action, built: build_bucket(clients, prefix, action),
        "function": lambda action, built: build_function(clients, prefix, action),
    }
