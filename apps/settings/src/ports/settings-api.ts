import type {
  AccountSettings,
  AwsConnectionStart,
  GithubInstallBegin,
  PaidPlan,
  PaymentMethod,
  RepoSelection,
} from "~/domain/types";

export interface SubscriptionApi {
  buyRunPack(): Promise<AccountSettings>;
  changePlan(plan: PaidPlan): Promise<AccountSettings>;
  cancelSubscription(): Promise<AccountSettings>;
  resumeSubscription(): Promise<AccountSettings>;
  updatePaymentMethod(method: PaymentMethod): Promise<AccountSettings>;
}

export interface CloudApi {
  startAwsConnection(): Promise<AwsConnectionStart>;
  verifyAwsConnection(id: string, roleArn: string): Promise<AccountSettings>;
  updateRegions(id: string, regions: string[]): Promise<AccountSettings>;
  rotateExternalId(id: string): Promise<AccountSettings>;
  revokeCloudConnection(id: string): Promise<AccountSettings>;
  removeCloudConnection(id: string): Promise<AccountSettings>;
}

export interface GithubApi {
  beginGithubInstall(): Promise<GithubInstallBegin>;
  completeGithubInstall(state: string, installationId: number): Promise<AccountSettings>;
  updateRepoSelection(selection: RepoSelection): Promise<AccountSettings>;
  disconnectGithub(): Promise<AccountSettings>;
}

export interface SettingsApi extends SubscriptionApi, CloudApi, GithubApi {
  getSettings(): Promise<AccountSettings>;
}
