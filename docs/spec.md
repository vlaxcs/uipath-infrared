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
| Phone frame | an iPhone screen on the laptop, running a browser logged into Slack, where approvals happen live in the demo | TypeScript | new |
| Product page | the vertical page that carries the theme and doubles as the pitch site | TypeScript, React | started (`apps/site`, imported from an earlier product page) |

**How components connect.** The pipeline stages exchange contract files (`infra.json`, `forecast.json`, `catalog.json`, `result.json`), validated against their schemas. The orchestrator calls each stage as a subprocess or over HTTP, and serves run state and events to the surfaces over an HTTP JSON API. No gRPC and no protobuf in the MVP: the JSON Schemas in `contracts/` are the only contract.

## 3. Repository structure

Every service lives under `apps/`, one folder per service. Contracts are shared and live outside the services.

```
apps/
  estate/            Floci estate simulator, synthetic metrics, ground truth
  extractor/         infra.json from the cloud APIs
  agent/             investigation and candidate proposals
  engine/            pricing, constraints, ranking
  sandbox/           rehearsal: traffic and failure simulation
  orchestrator/      the workflow, run state, approvals, HTTP API (Go)
  dashboard/         the web app
  slack-bot/
  chrome-extension/
  phone/             the iPhone frame with Slack
  site/              the product page: theme and pitch
contracts/           JSON Schemas, examples, mocks, check_mock.py
design/              tokens.css, shared by the dashboard, the phone and the site
docs/                prd.md, spec.md, team/<name>.md (one task file per person)
```

`apps/estate/ground_truth/` is the agent's answer key: no other service reads it.

## 4. Engineering rules

**Structure**
- Respect the structure above. A file lives in the service it belongs to; nothing shared lives inside a service.
- No single-layer services. Each service separates its entry point (CLI, HTTP handler, bot event), its application logic, its domain, and its adapters to the outside world (cloud APIs, Floci, Slack, GitHub, the LLM). The domain never imports an adapter.
- One responsibility per file. A file that needs a section banner to be readable is two files.

**Code**
- No comments. The only exceptions are license headers and pragmas the tooling requires. If code needs a comment to be readable, rename things until it doesn't.
- Sophisticated, not complicated: if an approach can't be explained in two sentences, it's the wrong approach.
- No premature pessimisation, in this order: never call an API or a query inside a loop when a batch exists; never read fields you don't use, and never ship them to the client; batch writes; pick the right data structure before the input grows.
- Never claim something is fast without a measurement.
- Frontend: design tokens (colours, type, spacing, radii) live as global CSS variables. No hardcoded values or inline styles in components.

**Tests**
- Every behaviour in this spec gets a test, written while it is built, not after.
- A test that can't fail is deleted. Tests check behaviour someone would notice breaking, not the implementation.
- Every bug gets a failing test before its fix.

**Git**
- Every change lands through a pull request into `main`. Nobody pushes to `main` directly.
- A pull request's description states what it changes, what depends on it, and the manual checks a reviewer runs.

**Ownership of the flow**
- Vlad owns the flow end to end: the agent, the orchestrator, every schema in `contracts/`, and the end-to-end flow test.
- Others build components that plug into the flow. A component is done when it passes the flow test, not when it works on its own.
- Every pull request that touches `contracts/`, the orchestrator, the agent, or the entry point a component exposes to the flow (the engine's CLI, the sandbox's CLI, how the surfaces call the orchestrator API) needs Vlad's review.
- A bug in the flow gets a failing flow test before its fix, whoever's component it is in.

## 5. The agentic workflow

One run, per project:

| Step | Who | Input | Output | Decides next step on |
| --- | --- | --- | --- | --- |
| 1. Extract | extractor | cloud APIs, CloudWatch, DB statistics, GitHub API | `infra.json` | schema check fails: stop with the reason |
| 2. Investigate | agent | `infra.json`, read-only tools | findings with evidence | which components need deeper reads |
| 3. Propose | agent | findings, `forecast.json` | candidate plans (actions per component) | |
| 4. Evaluate | engine | candidates, `infra.json`, `forecast.json`, `catalog.json` | `result.json`: cost, availability, risk, effort, violations, rank | a candidate breaks a hard constraint: the agent revises it (back to 3) |
| 5. Present | orchestrator, dashboard, Slack | `result.json` | the analyses, the proposed layouts with their costs and availability, the step-by-step change | the CTO picks which analyses carry into the next plans, and the layout to rehearse |
| 6. Rehearse | sandbox | the layout the CTO picked | traffic and failure results | misses the forecast: back to 3 with the measured gap; holds: the CTO approves the plan |
| 7. Migrate (phase 2) | orchestrator | approved plan | one pull request per step in the client's repo | a person approves; the client's CI applies |
| 8. Verify (phase 2) | extractor, engine | the infrastructure after merge | measured vs forecast | diverges: re-plan the remaining steps |

The loops are what make Infrared an agent and not a fixed pipeline: what the engine returns in step 4 and what the sandbox measures in step 6 decide whether the agent keeps, revises or drops a candidate. Every loop is bounded (a maximum number of revisions per run), and every decision is logged with its reason so a run can be replayed.

The sandbox runs after the CTO picks a layout, not before: it rehearses only what the CTO wants, and the rehearsal is a visible step in the run.

**Human in the loop.** Runs pause at three points: after step 5 (which analyses carry forward, which layout to rehearse), after step 6 (approve the plan), and on every pull request (approve the step). Approvals come from the dashboard or Slack.

**Decision criteria per project.** Each project has its own `forecast.json`, with its own criteria: high availability (`ha_level`, `min_availability_pct`), cost (`weights`, budget), and zones (`min_zones`, residency).

## 6. Contracts

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

## 7. What we keep from #2 and #3

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
- Move `infrared/` into the structure in section 3: `synth/` and `ground_truth/` to `apps/estate/`, `extract_floci.py` to `apps/extractor/`, `agent/` to `apps/agent/`, `graph/` to `apps/dashboard/`, the schemas, examples, mocks and checker to `contracts/`.
- Remove the comments and docstrings (section 4), and split single-file modules into the layers section 4 asks for, starting with `extract_floci.py` (811 lines) and `agent/main.py`.
- `infrared/agent/README.md` has a path from one laptop (`/Users/...`); use paths relative to the repo.
- No pinned dependencies: add `requirements.txt` (`boto3`, `claude-agent-sdk`, `jsonschema`).
- The product name is spelled "InfraRed" in #3 and #2; the product is **Infrared**.
- `run.sh`, `reset.sh`, `stop-live.sh` are bash only; document that Windows machines run them in Git Bash or WSL.
- #2 targets #3's branch: merge #3 first, then #2.

## 8. LLM

The agent runs on the Claude Agent SDK, which expects an Anthropic API key. The hackathon provides OpenRouter credentials. Before building on it, confirm one of: the team has an Anthropic key, or the SDK runs through OpenRouter's Anthropic-compatible endpoint. Until confirmed, this is the biggest risk to the agent.

## 9. Demo path

1. A start-up-sized project in Floci with a poor infrastructure, and its `forecast.json`.
2. A run starts from the dashboard; the steps appear live.
3. The engine rejects one candidate for a hard constraint (a zone the project does not allow); the agent revises it.
4. The dashboard shows the dependency graph, the candidates with why each lost, and the change step by step.
5. The CTO picks the analyses to keep and the layout to rehearse.
6. The sandbox rehearses that layout: traffic runs, a failure is injected, the fallback holds.
7. The CTO approves the plan from Slack, on the phone frame next to the dashboard.
8. Phase 2, if built: the first step opens a pull request; after merge, Infrared verifies against the forecast.

A recorded run of the same path is kept as a fallback.

## 10. Testing

- Contracts: `check_mock.py` on every contract file, in CI.
- Engine: build steps a to h, each tested against `mock/demo-shop.expected-signals.md` (#2 section 7); never against `ground_truth/`.
- Agent: `score.py` against `ground_truth/`, recall reported per run.
- Determinism: the same inputs give the same `result.json`, byte for byte.
- Workflow: a run on the mock reaches step 6 with every step logged; an injected constraint failure triggers exactly one revision.
- The flow test: one run of the demo path end to end, in CI. It starts with every component replaced by a stub that returns its sample file; each stub is swapped for the real component as it lands, and the test must stay green.

## 11. Open decisions

- Engine language: Python, as designed in #2, or Go with the orchestrator.
- LLM access: Anthropic key or OpenRouter (section 8).
- Which targets the catalog prices first (the PRD lists more than the catalog covers).
- Who chooses the criteria for a project.
- Phase 2 infrastructure code: OpenTofu or Terraform, and which repository the pull requests go to in the demo.

## 12. Out of scope today

- Providers other than AWS as the source cloud.
- Applying any change outside Floci.
- Billing, accounts and the subscription scheduler.
- Exhaustive pricing; the catalog stays illustrative and says so.
