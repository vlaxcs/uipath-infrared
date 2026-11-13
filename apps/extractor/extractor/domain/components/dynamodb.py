from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.instance_specs import HOURS_PER_MONTH
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

USD_PER_RCU_HOUR = 0.00013
USD_PER_WCU_HOUR = 0.00065
PITR_RETENTION_DAYS = 35


def is_on_demand(table):
    throughput = table.get("ProvisionedThroughput", {})
    return table.get("BillingModeSummary", {}).get("BillingMode") == "PAY_PER_REQUEST" or not throughput.get("ReadCapacityUnits")


def provisioned_cost(table):
    throughput, indexes = table.get("ProvisionedThroughput", {}), table.get("GlobalSecondaryIndexes", [])
    usd = (throughput["ReadCapacityUnits"] * USD_PER_RCU_HOUR + throughput["WriteCapacityUnits"] * USD_PER_WCU_HOUR) \
        * HOURS_PER_MONTH * (1 + len(indexes))
    return monthly_cost(usd, f"RCU 0.00013 + WCU 0.00065 USD/h x {HOURS_PER_MONTH} h x (table + {len(indexes)} GSI at same provisioning)")


def dynamodb_table(component_id, name, table, pitr, ttl, consumed_rcu, consumed_wcu, throttled):
    throughput, indexes, on_demand = table.get("ProvisionedThroughput", {}), table.get("GlobalSecondaryIndexes", []), is_on_demand(table)
    capacity = {} if on_demand else {"provisioned_rcu": point_metric(throughput["ReadCapacityUnits"], "count"),
                                     "provisioned_wcu": point_metric(throughput["WriteCapacityUnits"], "count")}
    size = table.get("TableSizeBytes")
    return {"id": component_id, "name": name, "kind": "nosql", "service": "dynamodb", "stateful": True, "stack": stack_of(None, name),
            "data_gb": point_metric(round(size / 2**30, 3), "GB") if size else None, "capacity": capacity,
            "usage": present(consumed_rcu=consumed_rcu, consumed_wcu=consumed_wcu, throttled_requests=throttled),
            "security": {"backup_retention_days": PITR_RETENTION_DAYS if pitr else 0, "deletion_protection": table.get("DeletionProtectionEnabled")},
            "cost": None if on_demand else provisioned_cost(table),
            "config": {"partition_key": table["KeySchema"][0]["AttributeName"], "billing_mode": "on_demand" if on_demand else "provisioned",
                       "gsi_count": len(indexes), "gsi_projection_all": sum(1 for g in indexes if g["Projection"]["ProjectionType"] == "ALL"),
                       "pitr_enabled": pitr, "ttl_enabled": ttl}}
