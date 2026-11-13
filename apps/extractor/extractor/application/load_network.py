from extractor.domain.network import network_facts


def load_network(context):
    ec2, guard = context.aws.ec2, context.warnings.guard
    context.network = network_facts(guard("describe_vpcs", ec2.vpcs, []), guard("describe_subnets", ec2.subnets, []),
                                    guard("describe_security_groups", ec2.security_groups, []))
