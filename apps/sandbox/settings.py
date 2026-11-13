import os
from dataclasses import dataclass
from urllib.parse import urlparse

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


FLOCI_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "localstack"}


def aws() -> AwsSettings:
    endpoint_url = required("AWS_ENDPOINT_URL")
    parsed = urlparse(endpoint_url)
    hostname = parsed.hostname or ""

    is_localhost = hostname in FLOCI_ALLOWED_HOSTS or hostname.startswith("127.")
    is_localstack_cloud = ".localstack.cloud" in hostname or "localstack" in hostname

    if not (is_localhost or is_localstack_cloud):
        raise SystemExit(
            f"Sandbox refused to run: AWS_ENDPOINT_URL={endpoint_url} "
            f"points at a non-Floci host ({hostname}). "
            f"The sandbox only ever touches Floci. Set AWS_ENDPOINT_URL to http://localhost:4566 or similar."
        )

    return AwsSettings(
        endpoint_url=endpoint_url,
        region=required("AWS_REGION"),
        access_key_id=required("AWS_ACCESS_KEY_ID"),
        secret_access_key=required("AWS_SECRET_ACCESS_KEY"),
    )
