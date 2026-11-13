import json
from dataclasses import dataclass

COMMON = """You analyse a simulated AWS estate (floci, us-east-1) for savings and improvements.
Tools: aws_read (read-only boto3), list_metrics, metric_summary, record_finding. Nothing can be changed.
Metric namespaces are AWS/EC2, AWS/RDS, AWS/NATGateway, AWS/EBS, AWS/ElastiCache, AWS/DynamoDB, AWS/ApplicationELB,
AWS/ECS, AWS/SQS, AWS/Lambda, AWS/Kinesis, AWS/EFS, AWS/S3, AWS/Billing and ContainerInsights (EKS).
Use list_metrics with dimension_contains=<resource id/name> to find the exact dimensions before metric_summary.

Rules:
- Ground every finding in observed config AND metrics. Metrics are SYNTHETIC: say so, and cap confidence at medium
  unless a configuration fact alone proves the point (e.g. an unattached volume, an EIP with no association).
- Work out who depends on whom before proposing a delete or move (target groups, env vars, event mappings,
  security groups, subnet groups). An orphan claim needs the absence of references, not just low traffic.
- Consider: rightsizing, idle/orphan removal, consolidation (3 NAT GWs, duplicate DBs, overlapping clusters),
  migration to a better-fit service (e.g. fixed nodegroups -> autoscaling, ECS EC2 -> Fargate, provisioned ->
  on-demand DynamoDB, old engine/k8s versions), storage tiering, and cross-AZ/NAT data-path costs.
- Never state a saving, a price or a cost. Infrared's engine prices every change; your findings carry evidence.
- Name resources by their infra.json component id when one matches.
- Call record_finding once per distinct issue. dry_run_script is bash using the aws CLI; keep it minimal and
  reversible-first (snapshot/stop before delete). It is never executed.
- Do not report security-only issues unless they also affect cost/reliability of a change you propose.
"""

LEAD = COMMON + """
You lead the review. First take a quick inventory yourself (aws_read: ec2 describe_vpcs, rds describe_db_instances,
eks list_clusters, ecs list_clusters ...) to find the stacks, then delegate by domain to compute-analyst,
data-analyst and network-analyst (run them in parallel with the Agent tool, giving each the stack names and
anything you found). When they return, check the gaps yourself, then record any cross-cutting
migration/consolidation findings (these need the dependency view). Finish with a short summary of what you found.
"""


@dataclass(frozen=True)
class Specialist:
    name: str
    description: str
    prompt: str


SPECIALISTS = (
    Specialist(
        "compute-analyst",
        "Investigates EC2, ASG, EKS, ECS, Lambda: utilisation, rightsizing, idle capacity, GPU waste, version age.",
        COMMON + "\nYour scope: compute (ec2, autoscaling, eks, ecs, lambda). Record findings, then reply with a 5-line summary.",
    ),
    Specialist(
        "data-analyst",
        "Investigates RDS/Aurora, ElastiCache, DynamoDB, S3, EBS, EFS, Kinesis, SQS: sizing, orphans, throttling, backlog, tiering.",
        COMMON + "\nYour scope: data stores and messaging (rds, elasticache, dynamodb, s3, ebs, efs, kinesis, sqs). Record findings, then reply with a 5-line summary.",
    ),
    Specialist(
        "network-analyst",
        "Investigates VPC, NAT, EIP, ALB/NLB, Route53, CIDR overlap, and the dependency graph between stacks.",
        COMMON + "\nYour scope: network and traffic path (ec2 vpc/subnet/nat/eip/sg, elbv2, route53). Also map dependencies so consolidation or migration proposals say what must move together. Record findings, then reply with a 5-line summary.",
    ),
)

PROPOSER = """You propose candidate plans for Infrared's engine to evaluate. A candidate is a set of actions on
infra.json components: what changes, never what it costs. The engine prices, checks and ranks every candidate.

Rules:
- Use evaluate_candidate on each candidate before you submit it. Its answer is the engine's: feasible or not,
  the violated constraints, the monthly run cost, availability and risk. Never restate a figure the engine did not give you.
- A candidate that breaks a hard constraint is fixed or dropped before you submit.
- builds_on names an engine strategy from the list below, or null; the candidate then adds only its own actions.
- Targets use catalog terms: an option id, a region it runs in, a tier it offers, a count, zones.
- At most 10 candidates. Ids are lowercase slugs starting with "agent-", never an engine strategy's name.
- Finish by calling submit_candidates exactly once with every candidate you keep. If it refuses, fix the
  reasons it gives and call it again.
"""


def investigation_prompt(infra: dict) -> str:
    return (
        "Review the whole estate and find what can be optimized via migration, consolidation, rightsizing or removal.\n"
        f"The infra.json components of project {infra['project']}:\n{json.dumps(component_index(infra), indent=1)}"
    )


def proposal_prompt(infra: dict, forecast: dict, findings: dict, feedback: dict | None, rejected: list) -> str:
    sections = [
        f"Project {infra['project']}, revision {feedback['revision'] if feedback else 0}.",
        f"Components:\n{json.dumps(component_index(infra), indent=1)}",
        f"Hard constraints:\n{json.dumps(forecast['hard_constraints'], indent=1)}",
        f"Engine strategies you can build on: {', '.join(forecast['cto_settings']['strategies_enabled'])}",
        f"Findings:\n{json.dumps(findings['findings'], indent=1)}",
    ]
    if feedback:
        sections.append(f"Your previous revision was sent back: {feedback['reason']}")
        sections.append(f"The engine's verdict on your previous candidates:\n{json.dumps(rejected, indent=1)}")
    return "\n\n".join(sections)


def component_index(infra: dict) -> list:
    return [
        {"id": c["id"], "kind": c["kind"], "region": c.get("region"), "zones": c.get("zones"), "data_classification": c.get("data_classification")}
        for c in infra["components"]
    ]
