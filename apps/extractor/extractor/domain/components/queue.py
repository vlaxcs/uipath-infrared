from extractor.domain.series_summary import present
from extractor.domain.stacks import stack_of


def queue_name(url):
    return url.split("/")[-1]


def queue(component_id, name, attributes, visible, sent, received, empty_receives):
    return {"id": component_id, "name": name, "kind": "queue", "service": "sqs", "stateful": True, "stack": stack_of(None, name),
            "usage": present(messages_visible=visible, messages_sent=sent, messages_received=received, empty_receives=empty_receives),
            "security": {"encryption_at_rest": bool(attributes.get("KmsMasterKeyId") or attributes.get("SqsManagedSseEnabled") == "true")},
            "config": {"visibility_timeout_s": int(attributes.get("VisibilityTimeout", 0)),
                       "receive_wait_s": int(attributes.get("ReceiveMessageWaitTimeSeconds", 0)),
                       "retention_s": int(attributes.get("MessageRetentionPeriod", 0)), "has_dlq": "RedrivePolicy" in attributes,
                       "messages_in_queue_now": int(attributes.get("ApproximateNumberOfMessages", 0))}}
