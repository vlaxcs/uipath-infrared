import boto3
from botocore.config import Config

from agent import settings

_config = Config(retries={"max_attempts": 2}, connect_timeout=5, read_timeout=60)


def client(service: str):
    aws = settings.aws()
    return boto3.client(
        service,
        endpoint_url=aws.endpoint_url,
        region_name=aws.region,
        aws_access_key_id=aws.access_key_id,
        aws_secret_access_key=aws.secret_access_key,
        config=_config,
    )
