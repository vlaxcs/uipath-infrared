import { useAction } from "~/app/settings-context";
import { ROLE_NAME, formatAccountId } from "~/domain/cloud-rules";
import type { CloudConnection } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { ConfirmByTyping } from "~/ui/ConfirmByTyping";

const revokeFn = (api: SettingsApi, id: string) => api.revokeCloudConnection(id);

export function RevokeDialog({ connection, onClose }: { connection: CloudConnection; onClose(): void }) {
  const revoke = useAction(revokeFn);
  const expected = connection.accountId ?? connection.id;

  async function confirm() {
    if (await revoke.run(connection.id)) onClose();
  }

  return (
    <ConfirmByTyping
      open
      title={connection.accountId ? `Revoke AWS account ${formatAccountId(connection.accountId)}?` : "Revoke this connection?"}
      expected={expected}
      confirmLabel="Revoke access"
      onConfirm={confirm}
      onClose={onClose}
      pending={revoke.pending}
      error={revoke.error}
    >
      <p className="type-body">
        Infrared will stop reading this account immediately, and scheduled runs for it will stop.
      </p>
      <p className="type-body text-fg-muted">
        To remove the access on your side too, delete the <code className="type-code">{ROLE_NAME}</code> role or its CloudFormation stack in AWS.
      </p>
    </ConfirmByTyping>
  );
}
