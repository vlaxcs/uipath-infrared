from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

USD_PER_MIBPS_MONTH = 6.0


def file_system_name(file_system):
    return file_system.get("Name") or file_system["CreationToken"]


def file_system(component_id, described, io_limit):
    name, provisioned = file_system_name(described), described.get("ProvisionedThroughputInMibps")
    return {"id": component_id, "name": name, "kind": "file_system", "service": "efs", "stateful": True, "stack": stack_of(None, name),
            "capacity": {"throughput_mibps": point_metric(provisioned, "MiB/s")} if provisioned else None,
            "usage": present(io_limit_pct=io_limit),
            "security": {"encryption_at_rest": described.get("Encrypted")},
            "cost": monthly_cost(provisioned * USD_PER_MIBPS_MONTH, f"EFS provisioned throughput 6 USD/MiB/s-mo x {provisioned}") if provisioned else None,
            "config": {"throughput_mode": described.get("ThroughputMode")}}
