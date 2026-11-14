# Infrared Slack bot

Posts a run's decisions into Slack and lets a person pick the architecture and approve the plan from Slack. It reads the run contract (`contracts/run.schema.json`, spec section 6): one run document, a summary plus an append-only `events` log.

## Which runs

`npm start` watches the orchestrator: every 3 s it lists the runs (`GET /runs?limit=50`) and starts tracking each one that is `running` or `awaiting_approval` and not tracked yet, in `SLACK_CHANNEL`. A run started from the platform therefore gets its header and its gate cards without anyone asking. Finished runs are not posted. A run that cannot be tracked is logged and the others go on; an orchestrator that does not answer is asked again on the next poll. `/infrared status <run-id>` still tracks one run in the channel it is typed in.

## What it posts

- **No emoji and no label/value grids.** The hierarchy comes from Slack's native blocks: a plain header, sentences with bold numbers, dividers between candidates, and plain status words (`our pick`, `not picked`, `These can't run`). Context lines carry a human date (*14 Nov, 09:25*) instead of the raw ISO timestamp.
- **Only the gates and the ending** in the channel: the layout gate, the combined rehearsal + plan gate, and a completion or failure card. The extract/investigate/propose/evaluate narration does not go to the channel.
- **There are no threads.** Each gate is one self-contained card. The layout card updates in place through the pick and the rehearsal, so the channel reads as a sequence of decisions rather than a message tree.
- **Layout card** (`present`, gate `layout`): *"Which architecture should we run?"* — opens with a lead sentence (the project, how many options pass, the availability and budget the CTO asked for), then a recommendation paragraph: *"We recommend consolidate. It runs the estate for €74,365 a month. It lands at 99.95% availability, above your 99.9% target."* Each option then gets one prose line with its numbers (and, for the losers, why it was not picked), its diagram, and its Rehearse button — no label/value grid. Infeasible candidates sit in one **These can't run** line, grouped by the constraint that blocks them. A pick sends a `pick_layout` event with `actor {kind: human, id, surface: slack}`; the card is updated in place when it comes back and becomes the rehearsal card. Without `x_candidates` the bot falls back to the dashboard notice.
- **Rehearsal + plan card** (`rehearse`, gate `plan`): the rehearsal as one sentence — *"The rehearsal held: 99.92% availability against your 99.9% target, and p95 latency 42 → 51 → 44 ms."* — with the injected failure as its own line, then the plan as prose — *"The estate moves from €133,308 a month to €74,365 a month. The plan has 14 steps and 6 actions."* — and the first changes as bullets. **Approve plan** opens a confirmation modal (see below).
- **Rehearsal progress** updates the layout card in place: after the pick it says the rehearsal is running on Floci and which step it is at (*"step 3 of 8"*), then the same card shows the measured result.
- When an extension object exists but one of its values is missing, the row stays and says `not measured` or `not estimated` rather than disappearing, so the card layout is stable while the interface is being wired. When the whole extension is absent, the card falls back to a plain version.
- A configured `DASHBOARD_URL` adds a **Details** button to the cards.

## Diagrams

Each decision card has a slot for a picture of the infrastructure graph, showing the state that decision leads to:

| Card | Diagram |
| --- | --- |
| Layout card | one image per offered candidate, under its fields and above its button: that candidate's `target` state |
| Progress / Rehearsal complete / Rehearsal stopped (the layout card updated in place) | the picked layout's `target` |
| Plan card | the plan's layout (`x_plan.layout`, else the picked layout), `target` |
| Plan approved and Architecture picked | the same image as the card it replaces |

The diagram is drawn from the run's own files, never from bundled data. The bot takes the latest `result` and `infra` outputs from the run's events, downloads them from the orchestrator (`GET /runs/{id}/files/{path}`) into `out/diagrams/<run>/inputs/`, and renders the PNG with `apps/state-view/snapshot.py --layout L --state S --result <result> --infra <infra> --out out/diagrams/<run>/<result>-L-S.png`, which prints one JSON line `{"path","layout","state","title","caption","alt"}`. A run with no `result` or no `infra` output yet gets the placeholder. A run file name must be a single file (`result.1.json`); anything else is refused. The sample run serves `contracts/mock/demo-shop.infra.json` and `contracts/result.example.json`, the files it was cut from.

The PNG is uploaded to Slack without a channel, so the file stays private to the bot, and shown through an `image` block with `slack_file.id` plus a context line with the caption. Each (run, result, layout, state) is rendered and uploaded once per process, before the card is posted (a failed render or upload is tried again on the next card update), so a revised run with a new result gets new diagrams; the in-place updates and the closed gate reuse the same file id. All candidates of the layout card render in parallel.

- `DIAGRAMS`: `on` (default) or `off`.
- `PYTHON`: the interpreter, default `python3`.
- `STATE_VIEW_SNAPSHOT`: the snapshot script, default `../state-view/snapshot.py`, resolved from this package's directory.
- The upload needs the **`files:write`** scope; without it the bot logs `the Slack app needs the files:write scope` and shows the placeholder.

**Fallback.** When there is no diagram (diagrams off, the snapshot is missing, fails or takes more than 20 s, or the upload fails), the slot stays as a context line, `Diagram unavailable — open Details for the graph` (`Diagram unavailable` without `DASHBOARD_URL`), so the card keeps its shape. Slack sometimes rejects a just-uploaded file with `invalid_blocks`; the bot retries twice with a short backoff, then sends the same card with the placeholder in place of the image. A run never stops because of a diagram. A layout card that would exceed Slack's 50 blocks drops the captions, then the diagram slots.

## Layers

- `src/entry/`: Bolt wiring, the layout action, the Approve plan action (opens the modal), the modal submission, `main.ts` (orchestrator) and `sample.ts` (sample run).
- `src/application/`: the run tracker (polls the log, posts and updates the gate cards), the diagram publisher (renders and uploads once per layout), the layout picker, the plan approver, and the ports.
- `src/domain/`: the run contract types, the run summary, layout-candidate and rehearsal/plan summary parsing, the approval modal view, and the Block Kit messages.
- `src/adapters/`: Slack (Bolt and a fake), the state-view diagram renderer, the HTTP orchestrator, the sample orchestrator, the run file.

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

### Interface handoff

`sample/interface.template.json` is the fill-in placeholder for the orchestrator team: the two gate event bodies with every extension field and `0` / `LABEL` placeholders. The orchestrator adds the contract-owned `seq`, `at`, `revision` and `actor` and replaces the placeholders.

| Event | Extension | Fields |
| --- | --- | --- |
| `present`, gate `layout` | `x_target` | `min_availability_pct`, `max_monthly_run_eur`, `horizon_months` |
| `present`, gate `layout` | `x_candidates[]` | `id`, `feasible`, `recommended`, `rank`, `monthly_eur`, `horizon_eur`, `availability_pct`, `risk`, `effort_hours`, `payback_months`, `actions`, `lost_because {reason, detail}` |
| `rehearse`, gate `plan` | `x_rehearsal` | `measured_availability_pct`, `target_availability_pct`, `passed`, `gap_pct`, `failure`, `latency_ms {baseline_p95, failure_p95, recovery_p95}` |
| `rehearse`, gate `plan` | `x_plan` | `layout`, `steps`, `monthly_eur_now`, `monthly_eur_after`, `effort_hours`, `cutover_downtime_hours`, `availability_pct`, `actions[] {component, action, to}` |

Only `x_candidates[].id` and `x_plan.layout` are useful on their own; every other field is optional and renders as `—` when absent. `lost_because.reason` is one of `cost`, `risk`, `effort`, `payback`, `constraint`; for an offered candidate it becomes the short "Not picked" line, and for an infeasible one the detail is grouped under **Not viable**. The approval modal reads the open plan gate from `GET /runs/{id}`, so the plan gate event must still be in the run document when the button is clicked.

## Approval modal

**Approve plan** opens a Slack modal that repeats the rehearsal result and the plan summary and offers an optional note. The note becomes `decision.reason`; **Cancel** sends nothing. This needs interactivity, which the app already needs for the buttons; no extra Slack scope. A click does not approve: only the modal's **Approve** submits the decision, so a misclick cannot complete the run.

## Configuration

Read from the repo-root `.env` only, through `src/settings.ts`. The bot stops at startup naming the first missing variable, and never prints a value.

- Required: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`.
- Optional: `ORCHESTRATOR_URL` (default `http://127.0.0.1:8080`), `SLACK_CHANNEL` (default `infrared-runs`), `DASHBOARD_URL` (adds the Details buttons; omitted when unset), `DIAGRAMS`, `PYTHON`, `STATE_VIEW_SNAPSHOT` (see Diagrams).

The Slack app uses Socket Mode with interactivity on, and the `chat:write` and `files:write` scopes. The bot must be a member of the channel it posts to: invite it with `/invite @<bot name>` in that channel.

## Running

```bash
npm ci
npm start                      # against the orchestrator; /infrared status <run-id> tracks a run
npm run sample                 # replays sample/run.json: pick an architecture, then approve the plan in the modal
npm run sample -- --dry-run    # prints the Block Kit messages, no Slack, no .env needed
npm run typecheck
npm test
```

`sample/run.json` is `contracts/run.example.json` cut at the layout gate (seq 14), with the candidates and target from `contracts/result.example.json` and `contracts/forecast.example.json` in `x_candidates` and `x_target`. `sample/interface.template.json` is the placeholder shape for the interface team (see above). `sample/after-layout.json` is the scripted continuation after a pick: present completed, the rehearsal with its `proceed` decision and an `x_rehearsal`, and the plan gate with `x_rehearsal` and `x_plan`; the sample orchestrator rewrites the plan's layout and figures to the candidate that was picked. `npm run sample` releases one event a second, posts the layout card, waits for a real pick, appends the `pick_layout` event, updates that card through the scripted rehearsal (progress bar, then the measured result), posts the combined rehearsal + plan card, waits for the modal approval, appends the `approved` event, marks the run `completed`, and writes the finished run document to `out/sample-run.json`. The sample's timestamps are in the future, so each human event is dated no earlier than the event before it; the hashes are the example's placeholders and the post-layout events are the example's, not a live rehearsal.

To check the finished document against the contract, run `contracts/check_mock.py` from `main` on a copy of `contracts/` whose `run.example.json` is replaced by `out/sample-run.json`: the checker validates a run only as `run.example.json`.
