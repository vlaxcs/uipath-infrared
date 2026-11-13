from extractor.domain.edges import (delivery_stream_edges, dns_edges, environment_edges, event_source_edges, notification_edges,
                                    rule_edges, subscription_edges, target_group_edges)


def build_edges(context):
    aws, guard, refs, inventory = context.aws, context.warnings.guard, context.references, context.inventory
    dns_edges(inventory, refs)
    target_group_edges(inventory, refs)
    environment_edges(inventory, refs)
    event_source_edges(inventory, refs, guard("event source mappings", aws.lambdas.event_source_mappings, []))
    subscription_edges(inventory, refs, {arn: context.topic_subscriptions.get(arn, []) for arn in refs.topics})
    notifications = {name: guard(f"s3 notif s3:{name}", lambda: aws.s3.notifications(name), {}) for name in refs.buckets}
    notification_edges(inventory, refs, notifications)
    targets = {rule: guard("rule targets", lambda: aws.events.targets(rule), []) for rule in refs.rules}
    rule_edges(inventory, refs, targets)
    delivery_stream_edges(inventory, refs)
