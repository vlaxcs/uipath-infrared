# Infrared Slack bot

Posts a run's decisions into Slack and lets a person pick the architecture and approve the plan from Slack. It reads the run contract (`contracts/run.schema.json`, spec section 6): one run document, a summary plus an append-only `events` log.

## What it posts

- **Only the gates and the ending** in the channel: the layout gate, the combined rehearsal + plan gate, and a completion or failure card. The extract/investigate/propose/evaluate narration does not go to the channel.
- Every event that led to a gate goes into a **thread under that card**, so the channel reads as decisions and the detail is one click away.
- **Layout card** (`present`, gate `layout`): *"Which architecture should we run?"* — one block per feasible candidate with monthly cost, horizon cost, availability against the target, risk, effort, payback and the number of actions. The engine's rank 1 carries a **RECOMMENDED** marker and the primary button; the others say why they were not picked. Infeasible candidates are listed with the constraint that blocks them. A pick sends a `pick_layout` event with `actor {kind: human, id, surface: slack}`; the card is updated in place when it comes back. Without `x_candidates` the bot falls back to the dashboard notice.
- **Rehearsal + plan card** (`rehearse`, gate `plan`): the measured availability against the target, the failure that was injected, the p95 latency through the phases, and the plan being approved — steps, actions, monthly cost before and after, effort, downtime and availability. **Approve plan** opens a confirmation modal (see below).
- A configured `DASHBOARD_URL` adds a **Details** button to the cards.

## Layers

- `src/entry/`: Bolt wiring, the layout action, the Approve plan action (opens the modal), the modal submission, `main.ts` (orchestrator) and `sample.ts` (sample run).
- `src/application/`: the run tracker (polls the log, posts the gates and their threads), the layout picker, the plan approver, and the ports.
- `src/domain/`: the run contract types, the run summary, layout-candidate and rehearsal/plan summary parsing, the approval modal view, and the Block Kit messages.
- `src/adapters/`: Slack (Bolt and a fake), the HTTP orchestrator, the sample orchestrator, the run file.

## Assumed orchestrator API (for Vlad to confirm)

The API is not defined yet. The bot assumes:

| Route | Answer |
| --- | --- |
| `GET /runs/{id}` | the run document, as in `contracts/run.schema.json`; the approval modal is built from the open gate event in this document |
| `GET /runs/{id}/events?after={seq}` | a JSON array of the events with `seq` greater than `after`, in order; `[]` when there is nothing new |
| `POST /runs/{id}/decisions` | appends a person's decision; answers `201` with the appended event, `409` when the gate it targets is not open |

The decision body is the contract's `approved` event without the fields the orchestrator owns (`seq`, `at`, `revision`). When the person writes a note in the approval modal, the note is the `decision.reason`; otherwise the reason is `rehearsal held; plan approved from Slack`:

```json
{
  "step": "rehearse",
  "status": "approved",
  "actor": { "kind": "human", "id": "andrei", "surface": "slack" },
  "decision": { "kind": "approve_plan", "reason": "looks good" }
}
```

The bot polls every 2 seconds while the run is neither `completed` nor `failed`, and asks again at once when a poll returned events.

### Extension fields on the gate events

The cards are built from the run contract's `x_` extensions (the schema allows `x_` fields on events, so this needs no contract change). Every field is optional; without them the bot keeps a plain card, so an older orchestrator still works.

Layout gate (`present`, gate `layout`):

```json
{
  "seq": 14, "step": "present", "status": "awaiting_approval", "gate": "layout",
  "x_target": { "min_availability_pct": 99.9, "max_monthly_run_eur": 90000, "horizon_months": 36 },
  "x_candidates": [
    {
      "id": "consolidate", "feasible": true, "recommended": true, "rank": 1,
      "monthly_eur": 74365, "horizon_eur": 3807488,
      "availability_pct": 99.95, "risk": 0.31,
      "effort_hours": 794, "payback_months": 1.38, "actions": 21
    },
    {
      "id": "managed_services", "feasible": true, "rank": 2,
      "monthly_eur": 82665, "horizon_eur": 4232448,
      "availability_pct": 99.95, "risk": 0.18,
      "effort_hours": 514, "payback_months": 1.04, "actions": 19,
      "lost_because": { "reason": "cost", "detail": "expected total EUR 4,482,148 against EUR 4,078,788 for consolidate" }
    },
    { "id": "rightsize_in_place", "feasible": false, "lost_because": { "reason": "constraint", "detail": "single-AZ database on the critical path" } }
  ]
}
```

`id` is mandatory. `recommended` defaults to true for the feasible candidate with rank 1; set it explicitly if the engine's pick is not the one to lead with. `lost_because` is shown for the offered candidates that were not picked and for the infeasible ones. Cost is the monthly run cost now and over the horizon, in EUR.

Plan gate (`rehearse`, gate `plan`):

```json
{
  "seq": 20, "step": "rehearse", "status": "awaiting_approval", "gate": "plan",
  "x_rehearsal": {
    "measured_availability_pct": 99.92, "target_availability_pct": 99.9,
    "passed": true, "gap_pct": 0.02,
    "failure": "stopped the primary database; the fallback took over",
    "latency_ms": { "baseline_p95": 42, "failure_p95": 51, "recovery_p95": 44 }
  },
  "x_plan": {
    "layout": "managed_services", "steps": 3,
    "monthly_eur_now": 133308, "monthly_eur_after": 82665,
    "effort_hours": 514, "cutover_downtime_hours": 2,
    "availability_pct": 99.95,
    "actions": [
      { "component": "rds-orders", "action": "resize", "to": "db.r5.4xlarge" }
    ]
  }
}
```

`x_rehearsal` may also sit on the `rehearse` `completed` event; the bot uses it if the plan gate does not repeat it. The verdict in the card is `passed` when present, otherwise the decision on the rehearsal event.

## Approval modal

**Approve plan** opens a Slack modal that repeats the rehearsal result and the plan summary and offers an optional note. The note becomes `decision.reason`; **Cancel** sends nothing. This needs interactivity, which the app already needs for the buttons; no extra Slack scope. A click does not approve: only the modal's **Approve** submits the decision, so a misclick cannot complete the run.

## Configuration

Read from the repo-root `.env` only, through `src/settings.ts`. The bot stops at startup naming the first missing variable, and never prints a value.

- Required: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`.
- Optional: `ORCHESTRATOR_URL` (default `http://127.0.0.1:8080`), `SLACK_CHANNEL` (default `infrared-runs`), `DASHBOARD_URL` (adds the Details buttons; omitted when unset).

The Slack app uses Socket Mode with interactivity on, and the `chat:write` scope. The bot must be a member of the channel it posts to: invite it with `/invite @<bot name>` in that channel.

## Running

```bash
npm ci
npm start                      # against the orchestrator; /infrared status <run-id> tracks a run
npm run sample                 # replays sample/run.json: pick an architecture, then approve the plan in the modal
npm run sample -- --dry-run    # prints the Block Kit messages, no Slack, no .env needed
npm run typecheck
npm test
```

`sample/run.json` is `contracts/run.example.json` cut at the layout gate (seq 14), with the candidates and target from `contracts/result.example.json` and `contracts/forecast.example.json` in `x_candidates` and `x_target`. `sample/after-layout.json` is the scripted continuation after a pick: present completed, the rehearsal with its `proceed` decision and an `x_rehearsal`, and the plan gate with `x_rehearsal` and `x_plan`. `npm run sample` releases one event a second, posts the layout card with the run so far in its thread, waits for a real pick, appends the `pick_layout` event, continues through the scripted rehearsal, posts the combined rehearsal + plan card, waits for the modal approval, appends the `approved` event, marks the run `completed`, and writes the finished run document to `out/sample-run.json`. The sample's timestamps are in the future, so each human event is dated no earlier than the event before it; the hashes are the example's placeholders and the post-layout events are the example's, not a live rehearsal.

To check the finished document against the contract, run `contracts/check_mock.py` from `main` on a copy of `contracts/` whose `run.example.json` is replaced by `out/sample-run.json`: the checker validates a run only as `run.example.json`.
