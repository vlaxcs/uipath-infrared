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

The layout gate is decided in the Present pane: it lists the feasible `x_candidates` (highest rank preselected, infeasible layouts named) and submits `pick_layout`. The plan gate is decided in the Rehearse pane and submits `approve_plan`. Both need a reason and act as `cto` on the `dashboard` surface. A `409` means another surface decided first, so the page asks for a refresh instead of resubmitting; `422` reports an infeasible layout.

Step results come from `GET /runs/{id}/files/{path}`. When that endpoint is unavailable, the pane says so and keeps the path and the event data. Artifacts are fetched on demand for the selected step and revision, cached per run; the revision buttons switch between `candidates.<n>.json`, `result.<n>.json` and `rehearsal.<n>.json`.

The view polls `GET /runs/{id}/events?after=` every two seconds while the run is live, stops at a terminal status, and refreshes the runs list when the step or status changes. `src/runs/httpRunSource.ts` implements the API; `src/runs/sampleRunSource.ts` serves the sample without advancing.

## Sample data

`src/runs/sampleRun.ts` reads `contracts/run.example.json`; `src/runs/sampleArtifacts.ts` maps the run's artifact paths to `contracts/` examples so every step has a result to show. The sample is read-only: no start and no approvals. `src/runs/fixtures.ts` cuts the sample at each gate and provides a failed run for tests.
