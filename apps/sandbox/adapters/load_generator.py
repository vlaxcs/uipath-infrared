import json
from pathlib import Path
from typing import Dict, List

from botocore.exceptions import ClientError

from ..domain.built import BuiltResource
from ..domain.traffic_record import TrafficRecord
from .aws_clients import AwsClients
from .compute_builder import launch_instances
from .network_builder import Network

AGENT_SOURCE = Path(__file__).with_name("loadgen_agent.py")
CONTROL_KEY = "control.json"
RESULTS_KEY = "results.json"


class LoadGenerator:
    def __init__(self, clients: AwsClients, bucket: str, in_vpc_api_url: str):
        self.clients = clients
        self.bucket = bucket
        self.in_vpc_api_url = in_vpc_api_url
        self.resources: List[BuiltResource] = []

    def create_bucket(self) -> BuiltResource:
        self.clients.s3.create_bucket(Bucket=self.bucket)
        self.set_phase("warmup")
        resource = BuiltResource("bucket", self.bucket, self.bucket)
        self.resources.append(resource)
        return resource

    def user_data(self, config: Dict) -> str:
        return "\n".join(
            [
                "#!/bin/bash",
                "mkdir -p /opt/sandbox",
                "cat > /opt/sandbox/loadgen.py <<'SANDBOX_AGENT'",
                AGENT_SOURCE.read_text().rstrip("\n"),
                "SANDBOX_AGENT",
                "cat > /opt/sandbox/loadgen.json <<'SANDBOX_CONFIG'",
                json.dumps(config),
                "SANDBOX_CONFIG",
                "setsid -f python3 /opt/sandbox/loadgen.py /opt/sandbox/loadgen.json </dev/null >/var/log/sandbox-loadgen.log 2>&1",
                "",
            ]
        )

    def launch(self, network: Network, image_id: str, name: str, http_targets: List[Dict], tcp_targets: List[Dict], requests_per_second: int, max_seconds: int) -> BuiltResource:
        config = {
            "control_url": f"{self.in_vpc_api_url}/{self.bucket}/{CONTROL_KEY}",
            "results_url": f"{self.in_vpc_api_url}/{self.bucket}/{RESULTS_KEY}",
            "http_targets": http_targets,
            "tcp_targets": tcp_targets,
            "requests_per_second": requests_per_second,
            "timeout_s": 2,
            "upload_every_s": 2,
            "max_seconds": max_seconds,
        }
        instance = launch_instances(self.clients, network, image_id, name, "t3.micro", 1, 0, self.user_data(config))[0]
        self.resources.append(instance)
        return instance

    def set_phase(self, phase: str) -> None:
        self.clients.s3.put_object(Bucket=self.bucket, Key=CONTROL_KEY, Body=json.dumps({"phase": phase}).encode())

    def results(self) -> Dict:
        try:
            return json.loads(self.clients.s3.get_object(Bucket=self.bucket, Key=RESULTS_KEY)["Body"].read())
        except ClientError:
            return {"done": False, "samples": []}

    def records(self) -> List[TrafficRecord]:
        return [TrafficRecord(*sample) for sample in self.results()["samples"]]
