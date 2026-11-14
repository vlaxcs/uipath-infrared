import { useCallback, useState } from "react";
import { useSettings } from "~/app/settings-context";
import { formatUsd } from "~/app/format";
import type { PendingPayment } from "~/domain/types";
import { Button } from "~/ui/Button";
import { Notice } from "~/ui/Notice";
import { AuthenticateDialog } from "~/features/subscription/AuthenticateDialog";
import { ChargeDialog, type ChargeKind } from "~/features/subscription/ChargeDialog";
import { CurrentPlanCard } from "~/features/subscription/CurrentPlanCard";
import { InvoicesCard } from "~/features/subscription/InvoicesCard";
import { PaymentMethodCard } from "~/features/subscription/PaymentMethodCard";
import { PlansCard } from "~/features/subscription/PlansCard";
import { SandboxCard } from "~/features/subscription/SandboxCard";

export function SubscriptionPanel() {
  const { subscription } = useSettings();
  const [charge, setCharge] = useState<ChargeKind | null>(null);
  const [challenge, setChallenge] = useState<PendingPayment | null>(null);
  const closeCharge = useCallback(() => setCharge(null), []);
  const closeChallenge = useCallback(() => setChallenge(null), []);
  const pending = subscription.pendingPayment;

  return (
    <div className="flex flex-col gap-5">
      {subscription.status === "past_due" && (
        <Notice tone="danger">Your last payment failed. Update your payment method to keep your plan and scheduled runs.</Notice>
      )}
      {pending && !charge && !challenge && (
        <Notice tone="warn">
          <span className="flex flex-wrap items-center justify-between gap-3">
            A payment of {formatUsd(pending.amountUsd)} for {pending.description} is waiting for your bank's confirmation.
            <Button onClick={() => setChallenge(pending)}>Authenticate payment</Button>
          </span>
        </Notice>
      )}
      <CurrentPlanCard onCharge={setCharge} />
      <PlansCard onCharge={setCharge} />
      <PaymentMethodCard />
      <InvoicesCard />
      <SandboxCard />
      <ChargeDialog key={charge ?? "closed"} kind={charge} onClose={closeCharge} />
      {challenge && <AuthenticateDialog pending={challenge} onClose={closeChallenge} />}
    </div>
  );
}
