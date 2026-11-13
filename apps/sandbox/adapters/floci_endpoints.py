from urllib.parse import urlparse

IN_VPC_HOST = "localhost.floci.io"
LOOPBACK_HOSTS = {"localhost", "127.0.0.1"}


def in_vpc_host(host: str) -> str:
    return IN_VPC_HOST if host in LOOPBACK_HOSTS else host


def in_vpc_api_url(endpoint_url: str) -> str:
    port = urlparse(endpoint_url).port or 4566
    return f"http://{IN_VPC_HOST}:{port}"
