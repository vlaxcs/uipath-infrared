# Andrei: mocked systems, sandbox, Slack bot

Your lane: everything Infrared reads and everything it rehearses on. The estate in Floci, the extractor, the start-up mock, the sandbox that runs traffic and failures on a proposed infrastructure, and the Slack bot. It continues the estate in #3.

Time: `H+0` is the commit that added this file. Feature freeze at `H+8`.

Read first: `docs/spec.md` sections 2, 3, 5 and 6; `contracts/README.md`.

## You own

`apps/estate/`, `apps/extractor/`, `apps/sandbox/`, `apps/slack-bot/`, `contracts/infra.schema.json`, `contracts/rehearsal.schema.json`, the mocks.

## Order

| # | Task | Spec | Size | Done when |
|---|---|---|---|---|
| 1 | `rehearsal.schema.json` with a sample: traffic profile, failure injected, availability, latency | 6 | S | `check_mock.py` validates it; Robi renders it |
| 2 | A start-up-sized mock: EUR 3-8k a month, about 10 components, with its `forecast.json` | 7 | M | passes `check_mock.py`; Remus's engine finds a winner on it |
| 3 | The same start-up estate built in Floci by `apps/estate/` | 9 | M | the extractor's output matches the mock's components |
| 4 | Sandbox: build a candidate's end state in Floci, send synthetic traffic, inject one failure, measure | 5 | L | a rehearsal of the start-up winner returns `rehearsal.json` |
| 5 | The extractor split into layers, comments removed | 4, 7 | M | same output as before, as a test |
| 6 | Slack bot: run summaries and approval buttons on the orchestrator API | 2 | M | the plan is approved from Slack and the run continues |
| 7 | Extractor extensions: AI consumption, Postgres statistics, GitHub runners | 6 | M | the new fields pass the extended schema |

## What you hand over

| To | What | By |
|---|---|---|
| Vlad, Robi | `rehearsal.schema.json` and a sample | `H+2` |
| Vlad, Remus | the start-up mock and its `forecast.json` | `H+3` |
| Vlad | `sandbox rehearse <candidate>` giving `rehearsal.json` | `H+6` |
| Robi | the Slack bot posting into the workspace the phone frame shows | `H+7` |

## What you expect

| From | What | By | If late |
|---|---|---|---|
| Vlad | `main` in the `apps/` structure; the Slack keys | `H+1` | build on your branch, rebase later |
| Vlad | the orchestrator API | `H+5` | the bot posts the sample run |

## Rules you own

- The extractor reports facts with provenance; it never emits findings or scores.
- `apps/estate/ground_truth/` is the answer key: no other service reads it.
- The sandbox only ever touches Floci.
