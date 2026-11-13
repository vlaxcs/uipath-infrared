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
