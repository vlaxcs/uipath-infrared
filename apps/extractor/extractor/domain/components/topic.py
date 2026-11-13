from extractor.domain.stacks import stack_of


def topic_name(arn):
    return arn.split(":")[-1]


def topic(component_id, name, subscriptions):
    return {"id": component_id, "name": name, "kind": "queue", "service": "sns", "stateful": False, "stack": stack_of(None, name),
            "config": {"subscriptions": [{"protocol": s["Protocol"], "endpoint": s["Endpoint"]} for s in subscriptions]}}
