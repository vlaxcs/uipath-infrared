import { useCallback, useState } from "react";
import { useAction, useSettings } from "~/app/settings-context";
import { formatUsd } from "~/app/format";
import type { PendingPayment } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Dialog } from "~/ui/Dialog";
import { Notice } from "~/ui/Notice";

const complete = (api: SettingsApi, intentId: string, authenticated: boolean) => api.completePayment(intentId, authenticated);

export const AUTHENTICATION_FAILED =
  "We are unable to authenticate your payment method. Please choose a different payment method and try again.";

/** Stands in for the bank's 3-D Secure page that Stripe opens for a card that needs authentication. */
export function AuthenticateDialog({ pending, onClose }: { pending: PendingPayment; onClose(): void }) {
  const { subscription } = useSettings();
  const action = useAction(complete);
  const [failed, setFailed] = useState(false);
  const card = subscription.paymentMethod;

  const { clearError } = action;
  const close = useCallback(() => {
    clearError();
    onClose();
  }, [clearError, onClose]);

  async function answer(authenticated: boolean) {
    if (!(await action.run(pending.intentId, authenticated))) return;
    if (authenticated) close();
    else setFailed(true);
  }

  return (
    <Dialog
      open
      title="Authenticate your payment"
      description="3-D Secure test page. In test mode no bank is contacted."
      onClose={close}
      size="sm"
      footer={
        failed ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="danger" pending={action.pending} onClick={() => answer(false)}>
              Fail authentication
            </Button>
            <Button variant="primary" pending={action.pending} onClick={() => answer(true)}>
              Complete authentication
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p className="type-body">
          Infrared asks to charge {formatUsd(pending.amountUsd)} for {pending.description}
          {card ? ` to ${card.brand} •••• ${card.last4}` : ""}. Your bank wants you to confirm it.
        </p>
        {failed && <Notice tone="danger">{AUTHENTICATION_FAILED}</Notice>}
        {action.error && <Notice tone="danger">{action.error}</Notice>}
      </div>
    </Dialog>
  );
}
