from typing import List, Sequence

from ..domain.built import BuiltComponent


def measurement_notes(components: Sequence[BuiltComponent], loadgen_name: str, region: str) -> List[str]:
    kinds = {component.kind for component in components}
    notes = [
        "All values are synthetic: measured against Floci containers on one machine, not against AWS.",
        f"Everything is built in the Floci region {region}, whatever region infra.json names.",
        f"Traffic comes from a load-generator instance inside the sandbox VPC ({loadgen_name}). Floci serves ALB listeners on port 80 inside its own container and does not publish that port to the host, and instance IPs are not routable from the host either, so HTTP is only possible from inside the VPC.",
        "Phases are labelled by the load generator from a control object the sandbox writes to S3 at each transition, so phase boundaries are accurate to about one second.",
        "Latency percentiles use successful requests only; failed requests are counted in availability and error rate.",
    ]
    if "load_balancer" in kinds:
        notes.append("Requests go through Floci's ALB data plane, which health-checks the instances and routes only to healthy ones.")
    elif "virtual_machine" in kinds:
        notes.append("The end state has no load balancer, so the load generator spreads requests round-robin over the web instances' private IPs; a stopped instance keeps receiving its share.")
    if "virtual_machine" in kinds:
        notes.append("Floci does not rerun UserData when a stopped instance starts again, so the web server on a restarted instance stays down; recovery shows how the rest of the layout coped.")
    if kinds & {"postgres", "cache"}:
        notes.append("Postgres and cache are checked once a second from the load generator with a protocol handshake (postgres SSLRequest, redis PING) on the endpoint Floci returns.")
    if "postgres" in kinds:
        notes.append("Floci accepts MultiAZ on RDS but runs a single postgres container with no standby; a forced failover restarts that container.")
    if kinds & {"queue", "object_storage", "function"}:
        notes.append("Queue, bucket and function checks are real API calls against Floci every few seconds: send_message, put_object, invoke.")
    if "nat" in kinds:
        notes.append("NAT gateways are checked on the control plane only (describe state); no egress traffic is sent through them.")
    return notes
