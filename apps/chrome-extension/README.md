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

The card shows the newest run from the orchestrator (`GET /runs?limit=1`): its monthly saving from the latest `result.<n>.json` before/after prices as the headline, its status and pipeline, the top runner suggestion derived from the latest `infra.json`, and one action, which becomes **Review layout** or **Review plan** when the run waits on a decision. Run id, revision, layout names and the full suggestion list stay in the dashboard.

- The background service worker performs the requests. Extension service workers with host permissions are exempt from CORS, so the orchestrator needs no extra origin; the content script never fetches the API directly.
- Without `ci_runners` in the run's `infra.json`, the card explains that there is no runner data. The extractor fills `ci_runners` from the GitHub Actions API when run with `GITHUB_TOKEN` and `GITHUB_REPOSITORY`.
- If the orchestrator has no runs, is down, or the extension has no access to it, the card shows one line (**No runs yet**, **Can't reach Infrared**, **Not connected**) with a link to the dashboard, or **Connect** to Settings for missing access. There is no sample data; the cause of a failure is in the line's tooltip.
- The extension is read-only: the orchestrator only accepts human decisions from the `dashboard` and `slack` surfaces. Approvals happen in the dashboard; the card links there.
- The runner suggestions are heuristics from job durations, not engine-priced changes: self-hosted use at ≤ 20 h/month suggests moving to GitHub-hosted, hosted use at ≥ 160 h/month suggests evaluating self-hosted/on-prem, metered macOS/Windows at ≥ 80 h/month suggests checking whether the runner type is required.

## Connect

The options page (toolbar action or **Settings** in the card) connects the extension to an orchestrator:

- **Local demo**: `http://127.0.0.1:8080`, the default; no extra permission.
- **Hosted instance**: an `https://` URL (for example `https://infrared.example.com`). Chrome asks for access to that host through the manifest's optional host permissions; accept it once. The hosted orchestrator must be reachable over HTTPS and handle its own authentication — the extension never holds a GitHub token, and the GitHub integration stays on the server.

This version does not implement an in-extension sign-in or token forwarding. A hosted instance must accept the extension's requests at the network layer (trusted network or reverse proxy); a future version would add workspace sign-in.

The dashboard URL (default `http://localhost:5173`) is only used by the card's **Open dashboard** link. **Use local demo** resets both URLs. `VITE_ORCHESTRATOR_URL` at build time can change the local default when it is a valid localhost URL.

## Checks

    npm run typecheck
    npm test
    npm run build

The card's design tokens mirror `apps/dashboard/src/styles/tokens.css`; the extension is a standalone app, so the values are copied rather than imported. The extension icons are rendered from the Infrared logo in `apps/dashboard/src/assets/infrared-icon.svg`, the mark the dashboard and site use.

No CI: the team verifies locally.
