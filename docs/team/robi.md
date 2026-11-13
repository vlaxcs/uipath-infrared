# Robi: dashboard and phone

Your lane: everything the CTO sees during the demo. The phone frame where the plan is approved in Slack, and the dashboard where a run is followed step by step, from the dependency graph to the winning change.

Time: `H+0` is the commit that added this file. Feature freeze at `H+8`.

Read first: `docs/spec.md` sections 2, 4, 5 and 9.

## You own

`apps/phone/`, `apps/dashboard/`, `apps/chrome-extension/`.

## Order

| # | Task | Spec | Size | Done when |
|---|---|---|---|---|
| 1 | Phone frame: an iPhone screen on the laptop, a browser logged into Slack | 2, 9 | S | Slack works inside the frame next to the dashboard |
| 2 | Dashboard shell on Miruna's tokens | 4 | S | no hardcoded colours or sizes |
| 3 | Run view: the steps of a run, live, each decision and its reason | 5 | M | the sample run renders, then a real one |
| 4 | Dependency graph, from the prototype that came with #3 | 2 | M | the start-up mock's graph renders with its edges |
| 5 | Candidates: cost, availability, risk, effort, why each lost; the winner's change step by step | 5 | L | renders a real `result.json` |
| 6 | Approvals: keep analyses, pick the layout to rehearse, approve the plan | 5 | S | calls the orchestrator and the run continues |
| 7 | Rehearsal view: traffic, the failure injected, the fallback | 5 | M | renders a `rehearsal.json` |
| 8 | Chrome extension: the latest run and runner suggestions inside the GitHub organisation | 2 | M | shows the latest run on a GitHub page |

Build on the sample files first; swap to the real API as soon as it exists.

## What you hand over

| To | What | By |
|---|---|---|
| Vlad | the phone frame | `H+4` |
| Vlad | run view and approvals | `H+6` |
| The pitch | screenshots of every view | `H+8` |

## What you expect

| From | What | By | If late |
|---|---|---|---|
| Miruna | tokens and the dashboard screens | `H+2`, `H+3` | neutral tokens, swapped later |
| Vlad | `run.schema.json` and a sample run | `H+2` | build on a hand-written sample |
| Remus | a sample `result.json` | `H+2` | build on the sketch in `docs/decision-engine.md` |
| Andrei | a sample `rehearsal.json` | `H+2` | the rehearsal view waits |
| Vlad | the orchestrator API | `H+5` | keep the samples |
