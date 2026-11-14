# Chrome extension: repository access and runner configuration

The extension today shows the newest run of one orchestrator, whatever GitHub page is open, and guesses the runner type from the first job label. This spec makes it per repository: the card on `github.com/<owner>/<repo>` shows that repository's runners, how each one is hosted, and the suggestions, for any organisation or personal account that installed the Infrared GitHub App, and only to people signed in to that Infrared account.

No grill ran on this spec; section 9 lists the defaults taken in its place.

## 1. Use cases

1. A user installs the Infrared GitHub App on an organisation they administer, choosing all repositories or a selection, from Configuration in the dashboard.
2. A user installs it on their personal account, the same way.
3. One Infrared account holds several installations: one or more organisations plus the personal account.
4. A user signs the extension in to a hosted orchestrator, once, through the dashboard.
5. On a repository page covered by an installation of their account, the card shows each runner with its hosting kind, labels, OS and architecture when known, hours per month, workflow runs, and up to three suggestions.
6. On a repository page not covered by any installation of their account, the card says so and links to the installation page.
7. On a GitHub page that is not a repository (profile, settings, search), the card shows the newest run, as today.
8. A user signs the extension out, or disconnects in the dashboard; the extension stops showing account data.

## 2. Access: the GitHub App

- One GitHub App, installable on an organisation or a user account. GitHub's own consent page chooses all or selected repositories; Infrared never asks again.
- The account kind comes from the installation's `account.type` (`Organization` or `User`), never from the user.
- The card in Configuration reads "Connect GitHub", not "Connect GitHub organisation", and lists every installation with its account, kind, repository selection and a link to manage it on GitHub.
- `contracts/settings.schema.json` goes from one `github` installation to `github.installations`, an array; `org` becomes `account` with `account_type`. A minor version, since the old single object maps to a one-element array.
- Installation tokens stay on the orchestrator. The extension never holds a GitHub token.
- `installation` and `installation_repositories` webhooks keep the list current: added or removed repositories, suspended or deleted installations.

Permissions requested, added to `GITHUB_PERMISSIONS`:

| Scope | Level | Access | Why |
| --- | --- | --- | --- |
| `actions` | repository | read | workflow runs and jobs (existing) |
| `metadata` | repository | read | list repositories (existing) |
| `contents` | repository | read | `runs-on` in workflow files (existing) |
| `administration` | repository | read | the repository's self-hosted runners |
| `self_hosted_runners` | organisation | read | the organisation's self-hosted runners and groups |

The two new rows are unverified against GitHub's permission reference; confirm them before the work starts. Existing installations must accept the new permissions on GitHub; until they do, the card marks self-hosted details as unavailable rather than failing.

## 3. Extension sign-in

Sign-in with GitHub (`docs/platform.md` section 7) lands with this work, and uses the Infrared GitHub App's user authorization: the App's client id and secret, not a separate OAuth app. One App signs people in, reads their repositories and receives the webhooks.

The orchestrator session is an HttpOnly cookie for the dashboard. The extension does not reuse it: it gets its own bearer token.

1. Settings in the extension shows "Sign in", which opens `<dashboard>/#/extension/connect?ext=<extension id>`.
2. The dashboard, with a session, calls `POST /extension/tokens`. The orchestrator returns a token bound to the Infrared account, read-only, valid 30 days.
3. The dashboard hands the token to the extension with `chrome.runtime.sendMessage(<extension id>, ...)`. The manifest's `externally_connectable` lists only the dashboard origin; the background rejects messages from any other sender.
4. The background stores the token in `chrome.storage.local` and sends it as `Authorization: Bearer` on every orchestrator request. The content script never sees it.
5. `401` from the orchestrator clears the token and the card shows "Sign in again".
6. Disconnect in the dashboard and sign-out in the extension both call `DELETE /extension/tokens/current`, which revokes it.

Local demo (`http://127.0.0.1`, `http://localhost`) keeps working without a token, as today.

## 4. Runner configuration

### Hosting kinds

| Kind | How it is recognised |
| --- | --- |
| `github_hosted` | job `runner_group_name` is `GitHub Actions` |
| `github_larger` | the runner is listed among the organisation's GitHub-hosted larger runners |
| `self_hosted` | job labels contain `self-hosted`, or the runner is listed among the repository's or organisation's self-hosted runners |
| `third_party` | a job label starts with a known provider prefix: `blacksmith-`, `ubicloud-`, `namespace-profile-`, `buildjet-`, `warp-`, `depot-`, `runs-on=`, `runs-on/`. Checked before `self_hosted`, since these runners register as self-hosted. The provider name goes in `provider` |
| `unknown` | none of the above |

### Data sources

- Jobs of the repository's workflow runs in the window (`window_days`, as the extractor): `labels`, `runner_name`, `runner_group_name`, start and end times.
- `GET /repos/{owner}/{repo}/actions/runners`, and for an organisation `GET /orgs/{org}/actions/runners`: OS, architecture, status, labels of self-hosted runners.
- `runs-on` in `.github/workflows/*.yml`: what is configured, shown beside what ran when they differ.

### Contract

`ci_runners` in `contracts/infra.schema.json`, minor version 1.2. Every runner item gains:

| Field | Type |
| --- | --- |
| `hosting` | one of the kinds above |
| `labels` | array of strings |
| `os`, `arch` | string, when known |
| `runner_group` | string, when known |
| `provider` | string, only for `third_party` |

`runner_type` stays, for readers of 1.1. `source_repo` stays, the repository the item was measured on.

### Where it runs

A new orchestrator route, `GET /github/repos/{owner}/{repo}/runners`, answers the card. It runs the extractor's runner extraction as a subprocess with an installation token, as stages already do, so the classification lives in one place. Answers:

- `200`, the `ci_runners` object and the suggestions;
- `401`, no or bad token;
- `403`, the repository is not covered by an installation of the token's account. The body carries the installation URL;
- `502`, GitHub failed; the body names the call.

The suggestions keep today's thresholds; `hosting` replaces the string match on `self-hosted`.

## 4b. Installing before it is published

Home's **+ Browser extension** links to `VITE_CHROME_EXTENSION_URL` when it is set, as today. Unset, it opens a dialog, "Install the Infrared extension", instead of sitting disabled:

1. Build it: in the repository, `cd apps/chrome-extension`, `npm install`, `npm run build`.
2. Open `chrome://extensions` and turn on **Developer mode**. A page cannot link to `chrome://`, so the address has a **Copy** button.
3. Choose **Load unpacked** and select `apps/chrome-extension/dist`.
4. Open any page on github.com; the Infrared card appears.
5. For a hosted orchestrator, open the extension's **Settings** and enter its `https://` URL.

- The dialog is a native modal: focus moves into it, Escape and **Close** close it, focus returns to the button.
- Copy that fails (no clipboard permission, insecure origin) says "Copy failed"; the address stays selectable.
- Out of scope: a downloadable zip of `dist`, publishing to the Chrome Web Store, detecting whether the extension is already installed.

## 5. Edge cases

- A repository covered by two installations of the same account (personal plus an org it was transferred to): the installation whose account owns the repository wins.
- A repository with no workflow runs in the window: the card says "No workflow runs in the last N days", not "no runner data".
- A personal account: no runner groups and no organisation runners; only repository runners and job data.
- A self-hosted runner removed since the job ran: classified from the job's labels; OS and architecture unknown.
- A matrix job on several runners: each job counts toward its own runner.
- Labels in mixed case: compared case-insensitively.
- Repository renamed or transferred: GitHub redirects; the route resolves on the repository id, not the name.
- The user navigates between repositories without a page load (GitHub is a single-page app): the card re-reads `owner/repo` on each navigation.
- A private repository the signed-in user cannot see on GitHub but the installation can: the user is on the page only if they can see it, so the card never reveals one they cannot open.

## 6. Failure modes

| Failure | What happens |
| --- | --- |
| Orchestrator unreachable | the card shows the sample run with the Sample data badge, as today |
| No token on a hosted orchestrator | the card shows "Sign in" and no account data |
| Token expired or revoked | `401`, token cleared, "Sign in again" |
| Repository not installed for this account | `403`, the card links to the installation page |
| Installation lacks the new permissions | job data shown; self-hosted details marked unavailable, with a link to accept the permissions |
| GitHub rate limit on the installation | the last cached answer with its age; no cache: "GitHub rate limit, retry after <time>" |
| GitHub error mid-extraction | `502`; the cached answer if there is one, marked stale |
| Installation suspended or deleted | the webhook removes it; the next request is `403` |

## 7. Load

- Every repository page view asks for its runners. The orchestrator caches each repository's answer for 15 minutes and serves concurrent requests for the same repository from one extraction.
- Jobs are fetched per workflow run, one GitHub call per run; GitHub has no batch call. Completed runs never change, so jobs are cached by run id and only runs newer than the cache are fetched. A repository with 2,000 runs a month costs 2,000 calls once, then only the new ones.
- At a thousand times today's users the limit is GitHub's rate limit per installation, not the orchestrator. The cache is per repository, shared by every user of the account.
- The extension's 5-second cache stays, keyed by repository.

## 8. Out of scope

- Changing runners from the extension; it stays read-only.
- Pricing runner changes in the engine; suggestions stay heuristics.
- GitHub Enterprise Server.
- Other browsers than Chrome.
- Runner usage across all repositories of an account in one view; that is the dashboard's job.
- Billing data from GitHub (minutes billed, spending limits).

## 9. Decisions taken without the grill

Each one is a recommended default. Overturn any of them and this file changes first.

1. Organisations and personal accounts both in v1, through one GitHub App.
1. The same GitHub App signs people in; there is no separate OAuth app.
1. Third-party runners are recognised by label prefix (section 4); an unlisted provider falls through to `self_hosted` or `unknown`.
2. The extension signs in through the dashboard and holds its own bearer token, not the session cookie.
3. The token is read-only, account-bound, valid 30 days, revocable.
4. The runner route runs the extractor as a subprocess, so the classification is not duplicated in Go.
5. 15 minutes of cache per repository; jobs cached by run id.
6. Pages that are not repositories keep showing the newest run.

## 10. Open questions

1. The new permission names in section 2: confirm them on the GitHub App's permission page when it is created.
