from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.instance_specs import HOURS_PER_MONTH
from extractor.domain.point_metric import point_metric
from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of

USD_PER_SHARD_HOUR = 0.015


def kinesis_stream(component_id, name, summary, incoming_bytes, incoming_records):
    shards = summary["OpenShardCount"]
    return {"id": component_id, "name": name, "kind": "stream", "service": "kinesis", "stateful": True, "stack": stack_of(None, name),
            "capacity": {"shards": point_metric(shards, "count")},
            "usage": present(incoming_bytes_per_s=incoming_bytes, incoming_records=incoming_records),
            "security": {"encryption_at_rest": summary.get("EncryptionType", "NONE") != "NONE"},
            "cost": monthly_cost(shards * USD_PER_SHARD_HOUR * HOURS_PER_MONTH,
                                 f"{shards} shards x 0.015 USD/shard-h x {HOURS_PER_MONTH} h (PUT payload units excluded)"),
            "config": {"mode": summary.get("StreamModeDetails", {}).get("StreamMode"), "retention_hours": summary.get("RetentionPeriodHours")}}
