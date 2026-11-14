# Onboarding: how a run starts

Status: draft. Vlad set the order of the steps, the premise, the route, where the targets come from and which answers win; the rest are Claude's recommendations, listed in section 9.

## 1. Why

A run needs to know what infrastructure to read, which project it serves, where that project may move, and whether on-prem is on the table. Today all of it comes from files the team writes by hand. Onboarding asks the owner instead, in the platform, as the start of a run.

## 2. Where it lives

| Route | What |
| --- | --- |
| `/` | the product page (`apps/site`), as today |
| `/app` | the platform (`apps/dashboard`): onboarding first, then the run |

Both are served from one origin. The dashboard builds with `base: "/app/"`, and one static server (or reverse proxy) serves it under that path, with every unknown path under `/app/` answering its `index.html`. That server is not part of this feature: the dashboard has no client routes yet, so only the base path is needed now.

The phone frame (`apps/phone`) has no web route: Slack loads in an Electron `<webview>`, which a browser does not have, and Slack refuses to load in an iframe. In the demo it runs as the Electron shell, `npm run phone`, beside the platform.

## 3. Use cases

The premise: the owner runs no hardware today. Infrared cannot know what an owner's own servers hold, so it does not ask.

1. **The owner starts a run.** At `/app`, "New run" is the first section of the menu, at `#/start`; `/app` itself opens on Runs, as the hash routing does today. The owner answers the four sections below and presses Start. The run starts, and the page shows its id and where to follow it.
2. **The owner keeps every target and skips on-prem.** Sections 3 and 4 stay at their defaults; the run evaluates the targets the catalog prices, with on-prem forbidden.
3. **The owner narrows the targets.** Unticked targets go to `forbidden_providers`; the engine already rejects moves to them, with the reason.
4. **The owner wants on-prem.** Section 4 is ticked; `onprem` joins `allowed_providers`.

## 4. The sections

One page, four sections in this order, each a `fieldset` with a `legend`, all visible at once, so nothing is lost going back up. Start is at the end.

1. **Connect the infrastructure.** One option in the MVP: "AWS (demo estate)", which reaches Floci through the orchestrator's own `AWS_*` variables. Selected and the only choice. No credentials go through the browser.
2. **Pick the project.** One of the projects the orchestrator knows, with its description. The first is selected.
3. **Pick where it may move.** One checkbox per provider that has at least one option in the run's catalog, except `onprem`. Today the real catalog prices `aws` and `managed_pg`; a provider appears on its own once `apps/pricing` prices it. All ticked by default. A provider the project's `forecast.json` forbids is shown unticked and disabled, with "Forbidden by the project". The last ticked provider cannot be unticked.
4. **On-prem.** Shown only when the catalog has an on-prem option. A checkbox: "Also price a setup of our own", with "Infrared prices the hardware, the space and the people to run it." under it. Unticked by default. Disabled, with "Forbidden by the project", when the project forbids `onprem`.
   - **This slice is the checkbox only.** The location and the space (section 3 of `docs/onprem-site.md`) land with the site step, since they need the `onprem` block of `forecast.json` 1.1 and a Google Maps key.

Provider labels are the dashboard's: `aws` "AWS", `gcp` "Google Cloud", `azure` "Azure", `managed_pg` "Managed Postgres", `other` "Other providers (Hetzner, Fly.io, R2 and more)", any other id shown as it is.

## 5. The API

**`GET /onboarding`** answers what the page needs, in one round trip:

```json
{
  "connections": [{ "id": "floci", "label": "AWS (demo estate)" }],
  "providers": ["aws", "managed_pg"],
  "onprem": true,
  "company": "company",
  "projects": [
    { "id": "startup", "description": "...", "forbidden_providers": [] }
  ]
}
```

- `providers`: the distinct `options[].provider` of the orchestrator's catalog, without `onprem`, sorted.
- `onprem`: the catalog has an `onprem` option or an `onprem_platforms` entry.
- `company`: the one company Infrared analyses (`ORCHESTRATOR_COMPANY`, default `company`); its `<company>.forecast.json` `projects` are the roadmap projects the page lists.
- `projects`: every `<id>.forecast.json` in the projects directory, sorted by id, kept for compatibility.

**`POST /runs`** takes an optional `project` (absent or empty: the company) and an optional `onboarding`:

```json
{
  "project": "startup",
  "onboarding": {
    "connection": "floci",
    "targets": ["aws", "managed_pg"],
    "onprem": { "wanted": false }
  }
}
```

The orchestrator writes the answers into the run's copy of `forecast.json`; the project's own file is never changed. The answers win over the project's own lists, except its forbidden providers:
- `allowed_providers` = the targets, plus `onprem` when wanted;
- `forbidden_providers` = the project's own, plus every catalog provider left unticked, plus `onprem` when not wanted.

`400` with the reason, and no run starts, when: `connection` is not `floci`; no target is given; a target is listed twice; a target the catalog does not price; a target or `onprem` the project forbids; `onprem` wanted while the catalog has no on-prem option; an unknown field anywhere in the body.

Per roadmap project, `onboarding.applications[]` items take `id`, `users_now`, `users_expected`, `at_month`, an optional `criteria` and an optional `intent`:
- `criteria` set: the project gets its own `focus` in the run's forecast; absent: it uses the default (the plan's) focus. This holds whatever `focus_mode` says; `focus_mode` is still accepted for compatibility.
- `intent`: what the owner wants done with the project next, trimmed, at most 2000 characters (`400` naming the application when longer). Non-empty, it is written as the project's `intent`; empty, any `intent` is removed. The agent's proposal prompt lists each project's intent and asks every candidate to honour it where the hard constraints allow.

Without `onboarding`, the run starts from the project's `forecast.json` as today, so the flow test and the Slack bot keep working.

The answers are part of the run's inputs: the run's `forecast.json` hash covers them, and a replay gets them back.

## 6. Edge cases and failure modes

| Case | What happens |
| --- | --- |
| The orchestrator is down when the page loads | the sections are replaced by "The platform is unreachable" and a Retry button |
| The orchestrator is down when the owner presses Start | the answers stay on screen, the error shows under Start, and Start works again |
| `POST /runs` answers `400`, `404` or `409` | the orchestrator's reason shows under Start; the answers stay |
| No projects in the projects directory | section 2 says "No projects yet" and Start stays disabled |
| A project's `forecast.json` does not parse | `GET /onboarding` answers `500` naming the file: the team fixes the file, nothing is guessed |
| The catalog does not parse | `GET /onboarding` answers `500` naming the file |
| Two owners start a run on the same project | the orchestrator allows one active run per project: the second gets `409` with the active run's id |
| The owner reloads mid-onboarding | the answers are lost; acceptable for the MVP, since nothing was sent |
| A thousand projects | `GET /onboarding` reads a thousand small files per call: 130 to 141 ms a call, measured with `BenchmarkTheSetupWithAThousandProjects` (5 runs of 20 calls, Windows laptop, warm file cache). Fine for onboarding, which runs once per run; a projects store replaces the directory before ten thousand |

## 7. Tests

- Orchestrator, the answers: targets replace `allowed_providers`; the project's forbidden providers stay; unticked providers and an unwanted `onprem` land in `forbidden_providers`; each `400` case of section 5.
- Orchestrator, the run: `POST /runs` with `onboarding` writes the run's `forecast.json` and leaves the project's file byte for byte; a refused body creates no run directory; without `onboarding` the run's `forecast.json` is the project's, byte for byte.
- Orchestrator, `GET /onboarding`: providers from the catalog, without `onprem`; projects with their forbidden providers; a broken forecast answers `500` naming it.
- Dashboard: the four sections in order; Start sends the body of section 5; a forbidden provider is disabled; the last ticked provider cannot be unticked; on-prem hidden when the catalog has none; an unreachable platform shows Retry; a refused Start keeps the answers and shows the reason; a started run shows its id.
- Route: the dashboard build's assets live under `/app/`.

## 8. Out of scope

- Connecting a real cloud account, and any credentials in the browser.
- Owners who already run their own servers.
- Accounts, sign-in, and saving onboarding answers between runs.
- Editing the project's own `forecast.json` from the platform.
- The on-prem location and space, in this slice (section 4).
- The static server that serves `/` and `/app` together.

## 9. Decisions

1. Order: connect, project, targets, on-prem, start. Vlad's.
2. Premise: no hardware today. Vlad's.
3. Route: `/app` for the platform; the phone frame stays an Electron shell with no route. Vlad's.
4. Targets: only the providers the run's catalog prices. Vlad's.
5. Precedence: the answers replace `allowed_providers`; the project's `forbidden_providers` stays forbidden. Vlad's.
6. The enum of providers stays as it is. Vlad's.
7. One page with four sections, not a wizard with Next and Back. Claude's.
8. The connect step uses the orchestrator's own credentials. Claude's.
9. The dashboard sends the ticked targets; the orchestrator works out `forbidden_providers`, so a client cannot send a contradiction. Claude's.
10. `GET /onboarding` as one route for everything the page needs. Claude's.
11. On-prem unticked by default; the on-prem location waits for the site step. Claude's.
12. `/app` opens on Runs, not on New run: without an orchestrator the dashboard runs on the sample, and onboarding has none. Claude's, open for Vlad.
