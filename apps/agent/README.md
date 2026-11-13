# Infrared optimizer agent

A Claude Agent SDK app with two commands, the investigate and propose steps of the orchestrator (`docs/orchestrator.md` sections 2 and 8). It reviews the simulated AWS estate (floci, see `apps/estate/README.md`) and proposes candidate plans for the engine. It is **read-only**, and it never states a number: the engine prices, checks and ranks every candidate.

## Commands

```bash
python -m agent investigate --infra infra.json --out findings.json
python -m agent propose --infra infra.json --forecast forecast.json --catalog catalog.json \
  --findings findings.json --revision 0 [--feedback feedback.1.json] --out candidates.0.json
```

Global flags, before the command: `--model` (default `sonnet`), `--max-turns` (default 150).

- **investigate**: a lead and three specialists (compute, data, network) read the estate through the tools below and record one finding per issue. Writes `{"findings": [...]}` once at the end. A finding has `id`, `title`, `category`, `stack`, `resources`, `evidence`, `recommendation`, `confidence`, `risk`, `migration_notes` and `dry_run_script`; no saving and no price.
- **propose**: one agent with the findings, the forecast's hard constraints and enabled strategies, and on a revision the reason and the engine's verdict on its previous candidates. It checks each candidate with `evaluate_candidate` and ends with `submit_candidates`. Exits 1 when the model finishes without a successful submit.

## Tools

| tool | command | does |
|---|---|---|
| `aws_read` | investigate | any boto3 `describe_` / `list_` / `get_` / `batch_get_` / `lookup_` call against floci; others are rejected; output cut at ~20k chars |
| `list_metrics` | investigate | CloudWatch series, filtered by namespace and a substring of a dimension value |
| `metric_summary` | investigate | avg / min / p50 / p95 / max / sum over N days, and the trend |
| `record_finding` | investigate | stores one finding; refuses an unknown category |
| `evaluate_candidate` | propose | runs the engine on one candidate and answers with its verdict: `feasible`, `violations`, `run_eur_month_now`, `availability_pct`, `risk`, `rank` |
| `submit_candidates` | propose | checks the candidates against `contracts/candidates.schema.json` and `contracts/candidates_integrity.py`, then writes `--out`; refuses with the reasons and writes nothing when they break |

Built-in tools are disabled (`Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, web tools) and `permission_mode` is `dontAsk`. The session's working directory is the directory of `--out`, so `apps/estate/ground_truth/` stays out of reach. Metrics are synthetic: the prompt says so and caps confidence at `medium` unless a configuration fact alone proves the point.

## Configuration

From the repo-root `.env`, through `agent/settings.py`; a missing variable stops the agent at startup, naming it.

- `ANTHROPIC_API_KEY`, and `ANTHROPIC_BASE_URL` only when routing through another provider.
- `AWS_ENDPOINT_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` for investigate.
- `AGENT_ENGINE_CMD` for propose, e.g. `python -m engine`, with `apps/engine` on `PYTHONPATH`.

## Site store

Listings for the on-prem site step (`docs/onprem-site.md`) live in Postgres with PostGIS. Only the `site_step` role reaches them: select, insert and update on `site_options`, nothing else.

```bash
docker compose up -d --wait sites-db
```

The container applies `migrations/001_site_options.sql`, then `migrations/local/900_site_step_login.sql`, which adds the local login `site_step_login` (password `site_step`). The migrations run only on an empty volume: after changing one, `docker compose down -v` and start again.

`SITES_DATABASE_URL` is the site step's connection string. The store tests need two more, and skip without them:

```bash
export SITES_TEST_ADMIN_URL=postgresql://sites_admin:sites_admin@127.0.0.1:54329/sites
export SITES_TEST_DATABASE_URL=postgresql://site_step_login:site_step@127.0.0.1:54329/sites
.venv/bin/python -m pytest -q tests/test_site_store.py
```

CI runs them in the `site-store` job, against the same image.

## Run and test

From `apps/agent/`:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q
```

The tests run with no model: a fake session calls the tools directly, the engine is the real one.

## Score it

The scorer lives with the ground truth, in `apps/estate/`. It reads the findings document (or an older `findings.jsonl`):

```bash
python apps/estate/score.py runs/run-startup-0001/findings.json
```

It compares the findings with `apps/estate/ground_truth/planted_issues.json` and prints recall overall and per category. Matching is by resource name tokens, so read the misses by hand. Run it yourself; never expose the ground truth to the agent.

## Known limits

- EKS pods are not simulated, so Kubernetes rightsizing relies on node and ContainerInsights metrics.
- Not yet verified: that subagents can call the `mcp__infra__*` tools.
- Not yet run against a model since the CLI split: see the pull request's manual checks.

## Layout

| Path | Layer | Holds |
|---|---|---|
| `agent/cli.py`, `agent/__main__.py` | entry point | arguments, wiring |
| `agent/application/` | application | `investigate`, `propose` (`Proposal`), the tool shape, the ports |
| `agent/domain/` | domain | prompts, the findings log, the candidates document and the figures read from a result |
| `agent/adapters/` | adapters | the SDK session, AWS clients and read tools, the engine subprocess, the contract checker |
| `agent/settings.py` | configuration | the environment and `.env` |
