import secrets

from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients
from .network_builder import Network


def build_postgres(clients: AwsClients, network: Network, prefix: str, action: Action) -> BuiltComponent:
    group_name = resource_name(prefix, action.component_id, suffix="-subnets")
    clients.rds.create_db_subnet_group(DBSubnetGroupName=group_name, DBSubnetGroupDescription=group_name, SubnetIds=network.subnet_ids)
    multi_az = action.zones > 1
    instance = clients.rds.create_db_instance(
        DBInstanceIdentifier=resource_name(prefix, action.component_id),
        DBInstanceClass=action.sku,
        Engine="postgres",
        MasterUsername="sandbox",
        MasterUserPassword=secrets.token_hex(16),
        AllocatedStorage=20,
        MultiAZ=multi_az,
        DBSubnetGroupName=group_name,
        VpcSecurityGroupIds=[network.security_group_id],
        PubliclyAccessible=False,
    )["DBInstance"]
    endpoint = instance.get("Endpoint") or {}
    return BuiltComponent(
        action.component_id,
        action.kind,
        action.sku,
        action.zones,
        [
            BuiltResource("db_subnet_group", group_name, group_name),
            BuiltResource(
                "db_instance",
                instance["DBInstanceIdentifier"],
                instance["DBInstanceIdentifier"],
                instance.get("AvailabilityZone", ""),
                f"{endpoint.get('Address', '')}:{endpoint.get('Port', '')}",
            ),
        ],
        f"postgres {action.sku}, MultiAZ requested {multi_az}, Floci reports MultiAZ {instance.get('MultiAZ')}",
    )
