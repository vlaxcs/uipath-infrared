from extractor.domain.components.load_balancer import balancer_dimension, key_values, load_balancer


def last_group_attributes(context, target_groups):
    attributes = {}
    for group in target_groups:
        attributes = key_values(context.warnings.guard(
            "tg attrs", lambda: context.aws.elb.target_group_attributes(group["TargetGroupArn"]), []))
    return attributes


def extract_load_balancers(context):
    elb, guard, refs, series = context.aws.elb, context.warnings.guard, context.references, context.series
    balancers = guard("elbv2", elb.load_balancers, [])
    groups_by_balancer = guard("tgs", elb.target_groups_by_balancer, {}) if balancers else {}
    for balancer in balancers:
        name, arn = balancer["LoadBalancerName"], balancer["LoadBalancerArn"]
        dimensions = {"LoadBalancer": balancer_dimension(balancer)}
        attributes = key_values(guard(f"lb attrs {name}", lambda: elb.attributes(arn), []))
        target_groups = groups_by_balancer.get(arn, [])
        listeners = guard(f"listeners {name}", lambda: elb.listeners(arn), [])
        component_id = context.slugs.make(name, "alb-")
        refs.balancer_dns[balancer["DNSName"]] = component_id
        for group in target_groups:
            refs.target_group_balancers[group["TargetGroupArn"]] = component_id
        group_attributes = last_group_attributes(context, target_groups)
        requests = series.read("AWS/ApplicationELB", "RequestCount", dimensions, "count", "Sum")
        target_5xx = series.read("AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", dimensions, "count", "Sum")
        response_time = series.read("AWS/ApplicationELB", "TargetResponseTime", dimensions, "s")
        registered = sum(elb.registered_target_count(g["TargetGroupArn"]) for g in target_groups)
        context.inventory.add(load_balancer(component_id, balancer, attributes, target_groups, group_attributes, listeners, registered,
                                            context.network, requests, target_5xx, response_time))
