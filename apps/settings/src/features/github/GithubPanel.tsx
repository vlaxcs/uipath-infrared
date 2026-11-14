import { useSettings } from "~/app/settings-context";
import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";
import { ConnectCard } from "~/features/github/ConnectCard";
import { DisconnectCard } from "~/features/github/DisconnectCard";
import { ExtensionCard } from "~/features/github/ExtensionCard";
import { OrgCard } from "~/features/github/OrgCard";
import { PermissionList } from "~/features/github/PermissionList";

export function GithubPanel() {
  const { github } = useSettings();

  if (github.status === "not_connected") {
    return (
      <div className="flex flex-col gap-5">
        <ConnectCard />
      </div>
    );
  }

  if (github.status === "suspended") {
    return (
      <div className="flex flex-col gap-5">
        <Notice tone="warn">
          The Infrared app was suspended in GitHub{github.org ? ` for ${github.org}` : ""}. Unsuspend it in your GitHub organisation settings to
          use the extension again.
        </Notice>
        {github.org && <OrgCard installation={github} />}
        <ConnectCard disabled />
        {github.org && <DisconnectCard org={github.org} />}
      </div>
    );
  }

  const org = github.org ?? "";

  return (
    <div className="flex flex-col gap-5">
      <OrgCard installation={github} />
      <Card title="Permissions" description="Granted to the Infrared app when it was installed.">
        <PermissionList permissions={github.permissions} />
      </Card>
      {github.extensionReady && <ExtensionCard org={org} />}
      <DisconnectCard org={org} />
    </div>
  );
}
