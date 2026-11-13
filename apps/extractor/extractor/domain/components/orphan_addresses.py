from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.instance_specs import HOURS_PER_MONTH

IDLE_EIP_USD_PER_HOUR = 0.005
ELASTIC_IP_ID = "eip-unassociated"


def unassociated_addresses(addresses):
    return [a for a in addresses if "AssociationId" not in a and "InstanceId" not in a]


def orphan_addresses(addresses):
    count = len(addresses)
    return {"id": ELASTIC_IP_ID, "name": f"{count} unassociated Elastic IP(s)", "kind": "other", "service": "ec2-eip",
            "quantity": count, "status": "orphan", "stateful": False,
            "cost": monthly_cost(IDLE_EIP_USD_PER_HOUR * HOURS_PER_MONTH * count, f"idle EIP 0.005 USD/h x {HOURS_PER_MONTH} h x {count}"),
            "config": {"public_ips": [a.get("PublicIp") for a in addresses]}}
