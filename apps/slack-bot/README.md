# Infrared Slack bot

Posts a run's progress into Slack and lets a person approve the plan from Slack. It reads the run contract (`contracts/run.schema.json`, spec section 6): one run document, a summary plus an append-only `events` log.

## Which runs

`npm start` watches the orchestrator: every 3 s it lists the runs (`GET /runs?limit=50`) and starts tracking each one that is `running` or `awaiting_approval` and not tracked yet, in `SLACK_CHANNEL`. A run started from the platform therefore gets its header and its gate cards without anyone asking. Finished runs are not posted. A run that cannot be tracked is logged and the others go on; an orchestrator that does not answer is asked again on the next poll. `/infrared status <run-id>` still tracks one run in the channel it is typed in.

## What it posts

- A header for the run (project, status, open gate, step, revisions used of `max_revisions`), updated in place as events arrive.
- One message per meaningful event: every event except a step that only `started`. Each shows a readable summary of the step, the decision and its reason on `evaluate` and `rehearse`, the contract file the step wrote, and the revision the event belongs to.
- Layout gate (`present`, `awaiting_approval`, gate `layout`): asks which architecture to migrate to. When the gate event carries `x_candidates` (see below), every feasible candidate gets its cost, availability and risk plus a button; a click sends a `pick_layout` event with `actor {kind: human, id, surface: slack}`. Infeasible candidates are listed, not offered. Without `x_candidates` the bot falls back to a notice that the layout is picked on the dashboard. The message is updated in place when the `pick_layout` event comes back. Kept analyses get their own message.
- Plan gate (`rehearse`, `awaiting_approval`, gate `plan`): the rehearsal decision with its reason and an **Approve plan** button. The contract allows only `approve_plan` at this gate, so that is the only button. A click sends an `approved` event with `actor {kind: human, id: <Slack user name>, surface: slack}`; the message is updated in place when that event comes back in the log.

## Layers

- `src/entry/`: Bolt wiring, the Approve plan action handler, `main.ts` (orchestrator) and `sample.ts` (sample run).
- `src/application/`: the run tracker (polls the log and posts), the plan approver, and the ports the adapters implement.
- `src/domain/`: the run contract types, the summary derived from the events, the plan approval, and the Block Kit messages.
- `src/adapters/`: Slack (Bolt and a fake), the HTTP orchestrator, the sample orchestrator, the run file.

## Assumed orchestrator API (for Vlad to confirm)

The API is not defined yet. The bot assumes:

| Route | Answer |
| --- | --- |
| `GET /runs/{id}` | the run document, as in `contracts/run.schema.json` |
| `GET /runs/{id}/events?after={seq}` | a JSON array of the events with `seq` greater than `after`, in order; `[]` when there is nothing new |
| `POST /runs/{id}/decisions` | appends a person's decision; answers `201` with the appended event, `409` when the gate it targets is not open |

The decision body is the contract's `approved` event without the fields the orchestrator owns (`seq`, `at`, `revision`):

```json
{
  "step": "rehearse",
  "status": "approved",
  "actor": { "kind": "human", "id": "andrei", "surface": "slack" },
  "decision": { "kind": "approve_plan", "reason": "rehearsal held; plan approved from Slack" }
}
```

The bot polls every 2 seconds while the run is neither `completed` nor `failed`, and asks again at once when a poll returned events.

### Layout candidates on the gate

For the layout buttons, the `present` `awaiting_approval` event carries the candidates from the run's latest `result.json` in the run contract's `x_` extension (the schema allows `x_` fields on events, so this needs no contract change):

```json
{
  "seq": 14, "step": "present", "status": "awaiting_approval", "gate": "layout",
  "x_candidates": [
    { "id": "managed_services", "feasible": true, "rank": 2, "monthly_eur": 82665, "availability_pct": 99.95, "risk": 0.18 },
    { "id": "rightsize_in_place", "feasible": false }
  ]
}
```

`id` is mandatory. `feasible` defaults to true; the numbers are optional and only decorate the message. Without the extension the bot keeps the dashboard notice, so an older orchestrator still works.

## Configuration

Read from the repo-root `.env` only, through `src/settings.ts`. The bot stops at startup naming the first missing variable, and never prints a value.

- Required: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`.
- Optional: `ORCHESTRATOR_URL` (default `http://127.0.0.1:8080`), `SLACK_CHANNEL` (default `infrared-runs`).

The Slack app uses Socket Mode with interactivity on, and the `chat:write` scope. The bot must be a member of the channel it posts to: invite it with `/invite @<bot name>` in that channel.

## Running

```bash
npm ci
npm start                      # against the orchestrator; /infrared status <run-id> tracks a run
npm run sample                 # replays sample/run.json, asks for the architecture, then waits for the plan approval
npm run sample -- --dry-run    # prints the Block Kit messages, no Slack, no .env needed
npm run typecheck
npm test
```

`sample/run.json` is `contracts/run.example.json` cut at the layout gate (seq 14), with the candidates from `contracts/result.example.json` in `x_candidates`. `sample/after-layout.json` is the scripted continuation after a pick: present completed, the rehearsal with its `proceed` decision, and the plan gate. `npm run sample` releases one event a second, waits at the layout gate for a real pick in Slack, appends the `pick_layout` event, continues through the scripted rehearsal, waits at the plan gate for a real click, appends the `approved` event, marks the run `completed`, and writes the finished run document to `out/sample-run.json`. The sample's timestamps are in the future, so each human event is dated no earlier than the event before it; the hashes are the example's placeholders and the post-layout events are the example's, not a live rehearsal.

To check the finished document against the contract, run `contracts/check_mock.py` from `main` on a copy of `contracts/` whose `run.example.json` is replaced by `out/sample-run.json`: the checker validates a run only as `run.example.json`.
