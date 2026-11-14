import { useCallback, useState } from "react";
import { useSettings } from "~/app/settings-context";
import { Notice } from "~/ui/Notice";
import { ChargeDialog, type ChargeKind } from "~/features/subscription/ChargeDialog";
import { CurrentPlanCard } from "~/features/subscription/CurrentPlanCard";
import { InvoicesCard } from "~/features/subscription/InvoicesCard";
import { PaymentMethodCard } from "~/features/subscription/PaymentMethodCard";
import { PlansCard } from "~/features/subscription/PlansCard";

export function SubscriptionPanel() {
  const { subscription } = useSettings();
  const [charge, setCharge] = useState<ChargeKind | null>(null);
  const closeCharge = useCallback(() => setCharge(null), []);

  return (
    <div className="flex flex-col gap-5">
      {subscription.status === "past_due" && (
        <Notice tone="danger">Your last payment failed. Update your payment method to keep your plan and scheduled runs.</Notice>
      )}
      <CurrentPlanCard onCharge={setCharge} />
      <PlansCard onCharge={setCharge} />
      <PaymentMethodCard />
      <InvoicesCard />
      <ChargeDialog key={charge ?? "closed"} kind={charge} onClose={closeCharge} />
    </div>
  );
}
