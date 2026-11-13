from extractor.domain.components.event_rule import event_rule


def extract_event_rules(context):
    for rule in context.warnings.guard("events", context.aws.events.rules, []):
        component_id = context.slugs.make(rule["Name"], "rule-")
        context.references.rules[rule["Name"]] = component_id
        context.inventory.add(event_rule(component_id, rule))
