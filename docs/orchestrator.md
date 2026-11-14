# Orchestrator, flow test and the agent's CLI

The component spec for `apps/orchestrator/`, the end-to-end flow test, and the agent's command line with its `evaluate_candidate` tool. It refines `docs/spec.md` sections 5, 6 and 10; where the two disagree, `docs/spec.md` wins and this file is fixed.

Written without the grill, on recommended decisions. Every decision taken that way is listed in section 9 so it can be overturned.

## 1. What it does

The orchestrator runs one workflow per project, steps 1 to 6 of `docs/spec.md` section 5: extract, investigate, propose, evaluate, present, rehearse. It holds the run state as a `run.schema.json` document, calls every stage as a subprocess, decides after evaluate and rehearse whether to proceed, revise or stop, pauses at the `layout` and `plan` gates for a person, and serves runs and events over an HTTP JSON API.

Two sentences: a run is an append-only event log, and every step is a function from the log and the run's files to the next events. The HTTP layer only reads the log and appends a person's decision; the workflow does the rest.

## 2. Stages

Every stage is a subprocess. Its command prefix comes from configuration (section 6) and is split on spaces, never through a shell; the orchestrator appends the arguments below. The subprocess inherits the orchestrator's environment and working directory, so relative paths in a command prefix resolve from where the orchestrator was started. Every path the orchestrator passes is absolute.

| Step | Command | Writes | Checked against |
| --- | --- | --- | --- |
| extract | `<extract> --project <project> --forecast forecast.json --out infra.json` (the run's own forecast, so the extractor can attribute resources to its roadmap `projects`) | `infra.json` | `infra.schema.json` |
| investigate | `<agent> investigate --infra infra.json --out findings.json` | `findings.json` | a JSON object |
| propose | `<agent> propose --infra infra.json --forecast forecast.json --catalog catalog.json --findings findings.json --revision <n> [--feedback feedback.<n>.json] --out candidates.<n>.json` | `candidates.<n>.json` | `candidates.schema.json`, and its `revision` equals `n` |
| evaluate | `<engine> evaluate infra.json forecast.json catalog.json --candidates candidates.<n>.json --out result.<n>.json` | `result.<n>.json` | `result.schema.json` |
| rehearse | `<sandbox> rehearse --result result.<n>.json --candidate <layout> --infra infra.json --forecast forecast.json --out rehearsal.<n>.json` | `rehearsal.<n>.json` | `rehearsal.schema.json` |

- Investigate runs once per run, in revision 0. A revision goes back to propose, not to investigate.
- A stage fails when it exits non-zero (except the sandbox's exit 1, below), when it runs past its timeout, when it does not write its file, or when the file breaks its contract. The step's event is `failed` with a `stop` decision, and the reason names the step and the cause: the last non-empty line of stderr, cut to 300 characters, or `timed out after <d>`, or `wrote no candidates.0.json`, or the first schema error.
- Timeouts: extract 10 min, investigate 30 min, propose 15 min, evaluate 2 min, rehearse 20 min.
- Every stage's stdout and stderr go to `logs/<seq>-<step>.log` in the run's directory, where `<seq>` is the stage's `started` event. They are never put in the run document or the API.
- The orchestrator validates contracts itself, against the schemas in `contracts/`, loaded once at startup. A schema that does not load stops the orchestrator at startup.

## 3. Decisions

**After evaluate.** The candidates the agent proposed are the ones with `source: agent` in `result.<n>.json`.
- Every agent candidate is feasible and at least one candidate is feasible: `proceed`, reason `every candidate the agent proposed passes the hard constraints`.
- Otherwise: `revise`, reason `<candidate> breaks <constraint>, <constraint>; <candidate> breaks ...` over the infeasible agent candidates in result order, or `no candidate is feasible` when there are none. The orchestrator writes `feedback.<n+1>.json` (below) and goes back to propose with revision `n + 1`.
- A revise when the run already holds `max_revisions` revisions becomes `stop` instead, reason `needs revision <n+1>, max_revisions is <max>; <the revise reason>`. The run fails.

**After rehearse.** The sandbox's exit code decides: 0 `proceed`, 1 `revise`, anything else a failed stage. The reason is `x_decision.reason` from `rehearsal.<n>.json`, or `verdict.reason` when it has no `x_decision`. A revise from rehearse writes the feedback file and goes back to propose, under the same cap.

**Feedback file.** What the agent gets on a revision. It is the orchestrator's own format, read only by the agent:

```json
{
  "revision": 1,
  "from_step": "evaluate",
  "reason": "agent-eu-db breaks data_residency",
  "result": "result.0.json",
  "rehearsal": null
}
```

`result` is always the latest result's file name; `rehearsal` is the rehearsal's file name when the revise came from rehearse.

**Gates.** Present opens `layout` right after it starts. The `awaiting_approval` event carries `x_candidates`, one entry per candidate of the latest result in result order: `id`, `feasible`, and, when present in the result, `rank`, `monthly_eur` (`cost.run_eur_month_now`), `availability_pct` and `risk`. This is the extension the Slack bot reads.

| Decision | Allowed when | Effect |
| --- | --- | --- |
| `keep_analyses` | gate `layout` open | appended; the gate stays open; repeatable |
| `pick_layout` | gate `layout` open, and `layout` is a feasible candidate in the latest result | appended, then present `completed`, then rehearse starts |
| `approve_plan` | gate `plan` open | appended; the run is `completed` |

`keep_analyses` checks only the shape of `analyses`: `result.json` defines no analyses yet (`docs/spec.md` section 6), so there is nothing to check the ids against.

## 4. Run state

- **Where.** `<runs dir>/<run id>/run.json`, next to the run's files: `forecast.json` and `catalog.json` (copied in at start; these are `inputs`), and the stage files of section 2.
- **Id.** `run-<project>-<nnnn>`, numbered from 0001 per project, one above the highest on disk.
- **Writes.** The document is rewritten after every event, to a temporary file then renamed over `run.json`, so a reader never sees half a document. Events are appended under the run's lock; `seq` is the next integer, and `at` is the orchestrator's clock in UTC, never earlier than the previous event's `at`.
- **Restart.** At startup the orchestrator loads every `run.json` under the runs dir. A run that was `running` cannot resume its subprocess: it gets a `failed` event on its current step with `stop`, reason `the orchestrator restarted during <step>`. A run awaiting approval waits as before.
- **Shutdown.** On SIGINT or SIGTERM the HTTP server stops accepting, running stages are killed, and each running run gets the same `failed` event, reason `the orchestrator stopped during <step>`.
- **Concurrency.** Any number of projects run at once. A project has at most one run that is `running` or `awaiting_approval`. Only one rehearse runs at a time across all runs, because the sandbox refuses to start while another rehearsal's resources exist in Floci; a second rehearse waits, and its `started` event is written when it gets its turn.

## 5. HTTP API

JSON in and out, `Content-Type: application/json`. Errors are `{"error": "<reason>"}`. Request bodies over 64 KiB are refused with 413, and unknown fields with 400.

| Route | Answers |
| --- | --- |
| `GET /onboarding` | `200`, what onboarding offers: the connections, the providers the catalog prices (without `onprem`), whether it has an on-prem option, and every project with its description and forbidden providers (`docs/onboarding.md` section 5). `500` naming the file when the catalog or a project's forecast does not parse |
| `GET /runs?project=<p>&limit=<n>` | `200`, an array of run summaries, newest first: the run document without `events` and `inputs`. `limit` defaults to 50 and is capped at 200; `project` is optional |
| `POST /runs` with `{"project": "<p>", "onboarding": {...}}` | `201`, the new run document. `project` is optional: absent or empty, the run is for the company (`ORCHESTRATOR_COMPANY`). `onboarding` is optional; when present, its answers are written into the run's copy of `forecast.json` (`docs/onboarding.md` section 5), and `400` with the reason when they break its rules. `404` when the project has no forecast. `409` when the project already has a run that is `running` or `awaiting_approval` |
| `GET /runs/{id}` | `200`, the run document. `404` |
| `GET /runs/{id}/events?after=<seq>` | `200`, the events with `seq` greater than `after`, in order; `[]` when there is none. `after` defaults to 0; `400` when it is not a non-negative integer. `404` |
| `POST /runs/{id}/decisions` | `201`, the appended event. `400` when the body breaks the rules below. `404`. `409` when the gate it targets is not open. `422` when `pick_layout` names a candidate that is not a feasible candidate of the latest result |
| `GET /runs/{id}/files` | `200`, the allowlisted run artifacts as `{path, size}`. `404` |
| `GET /runs/{id}/files/{path}` | `200`, the file's raw JSON. `404` when the name is not an allowlisted artifact or the file is missing; `413` over 16 MiB |

A decision's body is the contract's `approved` event without the fields the orchestrator owns (`seq`, `at`, `revision`), as the Slack bot already sends it:

```json
{
  "step": "rehearse",
  "status": "approved",
  "actor": { "kind": "human", "id": "cto", "surface": "slack" },
  "decision": { "kind": "approve_plan", "reason": "rehearsal held; go ahead" }
}
```

`status` must be `approved`, `actor.kind` `human` with a non-empty `id` and a `surface` of `dashboard` or `slack`, the decision one of the three gate decisions with a non-empty `reason`, `analyses` only on `keep_analyses` and `layout` only on `pick_layout`. `step` must be the step of the gate: `present` for `layout`, `rehearse` for `plan`.

**Browsers.** The dashboard runs on another origin (Vite's dev server), so it needs CORS. Only the origins in `ORCHESTRATOR_ALLOWED_ORIGINS` get `Access-Control-Allow-Origin`, echoed back exactly, with `Vary: Origin`; a preflight from one of them answers `204` with `GET, POST, PUT` and `Content-Type`, and a preflight from any other origin answers `403`. With the variable unset, no CORS headers are sent and the API stays same-origin. Never `*`: there is no authentication, so an open CORS policy would let any page open in the CTO's browser approve a plan on `localhost`.

Reads come from memory: the orchestrator holds every run, so a run, its events after a `seq`, and the run list need no disk read. Events after a `seq` are a slice of the log, since `seq` is gapless.

**Run files.** The two file routes read the run directory on disk. They serve only the stage artifacts: `infra.json`, `findings.json`, `candidates.<n>.json`, `feedback.<n>.json`, `result.<n>.json` and `rehearsal.<n>.json`. `run.json`, the copied inputs and the logs are never served. A path is a single file name; `..`, separators, directories and symlinks are refused, and a file over 16 MiB gets `413`. They use the same CORS policy as the rest of the API.

## 6. Configuration

Read once at startup by the orchestrator's settings package from the environment and the repo-root `.env`. A missing variable stops it at startup, naming the variable.

| Variable | Value |
| --- | --- |
| `ORCHESTRATOR_ADDR` | where it listens, e.g. `127.0.0.1:8080` |
| `ORCHESTRATOR_RUNS_DIR` | where run directories go |
| `ORCHESTRATOR_PROJECTS_DIR` | holds `<project>.forecast.json` per project, e.g. `contracts/mock` |
| `ORCHESTRATOR_CATALOG` | the `catalog.json` every run uses |
| `ORCHESTRATOR_EXTRACT_CMD`, `ORCHESTRATOR_AGENT_CMD`, `ORCHESTRATOR_ENGINE_CMD`, `ORCHESTRATOR_SANDBOX_CMD` | the command prefix of each stage |
| `ORCHESTRATOR_CONTRACTS_DIR` | the `contracts/` directory, for the schemas |
| `ORCHESTRATOR_COMPANY` | optional, default `company`: the project a run starts for when `POST /runs` names none; `GET /onboarding` returns it as `company`. Must be a project id (lowercase letters, digits, dashes) |
| `ORCHESTRATOR_MAX_REVISIONS` | optional, default 2 |
| `ORCHESTRATOR_STATES_CMD` | optional: the plan view's state builder (`docs/run-plan-view.md`); unset, no states are built |
| `ORCHESTRATOR_ALLOWED_ORIGINS` | optional, comma-separated: the browser origins allowed to call the API, e.g. the dashboard's `http://127.0.0.1:5173`. Unset, no CORS |

## 7. The flow test

One run of the demo path (`docs/spec.md` section 9) through the real orchestrator, over its HTTP API, as a Go test in `apps/orchestrator/`.

- It starts the orchestrator's HTTP handler in-process, on a temporary runs dir, with the start-up project (`contracts/mock/startup.forecast.json`) and `contracts/real/catalog.json`, the catalog `apps/pricing` builds from real price snapshots.
- Stages, today: extract and agent are stubs; the engine is the real one, `python -m engine` from `apps/engine/`; the sandbox is a stub. The extract stub copies `contracts/mock/startup.infra.json`. The agent stub writes `{"findings": []}` for investigate and, for propose, a fixed candidates file per revision: revision 0 has a candidate that moves the database out of the EU, revision 1 keeps it in the EU. The sandbox stub copies `contracts/rehearsal.example.json` and exits 0.
- Which stage is real is chosen per stage by `FLOW_<STAGE>_CMD` variables, so swapping a stub for a real component changes configuration, not the test.
- The path: start a run; poll events until gate `layout`; the evaluate in revision 0 has decided `revise` and the one in revision 1 `proceed`; list and read `infra.json` through the file routes; keep one analysis from the dashboard; pick the first feasible candidate from the dashboard; poll until gate `plan`; approve the plan from Slack; the run is `completed` with exactly one revision.
- The finished `run.json` is then checked by `python contracts/check_run.py <file>`: the schema and every rule of `contracts/run_integrity.py`. The oracle is the contracts' own Python checker, not the orchestrator's code.
- It runs in CI in a new `orchestrator` job: `go vet`, `go test ./...` with the flow test, on Go 1.26 and the engine's Python environment. The CI trigger stays as it is (manual dispatch, #10).
- The agent stays a stub in CI for good: the team's LLM key never goes into CI. The real agent is checked by hand (section 8).

`contracts/check_run.py` is new: it checks one run file against `run.schema.json` and `run_integrity.py` and exits non-zero on any error. `check_mock.py` keeps checking `run.example.json`.

## 8. The agent's CLI and `evaluate_candidate`

The agent becomes the two stage commands of section 2. Built after the orchestrator.

- `python -m agent investigate --infra <f> --out <f>`: the current lead and specialists, on the current read-only tools. `record_finding` appends to the findings document instead of `out/findings.jsonl`; `monthly_saving_usd` and `saving_basis` leave the tool, because the model's numbers are not numbers Infrared shows. The file is `{"findings": [...]}`, written once at the end.
- `python -m agent propose --infra --forecast --catalog --findings --revision <n> [--feedback] --out <f>`: one agent with the findings, the forecast's criteria and the feedback in its prompt, and two tools:
  - `evaluate_candidate`: takes one candidate in the candidates contract's shape, writes it as a one-candidate `candidates.json` in a temporary directory, runs the engine (`AGENT_ENGINE_CMD`, same prefix rule as section 2) and answers with that candidate's entry of the result: `feasible`, `violations`, `cost.run_eur_month_now`, `availability_pct`, `risk`, `rank`. An engine error comes back as a tool error with the engine's stderr line;
  - `submit_candidates`: takes the candidates, sets `schema_version`, `project`, `revision` and `proposed_by`, checks the document against `candidates.schema.json` and `contracts/candidates_integrity.py`, and writes `--out`. A broken document comes back as a tool error with the reasons, and nothing is written.
- `propose` exits 1 when the model finishes without a successful `submit_candidates`.
- Both prompts list the infra.json components (id, kind, region, zones, classification), so findings and actions name components by id. On a revision, the propose prompt also carries the engine's verdict on the agent's previous candidates, read from the feedback's `result`.
- The SDK session's working directory is the directory of `--out`, the run's directory, so the ground truth stays out of reach.
- `apps/estate/score.py` reads the findings document, and still reads an older `findings.jsonl`.
- Layers: `agent/cli.py` (entry), `agent/application/` (the two use cases), `agent/domain/` (prompts, the candidates document), `agent/adapters/` (the SDK, AWS, the engine subprocess, files). The module docstrings and comments go.
- Tests, with no model: `evaluate_candidate` answers exactly the engine's figures for the same candidate; `submit_candidates` refuses a candidate carrying a price and writes nothing; `propose` exits 1 when a fake model never submits; `investigate` writes a findings document with no saving field.
- `AGENT_ENGINE_CMD` joins `.env.example`.

## 9. Decisions taken without the grill

Each one is a recommended default. Overturn any of them and this file changes first.

1. Stages run as subprocesses with configured command prefixes; no HTTP between the orchestrator and a stage.
2. The orchestrator validates every stage's output against its contract itself, with a Go JSON Schema library.
3. Evaluate proceeds only when every agent candidate is feasible; one infeasible agent candidate is a revise.
4. A revise past `max_revisions` is a `stop`, even when some candidate is feasible.
5. `max_revisions` defaults to 2, as in the sample.
6. Investigate runs once per run.
7. `keep_analyses` checks only the shape of the ids.
8. One active run per project; one rehearse at a time across all runs.
9. A restart or shutdown fails the runs that were mid-step; it does not resume them.
10. Projects are files, `<project>.forecast.json` in one directory; one catalog for every run.
11. No authentication: the orchestrator listens on localhost and trusts `actor.id`. Superseded by `docs/sign-in.md`: every route needs a session or the service token unless `ORCHESTRATOR_AUTH=off`; `actor.id` is still trusted as sent.
12. The flow test is a Go test using the real engine today, with stubs for extract, agent and sandbox.
13. The CI trigger stays on manual dispatch.
14. The agent's `propose` reaches the engine as a subprocess, not by import.
15. The feedback file is the orchestrator's own format, not a contract in `contracts/`.
16. CORS only for the origins in `ORCHESTRATOR_ALLOWED_ORIGINS`, never `*`.

## 10. Failure modes

| Failure | What happens |
| --- | --- |
| A stage exits non-zero, times out, writes nothing or breaks its contract | the step `failed`, `stop`, the run fails with the reason |
| The sandbox finds leftover resources (exit 2) | same as above |
| Revisions run out | `stop` on the step that wanted to revise |
| A decision for a gate that is not open, or a second `pick_layout` | `409`, nothing appended |
| Two surfaces decide at the same gate at once | the run's lock orders them; the first closes the gate, the second gets `409` |
| A decision with a bad body | `400`, nothing appended |
| The orchestrator restarts or stops mid-step | the run fails, section 4 |
| A run directory on disk that does not load | the orchestrator stops at startup naming the file; it never skips a run silently |
| A disk write fails | the event is not appended, the run fails with the reason, and the API answers `500` for a decision |

## 11. Load

- A run has tens of events and a project has one active run, so a run's document stays small; rewriting it on every event is bounded by the number of events.
- Reads never touch the disk. Startup reads every run once.
- At a thousand times today's runs the memory and the startup read grow with the number of runs on disk; archiving finished runs is out of scope.
- Clients poll `events?after=`, which costs a slice of the log.

## 12. Out of scope

- Phase 2: migrate, verify, the pull-request gate (run contract 1.1).
- Authorization on the API (who may decide on which run); authentication is `docs/sign-in.md`.
- Server-sent events or websockets; polling is the contract.
- Resuming a stage after a restart.
- Deleting or archiving runs; pagination beyond `limit`.
- Running a stage over HTTP.
- A contract for findings or for the feedback file.
- The real extractor, sandbox and agent in the CI flow test.
- Defining analyses in `result.json`.
