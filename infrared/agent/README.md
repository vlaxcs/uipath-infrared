# InfraRed optimizer agent

A Claude Agent SDK app that reviews the simulated AWS estate (floci, see the top-level `README.md`) and
proposes what to optimize: rightsizing, idle/orphan removal, consolidation, and migration to a better-fit
service. It is **read-only**. Proposed changes are written as dry-run scripts for a human to review; the
agent never applies them.

## How it works

```
                    ┌──────────────── lead agent (agent/main.py) ────────────────┐
 floci :4566  <───  │ inventory -> delegate in parallel -> cross-cutting findings │
 (boto3, CW)        │ -> ranked summary (top 10 by saving, total)                 │
                    └───────┬───────────────────┬───────────────────┬─────────────┘
                     compute-analyst      data-analyst       network-analyst
                     ec2/asg/eks/ecs/     rds/elasticache/   vpc/nat/eip/elb/
                     lambda               dynamodb/s3/ebs/   route53 + dependency
                                          efs/kinesis/sqs    map
                            └──── all use the same 4 MCP tools (agent/tools.py) ────┘
```

1. The lead takes a quick inventory to find the stacks, then runs the three specialists in parallel.
2. Each specialist investigates its domain with the tools below and calls `record_finding` once per issue.
3. The lead fills gaps and records cross-cutting migration/consolidation findings (these need the
   dependency view), then writes the ranked summary.

### Tools (`agent/tools.py`, in-process MCP server `infra`)

| tool | purpose |
|---|---|
| `aws_read` | Any boto3 `describe_` / `list_` / `get_` / `batch_get_` / `lookup_` call against floci. Other operations are rejected. Output is truncated at ~20k chars. |
| `list_metrics` | Discover CloudWatch series; filter by namespace and/or a substring of a dimension value. |
| `metric_summary` | avg / min / p50 / p95 / max / sum over N days (default 14, hourly), plus first-half vs second-half average for trend. |
| `record_finding` | Store one finding with evidence, saving estimate and basis, confidence, risk, migration notes, and an optional dry-run script. |

### Guardrails

- Built-in tools are disabled (`Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, web tools), so the agent
  only has the four tools above. `permission_mode="dontAsk"`.
- The agent runs with `cwd=out/`, so `ground_truth/` is out of its reach. Do not copy it into `out/`.
- Metrics are **synthetic** (floci produces none; `synth/metrics.py` pushes them). The prompt tells the agent
  to say so and to cap confidence at `medium` unless a configuration fact alone proves the point (e.g. an
  unattached volume).
- Savings figures are rough USD/month estimates from the model's knowledge of list prices, with the basis
  stated in `saving_basis`. Treat them as order-of-magnitude, not billing data.

## Run it

Prerequisites: floci running and the estate built (`./run.sh` from the repo root), plus credentials for
Claude. The SDK launches the Claude Code CLI, so an existing Claude Code login may work; otherwise
`export ANTHROPIC_API_KEY=...`.

```bash
cd /Users/rosuae/Documents/InfraRed
./run.sh                                   # only if the estate isn't up yet
.venv/bin/pip install claude-agent-sdk     # once

.venv/bin/python -m agent.main                                   # full review
.venv/bin/python -m agent.main --focus "NAT gateways and orphan storage"   # cheaper, narrower
.venv/bin/python -m agent.main --model opus --max-turns 200      # stronger model, more headroom
```

Flags: `--focus TEXT` (narrow the review), `--model` (default `sonnet`), `--max-turns` (default 150).
Progress prints each tool call; the final line shows turns and the SDK's estimated cost. A full run makes
many API calls (lead + three subagents), so try `--focus` first.

Each run **deletes and recreates `out/`**.

## Output (`out/`, gitignored)

| path | content |
|---|---|
| `findings.jsonl` | one JSON object per finding: `id`, `title`, `category`, `stack`, `resources`, `evidence`, `recommendation`, `monthly_saving_usd`, `saving_basis`, `confidence`, `risk`, `migration_notes`, `dry_run_script` (path) |
| `report.md` | the lead's final ranked summary |
| `dryrun/F00N.sh` | proposed change for finding `F00N`, using the aws CLI against floci. Review before running; nothing executes it. |

Applying one by hand: `bash out/dryrun/F003.sh` (it sets the floci endpoint and test credentials itself).

## Score it

```bash
.venv/bin/python -m agent.score
```

Compares `out/findings.jsonl` with `ground_truth/planted_issues.json` and prints recall overall and per
category, how many findings match a planted issue, and the missed non-security issues. Matching is by
resource name tokens, so it is crude: read the misses and the unmatched findings by hand (unmatched may be
real extra findings, not false positives). Run it yourself; never expose the ground truth to the agent.

## Known limits

- EKS pods are not simulated, so Kubernetes rightsizing relies on node and ContainerInsights metrics.
- Metric series aren't keyed to the planted-issue ledger; the agent must match series to resources itself.
- Not yet verified: that subagents can call the `mcp__infra__*` tools. If a run shows the specialists
  failing on tool access, move the tool calls to the lead or adjust `AGENTS[...].tools` in `agent/main.py`.
- Output is not yet converted to the `contract/forecast.schema.json` format; `findings.jsonl` is its own shape.

## Files

```
agent/
  main.py    lead + subagent definitions, prompts, run loop
  tools.py   read-only MCP tools and finding/dry-run writer
  score.py   scorer against ground_truth (human use only)
  README.md  this file
```
