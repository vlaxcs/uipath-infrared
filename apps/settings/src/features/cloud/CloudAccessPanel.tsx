import { useCallback, useState } from "react";
import { useAction, useSettings } from "~/app/settings-context";
import { awsSetupFor } from "~/domain/cloud-rules";
import type { AwsConnectionStart, CloudConnection } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";
import { AccessScopeCard } from "~/features/cloud/AccessScopeCard";
import { ConnectAwsDialog, type ConnectStep } from "~/features/cloud/ConnectAwsDialog";
import { ConnectionCard } from "~/features/cloud/ConnectionCard";
import { RegionsDialog } from "~/features/cloud/RegionsDialog";
import { RevokeDialog } from "~/features/cloud/RevokeDialog";
import { RotateDialog } from "~/features/cloud/RotateDialog";
import { useRefresh } from "~/features/cloud/use-cloud-actions";

type OpenDialog =
  | { kind: "connect"; setup: AwsConnectionStart; step: ConnectStep; roleArn: string | null }
  | { kind: "regions" | "rotate" | "revoke"; id: string };

const startFn = (api: SettingsApi) => api.startAwsConnection();

export function CloudAccessPanel() {
  const { cloud } = useSettings();
  const start = useAction(startFn);
  const refresh = useRefresh();
  const [open, setOpen] = useState<OpenDialog | null>(null);
  const close = useCallback(() => setOpen(null), []);

  async function connect() {
    const setup = await start.run();
    if (!setup) return;
    await refresh.run();
    setOpen({ kind: "connect", setup, step: 1, roleArn: null });
  }

  function continueSetup(connection: CloudConnection) {
    setOpen({ kind: "connect", setup: awsSetupFor(connection), step: 2, roleArn: connection.roleArn });
  }

  const target = open && open.kind !== "connect" ? cloud.find((connection) => connection.id === open.id) : undefined;
  const connectButton = (
    <Button variant="primary" pending={start.pending || refresh.pending} onClick={connect}>
      Connect AWS account
    </Button>
  );

  return (
    <>
      <AccessScopeCard />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="type-heading">AWS accounts</h3>
            <p className="type-small text-fg-muted">Each account is reached through a read-only IAM role that you own.</p>
          </div>
          {cloud.length > 0 && connectButton}
        </div>

        {start.error && <Notice tone="danger">{start.error}</Notice>}

        {cloud.length === 0 ? (
          <Card>
            <div className="flex flex-col items-start gap-3 py-2">
              <h4 className="type-label">No AWS accounts connected</h4>
              <p className="type-body text-fg-muted">
                Connect an account so Infrared can read its inventory, metrics and costs. Setup takes about five minutes.
              </p>
              {connectButton}
            </div>
          </Card>
        ) : (
          cloud.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onContinue={() => continueSetup(connection)}
              onEditRegions={() => setOpen({ kind: "regions", id: connection.id })}
              onRotate={() => setOpen({ kind: "rotate", id: connection.id })}
              onRevoke={() => setOpen({ kind: "revoke", id: connection.id })}
            />
          ))
        )}
      </div>

      {open?.kind === "connect" && <ConnectAwsDialog setup={open.setup} initialStep={open.step} initialRoleArn={open.roleArn} onClose={close} />}
      {open?.kind === "regions" && target && <RegionsDialog connection={target} onClose={close} />}
      {open?.kind === "rotate" && target && <RotateDialog connection={target} onClose={close} />}
      {open?.kind === "revoke" && target && <RevokeDialog connection={target} onClose={close} />}
    </>
  );
}
