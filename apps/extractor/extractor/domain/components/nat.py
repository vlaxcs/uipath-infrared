import statistics

from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.instance_specs import HOURS_PER_MONTH
from extractor.domain.series_summary import RESOLUTION_SECONDS, present
from extractor.domain.stacks import stack_of

USD_PER_GATEWAY_HOUR = 0.045


def available_by_vpc(gateways):
    grouped = {}
    for gateway in gateways:
        if gateway["State"] == "available":
            grouped.setdefault(gateway["VpcId"], []).append(gateway)
    return grouped


def mean_across(series, key):
    return round(statistics.fmean(s[key] for s in series), 6)


def combined_bytes_out(series, window_days, provenance):
    series = [s for s in series if s]
    if not series:
        return None
    return {"unit": "gb_per_hour", "window_days": window_days, "resolution_seconds": RESOLUTION_SECONDS, "provenance": provenance,
            "avg": mean_across(series, "avg"), "p95": mean_across(series, "p95"), "max": max(s["max"] for s in series),
            "basis": "CloudWatch AWS/NATGateway BytesOutToDestination per gateway, averaged across gateways"}


def nat_gateways(component_id, vpc_name, gateways, network, bytes_out):
    count = len(gateways)
    return {"id": component_id, "name": f"{count} NAT gateway(s) in {vpc_name}", "kind": "nat", "service": "nat-gateway",
            "quantity": count, "stateful": False, "stack": stack_of(vpc_name),
            "zones": len({g["SubnetId"] and network.subnet_zones.get(g["SubnetId"]) for g in gateways}),
            "usage": present(bytes_out=bytes_out),
            "cost": monthly_cost(USD_PER_GATEWAY_HOUR * HOURS_PER_MONTH * count,
                                 f"0.045 USD/h x {HOURS_PER_MONTH} h x {count} (data processing charges excluded)")}
