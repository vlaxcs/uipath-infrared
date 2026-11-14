import { useState } from "react";
import { useAction } from "~/app/settings-context";
import { GITHUB_PERMISSIONS } from "~/domain/github-rules";
import type { GithubInstallBegin, RepoSelection } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";
import { SIMULATED_INSTALLATION_ID } from "~/features/github/constants";
import { PermissionList } from "~/features/github/PermissionList";
import { SimulatedGithubConsent } from "~/features/github/SimulatedGithubConsent";

const beginInstall = (api: SettingsApi) => api.beginGithubInstall();
const completeInstall = (api: SettingsApi, state: string) => api.completeGithubInstall(state, SIMULATED_INSTALLATION_ID);
const updateSelection = (api: SettingsApi, selection: RepoSelection) => api.updateRepoSelection(selection);

const REASONS = [
  "The Infrared Chrome extension shows the latest Infrared run and its status right inside GitHub.",
  "It suggests CI runners for your workflows, based on what Infrared measured.",
  "In phase 2, Infrared opens migration pull requests that your own CI applies.",
];

export function ConnectCard({ disabled = false }: { disabled?: boolean }) {
  const [consent, setConsent] = useState<GithubInstallBegin | null>(null);
  const begin = useAction(beginInstall);
  const complete = useAction(completeInstall);
  const select = useAction(updateSelection);

  async function start() {
    const result = await begin.run();
    if (result) setConsent(result);
  }

  async function install(selection: RepoSelection) {
    if (!consent) return;
    const settings = await complete.run(consent.state);
    if (!settings) return;
    setConsent(null);
    if (selection.kind === "selected") await select.run(selection);
  }

  function cancel() {
    complete.clearError();
    setConsent(null);
  }

  const error = begin.error ?? select.error;

  return (
    <Card
      title="Connect your GitHub organisation"
      description="Install the Infrared GitHub App on your organisation. You choose which repositories it can see."
    >
      <div className="flex flex-col gap-5">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {REASONS.map((reason) => (
            <li key={reason} className="type-body">
              {reason}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <h3 className="type-label">Permissions requested</h3>
          <PermissionList permissions={GITHUB_PERMISSIONS} />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Button variant="primary" pending={begin.pending} disabled={disabled} onClick={start}>
            Connect GitHub organisation
          </Button>
        </div>
      </div>
      {consent && (
        <SimulatedGithubConsent begin={consent} pending={complete.pending} error={complete.error} onInstall={install} onCancel={cancel} />
      )}
    </Card>
  );
}
