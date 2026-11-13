from extractor.domain.components.delivery_stream import delivery_source_arn, delivery_stream, destination_bucket
from extractor.domain.components.kinesis_stream import kinesis_stream
from extractor.domain.components.queue import queue, queue_name
from extractor.domain.components.topic import topic, topic_name


def extract_queues(context):
    api, series, refs = context.aws.sqs, context.series, context.references
    for url in context.warnings.guard("sqs", api.queue_urls, []):
        name = queue_name(url)
        attributes = api.attributes(url)
        dimensions = {"QueueName": name}
        component_id = context.slugs.make(name, "q-")
        refs.queue_urls[url] = component_id
        refs.queue_arns[attributes.get("QueueArn")] = component_id
        context.inventory.add(queue(component_id, name, attributes,
                                    series.read("AWS/SQS", "ApproximateNumberOfMessagesVisible", dimensions, "count"),
                                    series.read("AWS/SQS", "NumberOfMessagesSent", dimensions, "count", "Sum"),
                                    series.read("AWS/SQS", "NumberOfMessagesReceived", dimensions, "count", "Sum"),
                                    series.read("AWS/SQS", "NumberOfEmptyReceives", dimensions, "count", "Sum")))


def extract_topics(context):
    api, guard = context.aws.sns, context.warnings.guard
    for arn in guard("sns", api.topic_arns, []):
        name = topic_name(arn)
        component_id = context.slugs.make(name, "topic-")
        context.references.topics[arn] = component_id
        subscriptions = guard("sns subs", lambda: api.subscriptions(arn), [])
        context.topic_subscriptions[arn] = subscriptions
        context.inventory.add(topic(component_id, name, subscriptions))


def extract_kinesis(context):
    api, refs = context.aws.kinesis, context.references
    for name in context.warnings.guard("kinesis", api.stream_names, []):
        summary = api.summary(name)
        component_id = context.slugs.make(name, "stream-")
        refs.stream_arns[summary["StreamARN"]] = component_id
        context.inventory.add(kinesis_stream(
            component_id, name, summary,
            context.series.read("AWS/Kinesis", "IncomingBytes", {"StreamName": name}, "bytes_per_second", "Sum", 1 / 3600),
            context.series.read("AWS/Kinesis", "IncomingRecords", {"StreamName": name}, "count", "Sum")))


def extract_delivery_streams(context):
    api = context.aws.firehose
    for name in context.warnings.guard("firehose", api.stream_names, []):
        description = api.description(name)
        component_id = context.slugs.make(name, "fh-")
        context.inventory.add(delivery_stream(component_id, name, description))
        context.references.delivery_streams[name] = (component_id, delivery_source_arn(description), destination_bucket(description))


def extract_messaging(context):
    extract_queues(context)
    extract_topics(context)
    extract_kinesis(context)
    extract_delivery_streams(context)
