import { useCallback, useState, type ReactNode } from "react";
import { useAction, useSettings } from "~/app/settings-context";
import { formatDate, formatUsd } from "~/app/format";
import { offerFor } from "~/domain/plans";
import type { Subscription } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Badge, type Tone } from "~/ui/Badge";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";
import type { ChargeKind } from "~/features/subscription/ChargeDialog";

const cancel = (api: SettingsApi) => api.cancelSubscription();
const resume = (api: SettingsApi) => api.resumeSubscription();

function statusOf(subscription: Subscription): { tone: Tone; label: string } {
  if (subscription.plan === "none") return { tone: "neutral", label: "No plan" };
  if (subscription.status === "past_due") return { tone: "danger", label: "Past due" };
  if (subscription.status === "canceled") return { tone: "neutral", label: "Canceled" };
  if (subscription.cancelAtPeriodEnd && subscription.renewsAt) return { tone: "warn", label: `Cancels on ${formatDate(subscription.renewsAt)}` };
  return { tone: "success", label: "Active" };
}

function Figure({ value, caption }: { value: ReactNode; caption: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-figure">{value}</span>
      <span className="type-small text-fg-muted">{caption}</span>
    </div>
  );
}

export function CurrentPlanCard({ onCharge }: { onCharge(kind: ChargeKind): void }) {
  const { subscription } = useSettings();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelAction = useAction(cancel);
  const resumeAction = useAction(resume);
  const status = statusOf(subscription);
  const isSubscription = subscription.plan === "subscription";
  const runsLeft = `${subscription.runsRemaining} ${subscription.runsRemaining === 1 ? "run" : "runs"} left`;

  const clearCancelError = cancelAction.clearError;
  const closeCancel = useCallback(() => {
    clearCancelError();
    setConfirmCancel(false);
  }, [clearCancelError]);

  async function confirmCancellation() {
    if (await cancelAction.run()) setConfirmCancel(false);
  }

  let figure: ReactNode;
  if (isSubscription && subscription.renewsAt && subscription.cancelAtPeriodEnd) {
    figure = <Figure value={formatDate(subscription.renewsAt)} caption="Access and scheduled runs continue until this date" />;
  } else if (isSubscription && subscription.renewsAt) {
    figure = (
      <Figure value={formatUsd(offerFor("subscription").priceUsd)} caption={`Next charge on ${formatDate(subscription.renewsAt)}`} />
    );
  } else {
    figure = <Figure value={runsLeft} caption={subscription.plan === "none" ? "Buy a run pack or subscribe to start" : "Runs never expire"} />;
  }

  let actions: ReactNode = null;
  if (isSubscription && subscription.cancelAtPeriodEnd) {
    actions = (
      <Button variant="primary" pending={resumeAction.pending} onClick={() => resumeAction.run()}>
        Resume subscription
      </Button>
    );
  } else if (isSubscription && subscription.status === "active") {
    actions = <Button onClick={() => setConfirmCancel(true)}>Cancel subscription</Button>;
  } else if (!isSubscription) {
    actions = (
      <Button variant="primary" onClick={() => onCharge("buy_pack")}>
        Buy run pack
      </Button>
    );
  }

  return (
    <Card
      title="Current plan"
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <span className="type-eyebrow text-fg-muted">{subscription.plan === "none" ? "No plan" : offerFor(subscription.plan).name}</span>
            {figure}
            {isSubscription && subscription.runsRemaining > 0 && (
              <span className="type-small text-fg-muted">Plus {runsLeft} from run packs</span>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {resumeAction.error && <Notice tone="danger">{resumeAction.error}</Notice>}
      </div>

      <Dialog
        open={confirmCancel}
        title="Cancel subscription?"
        onClose={closeCancel}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeCancel}>
              Keep subscription
            </Button>
            <Button variant="danger" pending={cancelAction.pending} onClick={confirmCancellation}>
              Cancel subscription
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="type-body">
            {subscription.renewsAt
              ? `You keep full access until ${formatDate(subscription.renewsAt)} and will not be charged again. Scheduled runs stop after that date.`
              : "Scheduled runs stop at the end of the current period."}
          </p>
          <p className="type-small text-fg-muted">You can resume any time before then.</p>
          {cancelAction.error && <Notice tone="danger">{cancelAction.error}</Notice>}
        </div>
      </Dialog>
    </Card>
  );
}
