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

## Sample data

The runs list and summary read `contracts/run.example.json` through `src/runs/sampleRun.ts`, so the shell renders a real contract sample before the orchestrator API exists. The sample's output paths do not map to `contracts/result.example.json` or a rehearsal file; later views need an explicit fixture map or the real API.

## Candidates

The Candidates section reads `apps/orchestrator/testdata/flow/result.1.json` — a real engine output from the start-up flow test — through `src/candidates/sampleResult.ts`. It shows the result context and baseline, every candidate ranked with cost, availability, risk, effort and why it lost, and the winner's change step by step grouped by layer. `contracts/result.example.json` and `contracts/result.example.nothing-feasible.json` are available as `exampleResult` and `nothingFeasibleResult` for alternate states and tests.

The data module is the single swap point for the future orchestrator API. Readers accept any 1.x schema; unknown actions, layers, flags and confidences are shown as text.
