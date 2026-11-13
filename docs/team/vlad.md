# Vlad: owner of the flow

Your lane: the flow, end to end, and that it has no bugs. You own the agent, the orchestrator, every contract between components, and the end-to-end test of the demo path. Everyone else builds a component that plugs into your flow; a component is done when it passes your flow test, not when it works on its own. You also make the swap calls when a lane runs late.

Time: `H+0` is the commit that added this file. Feature freeze at `H+8`; after it, only integration and fixes on the demo path.

Read first: `docs/spec.md`, all of it.

## You own

- `apps/orchestrator/`, `apps/agent/`.
- `contracts/`, every schema. Remus drafts `result.schema.json` and Andrei drafts `rehearsal.schema.json`; nothing in `contracts/` merges without your review.
- The end-to-end flow test and the CI.
- The merge order on `main`, and the review of every pull request that touches `contracts/`, the orchestrator, the agent, or the entry point a component exposes to the flow (the engine's CLI, the sandbox's CLI, the orchestrator API the surfaces call).

## Order

| # | Task | Spec | Size | Done when |
|---|---|---|---|---|
| 1 | Merge #3, then #2; move them into `apps/` and `contracts/`; fix the items in section 7 | 3, 7 | M | `main` follows the structure; `check_mock.py` passes from `contracts/` |
| 2 | `run.schema.json` with a sample run; review and merge the drafts of `result` and `rehearsal` | 6 | S | all three schemas on `main` with a sample each |
| 3 | The flow test: one run of the demo path end to end, every component replaced by a stub that returns its sample file | 5, 9, 10 | M | green on stubs; each stub is swapped for the real component as it lands, and the test stays green |
| 4 | CI: `check_mock.py`, lint, unit tests and the flow test on every pull request | 4, 10 | S | a pull request that breaks a contract or the flow goes red |
| 5 | LLM access: Anthropic key, or the agent through OpenRouter | 8 | S | one agent run completes on the mock |
| 6 | Orchestrator in Go: steps 1 to 6, run state, every decision logged, runs and events over HTTP; it pauses after step 5 for the CTO to pick a layout, then rehearses it | 5 | L | the flow test passes on the real orchestrator |
| 7 | The revise loop: engine violations and sandbox gaps go back to the agent, capped per run | 5 | M | an injected constraint failure triggers exactly one revision, as a test |
| 8 | Approval endpoints: keep analyses, pick the layout to rehearse, approve the plan | 5 | S | the dashboard and Slack both approve, as a test |
| 9 | Agent: an `evaluate_candidate` tool calling the engine; comments removed, split into layers | 4, 7 | M | no number in the output comes from the model, as a test |
| 10 | Integration at every handoff: swap a stub for the real component, run the flow, file what breaks against its owner | 10 | M | the flow test passes with every real component by `H+8` |
| 11 | Phase 2: a pull request per step, watch it, verify after merge, re-plan on divergence | 5 | L | one step goes from plan to merged pull request to verified |

## What you hand over

| To | What | By |
|---|---|---|
| Everyone | `main` in the `apps/` structure, CI green | `H+1` |
| Andrei | the Slack keys | `H+1` |
| Everyone | the three schemas and their samples on `main` | `H+2` |
| Everyone | the flow test on stubs, in CI | `H+3` |
| Robi, Andrei | the orchestrator API: list runs, one run with its events, start a run, approve | `H+5` |

## What you expect

| From | What | By | If late |
|---|---|---|---|
| Remus | the draft of `result.schema.json` and a sample | `H+2` | you write it from #2's sketch |
| Andrei | the draft of `rehearsal.schema.json` and a sample | `H+2` | you write it from section 6 |
| Remus | `engine evaluate <infra> <forecast> <catalog>` passing the flow test | `H+5` | the stub stays; the demo shows the agent's findings, marked unpriced |
| Andrei | the start-up mock and its `forecast.json` | `H+3` | run on `demo-shop` |
| Andrei | `sandbox rehearse <layout>` passing the flow test | `H+6` | the stub stays; the run says "not rehearsed" |
| Robi | the run view and approvals, on the real API | `H+6` | approve over the API by hand in the demo |

## Rules you own

- A bug in the flow gets a failing flow test before its fix, whoever's component it is in.
- No one changes a contract without your review; a contract change ships with its sample and the flow test updated.
- At `H+8`, everything on the demo path passes the flow test or a P2 goes: phase 2 first, then the Chrome extension.
- If the engine slips, Remus keeps steps a to d and g and drops on-prem; the demo shows a cleanup and a rightsize instead of a cross-provider move.
