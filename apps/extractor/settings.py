import os
from dataclasses import dataclass

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is not set. Copy .env.example to .env at the repo root and fill it in.")
    return value


@dataclass(frozen=True)
class AwsSettings:
    endpoint_url: str
    region: str
    access_key_id: str
    secret_access_key: str


def aws() -> AwsSettings:
    return AwsSettings(
        endpoint_url=required("AWS_ENDPOINT_URL"),
        region=required("AWS_REGION"),
        access_key_id=required("AWS_ACCESS_KEY_ID"),
        secret_access_key=required("AWS_SECRET_ACCESS_KEY"),
    )
