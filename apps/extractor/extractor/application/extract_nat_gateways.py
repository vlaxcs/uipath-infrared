from extractor.domain.components.nat import available_by_vpc, combined_bytes_out, nat_gateways


def extract_nat_gateways(context):
    gateways = context.warnings.guard("nat", context.aws.ec2.nat_gateways, [])
    for vpc, members in available_by_vpc(gateways).items():
        vpc_name = context.network.vpc_names.get(vpc, vpc)
        per_gateway = [context.series.read("AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": g["NatGatewayId"]},
                                           "gb_per_hour", scale=1 / 2**30) for g in members]
        bytes_out = combined_bytes_out(per_gateway, context.window_days, context.metric_provenance)
        component_id = context.slugs.make(vpc_name, "nat-")
        context.inventory.add(nat_gateways(component_id, vpc_name, members, context.network, bytes_out))
