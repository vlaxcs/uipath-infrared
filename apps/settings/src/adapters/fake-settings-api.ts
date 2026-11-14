import type { AccountSettings } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import type { SandboxControls } from "~/ports/billing";
import { SEED_SETTINGS } from "~/adapters/seed";
import { createFakeStore, type FakeStore, type FakeStoreOptions } from "~/adapters/fake/store";
import { createFakeSubscriptionApi } from "~/adapters/fake/subscription";
import { createStripeSandbox, TEST_CARDS } from "~/adapters/fake/stripe-sandbox";
import { createFakeCloudApi } from "~/adapters/fake/cloud";
import { createFakeGithubApi } from "~/adapters/fake/github";

export interface FakeSettingsApi extends SettingsApi {
  store: FakeStore;
  sandbox: SandboxControls;
}

export function createFakeSettingsApi(
  seed: AccountSettings = SEED_SETTINGS,
  options: FakeStoreOptions = {},
): FakeSettingsApi {
  const store = createFakeStore(seed, options);
  const stripe = createStripeSandbox(store);
  const subscription = createFakeSubscriptionApi(store, stripe);
  const cloud = createFakeCloudApi(store);
  const github = createFakeGithubApi(store);
  return {
    store,
    sandbox: {
      testCards: TEST_CARDS.map(({ number, brand, outcome }) => ({ number, brand, outcome })),
      createPaymentMethod: (card) => stripe.createPaymentMethod(card),
      events: () => stripe.events(),
      subscribe: (listener) => stripe.subscribe(listener),
      advanceToRenewal: () => subscription.advanceToRenewal(),
    },
    getSettings: () => store.settle(() => store.snapshot()),
    buyRunPack: () => subscription.buyRunPack(),
    changePlan: (plan) => subscription.changePlan(plan),
    completePayment: (intentId, authenticated) => subscription.completePayment(intentId, authenticated),
    cancelSubscription: () => subscription.cancelSubscription(),
    resumeSubscription: () => subscription.resumeSubscription(),
    updatePaymentMethod: (method) => subscription.updatePaymentMethod(method),
    startAwsConnection: () => cloud.startAwsConnection(),
    verifyAwsConnection: (id, roleArn) => cloud.verifyAwsConnection(id, roleArn),
    updateRegions: (id, regions) => cloud.updateRegions(id, regions),
    rotateExternalId: (id) => cloud.rotateExternalId(id),
    revokeCloudConnection: (id) => cloud.revokeCloudConnection(id),
    removeCloudConnection: (id) => cloud.removeCloudConnection(id),
    beginGithubInstall: () => github.beginGithubInstall(),
    completeGithubInstall: (state, installationId) => github.completeGithubInstall(state, installationId),
    updateRepoSelection: (selection) => github.updateRepoSelection(selection),
    disconnectGithub: () => github.disconnectGithub(),
  };
}
