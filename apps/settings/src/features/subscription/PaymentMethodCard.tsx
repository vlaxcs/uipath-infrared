import { useCallback, useState, type FormEvent } from "react";
import { useAction, useSandbox, useSettings } from "~/app/settings-context";
import type { PaymentMethod } from "~/domain/types";
import type { CardInput } from "~/ports/billing";
import type { SettingsApi } from "~/ports/settings-api";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dialog } from "~/ui/Dialog";
import { Field } from "~/ui/Field";
import { Notice } from "~/ui/Notice";
import { describeCard, formatCardNumber, parseCardForm, type CardFormErrors } from "~/features/subscription/card-form";

function PaymentMethodDialog({ onClose }: { onClose(): void }) {
  const sandbox = useSandbox();
  const save = useCallback(
    async (api: SettingsApi, card: CardInput, method: PaymentMethod) =>
      api.updatePaymentMethod(sandbox ? await sandbox.createPaymentMethod(card) : method),
    [sandbox],
  );
  const action = useAction(save);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<CardFormErrors>({});

  const { clearError } = action;
  const close = useCallback(() => {
    clearError();
    onClose();
  }, [clearError, onClose]);

  function fillTestCard(digits: string) {
    setNumber(formatCardNumber(digits));
    setExpiry("12/34");
    setCvc(digits.length === 15 ? "1234" : "123");
    setErrors({});
    clearError();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCardForm(number, expiry, cvc);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    if (await action.run(parsed.card, parsed.method)) close();
  }

  return (
    <Dialog
      open
      title="Update payment method"
      description={sandbox ? "Stripe test mode: no real card is charged." : "Simulated: no real card is charged."}
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
        <div className="flex gap-4">
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
          <Field
            label="CVC"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            value={cvc}
            onChange={(event) => setCvc(event.target.value)}
            error={errors.cvc}
            className="max-w-24"
          />
        </div>
        {action.error && <Notice tone="danger">{action.error}</Notice>}
        {sandbox && (
          <details className="rounded-well border border-line bg-sunken px-4 py-3">
            <summary className="type-label cursor-pointer">Stripe test cards</summary>
            <ul className="mt-3 flex flex-col gap-1">
              {sandbox.testCards.map((card) => (
                <li key={card.number}>
                  <button
                    type="button"
                    onClick={() => fillTestCard(card.number)}
                    className="flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded-item px-2 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="type-code tabular-nums">{formatCardNumber(card.number)}</span>
                    <span className="type-small text-fg-muted">{card.outcome}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="type-small mt-2 text-fg-muted">Any future expiry date and any CVC work.</p>
          </details>
        )}
      </form>
    </Dialog>
  );
}

export function PaymentMethodCard() {
  const { subscription } = useSettings();
  const sandbox = useSandbox();
  const [editing, setEditing] = useState(false);
  const method = subscription.paymentMethod;
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <Card
      title="Payment method"
      actions={<Button onClick={() => setEditing(true)}>{method ? "Update" : "Add card"}</Button>}
    >
      <p className="type-body">{method ? describeCard(method) : "No payment method on file."}</p>
      <p className="type-small mt-1 text-fg-muted">
        {sandbox ? "Stripe test mode, no real card is charged." : "Simulated billing, no real card is charged."}
      </p>
      {editing && <PaymentMethodDialog onClose={stopEditing} />}
    </Card>
  );
}
