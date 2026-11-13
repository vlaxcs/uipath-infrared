from extractor.domain.components.dynamodb import dynamodb_table


def extract_dynamodb(context):
    api, guard, series = context.aws.dynamodb, context.warnings.guard, context.series
    for name in guard("ddb list", api.table_names, []):
        table = api.table(name)
        pitr = guard(f"pitr {name}", lambda: api.point_in_time_recovery(name))
        ttl = guard(f"ttl {name}", lambda: api.time_to_live(name))
        component_id = context.slugs.make(name, "ddb-")
        dimensions = {"TableName": name}
        context.inventory.add(dynamodb_table(
            component_id, name, table, pitr, ttl,
            series.read("AWS/DynamoDB", "ConsumedReadCapacityUnits", dimensions, "per_second", "Sum", 1 / 3600),
            series.read("AWS/DynamoDB", "ConsumedWriteCapacityUnits", dimensions, "per_second", "Sum", 1 / 3600),
            series.read("AWS/DynamoDB", "WriteThrottleEvents", dimensions, "count", "Sum")))
