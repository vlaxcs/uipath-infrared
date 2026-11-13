"""Infrared optimizer agent (Claude Agent SDK).

    .venv/bin/python -m agent.main [--focus "text"] [--model sonnet|opus]

Lead agent + three specialist subagents investigate the simulated AWS estate through read-only tools and
record findings to out/findings.jsonl, with dry-run change scripts in out/dryrun/. Nothing is applied.
"""
import argparse
import asyncio
import shutil

from claude_agent_sdk import (
    AgentDefinition, AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, ToolUseBlock, query,
)

from agent.tools import DRYRUN, FINDINGS, OUT, TOOL_NAMES, server

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
- Savings are rough USD/month from public list prices; state the basis. Never invent numbers you did not derive.
- Call record_finding once per distinct issue. dry_run_script is bash using the aws CLI; keep it minimal and
  reversible-first (snapshot/stop before delete). It is never executed.
- Do not report security-only issues unless they also affect cost/reliability of a change you propose.
"""

AGENTS = {
    "compute-analyst": AgentDefinition(
        description="Investigates EC2, ASG, EKS, ECS, Lambda: utilisation, rightsizing, idle capacity, GPU waste, version age.",
        prompt=COMMON + "\nYour scope: compute (ec2, autoscaling, eks, ecs, lambda). Record findings, then reply with a 5-line summary.",
        tools=TOOL_NAMES, model="inherit",
    ),
    "data-analyst": AgentDefinition(
        description="Investigates RDS/Aurora, ElastiCache, DynamoDB, S3, EBS, EFS, Kinesis, SQS: sizing, orphans, throttling, backlog, tiering.",
        prompt=COMMON + "\nYour scope: data stores and messaging (rds, elasticache, dynamodb, s3, ebs, efs, kinesis, sqs). Record findings, then reply with a 5-line summary.",
        tools=TOOL_NAMES, model="inherit",
    ),
    "network-analyst": AgentDefinition(
        description="Investigates VPC, NAT, EIP, ALB/NLB, Route53, CIDR overlap, and the dependency graph between stacks.",
        prompt=COMMON + "\nYour scope: network and traffic path (ec2 vpc/subnet/nat/eip/sg, elbv2, route53). Also map dependencies so consolidation or migration proposals say what must move together. Record findings, then reply with a 5-line summary.",
        tools=TOOL_NAMES, model="inherit",
    ),
}

LEAD = COMMON + """
You lead the review. First take a quick inventory yourself (aws_read: ec2 describe_vpcs, rds describe_db_instances,
eks list_clusters, ecs list_clusters ...) to find the stacks, then delegate by domain to compute-analyst,
data-analyst and network-analyst (run them in parallel with the Agent tool, giving each the stack names and
anything you found). When they return, check findings.jsonl-worthy gaps yourself, then record any cross-cutting
migration/consolidation findings (these need the dependency view). Finish with a ranked summary: top 10 by
monthly_saving_usd with confidence, and total estimated savings.
"""


async def run(focus: str | None, model: str, max_turns: int) -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    opts = ClaudeAgentOptions(
        system_prompt=LEAD,
        model=model,
        mcp_servers={"infra": server},
        allowed_tools=TOOL_NAMES + ["Agent"],
        disallowed_tools=["Bash", "Write", "Edit", "NotebookEdit", "WebFetch", "WebSearch", "Read", "Glob", "Grep"],
        agents=AGENTS,
        permission_mode="dontAsk",
        setting_sources=[],
        cwd=str(OUT),  # keeps the agent away from ground_truth/
        max_turns=max_turns,
    )
    prompt = "Review the whole estate and find what can be optimized via migration, consolidation, rightsizing or removal."
    if focus:
        prompt += f" Focus: {focus}"
    async for m in query(prompt=prompt, options=opts):
        if isinstance(m, AssistantMessage):
            for b in m.content:
                if isinstance(b, ToolUseBlock):
                    print(f"  -> {b.name} {str(b.input)[:110]}")
                elif isinstance(b, TextBlock) and b.text.strip():
                    print(b.text.strip())
        elif isinstance(m, ResultMessage):
            print(f"\n== done: {m.subtype}, turns={m.num_turns}, cost=${m.total_cost_usd or 0:.2f}")
            if m.result:
                (OUT / "report.md").write_text(m.result)
    n = sum(1 for _ in FINDINGS.open()) if FINDINGS.exists() else 0
    print(f"{n} findings -> {FINDINGS}; dry-run scripts in {DRYRUN}; report in {OUT / 'report.md'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--focus")
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--max-turns", type=int, default=150)
    a = ap.parse_args()
    asyncio.run(run(a.focus, a.model, a.max_turns))
