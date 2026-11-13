from ..domain.failure_target import FailureTarget
from .aws_clients import AwsClients
from .compute_builder import instance_states


class FailureInjector:
    def __init__(self, clients: AwsClients):
        self.clients = clients

    def inject(self, target: FailureTarget) -> str:
        resource = target.resource
        if resource.resource_type == "instance":
            change = self.clients.ec2.stop_instances(InstanceIds=[resource.resource_id])["StoppingInstances"][0]
            return f"stop_instances {resource.resource_id}: {change['PreviousState']['Name']} -> {change['CurrentState']['Name']}"
        if resource.resource_type == "db_instance":
            status = self.clients.rds.reboot_db_instance(DBInstanceIdentifier=resource.resource_id, ForceFailover=True)["DBInstance"]["DBInstanceStatus"]
            return f"reboot_db_instance {resource.resource_id} ForceFailover=True: status {status}"
        raise ValueError(f"cannot inject a failure into {resource.resource_type}")

    def state(self, target: FailureTarget) -> str:
        resource = target.resource
        if resource.resource_type == "instance":
            return instance_states(self.clients, [resource.resource_id]).get(resource.resource_id, "missing")
        return self.clients.rds.describe_db_instances(DBInstanceIdentifier=resource.resource_id)["DBInstances"][0]["DBInstanceStatus"]

    def effective(self, target: FailureTarget) -> bool:
        if target.resource.resource_type == "instance":
            return self.state(target) == "stopped"
        return True

    def restore(self, target: FailureTarget) -> str:
        resource = target.resource
        if resource.resource_type == "instance":
            change = self.clients.ec2.start_instances(InstanceIds=[resource.resource_id])["StartingInstances"][0]
            return f"start_instances {resource.resource_id}: {change['PreviousState']['Name']} -> {change['CurrentState']['Name']}"
        return f"{resource.resource_id}: nothing to restore, the reboot recovers by itself"
