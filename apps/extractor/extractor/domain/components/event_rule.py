from extractor.domain.stacks import stack_of


def event_rule(component_id, rule):
    return {"id": component_id, "name": rule["Name"], "kind": "other", "service": "eventbridge-rule", "stateful": False,
            "stack": stack_of(None, rule["Name"]), "config": {"schedule": rule.get("ScheduleExpression"), "state": rule.get("State")}}
