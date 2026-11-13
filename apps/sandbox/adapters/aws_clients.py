from dataclasses import dataclass
from typing import Any

import boto3

from ..settings import AwsSettings


@dataclass(frozen=True)
class AwsClients:
    ec2: Any
    elbv2: Any
    autoscaling: Any
    rds: Any
    elasticache: Any
    sqs: Any
    s3: Any
    awslambda: Any


def connect(settings: AwsSettings) -> AwsClients:
    session = boto3.Session(
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        region_name=settings.region,
    )

    def client(service: str):
        return session.client(service, endpoint_url=settings.endpoint_url)

    return AwsClients(
        ec2=client("ec2"),
        elbv2=client("elbv2"),
        autoscaling=client("autoscaling"),
        rds=client("rds"),
        elasticache=client("elasticache"),
        sqs=client("sqs"),
        s3=client("s3"),
        awslambda=client("lambda"),
    )
