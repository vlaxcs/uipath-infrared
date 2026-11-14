# The platform at `/app`

Status: draft. The layout, the pages and the rules below are Vlad's; the defaults Claude picked are listed in section 10.

## 1. Scope

The platform replaces the dashboard's sidebar layout. One home page with two actions, an account menu, and a run page that shows the agent working live. All routes live under `/app`, as hash routes.

The theme is out of scope for now: the pages use the dashboard's neutral tokens. Copy is short, technical, in English.

## 2. Routes

| Route | Page |
| --- | --- |
| `#/login` | sign in with GitHub |
| `#/` | home: Analyze, Previous analysis, Add browser extension |
| `#/analyze` | the configuration of a new analysis, then its run |
| `#/runs` | previous analyses, as a table |
| `#/runs/<id>` | one run: the pipeline live, its candidates, the sandbox, the migration plan |
| `#/configuration` | connections and project defaults |
| `#/account` | credits, plan, payments |

Every page except `#/login` needs a session; without one it opens `#/login`.

## 3. Frame

- **Logo**, floating at the top left. A **Back** button sits to its left on every page but home, and goes to the previous page in the app.
- **Avatar**, at the top right, from the GitHub account. Its menu: Configuration, Account, Disconnect. Disconnect ends the session and opens `#/login`.
- **Credits**, beside the avatar: one red half-circle per run left (`#EF3B24`, the mascot's red), facing left. Above 10, the count is shown as a number beside one mark.
- No sidebar.

## 4. Pages

### Login
The mascot (`apps/site/rive/infrared.riv`, artboard `Infrared`, animation `float`) and one button: "Sign in with GitHub".

### Home
- The mascot in the middle, animation `hood` (the hood falls and leaves the ghost).
- Floating at the bottom, rounded: **Analyze** (with the credit mark) and **Previous analysis** side by side on the left; **+ Browser extension** on the right, linking to the Chrome extension, disabled until it is published.
- Analyze with no credit left opens Account instead of a new analysis.

### Analyze
Opens with a fade. The onboarding sections of `docs/onboarding.md`, pre-filled from Configuration:
1. Infrastructure: the connected one.
2. Project.
3. Criteria: high availability, cost reduction, data residency, performance.
4. Where it may move: every provider the run's catalog prices.
5. On-prem.

Start takes one credit and opens the run page.

### Run
- **Left: the agent.** A state graph of the workflow: each step's status in order, steps that run at the same time side by side, and the step in progress with its log streaming. The mascot plays the step's animation (section 6). A gate shows its decision in place, and the same gate goes to Slack.
- **Right: the selected item.** By default, the run's summary.
- **Candidates**, listed under the agent once evaluate has run; selecting one loads its details on the right: cost, availability, risk, effort, violations, the change step by step.
- **Sandbox**, once a layout is picked: the rehearsal's result, and a form to rehearse again with another traffic profile (requests per second, duration, which failure to inject). A prompt field turns a sentence into the same profile.
- **Migration plan**: Andrei's A to B view (`docs/run-plan-view.md`), under the candidate it belongs to.

### Previous analysis
A table of every run: id, project, started, status, winner, monthly cost before and after. A row opens its run page, with the same content as a live run.

### Configuration
- **GitHub organisation**: the one connected at sign-in, with the repositories it grants.
- **Infrastructure**: AWS. In the MVP it reaches Floci through the orchestrator's own credentials; the page says so.
- **Project defaults**: the weight of each criterion (high availability, cost reduction, data residency, performance) and the allowed regions. New analyses start from these.
- **On-prem**: wanted or not; headquarters with its free area, or a search area with a radius (`docs/onprem-site.md`).

### Account
- Credits left, credits used, and the plan.
- **Buy credits**: the run pack from the PRD, 5 runs for 100 USD, through Stripe Checkout in test mode.
- **Subscription**: 200 USD a month with scheduled runs, shown as not yet available.
- Payment history: date, pack, amount, Stripe status.

## 5. Rules

- One run costs one credit, taken when the run starts. No credit, no start: `402`. A run that fails before investigate gives its credit back.
- **Two plans cannot be applied at the same time on the same infrastructure.** Applying starts with phase 2 (pull requests per step). Until phase 2 exists nothing is applied, so the rule has nothing to enforce; it is enforced in the orchestrator when phase 2 lands.
- A gate decided in the platform closes the same gate in Slack, and the reverse.

## 6. Mascot states

`infrared.riv`, artboard `Infrared`. The state machine has no inputs, so each state plays one animation by name.

| When | Animation |
| --- | --- |
| login, idle | `float` |
| loading a page or a file | `scan` |
| extract, investigate | `scan` |
| propose | `reorganise` |
| evaluate | `chomp` |
| waiting at a gate | `float` |
| rehearse | `grow` |
| completed | `sunset` |
| failed | `hood` |

## 7. API added to the orchestrator

| Route | Does |
| --- | --- |
| `GET /auth/github` | redirects to GitHub's authorize page with a `state` |
| `GET /auth/github/callback` | exchanges the code, checks `state`, opens the session, redirects to `/app` |
| `POST /auth/logout` | ends the session |
| `GET /me` | the user: login, avatar, credits, plan |
| `GET /profile`, `PUT /profile` | the configuration defaults |
| `GET /runs/{id}/logs?step=&after=` | a step's log from a byte offset, for streaming |
| `POST /runs/{id}/rehearsals` | rehearse the picked layout again with a traffic profile |
| `POST /billing/checkout` | creates a Stripe Checkout session for a run pack |
| `POST /billing/webhook` | Stripe's `checkout.session.completed`: adds the credits once per session |
| `GET /billing/payments` | the payment history |

The session is an HttpOnly, `SameSite=Strict` cookie. Every route but the auth routes and the Stripe webhook needs it; the webhook is checked with Stripe's signature instead.

## 8. Configuration

| Variable | Read by | Value |
| --- | --- | --- |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | orchestrator | the GitHub OAuth app; callback `<orchestrator>/auth/github/callback` |
| `SESSION_SECRET` | orchestrator | signs the session cookie |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | orchestrator | test mode keys |
| `STRIPE_RUN_PACK_PRICE_ID` | orchestrator | the price of the 5-run pack in Stripe |
| `CHROME_EXTENSION_URL` | dashboard (`VITE_`) | where Add browser extension points |

## 9. Delivery

Each slice is its own pull request into `agentic-wf`:
1. The frame, home, routes, the mascot component, the credit mark. On the current API.
2. Previous analysis and the run page layout: the agent on the left, the selected item on the right, the candidates list.
3. Live logs and the parallel state graph.
4. Sign-in with GitHub, sessions, `GET /me`.
5. Configuration and `/profile`; Analyze pre-filled from it.
6. Credits, Stripe Checkout and the webhook, Account.
7. The migration plan view and the sandbox form.
8. Slack notifications for every gate of every run.

## 10. Decisions

1. Pages, layout, menu and rules: Vlad's.
2. Sign-in with GitHub OAuth: Vlad's.
3. Run packs through Stripe, prices from the PRD: Vlad's.
4. Applying starts with phase 2: Vlad's.
5. Hash routes under `/app`, and every page behind a session: Claude's.
6. The credit mark faces left and switches to a number above 10: Claude's.
7. The mascot animation per step (section 6): Claude's.
8. A run that fails before investigate refunds its credit: Claude's.
9. The sandbox prompt is turned into a traffic profile, never sent to the sandbox as text: Claude's.

## 11. Out of scope

- The theme.
- Sign-up, teams, more than one user per account.
- The subscription's billing and scheduled runs.
- Real cloud accounts; the infrastructure stays Floci.
- Phase 2 and the apply rule's enforcement.
