IDLE_CONNECTIONS = 2
IDLE_CPU_PCT = 3
IDLE_GPU_PCT = 5
IDLE_NAT_GB_PER_HOUR = 0.001
IDLE_QUEUE_MESSAGES = 1


def average(usage, metric):
    return usage.get(metric, {}).get("avg")


def derived_status(component, inbound, outbound):
    status, usage = component["status"], component.get("usage", {})
    if status == "orphan":
        return status
    kind, service, referenced = component["kind"], component.get("service"), component["id"] in inbound
    connections = average(usage, "connections")
    cpu, gpu = average(usage, "cpu_pct"), average(usage, "gpu_pct")
    if kind in ("postgres", "cache") and connections is not None and connections < IDLE_CONNECTIONS:
        return "idle" if referenced else "orphan"
    if kind == "cache" and service == "elasticache-memcached" and not referenced:
        return "orphan" if (connections or 0) < IDLE_CONNECTIONS else "idle"
    if kind == "nat" and usage.get("bytes_out", {}).get("avg", 1) < IDLE_NAT_GB_PER_HOUR:
        return "idle"
    if kind in ("virtual_machine", "node_group") and service != "ec2-autoscaling" and cpu is not None and cpu < IDLE_CPU_PCT:
        return "idle"
    if kind == "node_group" and gpu is not None and gpu < IDLE_GPU_PCT:
        return "idle"
    if kind == "queue" and service == "sqs":
        traffic = (average(usage, "messages_sent") or 0) + (average(usage, "messages_received") or 0)
        if traffic < IDLE_QUEUE_MESSAGES and not referenced and component["id"] not in outbound:
            return "idle"
    return status


def apply_status(components, edges):
    inbound = {e["to"] for e in edges}
    outbound = {e["from"] for e in edges}
    for component in components:
        component["status"] = derived_status(component, inbound, outbound)
