# Infrared Chrome extension

The latest Infrared run and GitHub Actions runner suggestions, in a floating card on every `github.com` page.

## Build and load

    npm install
    npm run build

1. Open `chrome://extensions`, enable **Developer mode**.
2. Choose **Load unpacked** and select `apps/chrome-extension/dist`.
3. Open <https://github.com/vlaxcs> (or any GitHub page) with the orchestrator running.

For development, `npm run watch` rebuilds `dist/` on change; reload the extension from `chrome://extensions` to pick it up. `dist/` is generated and gitignored.

Current branded Chrome disables the `--load-extension` command-line flag; load the folder unpacked from `chrome://extensions` manually, or drive Chrome for Testing (as the automated check does) for a scripted launch.

## Data

The card shows the newest run from the orchestrator (`GET /runs?limit=1`), its latest `result.<n>.json` before/after prices, its pipeline state and the runner suggestions derived from the latest `infra.json`.

- The background service worker performs the requests. Extension service workers with host permissions are exempt from CORS, so the orchestrator needs no extra origin; the content script never fetches the API directly.
- Without `ci_runners` in the run's `infra.json`, the card explains that there is no runner data. The extractor fills `ci_runners` from the GitHub Actions API when run with `GITHUB_TOKEN` and `GITHUB_REPOSITORY`.
- If the orchestrator is down or has no runs, the card shows a bundled sample run with a **Sample data** badge, including sample runner usage.
- The extension is read-only: the orchestrator only accepts human decisions from the `dashboard` and `slack` surfaces. Approvals happen in the dashboard; the card links there.
- The runner suggestions are heuristics from job durations, not engine-priced changes: self-hosted use at ≤ 20 h/month suggests moving to GitHub-hosted, hosted use at ≥ 160 h/month suggests evaluating self-hosted/on-prem, metered macOS/Windows at ≥ 80 h/month suggests checking whether the runner type is required.

## Settings

The options page (toolbar action or **Settings** in the card) sets the orchestrator URL (default `http://127.0.0.1:8080`) and dashboard URL (default `http://localhost:5173`). The orchestrator URL must be local: the manifest only has host permissions for `http://localhost/*` and `http://127.0.0.1/*`. `VITE_ORCHESTRATOR_URL` at build time can change the default when it is a valid localhost URL.

## Checks

    npm run typecheck
    npm test
    npm run build

The card's design tokens mirror `apps/dashboard/src/styles/tokens.css`; the extension is a standalone app, so the values are copied rather than imported. The extension icons are resized from the Infrared logo in `apps/site/public/apple-touch-icon.png`.

No CI: the team verifies locally.
