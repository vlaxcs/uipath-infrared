# Infrared SPEC

The technical design for building Infrared, as described in `docs/prd.md`. This is the general spec: the architecture, the agentic workflow, the contracts between components, and what each component does. Each component gets its own detailed spec when it is built.

## 1. Principles

- **The LLM proposes, a deterministic engine decides, the LLM explains.** Every number in the output comes from the engine and traces back to a catalog price, an SLA figure, a forecast assumption or an infrastructure fact. The same inputs always give the same winner.
- **Read-only on the client's cloud.** Infrared never changes infrastructure itself. In phase 2, changes reach the cloud only as pull requests that a person approves and the client's own CI applies.
- **Facts and judgement stay apart.** The extractor reports facts with their provenance (`observed`, `estimated`, `synthetic`); only the engine and the agent turn them into findings. Every recommendation carries the weakest provenance behind it as its confidence.
- **Contract first.** Components talk through versioned JSON Schemas, so each one is built and tested on its own, in parallel.

## 2. Architecture

```
                     ┌───────────────────────── orchestrator (the agentic workflow) ─────────────────────────┐
 client cloud  ──►   │ extract ──► investigate ──► propose ──► evaluate ──► rehearse ──► present ──► migrate │
 (Floci in MVP)      │  extractor    agent          agent       engine      sandbox      dashboard   phase 2 │
 GitHub org    ──►   │                    ▲                        │            │          Slack       PRs    │
 DB statistics ──►   │                    └──── re-plan when a step fails or reality diverges ──┘            │
                     └─────────────────────────────────────────────────────────────────────────────────────────┘
                                 run state + events (HTTP JSON API) ──► dashboard, Slack bot, Chrome extension
```

| Component | Does | Language | Status |
| --- | --- | --- | --- |
| Estate simulator | builds deliberately poor infrastructure in Floci, pushes synthetic metrics | Python | exists (#3) |
| Extractor | reads the estate through read-only APIs, writes `infra.json` | Python | exists (#3) |
| Agent | investigates, records qualitative findings, proposes candidate plans | Python, Claude Agent SDK | exists, read-only (#3) |
| Engine | prices, checks constraints, scores and ranks candidates; writes `result.json` | Python | designed (#2), not built |
| Sandbox | builds the proposed infrastructure in Floci, simulates traffic and failures | Python | new |
| Orchestrator | runs the workflow, holds run state, gates approvals, exposes the API | Go | new |
| Dashboard | runs, the dependency graph, candidates, the step-by-step change, approvals | web (TypeScript) | prototype graph exists (#3) |
| Slack bot | run summaries and approvals | Go or TypeScript | new |
| Chrome extension | Infrared inside the GitHub organisation: runners, run status | TypeScript | new |

**How components connect.** The pipeline stages exchange contract files (`infra.json`, `forecast.json`, `catalog.json`, `result.json`), validated against their schemas. The orchestrator calls each stage as a subprocess or over HTTP, and serves run state and events to the surfaces over an HTTP JSON API. gRPC is reserved for Go-to-Go calls if more Go services appear; with one Go service, plain HTTP and the existing JSON Schemas avoid maintaining a second set of definitions in protobuf.

## 3. The agentic workflow

One run, per project:

| Step | Who | Input | Output | Decides next step on |
| --- | --- | --- | --- | --- |
| 1. Extract | extractor | cloud APIs, CloudWatch, DB statistics, GitHub API | `infra.json` | schema check fails: stop with the reason |
| 2. Investigate | agent | `infra.json`, read-only tools | findings with evidence | which components need deeper reads |
| 3. Propose | agent | findings, `forecast.json` | candidate plans (actions per component) | |
| 4. Evaluate | engine | candidates, `infra.json`, `forecast.json`, `catalog.json` | `result.json`: cost, availability, risk, effort, violations, rank | a candidate breaks a hard constraint: the agent revises it (back to 3) |
| 5. Rehearse | sandbox | the winning candidate | traffic and failure results | availability or latency misses the forecast: back to 3 with the measured gap |
| 6. Present | orchestrator, dashboard, Slack | `result.json`, rehearsal results | the analyses, the new layout, the step-by-step change | the CTO picks which analyses carry into the next plans |
| 7. Migrate (phase 2) | orchestrator | approved plan | one pull request per step in the client's repo | a person approves; the client's CI applies |
| 8. Verify (phase 2) | extractor, engine | the infrastructure after merge | measured vs forecast | diverges: re-plan the remaining steps |

The loop between 3, 4 and 5 is what makes Infrared an agent and not a fixed pipeline: what the engine and the sandbox return decides whether the agent keeps, revises or drops a candidate. Every loop is bounded (a maximum number of revisions per run), and every decision is logged with its reason so a run can be replayed.

**Human in the loop.** Runs pause at three points: after step 6 (which analyses carry forward), before step 7 (approve the plan), and on every pull request (approve the step). Approvals come from the dashboard or Slack.

**Decision criteria per project.** Each project has its own `forecast.json`, with its own criteria: high availability (`ha_level`, `min_availability_pct`), cost (`weights`, budget), and zones (`min_zones`, residency).

## 4. Contracts

| Contract | Owner | Status |
| --- | --- | --- |
| `infra.schema.json` | extractor | exists (#3), v1.0 |
| `forecast.schema.json` | orchestrator (from the roadmap) | exists (#3), v1.0 |
| `catalog.schema.json` | engine | exists (#3), v1.0, illustrative prices |
| `result.schema.json` | engine | to write, from the sketch in #2 section 6 |
| `run.schema.json`: run state and events (step, status, decision, reason, timestamps) | orchestrator | to write |
| `rehearsal.schema.json`: sandbox results (traffic profile, failures injected, availability, latency) | sandbox | to write |

Extensions the PRD needs, as minor versions of `infra.schema.json`:
- AI consumption: token spend per model and provider, GPU utilisation (GPU metrics already exist as usage).
- Database schemas: tables, sizes, hot tables, from Postgres statistics, for the refactoring suggestions. Schemas and statistics only, never table rows.
- GitHub runners: runner type, hours, workflow history.

## 5. What we keep from #2 and #3

| Piece | Verdict | Why |
| --- | --- | --- |
| #3 `synth/` estate in Floci | keep | builds, metrics and incident story work; becomes the sandbox's base |
| #3 `ground_truth/` and `agent/score.py` | keep | the evaluation set; never in the agent's reach |
| #3 `contract/` schemas, `check_mock.py`, mock and real extraction | keep | mock and real both pass the checker (0 errors; 1 warning on the real file) |
| #3 `extract_floci.py` | keep, extend | add AI consumption, database statistics, GitHub runners |
| #3 `agent/` | keep, change | its savings come from the model's memory; numbers must come from the engine through an `evaluate_candidate` tool; findings must map to `result.json` |
| #3 `graph/` (graph.html) | keep as prototype | the dependency graph view the dashboard builds on |
| #2 `docs/decision-engine.md` | keep | the engine's design: build steps a to h as written |
| #2 open decisions (section 5) | accept the proposals | priced `security_remediation` layer; keep the infeasible budget as a demo; add a start-up-sized mock |

**To fix before merging:**
- `infrared/agent/README.md` has a path from one laptop (`/Users/...`); use paths relative to the repo.
- No pinned dependencies: add `requirements.txt` (`boto3`, `claude-agent-sdk`, `jsonschema`).
- The product name is spelled "InfraRed" in #3 and #2; the product is **Infrared**.
- `run.sh`, `reset.sh`, `stop-live.sh` are bash only; document that Windows machines run them in Git Bash or WSL.
- #2 targets #3's branch: merge #3 first, then #2.

## 6. LLM

The agent runs on the Claude Agent SDK, which expects an Anthropic API key. The hackathon provides OpenRouter credentials. Before building on it, confirm one of: the team has an Anthropic key, or the SDK runs through OpenRouter's Anthropic-compatible endpoint. Until confirmed, this is the biggest risk to the agent.

## 7. Demo path

1. A start-up-sized project in Floci with a poor infrastructure, and its `forecast.json`.
2. A run starts from the dashboard; the steps appear live.
3. The engine rejects one candidate for a hard constraint (a zone the project does not allow); the agent revises it.
4. The sandbox rehearses the winner, a failure is injected, the fallback holds.
5. The dashboard shows the dependency graph, the candidates with why each lost, and the change step by step.
6. The CTO picks the analyses to keep and approves the plan from Slack.
7. Phase 2, if built: the first step opens a pull request; after merge, Infrared verifies against the forecast.

A recorded run of the same path is kept as a fallback.

## 8. Testing

- Contracts: `check_mock.py` on every contract file, in CI.
- Engine: build steps a to h, each tested against `mock/demo-shop.expected-signals.md` (#2 section 7); never against `ground_truth/`.
- Agent: `score.py` against `ground_truth/`, recall reported per run.
- Determinism: the same inputs give the same `result.json`, byte for byte.
- Workflow: a run on the mock reaches step 6 with every step logged; an injected constraint failure triggers exactly one revision.

## 9. Open decisions

- Engine language: Python, as designed in #2, or Go with the orchestrator.
- LLM access: Anthropic key or OpenRouter (section 6).
- Which targets the catalog prices first (the PRD lists more than the catalog covers).
- Who chooses the criteria for a project.
- Phase 2 infrastructure code: OpenTofu or Terraform, and which repository the pull requests go to in the demo.

## 10. Out of scope today

- Providers other than AWS as the source cloud.
- Applying any change outside Floci.
- Billing, accounts and the subscription scheduler.
- Exhaustive pricing; the catalog stays illustrative and says so.
