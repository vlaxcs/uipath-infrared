# The run's plan, from A to B

Status: draft. Vlad picked where it lives, what the sandbox shows and where the states come from; the rest are Claude's defaults, listed in section 8.

## 1. What

The run page in `/app` keeps Robi's pipeline (steps, timeline, gates) on top. Below it, once the run has a plan, Andrei's estate view (`apps/state-view`) shows that plan from A, the estate today, to B, the target: a carousel of states, one per action, and a schematic topology where removed resources leave a dashed ghost and their links snap apart. After the rehearsal, the target state shows what the sandbox did to it.

## 2. Which plan

- The layout picked at the `layout` gate, once one is picked.
- Before that, the winner of the run's latest `result.<rev>.json`.
- No winner (nothing feasible) and nothing picked: no plan view, and the page says so.

## 3. Where the states come from

- `apps/state-view/builder/build_states.py` takes `--infra`, `--result`, `--candidate` and `--out`. Without them it builds the demo dataset as today, so the standalone prototype keeps working.
- The orchestrator runs it as a stage command, `ORCHESTRATOR_STATES_CMD`, optional: unset, no states are built and the run page shows no plan view.
  - After an evaluate that decides `proceed`: for the winner, into `states.<rev>.<candidate>.json`.
  - After `pick_layout`, when the picked layout is not the winner: for the picked layout, same name pattern.
- The states file is a view, not a contract: it is not an event output, not in the run's hashes, and not checked against a schema. A failed or timed-out build is written to `logs/<seq>-states.log` and never fails the run.
- Timeout: 1 minute.
- The dashboard reads it through `GET /runs/{id}/files/{name}`, like every other run file.

## 4. The dashboard

- `apps/dashboard/src/plan/` holds the port of Andrei's renderer: his layout, link routing, carousel and resource detail, mounted into a container (`mount(container, dataset) → destroy`), not into the page. His listeners are scoped to that container, his theme follows the dashboard's, and he no longer writes the page hash.
- His palette becomes global tokens, `--color-estate-*`, light and dark, in `src/styles/tokens.css`. The plan view keeps his look; the rest of the dashboard keeps its own.
- Keyboard: left and right step through the states when the carousel has focus. Reduced motion is honoured, as in the prototype.

## 5. The sandbox on the topology

When the run has a `rehearsal.<rev>.json` for the plan shown, the target state shows:
- the component the sandbox failed, marked as failed;
- whether the fallback held, and the verdict with measured against required availability, as a strip above the topology;
- every value with provenance `synthetic`, as the rehearsal says.

The rehearsal page (Robi's) keeps the phases, latency and component table.

## 6. Failure modes

| Case | What happens |
| --- | --- |
| `ORCHESTRATOR_STATES_CMD` unset | no states files; the run page says the plan view is not set up |
| The builder exits non-zero or times out | no file, the reason in `logs/`; the run goes on; the run page says the plan view could not be built |
| The states file is not there yet | the run page says the plan view is not ready |
| Nothing feasible | no plan view: "No plan to show: no candidate passes the hard constraints" |
| The rehearsal failed a component the plan removed | the failure is listed in the strip, not on the topology |

## 7. Load

One file per plan shown: about 100 KB for the 10-component start-up, 850 KB for the 38-component demo shop. Read once per run page, cached by the dashboard's file cache. The builder runs at most twice per revision.

## 8. Decisions

1. Plan view in the run page, under Robi's pipeline. Vlad's.
2. The sandbox's result on the topology; the rehearsal page keeps the details. Vlad's.
3. Andrei's builder run by the workflow. Vlad's.
4. The picked layout, else the winner. Claude's.
5. A states file is a view: no contract, no event, never fails a run. Claude's.
6. Andrei's palette kept as estate tokens. Claude's, a matter of taste for Vlad.
7. No deep link to a state in the MVP. Claude's.
