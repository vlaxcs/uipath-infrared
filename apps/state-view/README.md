# Estate states

A focused frontend for the infrastructure as it exists at a given state of a migration. Pick a state in the ledger and the plate shows the whole estate at that moment: every stack, tier and resource, the resources changed by that step, and everything removed so far as ghosts.

It is a standalone prototype with simulated data. Nothing here talks to the orchestrator. It is built so its data shape can be handed to Robi's dashboard: each state is a full `Infra` snapshot using the same `Component`, `Edge` and `Stack` fields the dashboard already renders.

## Run

```bash
python3 apps/state-view/builder/build_states.py
python3 apps/state-view/build.py
open apps/state-view/dist/state-view.html
```

Tests:

```bash
python3 -m unittest discover -s apps/state-view/builder -p 'test_*.py'
```

`build.py` inlines the CSS, JavaScript and generated JSON into one self-contained HTML file; it works from `file://`. No network, no libraries, no build step.

Deep links use the state id, e.g. `state-view.html#state-11`.

## Data

The snapshots come from the Floci estate already checked in for the demo:

| Input | Path |
|---|---|
| Baseline estate | `contracts/mock/demo-shop.infra.json` |
| Winning candidate | `apps/state-view/data/result.demo-shop.json` (sample `result.json`, candidate `consolidate`) |
| Generated states | `apps/state-view/data/states.json` |

`builder/build_states.py` applies the winner's 21 actions in stage order and emits 22 states: the current estate, one state after each step, and the target. It also scales the actions' savings so the endpoints land exactly on the engine's figures: €133,308/month to €74,365/month.

### Honesty notes

- Every total is a sample plan. The `Sample plan` chip stays visible.
- Baseline and target costs come from the result file. Intermediate monthly costs are modelled from the action savings and are tagged `modelled` in the UI.
- Availability is reported only for the current estate (observed) and the target (engine estimate). In between it is `null` and shown as not measured until rehearsal.
- Per-resource costs are baseline list prices. On the last step the engine's saving for `ng-shop-cpu` is smaller than that resource's list cost, so resource costs do not sum exactly to the state total. The footnote in the UI says so.
- A plan can leave an issue open. `rds-analytics` is remediated for encryption but stays publicly exposed, and the inspector keeps showing `public`.

## Generated document: `data/states.json`

```jsonc
{
  "schema_version": "1.0",
  "project": "demo-shop",
  "title": "Demo shop",
  "baseline": { "monthly_eur": 133308, "availability_pct": 99.2, "components": 38, "stacks": 4 },
  "target":   { "monthly_eur": 74365, "availability_pct": 99.95, "components": 30, "stacks": 4, ... },
  "stepCount": 21,
  "stages": [{ "id": "cleanup_orphans", "label": "Clean up", "stateIds": ["state-4"], ... }],
  "tiers": [{ "id": "compute", "label": "Compute" }],
  "states": [{
    "id": "state-5",
    "index": 5,
    "step": 5,
    "label": "After resize efs-legacy",
    "shortLabel": "Resize efs-legacy",
    "stageId": "cleanup_orphans",
    "reason": "512 MiB/s provisioned, 0.4% used",
    "cost_source": "modelled",           // observed | modelled | engine
    "summary": {
      "monthly_eur": 128042,
      "delta_eur": -2837,
      "cumulative_saving_eur": 5266,
      "availability_pct": null,
      "availability_source": null,       // observed | engine | null
      "components": 37,
      "changed": 1,
      "removed_total": 1
    },
    "changes": [{ "component": "efs-legacy", "kind": "resized", "action": "resize", "verb": "Resize", ... }],
    "removed": [{ "id": "rds-orders-clone", "kind": "postgres", "stack": "shop", "tier": "data",
                  "typeLabel": "RDS", "monthlyEur": 2919, "action": "delete",
                  "atState": "state-4", "atIndex": 4 }],
    "infra": {
      "project": "demo-shop",
      "stacks": [{ "id": "shop", "name": "Web shop", "environment": "prod" }],
      "components": [{
        "id": "rds-orders", "kind": "postgres", "tier": "data", "stack": "shop",
        "status": "active", "quantity": 1, "monthlyEur": 3229,
        "securityIssue": null, "typeLabel": "RDS",
        "facts": [{ "label": "Size", "value": "32 vCPU · 256 GB" },
                  { "label": "Cost", "value": "€3,229/mo" }],
        "changed": "resized", "changedAction": "resize"
      }],
      "edges": [{ "from": "vmfleet-web", "to": "rds-orders", "kind": "data", "note": "..." }]
    }
  }]
}
```

## Mapping to Robi's dashboard

The component and state shapes were chosen to match `apps/dashboard/src/graph/types.ts` (on `andrei/dashboard-transitions`):

| This document | Dashboard model | Notes |
|---|---|---|
| `states[i].infra.components` | `Component[]` | Same fields; `tier`, `provider`, `region`, `service`, `sku`, `changed` are extras. |
| `states[i].infra.edges` | `Edge[]` | Dangling endpoints are removed per state. |
| `states[i].infra.stacks` | `Stack[]` | Adds `environment`. |
| `states[i].changes[]` | `Change` / `Action` | `kind` uses the dashboard's `ChangeKind`; `action`/`from`/`to`/`reason` match. |
| `states[i].summary` | `Summary` | Same money and count fields, plus availability source. |
| `states[i].removed[]` | ghosts | Snapshot of removed resources for the dashed rows. |

The dashboard's current `TransitionToggle` only offers current and after. This piece makes the middle of that transition navigable: feed it the run's state snapshots and each ledger row can map to a run step. The renderer is dependency-free so the plate can be lifted into `GraphSection` or a new run-step view without changing the data contract.

## Files

| Path | Owns |
|---|---|
| `builder/build_states.py`, `builder/test_build_states.py` | state derivation, tests, `data/states.json` |
| `web/app.js`, `web/app.css` | ledger, estate plate, links, resource inspector |
| `web/template.html`, `build.py` | shell and inlining |
| `data/result.demo-shop.json` | sample result copied from the checked-in mock |

## Design notes

Control-room ledger, not a dashboard of cards. The state sequence is a vertical spine with stage nodes and per-step cost deltas; the estate is a schematic of stack panels and tier bands, not a grid of tiles. The plate reserves a gutter on each stack so dependency traces run outside row text, and removed resources stay in place as dashed rows so absence is visible. Condensed display type, mono for identifiers and money, tabular numerals. One accent for the estate and one signal colour per change kind. Light and dark themes; keyboard stepping, focus rings and reduced motion are supported.
