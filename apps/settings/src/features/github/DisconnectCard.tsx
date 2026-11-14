import { useState } from "react";
import { useAction } from "~/app/settings-context";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { ConfirmByTyping } from "~/ui/ConfirmByTyping";

const disconnectGithub = (api: SettingsApi) => api.disconnectGithub();

export function DisconnectCard({ org }: { org: string }) {
  const [open, setOpen] = useState(false);
  const disconnect = useAction(disconnectGithub);

  async function confirm() {
    if (await disconnect.run()) setOpen(false);
  }

  function close() {
    disconnect.clearError();
    setOpen(false);
  }

  return (
    <Card
      tone="danger"
      title="Disconnect organisation"
      description="The Chrome extension stops showing Infrared data and Infrared can no longer open pull requests."
      actions={
        <Button variant="danger" onClick={() => setOpen(true)}>
          Disconnect
        </Button>
      }
    >
      <p className="type-small text-fg-muted">This only removes the link in Infrared. Also uninstall the Infrared app in your GitHub organisation settings.</p>
      <ConfirmByTyping
        open={open}
        title={`Disconnect ${org}?`}
        expected={org}
        confirmLabel="Disconnect organisation"
        onConfirm={confirm}
        onClose={close}
        pending={disconnect.pending}
        error={disconnect.error}
      >
        <p className="type-body">
          The Infrared Chrome extension stops showing runs and runner suggestions in {org}. To revoke access completely, also uninstall the
          Infrared app under your GitHub organisation settings.
        </p>
      </ConfirmByTyping>
    </Card>
  );
}
