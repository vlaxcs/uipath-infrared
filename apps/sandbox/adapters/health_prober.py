from typing import Dict, List, Sequence

from botocore.exceptions import BotoCoreError, ClientError

from ..domain.built import BuiltComponent
from ..domain.observation import Observation
from .aws_clients import AwsClients
from .compute_builder import instance_states

PROBE_ERRORS = (BotoCoreError, ClientError)


class HealthProber:
    def __init__(self, clients: AwsClients, components: Sequence[BuiltComponent]):
        self.clients = clients
        self.components = list(components)

    def ids_of(self, resource_type: str) -> List[str]:
        return [resource.resource_id for component in self.components for resource in component.resources_of(resource_type)]

    def target_health(self) -> Dict[str, str]:
        health = {}
        for group_arn in self.ids_of("target_group"):
            for description in self.clients.elbv2.describe_target_health(TargetGroupArn=group_arn)["TargetHealthDescriptions"]:
                health[description["Target"]["Id"]] = description["TargetHealth"]["State"]
        return health

    def observe(self, phase: str) -> List[Observation]:
        observations = []
        states = instance_states(self.clients, self.ids_of("instance"))
        health = self.target_health()
        databases = {item["DBInstanceIdentifier"]: item["DBInstanceStatus"] for item in self.clients.rds.describe_db_instances()["DBInstances"]} if self.ids_of("db_instance") else {}
        caches = {item["CacheClusterId"]: item["CacheClusterStatus"] for item in self.clients.elasticache.describe_cache_clusters()["CacheClusters"]} if self.ids_of("cache_cluster") else {}
        gateway_ids = self.ids_of("nat_gateway")
        gateways = {item["NatGatewayId"]: item["State"] for item in self.clients.ec2.describe_nat_gateways(NatGatewayIds=gateway_ids)["NatGateways"]} if gateway_ids else {}
        balancer_ids = self.ids_of("load_balancer")
        balancers = {item["LoadBalancerArn"]: item["State"]["Code"] for item in self.clients.elbv2.describe_load_balancers(LoadBalancerArns=balancer_ids)["LoadBalancers"]} if balancer_ids else {}
        for component in self.components:
            for resource in component.resources:
                observation = self.observe_resource(component, resource, phase, states, health, databases, caches, gateways, balancers)
                if observation:
                    observations.append(observation)
        return observations

    def observe_resource(self, component, resource, phase, states, health, databases, caches, gateways, balancers):
        def seen(ok: bool, detail: str) -> Observation:
            return Observation(component.component_id, resource.resource_id, phase, ok, "api", detail)

        kind = resource.resource_type
        if kind == "instance":
            state = states.get(resource.resource_id, "missing")
            target = health.get(resource.resource_id)
            ok = state == "running" and target in (None, "healthy")
            return seen(ok, f"{resource.resource_id} state {state}" + (f", target {target}" if target else ""))
        if kind == "load_balancer":
            healthy = sum(1 for state in health.values() if state == "healthy")
            state = balancers.get(resource.resource_id, "missing")
            return seen(state == "active" and healthy > 0, f"state {state}, {healthy} healthy target(s)")
        if kind == "db_instance":
            state = databases.get(resource.resource_id, "missing")
            return seen(state == "available", f"status {state}")
        if kind == "cache_cluster":
            state = caches.get(resource.resource_id, "missing")
            return seen(state == "available", f"status {state}")
        if kind == "nat_gateway":
            state = gateways.get(resource.resource_id, "missing")
            return seen(state == "available", f"state {state}")
        if kind == "queue":
            return self.call(seen, "send_message ok", lambda: self.clients.sqs.send_message(QueueUrl=resource.address, MessageBody=f"sandbox probe {phase}"))
        if kind == "bucket":
            return self.call(seen, "put_object ok", lambda: self.clients.s3.put_object(Bucket=resource.resource_id, Key=f"sandbox-probe/{phase}", Body=b"probe"))
        if kind == "function":
            return self.invoke(seen, resource.resource_id)
        return None

    def call(self, seen, success: str, operation):
        try:
            operation()
            return seen(True, success)
        except PROBE_ERRORS as error:
            return seen(False, type(error).__name__)

    def invoke(self, seen, function_name: str):
        try:
            reply = self.clients.awslambda.invoke(FunctionName=function_name, Payload=b"{}")
            ok = reply["StatusCode"] == 200 and not reply.get("FunctionError")
            return seen(ok, f"invoke status {reply['StatusCode']}" + (f" {reply['FunctionError']}" if reply.get("FunctionError") else ""))
        except PROBE_ERRORS as error:
            return seen(False, type(error).__name__)
