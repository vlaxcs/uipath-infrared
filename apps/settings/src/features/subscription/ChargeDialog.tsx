import { useCallback, useState } from "react";
import { useSandbox, useSettings, useAction } from "~/app/settings-context";
import { formatUsd } from "~/app/format";
import { offerFor, RUN_PACK_RUNS } from "~/domain/plans";
import type { PendingPayment } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";
import { describeCard } from "~/features/subscription/card-form";
import { AuthenticateDialog } from "~/features/subscription/AuthenticateDialog";

export type ChargeKind = "buy_pack" | "subscribe" | "downgrade";

const actions: Record<ChargeKind, (api: SettingsApi) => ReturnType<SettingsApi["buyRunPack"]>> = {
  buy_pack: (api) => api.buyRunPack(),
  subscribe: (api) => api.changePlan("subscription"),
  downgrade: (api) => api.changePlan("run_pack"),
};

function runs(count: number): string {
  return `${count} ${count === 1 ? "run" : "runs"}`;
}

export function ChargeDialog({ kind, onClose }: { kind: ChargeKind | null; onClose(): void }) {
  const { subscription } = useSettings();
  const sandbox = useSandbox();
  const action = useAction(kind ? actions[kind] : actions.buy_pack);
  const [challenge, setChallenge] = useState<PendingPayment | null>(null);
  const pack = offerFor("run_pack");
  const monthly = offerFor("subscription");

  const { clearError } = action;
  const close = useCallback(() => {
    clearError();
    onClose();
  }, [clearError, onClose]);

  async function confirm() {
    const result = await action.run();
    if (result?.subscription.pendingPayment) setChallenge(result.subscription.pendingPayment);
    else if (result) close();
  }

  const copy = {
    buy_pack: {
      title: "Buy a run pack",
      confirm: `Pay ${formatUsd(pack.priceUsd)}`,
      body: `You will be charged ${formatUsd(pack.priceUsd)} once, today. ${RUN_PACK_RUNS} runs are added to your balance, which becomes ${runs(subscription.runsRemaining + RUN_PACK_RUNS)}. Runs never expire.`,
    },
    subscribe: {
      title: "Switch to Subscription",
      confirm: `Pay ${formatUsd(monthly.priceUsd)} and subscribe`,
      body: `You will be charged ${formatUsd(monthly.priceUsd)} today, then ${formatUsd(monthly.priceUsd)} every month on the same day until you cancel. Runs are scheduled in the cloud.${subscription.runsRemaining > 0 ? ` Your ${runs(subscription.runsRemaining)} left from packs stay available.` : ""}`,
    },
    downgrade: {
      title: "Switch to Run pack",
      confirm: "Switch to Run pack",
      body: `Nothing is charged now. Your subscription ends today and scheduled runs stop. You keep ${runs(subscription.runsRemaining)} and can buy a pack when you need more.`,
    },
  };

  if (!kind) return null;
  if (challenge) return <AuthenticateDialog pending={challenge} onClose={close} />;
  const text = copy[kind];
  const charges = kind !== "downgrade";

  return (
    <Dialog
      open
      title={text.title}
      onClose={close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
          <Button variant="primary" pending={action.pending} onClick={confirm}>
            {text.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="type-body">{text.body}</p>
        {charges &&
          (subscription.paymentMethod ? (
            <p className="type-small text-fg-muted">Charged to {describeCard(subscription.paymentMethod)}. {sandbox ? "Stripe test mode" : "Simulated"}, no real card is charged.</p>
          ) : (
            <Notice tone="warn">There is no payment method on file. Add one before you buy.</Notice>
          ))}
        {action.error && <Notice tone="danger">{action.error}</Notice>}
      </div>
    </Dialog>
  );
}
