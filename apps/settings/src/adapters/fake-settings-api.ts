import type { AccountSettings } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import { SEED_SETTINGS } from "~/adapters/seed";
import { createFakeStore, type FakeStore, type FakeStoreOptions } from "~/adapters/fake/store";
import { createFakeSubscriptionApi } from "~/adapters/fake/subscription";
import { createFakeCloudApi } from "~/adapters/fake/cloud";
import { createFakeGithubApi } from "~/adapters/fake/github";

export interface FakeSettingsApi extends SettingsApi {
  store: FakeStore;
}

export function createFakeSettingsApi(
  seed: AccountSettings = SEED_SETTINGS,
  options: FakeStoreOptions = {},
): FakeSettingsApi {
  const store = createFakeStore(seed, options);
  const subscription = createFakeSubscriptionApi(store);
  const cloud = createFakeCloudApi(store);
  const github = createFakeGithubApi(store);
  return {
    store,
    getSettings: () => store.settle(() => store.snapshot()),
    buyRunPack: () => subscription.buyRunPack(),
    changePlan: (plan) => subscription.changePlan(plan),
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
