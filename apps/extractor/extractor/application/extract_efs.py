from extractor.domain.components.file_system import file_system, file_system_name


def extract_efs(context):
    for described in context.warnings.guard("efs", context.aws.efs.file_systems, []):
        io_limit = context.series.read("AWS/EFS", "PercentIOLimit", {"FileSystemId": described["FileSystemId"]}, "percent")
        component_id = context.slugs.make(file_system_name(described), "efs-")
        context.inventory.add(file_system(component_id, described, io_limit))
