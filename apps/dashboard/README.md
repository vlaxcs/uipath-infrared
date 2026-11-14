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

## Dependency graph

The Graph section renders the start-up mock's infrastructure graph from `contracts/mock/startup.infra.json` (10 components, 9 edges) through `src/graph/sampleGraph.ts`, the only graph module that imports contracts.

The layout in `src/graph/layout.ts` is deterministic: a seeded force simulation in a fixed 1000×700 world, so tests do not depend on DOM measurement. Nodes are coloured by stack and shaped by category; idle and orphan nodes get a status halo. The view filters by stack, connection kind and status, dims non-matches for search, and lets you select a node to see its facts and inbound/outbound connections (also navigable). Zoom, pan and fit are available.

There is no orchestrator graph source yet; a future source can replace the sample without changing the view.

## Sample data

The runs list and summary read `contracts/run.example.json` through `src/runs/sampleRun.ts`, so the shell renders a real contract sample before the orchestrator API exists. The sample's output paths do not map to `contracts/result.example.json` or a rehearsal file; later views need an explicit fixture map or the real API.

## Rehearsal

The Rehearsal section renders `rehearsal.json` through `src/rehearsal/sampleRehearsal.ts`, the only rehearsal module that imports data files. The default is `contracts/rehearsal.example.json` (the passed demo path); `apps/sandbox/sample/rehearsal.json` is exported as `failedRehearsal` for the failed/revise state and tests.

It shows the traffic profile, the injected failure, availability and latency before/during/after with each measurement's provenance and basis, per-component health, and the pass/fail verdict with the orchestrator's decision. `rehearsal.json` has no fallback field, so the fallback summary is derived from component results, phase measurements, the verdict and `x_measurement_notes`, and is labelled as derived. Missing measurements show "Not measured"; no value is zero-filled. Readers accept any 1.x schema and humanise unknown vocabulary.
