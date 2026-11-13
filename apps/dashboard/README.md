# Infrared dashboard

The CTO's surface for runs, the infrastructure graph, candidates, approvals and rehearsal. It follows the same Vite, React, TypeScript and Tailwind setup as the phone app.

## Run it

    npm install
    npm run dev

## Checks

    npm run typecheck
    npm test
    npm run build

## Design tokens

`src/styles/tokens.css` is the only file with colour, type and radius values. Components use token-backed Tailwind utilities only; `src/tokens.guard.test.ts` enforces it. The palette is neutral until Miruna's `design/tokens.css` lands. To swap it, import the shared file and point the local role variables at it; component classes stay unchanged.

## Run view

Selecting a run renders the summary, the six-step rail, an awaiting banner when a gate is open, and the revision-grouped timeline. Every event shows its status, time, step, actor, decision kind and full reason; outputs show the contract path and a short hash. Decisions and gates are read from the run contract; a run paused after `keep_analyses` still shows the layout gate.

The view polls `RunSource.eventsAfter` every two seconds while the run is live. `src/runs/sampleRunSource.ts` returns no events because the sample is finished. When the orchestrator exposes `GET /runs/{id}/events?after=`, add an HTTP source and pass it from `App`; the components do not change. Approval actions are task 6.

Tests use `src/runs/fixtures.ts` for runs cut at each gate and a failed run.

## Sample data

The runs list and run view read `contracts/run.example.json` through `src/runs/sampleRun.ts`, so the app renders a real contract sample before the orchestrator API exists. The sample's output paths do not map to `contracts/result.example.json` or a rehearsal file; later views need an explicit fixture map or the real API.
