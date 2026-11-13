import boto3
from botocore.config import Config

CLIENT_CONFIG = Config(retries={"max_attempts": 2}, connect_timeout=5, read_timeout=60)


class AwsClients:
    def __init__(self, endpoint, region, access_key_id, secret_access_key):
        self.endpoint, self.region = endpoint, region
        self.access_key_id, self.secret_access_key = access_key_id, secret_access_key

    def client(self, service):
        return boto3.client(service, endpoint_url=self.endpoint, region_name=self.region, aws_access_key_id=self.access_key_id,
                            aws_secret_access_key=self.secret_access_key, config=CLIENT_CONFIG)
