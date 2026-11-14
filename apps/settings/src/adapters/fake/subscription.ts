import type { SubscriptionApi } from "~/ports/settings-api";
import type { FakeStore } from "~/adapters/fake/store";
import type { StripeSandbox } from "~/adapters/fake/stripe-sandbox";
import { SettingsError, type AccountSettings, type Purchase, type Subscription } from "~/domain/types";
import {
  buyRunPack,
  cancelSubscription,
  changePlan,
  completePendingPayment,
  endSubscription,
  holdPayment,
  renewalFor,
  renewSubscription,
  resumeSubscription,
  updatePaymentMethod,
} from "~/domain/subscription-rules";

export interface FakeSubscriptionApi extends SubscriptionApi {
  advanceToRenewal(): Promise<AccountSettings>;
}

export function createFakeSubscriptionApi(store: FakeStore, stripe: StripeSandbox): FakeSubscriptionApi {
  function invoiceId(): string {
    const taken = new Set(store.state.subscription.invoices.map((invoice) => invoice.id));
    let id = store.nextId("in");
    while (taken.has(id)) id = store.nextId("in");
    return id;
  }

  function commit(next: (current: Subscription) => Subscription) {
    return store.settle(() => {
      store.state.subscription = next(store.state.subscription);
      return store.snapshot();
    });
  }

  // Validates and prices the purchase with the rules, then charges the card through the sandbox.
  function purchase(kind: Purchase, apply: (current: Subscription, invoiceId: string, intentId?: string) => Subscription) {
    return store.settle(() => {
      const current = store.state.subscription;
      const id = invoiceId();
      const preview = apply(current, id);
      const { amountUsd, description } = preview.invoices[0];
      const intent = stripe.charge(current.paymentMethod!, amountUsd, description);
      if (intent.status === "requires_payment_method") throw new SettingsError("payment_failed", intent.decline.message);
      store.state.subscription =
        intent.status === "requires_action"
          ? holdPayment(current, { intentId: intent.id, purchase: kind, amountUsd, description })
          : apply(current, id, intent.id);
      if (intent.status === "succeeded" && kind === "subscription") stripe.record("customer.subscription.created", "Subscription, monthly");
      return store.snapshot();
    });
  }

  return {
    buyRunPack: () => purchase("run_pack", (current, id, intentId) => buyRunPack(current, store.now(), id, intentId)),
    changePlan: (plan) =>
      plan === "subscription"
        ? purchase("subscription", (current, id, intentId) => changePlan(current, plan, store.now(), id, intentId))
        : commit((current) => {
            const next = changePlan(current, plan, store.now(), invoiceId());
            stripe.record("customer.subscription.deleted", "Switched to run pack");
            return next;
          }),
    completePayment: (intentId, authenticated) =>
      commit((current) => {
        const next = completePendingPayment(current, intentId, authenticated, store.now(), invoiceId());
        stripe.authenticate(intentId, authenticated);
        if (authenticated && current.pendingPayment?.purchase === "subscription") {
          stripe.record("customer.subscription.created", "Subscription, monthly");
        }
        return next;
      }),
    cancelSubscription: () =>
      commit((current) => {
        const next = cancelSubscription(current);
        stripe.record("customer.subscription.updated", `cancel_at_period_end, ${current.renewsAt}`);
        return next;
      }),
    resumeSubscription: () =>
      commit((current) => {
        const next = resumeSubscription(current);
        stripe.record("customer.subscription.updated", "Resumed");
        return next;
      }),
    updatePaymentMethod: (method) =>
      commit((current) => {
        const next = updatePaymentMethod(current, method, store.now());
        stripe.attach(method);
        return next;
      }),
    advanceToRenewal: () =>
      commit((current) => {
        if (current.plan === "subscription" && current.cancelAtPeriodEnd) {
          const next = endSubscription(current);
          stripe.record("customer.subscription.deleted", `Ended on ${current.renewsAt}`);
          return next;
        }
        const renewal = renewalFor(current);
        const id = invoiceId();
        const intent = current.paymentMethod
          ? stripe.charge(current.paymentMethod, renewal.amountUsd, renewal.description, { offSession: true })
          : null;
        const paid = intent?.status === "succeeded";
        const next = renewSubscription(current, paid, id, intent?.id);
        stripe.record(paid ? "invoice.paid" : "invoice.payment_failed", `${id}, $${renewal.amountUsd}, ${renewal.description}`);
        if (!paid) stripe.record("customer.subscription.updated", "past_due");
        return next;
      }),
  };
}
