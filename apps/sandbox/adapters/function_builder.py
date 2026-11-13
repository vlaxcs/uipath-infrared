import io
import time
import zipfile

from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.function_sku import parse_function_sku
from ..domain.naming import resource_name
from .aws_clients import AwsClients

HANDLER_SOURCE = "def handler(event, context):\n    return {\"statusCode\": 200}\n"
NAME_LIMIT = 64


def handler_archive() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("index.py", HANDLER_SOURCE)
    return buffer.getvalue()


def build_function(clients: AwsClients, prefix: str, action: Action) -> BuiltComponent:
    sku = parse_function_sku(action.sku)
    name = resource_name(prefix, action.component_id, NAME_LIMIT)
    clients.awslambda.create_function(
        FunctionName=name,
        Runtime=sku.runtime,
        Role=f"arn:aws:iam::000000000000:role/{prefix}function",
        Handler="index.handler",
        Code={"ZipFile": handler_archive()},
        MemorySize=sku.memory_mb,
        Timeout=30,
    )
    started = time.time()
    reply = clients.awslambda.invoke(FunctionName=name, Payload=b"{}")
    cold_start_ms = (time.time() - started) * 1000
    return BuiltComponent(
        action.component_id,
        action.kind,
        action.sku,
        action.zones,
        [BuiltResource("function", name, name)],
        f"{sku.runtime} {sku.memory_mb}MB, first invoke status {reply['StatusCode']} in {cold_start_ms:.0f} ms (cold start)",
    )
