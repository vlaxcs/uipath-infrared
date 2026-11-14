# Orchestrator

Runs the Infrared workflow, steps 1 to 6: extract, investigate, propose, evaluate, present, rehearse. It calls every stage as a subprocess, holds each run as a `contracts/run.schema.json` document, pauses at the `layout` and `plan` gates for a person, and serves runs over HTTP. Spec: `docs/orchestrator.md`.

## Run

From the repo root, with `.env` filled in from `.env.example` and the engine's Python environment active:

```bash
go -C apps/orchestrator build -o ../../.bin/orchestrator ./cmd/orchestrator
PYTHONPATH=apps/engine:apps .bin/orchestrator
```

Relative paths in `.env` resolve from where the orchestrator starts, so start it from the repo root. `ORCHESTRATOR_AGENT_CMD` points at the agent stub until the agent has its `investigate` and `propose` commands.

```bash
curl -s -XPOST localhost:8080/runs -d '{"project": "startup"}'
curl -s localhost:8080/runs/run-startup-0001/events?after=0
curl -s -XPOST localhost:8080/runs/run-startup-0001/decisions -d '{"step": "present", "status": "approved", "actor": {"kind": "human", "id": "cto", "surface": "dashboard"}, "decision": {"kind": "pick_layout", "reason": "stays in the EU", "layout": "agent-serverless-db-eu"}}'
```

## API

| Route | Answers |
| --- | --- |
| `GET /onboarding` | connections, the catalog's providers, on-prem, and every project with its forbidden providers |
| `GET /runs?project=&limit=` | run summaries, newest first, no events; `limit` 1 to 200, default 50 |
| `POST /runs` `{"project", "onboarding"?}` | `201` the new run, with the onboarding answers in its `forecast.json`; `400` answers that break `docs/onboarding.md` section 5; `404` no `<project>.forecast.json`; `409` the project already has an active run |
| `GET /runs/{id}` | the run document |
| `GET /runs/{id}/events?after=` | the events after `seq`, `[]` when none |
| `POST /runs/{id}/decisions` | `201` the appended event; `400` bad body; `409` gate not open; `422` layout not a feasible candidate |

Errors are `{"error": "<reason>"}`.

## Test

```bash
cd apps/orchestrator
go vet ./...
go test ./...
```

`flow/flow_test.go` is the end-to-end flow test: one run of the demo path over HTTP, with the real engine and stubs for extract, the agent and the sandbox (`testdata/stubs/`). Point a stage at its real component with `FLOW_EXTRACT_CMD`, `FLOW_AGENT_CMD`, `FLOW_ENGINE_CMD` or `FLOW_SANDBOX_CMD`; `FLOW_PYTHON` picks the interpreter (default `python`). The finished run is checked by `contracts/check_run.py`.

## Layout

| Path | Layer | Holds |
| --- | --- | --- |
| `cmd/orchestrator/` | entry point | settings, wiring, the HTTP server, signals |
| `internal/app/` | wiring | builds the workflow and the handler from settings |
| `internal/workflow/` | application | the steps, the run registry, the ports |
| `internal/run/` | domain | the run document, the event log and its summary, gates, decisions |
| `internal/adapters/` | adapters | subprocess stages, JSON Schema checks, run files, the run store, the HTTP API |
| `internal/settings/` | configuration | the environment and `.env` |
