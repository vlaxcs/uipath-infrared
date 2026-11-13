def dns_edges(inventory, references):
    for component in list(inventory.components):
        if component["kind"] == "dns":
            for record in component["config"].get("records", []):
                inventory.connect(component["id"], references.balancer_dns.get(record["target"]), "dns",
                                  note=f"{record['type']} {record['name']}, TTL {record.get('ttl')}")


def target_group_edges(inventory, references):
    for arn, backend in references.target_group_backends.items():
        inventory.connect(references.target_group_balancers.get(arn), backend, "traffic", note="target group")


def environment_edges(inventory, references):
    for source, environment in references.environments.items():
        for name, value in environment.items():
            if not isinstance(value, str) or not value:
                continue
            inventory.connect(source, references.database_endpoints.get(value), "data", note=f"env {name}={value}")
            inventory.connect(source, references.queue_urls.get(value), "event", note=f"env {name}")
            inventory.connect(source, references.buckets.get(value), "data", note=f"env {name}")


def event_source_edges(inventory, references, mappings):
    for mapping in mappings:
        inventory.connect(references.queue_arns.get(mapping["EventSourceArn"]), references.function_arns.get(mapping["FunctionArn"]),
                          "event", note=f"event source mapping, batch size {mapping.get('BatchSize')}")


def subscription_edges(inventory, references, subscriptions_by_topic):
    for topic_arn, subscriptions in subscriptions_by_topic.items():
        for subscription in subscriptions:
            if subscription["Protocol"] == "sqs":
                inventory.connect(references.topics[topic_arn], references.queue_arns.get(subscription["Endpoint"]), "event",
                                  note="SNS subscription")


def notification_edges(inventory, references, notifications_by_bucket):
    for bucket, configuration in notifications_by_bucket.items():
        for target in configuration.get("LambdaFunctionConfigurations", []):
            inventory.connect(references.buckets[bucket], references.function_arns.get(target["LambdaFunctionArn"]), "event",
                              note="S3 event notification " + ",".join(target["Events"]))


def rule_edges(inventory, references, targets_by_rule):
    for rule, targets in targets_by_rule.items():
        for target in targets:
            inventory.connect(references.rules[rule], references.function_arns.get(target["Arn"]), "event", note="EventBridge target")


def delivery_stream_edges(inventory, references):
    for component_id, source_arn, bucket in references.delivery_streams.values():
        inventory.connect(references.stream_arns.get(source_arn), component_id, "data", note="Kinesis source")
        inventory.connect(component_id, references.buckets.get(bucket), "data", note="Firehose S3 destination")
