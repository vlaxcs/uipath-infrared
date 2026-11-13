from extractor.domain.components.orphan_addresses import orphan_addresses, unassociated_addresses
from extractor.domain.components.orphan_volumes import orphan_volumes, unattached_volume_groups


def extract_orphan_volumes(context):
    for (size, volume_type, encrypted), volumes in unattached_volume_groups(context.volumes).items():
        component_id = context.slugs.make(f"orphan-{volume_type}-{size}gb", "vol-")
        context.inventory.add(orphan_volumes(component_id, size, volume_type, encrypted, volumes))


def extract_orphan_addresses(context):
    addresses = unassociated_addresses(context.warnings.guard("addresses", context.aws.ec2.addresses, []))
    if addresses:
        context.inventory.add(orphan_addresses(addresses))
