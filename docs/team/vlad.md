# Vlad: the agentic workflow end to end

Your lane: the repo, the agent and the orchestrator that runs it. You turn the pieces everyone else builds into one run that goes from a project's infrastructure to an approved plan, and in phase 2 to merged pull requests. You also make the swap calls when a lane runs late.

Time: `H+0` is the commit that added this file. Feature freeze at `H+8`; after it, only integration and fixes on the demo path.

Read first: `docs/spec.md` sections 2, 3, 4, 5, 6 and 9.

## You own

`apps/orchestrator/`, `apps/agent/`, `contracts/run.schema.json`, the CI, and the merge order on `main`.

## Order

| # | Task | Spec | Size | Done when |
|---|---|---|---|---|
| 1 | Merge #3, then #2; move them into `apps/` and `contracts/`; fix the items in section 7 | 3, 7 | M | `main` follows the structure; `check_mock.py` passes from `contracts/` |
| 2 | CI: `check_mock.py`, lint and tests on every pull request | 4, 10 | S | a pull request with a broken schema goes red |
| 3 | LLM access: Anthropic key, or the agent through OpenRouter | 8 | S | one agent run completes on the mock |
| 4 | `run.schema.json` with a sample run: steps, status, each decision and its reason | 6 | S | Robi renders the sample; Andrei's bot reads it |
| 5 | Orchestrator in Go: steps 1 to 6, run state, every decision logged, runs and events over HTTP; it pauses after step 5 for the CTO to pick a layout, then rehearses it | 5 | L | a run on the start-up mock reaches step 6 with every step logged |
| 6 | The revise loop: engine violations and sandbox gaps go back to the agent, capped per run | 5 | M | an injected constraint failure triggers exactly one revision |
| 7 | Approval endpoints: keep analyses, pick the layout to rehearse, approve the plan | 5 | S | the dashboard and Slack both approve |
| 8 | Agent: an `evaluate_candidate` tool calling Remus's engine; comments removed, split into layers | 4, 7 | M | no number in the output comes from the model |
| 9 | Phase 2: a pull request per step, watch it, verify after merge, re-plan on divergence | 5 | L | one step goes from plan to merged pull request to verified |

## What you hand over

| To | What | By |
|---|---|---|
| Everyone | `main` in the `apps/` structure, CI green | `H+1` |
| Andrei | the Slack keys | `H+1` |
| Robi, Andrei | `run.schema.json` and a sample run | `H+2` |
| Robi, Andrei | the orchestrator API: list runs, one run with its events, start a run, approve | `H+5` |

## What you expect

| From | What | By | If late |
|---|---|---|---|
| Remus | `result.schema.json` and a sample `result.json` | `H+2` | the orchestrator passes the sample through |
| Remus | `engine evaluate <infra> <forecast> <catalog>` giving `result.json` | `H+5` | the agent's findings only, marked unpriced |
| Andrei | the start-up mock and its `forecast.json` | `H+3` | run on `demo-shop` |
| Andrei | `sandbox rehearse <candidate>` giving `rehearsal.json` | `H+6` | step 6 is skipped and the run says "not rehearsed" |
| Robi | the run view and approvals on the dashboard | `H+6` | approve over the API by hand in the demo |

## Swap calls you make

- At `H+8`, everything on the demo path works or a P2 goes: phase 2 first, then the Chrome extension.
- If the engine slips, Remus keeps steps a to d and drops on-prem; the demo shows a cleanup and a rightsize instead of a cross-provider move.
