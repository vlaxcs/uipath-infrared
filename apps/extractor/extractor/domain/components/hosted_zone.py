from extractor.domain.stacks import stack_of


def zone_name(zone):
    return zone["Name"].rstrip(".")


def routed_records(records):
    return [r for r in records if r["Type"] in ("CNAME", "A") and r.get("ResourceRecords")]


def hosted_zone(component_id, zone, records):
    return {"id": component_id, "name": zone_name(zone), "kind": "dns", "service": "route53", "stateful": False,
            "stack": stack_of(None, "www." + zone["Name"]),
            "config": {"records": [{"name": r["Name"].rstrip("."), "type": r["Type"], "ttl": r.get("TTL"),
                                    "target": r["ResourceRecords"][0]["Value"]} for r in routed_records(records)],
                       "health_checks": any("HealthCheckId" in r for r in records)}}
