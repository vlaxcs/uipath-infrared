import os
import pytest
from sandbox import settings


def test_refuses_real_aws_endpoint(monkeypatch):
    monkeypatch.setenv("AWS_ENDPOINT_URL", "https://ec2.us-east-1.amazonaws.com")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")

    with pytest.raises(SystemExit) as exc_info:
        settings.aws()

    assert "refused to run" in str(exc_info.value).lower()


def test_accepts_localhost_endpoint(monkeypatch):
    monkeypatch.setenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")

    aws_settings = settings.aws()

    assert aws_settings.endpoint_url == "http://localhost:4566"


def test_accepts_127_endpoint(monkeypatch):
    monkeypatch.setenv("AWS_ENDPOINT_URL", "http://127.0.0.1:4566")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")

    aws_settings = settings.aws()

    assert aws_settings.endpoint_url == "http://127.0.0.1:4566"


def test_accepts_localstack_cloud_endpoint(monkeypatch):
    monkeypatch.setenv("AWS_ENDPOINT_URL", "https://abc123.us-east-1.localstack.cloud:4566")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")

    aws_settings = settings.aws()

    assert "localstack" in aws_settings.endpoint_url
