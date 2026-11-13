from dataclasses import dataclass, field

EVERY_PORT = -1


@dataclass
class NetworkFacts:
    vpc_names: dict = field(default_factory=dict)
    subnet_zones: dict = field(default_factory=dict)
    subnet_vpcs: dict = field(default_factory=dict)
    world_open: dict = field(default_factory=dict)

    def world_ports(self, group_ids):
        ports = set()
        for group_id in group_ids or []:
            ports |= self.world_open.get(group_id, set())
        return sorted(ports)

    def vpc_name_of_subnet(self, subnet_id):
        return self.vpc_names.get(self.subnet_vpcs.get(subnet_id))

    def zone_count(self, subnet_ids):
        return len({self.subnet_zones.get(s) for s in subnet_ids})


def world_open_ports(group):
    ports = set()
    for permission in group["IpPermissions"]:
        if any(r.get("CidrIp") == "0.0.0.0/0" for r in permission.get("IpRanges", [])):
            low, high = permission.get("FromPort", -1), permission.get("ToPort", -1)
            if permission.get("IpProtocol") == "-1" or (low == 0 and high == 65535):
                ports.add(EVERY_PORT)
            elif low is not None:
                ports.update(range(low, min(high, low + 20) + 1) if high - low < 20 else {low, high})
    return ports


def network_facts(vpcs, subnets, security_groups):
    facts = NetworkFacts()
    for vpc in vpcs:
        facts.vpc_names[vpc["VpcId"]] = next((t["Value"] for t in vpc.get("Tags", []) if t["Key"] == "Name"), vpc["VpcId"])
    for subnet in subnets:
        facts.subnet_zones[subnet["SubnetId"]] = subnet["AvailabilityZone"]
        facts.subnet_vpcs[subnet["SubnetId"]] = subnet["VpcId"]
    for group in security_groups:
        facts.world_open[group["GroupId"]] = world_open_ports(group)
    return facts
