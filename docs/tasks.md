# Infrared tasks

Built against `docs/spec.md`. P0 is the demo path and lands before the feature freeze; P1 follows once P0 works; P2 only if there is time.

## Order of work

1. Vlad sets up the repo and merges #3, then #2. Everyone builds on that `main`.
2. The contracts land first (`result`, `run`, `rehearsal` schemas), so the engine, the orchestrator, the sandbox and the dashboard can be built in parallel against them.
3. Each person works on their own branch and opens a pull request into `main`.

## Vlad: orchestrator and the agentic workflow

| Pri | Task | Done when |
| --- | --- | --- |
| P0 | Repo setup: merge #3, then #2; fix the items in spec section 5 (paths, `requirements.txt`, the name, bash note); CI runs `check_mock.py` on every pull request | `main` has the estate, the contract and the engine design; CI is green |
| P0 | Settle LLM access: Anthropic key, or the agent through OpenRouter | one agent run completes on the mock |
| P0 | `run.schema.json`: run state and events | the dashboard and the Slack bot can read a sample run |
| P0 | Orchestrator in Go: runs steps 1 to 6 of the workflow (spec section 3), holds run state, logs every decision with its reason, exposes runs and events over HTTP | a run on the mock reaches step 6 with every step logged |
| P0 | The revise loop: engine violations and sandbox gaps go back to the agent, bounded by a maximum number of revisions | an injected constraint failure triggers exactly one revision |
| P0 | Approval endpoints: pick the analyses to keep, approve the plan | the dashboard and Slack can both approve |
| P1 | Agent change: an `evaluate_candidate` tool that calls the engine, so the agent's numbers come from the engine | no number in the output comes from the model |
| P2 | Phase 2: one pull request per step, monitor it, verify after merge, re-plan on divergence | one step goes from plan to merged pull request to verified |

## Remus: decision engine

Continues #2.

| Pri | Task | Done when |
| --- | --- | --- |
| P0 | `result.schema.json` from the sketch in #2 section 6 | the dashboard can render a sample `result.json` |
| P0 | Engine steps a to d: loaders and baseline, `do_nothing` with constraints, `cleanup_orphans`, `rightsize_in_place` | each step passes its test in #2 section 7 |
| P0 | Steps e and g: `managed_services` with the feature check; scoring, Pareto, payback, robustness, the nothing-feasible fallback | a deterministic winner, and every losing candidate has a reason |
| P0 | Determinism test | the same inputs give the same `result.json`, byte for byte |
| P1 | Step f: `move_to_onprem` with the full platform cost | capex, cooling, disks and staff appear in the result |
| P1 | Step h: run on the real Floci extraction | no crash; the real-data flags appear |
| P1 | Catalog: add the first targets beyond AWS (Supabase or Neon first) | a cross-provider move is priced |

## Andrei: mocked systems, sandbox, Slack bot

Continues the estate in #3.

| Pri | Task | Done when |
| --- | --- | --- |
| P0 | A start-up-sized mock (EUR 3-8k a month, about 10 components) with its `forecast.json` | passes `check_mock.py`; the engine finds a winner on it |
| P0 | `rehearsal.schema.json` | the orchestrator can read a sample rehearsal |
| P0 | Sandbox: build a candidate's end state in Floci, send synthetic traffic, inject one failure, measure availability and latency | a rehearsal of the start-up mock's winner returns results in the schema |
| P1 | Extractor extensions: AI consumption, Postgres statistics for refactoring, GitHub runners | the new fields pass the extended schema |
| P1 | Slack bot: run summaries and approval buttons, calling the orchestrator API (Vlad provides the Slack keys) | the plan is approved from Slack and the run continues |

## Robi: dashboard

| Pri | Task | Done when |
| --- | --- | --- |
| P0 | Run view: the steps of a run, live, with each decision and its reason | a run on the mock is followed step by step |
| P0 | Dependency graph, built from the prototype in #3 `graph/` | the start-up mock's graph renders with its edges |
| P0 | Candidates: cost, availability, risk, effort, why each lost; the winner's change step by step | renders a `result.json` from the engine |
| P0 | Approvals: pick the analyses to keep, approve the plan | calls the orchestrator's approval endpoints |
| P1 | Rehearsal view: traffic, the failure injected, the fallback | renders a `rehearsal.json` |
| P2 | Chrome extension for the GitHub organisation: run status and runner suggestions | shows the latest run inside GitHub |

## Miruna: branding, design, pitch

| Pri | Task | Done when |
| --- | --- | --- |
| P0 | Palette, mascot, logo | approved by Vlad |
| P0 | Design tokens (colours, type, spacing, radii) as global CSS variables, handed to Robi | the dashboard uses only the tokens |
| P0 | Dashboard screens: run view, graph, candidates, approvals | Robi builds from them |
| P1 | Pitch website: content from the PRD, screenshots from the dashboard, the rubric mapped slide by slide | a live URL |
| P1 | Video: screen recordings, Rive animations, AI voiceover, the sound library | a finished cut |

## Needs a decision

- **Engine language:** Python, as designed in #2, or Go with the orchestrator. These tasks assume Python.
- **Who is who on GitHub:** #2 is from `alexremus26` and #3 from `rosuae`. These tasks assume `alexremus26` is Remus and `rosuae` is Andrei.
