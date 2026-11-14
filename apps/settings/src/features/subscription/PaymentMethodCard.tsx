import { useCallback, useState, type FormEvent } from "react";
import { useAction, useSettings } from "~/app/settings-context";
import type { PaymentMethod } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dialog } from "~/ui/Dialog";
import { Field } from "~/ui/Field";
import { Notice } from "~/ui/Notice";
import { describeCard, parseCardForm, type CardFormErrors } from "~/features/subscription/card-form";

const update = (api: SettingsApi, method: PaymentMethod) => api.updatePaymentMethod(method);

function PaymentMethodDialog({ onClose }: { onClose(): void }) {
  const action = useAction(update);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [errors, setErrors] = useState<CardFormErrors>({});

  const { clearError } = action;
  const close = useCallback(() => {
    clearError();
    onClose();
  }, [clearError, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCardForm(number, expiry);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    if (await action.run(parsed.method)) close();
  }

  return (
    <Dialog
      open
      title="Update payment method"
      description="Simulated: no real card is charged."
      onClose={close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="payment-method-form" variant="primary" pending={action.pending}>
            Save card
          </Button>
        </>
      }
    >
      <form id="payment-method-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          error={errors.number}
        />
        <Field
          label="Expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/YY"
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
          error={errors.expiry}
          className="max-w-32"
        />
        {action.error && <Notice tone="danger">{action.error}</Notice>}
      </form>
    </Dialog>
  );
}

export function PaymentMethodCard() {
  const { subscription } = useSettings();
  const [editing, setEditing] = useState(false);
  const method = subscription.paymentMethod;
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <Card
      title="Payment method"
      actions={<Button onClick={() => setEditing(true)}>{method ? "Update" : "Add card"}</Button>}
    >
      <p className="type-body">{method ? describeCard(method) : "No payment method on file."}</p>
      <p className="type-small mt-1 text-fg-muted">Simulated billing, no real card is charged.</p>
      {editing && <PaymentMethodDialog onClose={stopEditing} />}
    </Card>
  );
}
