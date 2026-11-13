from extractor.domain.stacks import stack_of


def s3_destination(description):
    destination = (description.get("Destinations") or [{}])[0]
    return destination.get("ExtendedS3DestinationDescription") or destination.get("S3DestinationDescription") or {}


def delivery_source_arn(description):
    return (description.get("Source") or {}).get("KinesisStreamSourceDescription", {}).get("KinesisStreamARN")


def destination_bucket(description):
    return (s3_destination(description).get("BucketARN") or "").split(":::")[-1]


def delivery_stream(component_id, name, description):
    destination = s3_destination(description)
    hints = destination.get("BufferingHints") or {}
    return {"id": component_id, "name": name, "kind": "stream", "service": "firehose", "stateful": False, "stack": stack_of(None, name),
            "config": {"buffer_seconds": hints.get("IntervalInSeconds"), "buffer_mb": hints.get("SizeInMBs"),
                       "compression": destination.get("CompressionFormat"), "prefix": destination.get("Prefix") or "(none)",
                       "source_stream": delivery_source_arn(description), "destination_bucket": destination_bucket(description)}}
