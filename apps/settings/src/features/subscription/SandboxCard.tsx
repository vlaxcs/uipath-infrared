import { useCallback, useSyncExternalStore } from "react";
import { useAction, useSandbox, useSettings } from "~/app/settings-context";
import { formatDate, formatDateTime } from "~/app/format";
import type { SandboxControls } from "~/ports/billing";
import { Badge } from "~/ui/Badge";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Notice } from "~/ui/Notice";

const SHOWN_EVENTS = 12;

function Sandbox({ sandbox }: { sandbox: SandboxControls }) {
  const { subscription } = useSettings();
  const events = useSyncExternalStore(sandbox.subscribe, sandbox.events);
  const renew = useAction(useCallback(() => sandbox.advanceToRenewal(), [sandbox]));
  const renews = subscription.plan === "subscription" && subscription.status !== "canceled" && subscription.renewsAt;

  return (
    <Card
      dense
      title={
        <span className="inline-flex items-center gap-2">
          Stripe sandbox <Badge tone="warn">Test mode</Badge>
        </span>
      }
      description="Local Stripe test-mode simulator. Use a test card in the payment dialog to try a decline or 3-D Secure."
      actions={
        <Button size="sm" disabled={!renews} pending={renew.pending} onClick={() => renew.run()}>
          {renews ? `Simulate renewal on ${formatDate(subscription.renewsAt!)}` : "Simulate renewal"}
        </Button>
      }
    >
      {renew.error && (
        <div className="mb-3">
          <Notice tone="danger">{renew.error}</Notice>
        </div>
      )}
      <h3 className="type-eyebrow mb-1 text-fg-muted">Webhook events</h3>
      {events.length === 0 ? (
        <p className="type-small text-fg-muted">
          No events yet. Save a card or buy something.
        </p>
      ) : (
        <ol aria-label="Webhook events" className="flex flex-col">
          {events.slice(0, SHOWN_EVENTS).map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-1.5 last:border-b-0">
              <span className="min-w-0">
                <span className="type-code">{event.type}</span>
                <span className="type-small ml-2 text-fg-muted">{event.summary}</span>
              </span>
              <span className="type-small text-fg-muted">{formatDateTime(event.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function SandboxCard() {
  const sandbox = useSandbox();
  return sandbox ? <Sandbox sandbox={sandbox} /> : null;
}
