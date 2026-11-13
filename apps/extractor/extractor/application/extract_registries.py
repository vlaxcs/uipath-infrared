from extractor.domain.components.container_registry import container_registries


def extract_registries(context):
    repositories = context.warnings.guard("ecr", context.aws.ecr.repositories, [])
    if repositories:
        context.inventory.add(container_registries(repositories))
