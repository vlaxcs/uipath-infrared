from extractor.application.extract_dns import extract_dns
from extractor.application.extract_event_rules import extract_event_rules
from extractor.application.extract_load_balancers import extract_load_balancers
from extractor.application.extract_nat_gateways import extract_nat_gateways
from extractor.application.extract_orphans import extract_orphan_addresses, extract_orphan_volumes
from extractor.application.extract_registries import extract_registries


def extract_network_edge(context):
    extract_load_balancers(context)
    extract_nat_gateways(context)
    extract_orphan_volumes(context)
    extract_orphan_addresses(context)
    extract_dns(context)
    extract_event_rules(context)
    extract_registries(context)
