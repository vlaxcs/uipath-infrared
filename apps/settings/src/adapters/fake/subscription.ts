import type { SubscriptionApi } from "~/ports/settings-api";
import type { FakeStore } from "~/adapters/fake/store";
import type { Subscription } from "~/domain/types";
import {
  buyRunPack,
  cancelSubscription,
  changePlan,
  resumeSubscription,
  updatePaymentMethod,
} from "~/domain/subscription-rules";

export function createFakeSubscriptionApi(store: FakeStore): SubscriptionApi {
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

  return {
    buyRunPack: () => commit((current) => buyRunPack(current, store.now(), invoiceId())),
    changePlan: (plan) => commit((current) => changePlan(current, plan, store.now(), invoiceId())),
    cancelSubscription: () => commit(cancelSubscription),
    resumeSubscription: () => commit(resumeSubscription),
    updatePaymentMethod: (method) => commit((current) => updatePaymentMethod(current, method, store.now())),
  };
}
