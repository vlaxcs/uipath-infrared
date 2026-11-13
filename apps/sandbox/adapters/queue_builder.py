from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients

QUEUE_NAME_LIMIT = 80


def build_queue(clients: AwsClients, prefix: str, action: Action) -> BuiltComponent:
    name = resource_name(prefix, action.component_id, QUEUE_NAME_LIMIT)
    url = clients.sqs.create_queue(QueueName=name)["QueueUrl"]
    return BuiltComponent(action.component_id, action.kind, action.sku, action.zones, [BuiltResource("queue", url, name, address=url)], f"SQS queue {name}")
