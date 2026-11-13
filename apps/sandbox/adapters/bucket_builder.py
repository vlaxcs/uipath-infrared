from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients


def build_bucket(clients: AwsClients, prefix: str, action: Action) -> BuiltComponent:
    name = resource_name(prefix, action.component_id)
    clients.s3.create_bucket(Bucket=name)
    return BuiltComponent(action.component_id, action.kind, action.sku, action.zones, [BuiltResource("bucket", name, name)], f"S3 bucket {name}")
