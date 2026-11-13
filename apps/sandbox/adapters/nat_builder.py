from ..domain.built import BuiltComponent, BuiltResource
from ..domain.candidate import Action
from ..domain.naming import resource_name
from .aws_clients import AwsClients
from .network_builder import Network
from .tags import name_tags


def build_nat(clients: AwsClients, network: Network, prefix: str, action: Action) -> BuiltComponent:
    component = BuiltComponent(action.component_id, action.kind, action.sku, action.zones)
    for zone_index in range(min(action.zones, len(network.subnet_ids))):
        zone = network.zones[zone_index]
        address_name = resource_name(prefix, action.component_id, suffix=f"-eip-{zone}")
        allocation_id = clients.ec2.allocate_address(Domain="vpc", TagSpecifications=name_tags("elastic-ip", address_name))["AllocationId"]
        component.resources.append(BuiltResource("elastic_ip", allocation_id, address_name, zone))
        gateway_name = resource_name(prefix, action.component_id, suffix=f"-{zone}")
        gateway = clients.ec2.create_nat_gateway(
            SubnetId=network.subnet_ids[zone_index],
            AllocationId=allocation_id,
            TagSpecifications=name_tags("natgateway", gateway_name),
        )["NatGateway"]
        component.resources.append(BuiltResource("nat_gateway", gateway["NatGatewayId"], gateway_name, zone))
    component.detail = f"{len(component.resources_of('nat_gateway'))} NAT gateway(s), one per zone"
    return component
