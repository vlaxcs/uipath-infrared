# Settings

The customer's settings page. From here a start-up's CTO:

- manages the **subscription**: plan, payment method, invoices, cancel and resume;
- gives, changes or **revokes Infrared's read-only access** to their AWS accounts;
- **connects their GitHub organisation** through the Infrared GitHub App, so the Chrome extension works inside it.

Every integration is simulated for now. The page talks to one port, `SettingsApi`, and an in-memory fake implements it. When the orchestrator serves the real endpoints, a new adapter replaces the fake and the UI stays as it is.

Payments run on a local **Stripe test-mode sandbox** (`src/adapters/fake/stripe-sandbox.ts`): no Stripe account, no network. It accepts Stripe's test cards, declines with Stripe's messages, asks for 3-D Secure, fails renewals, and logs the webhook events it would send.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173, sections at #/subscription, #/cloud, #/github
npm test
npm run typecheck
npm run build
```

## Layout

| Path | What it holds |
| --- | --- |
| `src/domain/` | Types (`types.ts`), plan offers, and pure rules per area (`*-rules.ts`) |
| `src/ports/settings-api.ts` | The `SettingsApi` port: `getSettings()` plus every action |
| `src/ports/billing.ts` | `CardTokenizer` (the Stripe.js role) and `SandboxControls` (test cards, webhook log, renewal clock) |
| `src/adapters/` | The fake adapter: one slice per area in `fake/`, composed in `fake-settings-api.ts`, seeded from `seed.ts` |
| `src/app/` | Shell, hash navigation, `SettingsProvider`, `useAction`, theme toggle |
| `src/features/` | One panel per section: `subscription/`, `cloud/`, `github/` |
| `src/ui/` | Shared primitives: Button, Card, Badge, Dialog, Field, ConfirmByTyping and others |

Colours, fonts and radii come from the tokens in `src/index.css`, with light and dark themes. Components use only those tokens.

## Scripted outcomes in the fake

These inputs show the error states, in the demo and in tests:

- Payments take Stripe's test cards, listed in the payment method dialog under "Stripe test cards". Any future expiry and any CVC work:

  | Card | What happens |
  | --- | --- |
  | 4242 4242 4242 4242, 5555 5555 5555 4444, 3782 822463 10005, 4000 0000 0000 0077 | succeeds |
  | 4000 0025 0000 3155 | every on-session payment asks for 3-D Secure; renewals fail with `authentication_required` |
  | 4000 0000 0000 0341 | saves, then every payment is declined |
  | 4000 0000 0000 0002 / 9995 / 0069 / 0127 | refused when saved: declined, insufficient funds, expired card, incorrect CVC |
  | any other valid number | refused: a real card in test mode |

- **Simulate renewal** on the Stripe sandbox card charges the subscription on its renewal date, off-session. A declined charge leaves a failed invoice and the account `past_due`. A subscription set to cancel ends instead.

- An AWS role ARN whose role name contains `denied` fails with "could not assume the role".
- A role name containing `wrong-external-id` fails with an external ID mismatch.
- A subscription seeded as `past_due` shows the payment banner.
- A GitHub installation seeded as `suspended` shows the unsuspend notice.

## For the orchestrator

The account settings document is `contracts/settings.schema.json`, and `contracts/settings.example.json` is a sample. Every port method maps to one endpoint. Every action returns the whole updated `AccountSettings` document, except the two that start a flow.

| Port method | Endpoint |
| --- | --- |
| `getSettings` | `GET /settings` |
| `buyRunPack` | `POST /settings/subscription/run-packs` |
| `changePlan(plan)` | `PUT /settings/subscription/plan` |
| `completePayment(intentId, authenticated)` | `POST /settings/subscription/payments/:id/complete` |
| `cancelSubscription` / `resumeSubscription` | `POST /settings/subscription/cancel` / `resume` |
| `updatePaymentMethod` | `PUT /settings/subscription/payment-method` |
| `startAwsConnection` | `POST /settings/cloud/aws`, returns `AwsConnectionStart` |
| `verifyAwsConnection(id, roleArn)` | `POST /settings/cloud/:id/verify` |
| `updateRegions` | `PUT /settings/cloud/:id/regions` |
| `rotateExternalId` | `POST /settings/cloud/:id/rotate-external-id` |
| `revokeCloudConnection` / `removeCloudConnection` | `POST /settings/cloud/:id/revoke` / `DELETE /settings/cloud/:id` |
| `beginGithubInstall` | `POST /settings/github/install`, returns `{installUrl, state, org, repos}` |
| `completeGithubInstall(state, installationId)` | `POST /settings/github/callback`, from the GitHub App setup URL |
| `updateRepoSelection` / `disconnectGithub` | `PUT /settings/github/repos` / `DELETE /settings/github` |

A purchase whose card needs 3-D Secure returns the document with `subscription.pendingPayment` set and the plan unchanged. The page shows the challenge and then calls `completePayment`. With real Stripe:

- Stripe.js tokenizes the card in the browser, and `updatePaymentMethod` gets the `pm_` id, never the number.
- The server creates and confirms the PaymentIntent.
- On `requires_action` it returns `pendingPayment`, and the browser runs `stripe.handleNextAction`.
- The `payment_intent.*` and `invoice.*` webhooks are the source of truth for invoices and `past_due`.

Errors come back as `{code, message}`, using the codes in `SettingsErrorCode`. The real adapter rethrows them as `SettingsError`.

Cloud access stays read-only (`docs/spec.md`). Verifying a connection means one `sts:AssumeRole` with the external ID. Revoking means Infrared drops the role and stops scheduled runs for that account. The customer also deletes the role on their side.

## For the dashboard

`App` takes an optional `api` prop. To mount the page in `apps/dashboard`, render `<SettingsProvider api={realApi}><SettingsShell /></SettingsProvider>`, or the three panels on their own inside the provider.
