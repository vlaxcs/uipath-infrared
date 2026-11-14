# Infrared dashboard

The CTO's surface for runs, the infrastructure graph, candidates, approvals and rehearsal. It follows the same Vite, React, TypeScript and Tailwind setup as the phone app.

## Run it

    npm install
    npm run dev

To follow a real run, start the orchestrator first and point the dashboard at it:

    VITE_ORCHESTRATOR_URL=http://127.0.0.1:8080 npm run dev

The orchestrator's `ORCHESTRATOR_ALLOWED_ORIGINS` must include the Vite origin (`http://localhost:5173`). Without `VITE_ORCHESTRATOR_URL` the dashboard uses the sample run and the header badge says "Sample data".

## Checks

    npm run typecheck
    npm test
    npm run build

## Design tokens

`src/styles/tokens.css` is the only file with colour, type and radius values. Components use token-backed Tailwind utilities only; `src/tokens.guard.test.ts` enforces it. The palette is neutral until Miruna's `design/tokens.css` lands. To swap it, import the shared file and point the local role variables at it; component classes stay unchanged.

## Live workflow

Runs are a table: status, current step, the **before** price (the result's baseline) and the **after** price (the winner's monthly cost), plus when the run last changed. Prices come from the latest `result.<n>.json`; a run that has not been evaluated shows `—`. Selecting a row navigates to the run's own page (`#/runs/<id>`), and "← All runs" returns to the table. "Start run" posts `{"project":"startup"}` when no run is active and opens the new run.

The six steps form a connected pipeline graph. Selecting a node loads its artifact and shows the step's result, its events and the next step. Selecting the same node again returns to the **run overview** (summary and timeline); the overview is also what a freshly opened run page shows, and it follows `run.step` while "Following live" is on. "Next step" only moves the selection; the orchestrator advances the automatic steps itself.

Sections are hash routes (`#/runs`, `#/graph`, …), so a run page survives a refresh and the browser's back button works without a server rewrite.

The layout gate is decided in the Present pane. It can first **keep analyses**: the findings from investigate are listed with checkboxes and a reason, and keeping them posts `keep_analyses` without closing the gate. It then lists the feasible `x_candidates` (highest rank preselected, infeasible layouts named) and submits `pick_layout`, which starts the rehearsal. The plan gate is decided in the Rehearse pane and submits `approve_plan`. Every decision needs a reason and acts as `cto` on the `dashboard`. A `409` means another surface decided first, so the page asks for a refresh instead of resubmitting; `422` reports an infeasible layout.

`result.json` does not define analyses yet, so v1 uses the investigate findings' ids as the analyses to keep. The orchestrator checks only that the submitted ids are non-empty and unique.

The Approvals section (`#/approvals`) lists every run paused at a gate, newest first, with its gate and step. **Review** opens the run at `#/runs/<id>/gate` with the gated node already selected; "← All approvals" returns to the list. The gate focus is part of the route, so refresh and browser back behave.

Step results come from `GET /runs/{id}/files/{path}`. When that endpoint is unavailable, the pane says so and keeps the path and the event data. Artifacts are fetched on demand for the selected step and revision, cached per run; the revision buttons switch between `candidates.<n>.json`, `result.<n>.json` and `rehearsal.<n>.json`.

The run page polls `GET /runs/{id}/events?after=` every two seconds while the run is live and stops at a terminal status; the runs and approvals lists poll every five seconds in live mode. `src/runs/httpRunSource.ts` implements the API; `src/runs/sampleRunSource.ts` serves the sample without advancing.

## Sample data

`src/runs/sampleRun.ts` reads `contracts/run.example.json`; `src/runs/sampleArtifacts.ts` maps the run's artifact paths to `contracts/` examples so every step has a result to show, including three sample findings for the keep-analyses list. The sample is read-only: no start and no approvals; the Approvals page is empty until the orchestrator is connected. `src/runs/fixtures.ts` cuts the sample at each gate and provides a failed run for tests.

## Dependency graph

The Graph section renders the start-up mock's infrastructure graph from `contracts/mock/startup.infra.json` (10 components, 9 edges) through `src/graph/sampleGraph.ts`, the only graph module that imports contracts.

The layout in `src/graph/layout.ts` is deterministic: a seeded force simulation in a fixed 1000×700 world, so tests do not depend on DOM measurement. Nodes are coloured by stack and shaped by category; idle and orphan nodes get a status halo. The view filters by stack, connection kind and status, dims non-matches for search, and lets you select a node to see its facts and inbound/outbound connections (also navigable). Zoom, pan and fit are available.

There is no orchestrator graph source yet; a future source can replace the sample without changing the view.

## Rehearsal

The Rehearsal section renders `rehearsal.json` through `src/rehearsal/sampleRehearsal.ts`, the only rehearsal module that imports data files. The default is `contracts/rehearsal.example.json` (the passed demo path); `apps/sandbox/sample/rehearsal.json` is exported as `failedRehearsal` for the failed/revise state and tests.

It shows the traffic profile, the injected failure, availability and latency before/during/after with each measurement's provenance and basis, per-component health, and the pass/fail verdict with the orchestrator's decision. `rehearsal.json` has no fallback field, so the fallback summary is derived from component results, phase measurements, the verdict and `x_measurement_notes`, and is labelled as derived. Missing measurements show "Not measured"; no value is zero-filled. Readers accept any 1.x schema and humanise unknown vocabulary.
