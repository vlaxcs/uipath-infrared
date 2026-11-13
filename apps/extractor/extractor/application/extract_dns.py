from extractor.domain.components.hosted_zone import hosted_zone, zone_name


def extract_dns(context):
    api, guard = context.aws.route53, context.warnings.guard
    for zone in guard("route53", api.hosted_zones, []):
        records = guard("rrs", lambda: api.records(zone["Id"]), [])
        component_id = context.slugs.make(zone_name(zone), "dns-")
        context.inventory.add(hosted_zone(component_id, zone, records))
