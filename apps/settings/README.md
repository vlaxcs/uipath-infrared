# Settings

The customer's settings page. From here a start-up's CTO:

- manages the **subscription**: plan, payment method, invoices, cancel and resume;
- gives, changes or **revokes Infrared's read-only access** to their AWS accounts;
- **connects their GitHub organisation** through the Infrared GitHub App, so the Chrome extension works inside it.

Every integration is simulated for now. The page talks to one port, `SettingsApi`, and an in-memory fake implements it. When the orchestrator serves the real endpoints, a new adapter replaces the fake and the UI stays as it is.

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
| `src/adapters/` | The fake adapter: one slice per area in `fake/`, composed in `fake-settings-api.ts`, seeded from `seed.ts` |
| `src/app/` | Shell, hash navigation, `SettingsProvider`, `useAction`, theme toggle |
| `src/features/` | One panel per section: `subscription/`, `cloud/`, `github/` |
| `src/ui/` | Shared primitives: Button, Card, Badge, Dialog, Field, ConfirmByTyping and others |

Colours, fonts and radii come from the tokens in `src/index.css`, with light and dark themes. Components use only those tokens.

## Scripted outcomes in the fake

These inputs show the error states, in the demo and in tests:

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

Errors come back as `{code, message}`, using the codes in `SettingsErrorCode`. The real adapter rethrows them as `SettingsError`.

Cloud access stays read-only (`docs/spec.md`). Verifying a connection means one `sts:AssumeRole` with the external ID. Revoking means Infrared drops the role and stops scheduled runs for that account. The customer also deletes the role on their side.

## For the dashboard

`App` takes an optional `api` prop. To mount the page in `apps/dashboard`, render `<SettingsProvider api={realApi}><SettingsShell /></SettingsProvider>`, or the three panels on their own inside the provider.
