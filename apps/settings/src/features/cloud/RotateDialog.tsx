import { useState } from "react";
import { useAction } from "~/app/settings-context";
import { ROLE_NAME, formatAccountId, trustPolicyFor } from "~/domain/cloud-rules";
import type { CloudConnection } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { CopyField } from "~/ui/CopyField";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";
import { useVerifyConnection } from "~/features/cloud/use-cloud-actions";

const rotateFn = (api: SettingsApi, id: string) => api.rotateExternalId(id);

export function RotateDialog({ connection, onClose }: { connection: CloudConnection; onClose(): void }) {
  const rotate = useAction(rotateFn);
  const verify = useVerifyConnection();
  const [rotated, setRotated] = useState(false);
  const [verified, setVerified] = useState(false);

  async function confirm() {
    if (await rotate.run(connection.id)) setRotated(true);
  }

  async function reverify() {
    setVerified(Boolean(await verify.run(connection.id, connection.roleArn ?? "")));
  }

  if (!rotated) {
    return (
      <Dialog
        open
        title="Rotate external ID?"
        onClose={onClose}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" pending={rotate.pending} onClick={confirm}>
              Rotate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="type-body">
            Infrared will stop reading{connection.accountId ? ` AWS account ${formatAccountId(connection.accountId)}` : " this account"} until you put the
            new external ID in the trust policy of the <code className="type-code">{ROLE_NAME}</code> role and verify again.
          </p>
          {rotate.error && <Notice tone="danger">{rotate.error}</Notice>}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title="Update the trust policy"
      onClose={onClose}
      footer={
        verified ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Later
            </Button>
            <Button variant="primary" pending={verify.pending} onClick={reverify}>
              Re-verify
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {verified ? (
          <Notice tone="success">Verified. Infrared can read this account again.</Notice>
        ) : (
          <Notice tone="warn">
            Replace the trust policy on the <code className="type-code">{ROLE_NAME}</code> role with the one below, then re-verify.
          </Notice>
        )}
        <CopyField label="New external ID" value={connection.externalId} />
        <CopyField label="Trust policy" value={trustPolicyFor(connection.externalId)} multiline />
        {verify.error && <Notice tone="danger">{verify.error}</Notice>}
      </div>
    </Dialog>
  );
}
