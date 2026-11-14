export type Plan = "none" | "run_pack" | "subscription";
export type PaidPlan = Exclude<Plan, "none">;
export type SubscriptionStatus = "active" | "past_due" | "canceled";

export interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface Invoice {
  id: string;
  date: string;
  description: string;
  amountUsd: number;
  status: "paid" | "open" | "failed";
}

export interface Subscription {
  plan: Plan;
  status: SubscriptionStatus;
  runsRemaining: number;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: PaymentMethod | null;
  invoices: Invoice[];
}

export interface PlanOffer {
  id: PaidPlan;
  name: string;
  priceUsd: number;
  cadence: "one_time" | "monthly";
  runs: number | null;
  features: string[];
}

export type CloudProvider = "aws";
export type CloudConnectionStatus = "pending" | "verifying" | "connected" | "failed" | "revoked";

export interface CloudConnection {
  id: string;
  provider: CloudProvider;
  accountId: string | null;
  roleArn: string | null;
  externalId: string;
  regions: string[];
  access: "read-only";
  status: CloudConnectionStatus;
  createdAt: string;
  lastVerifiedAt: string | null;
  error: string | null;
}

export interface AwsConnectionStart {
  connectionId: string;
  externalId: string;
  trustPolicyJson: string;
  permissionsPolicyJson: string;
  cfnTemplateUrl: string;
}

export type GithubStatus = "not_connected" | "connected" | "suspended";
export type RepoSelection = { kind: "all" } | { kind: "selected"; repos: string[] };

export interface GithubPermission {
  scope: string;
  access: "read" | "write";
  reason: string;
}

export interface GithubInstallation {
  status: GithubStatus;
  org: string | null;
  installationId: number | null;
  repoSelection: RepoSelection;
  availableRepos: string[];
  permissions: GithubPermission[];
  installedAt: string | null;
  extensionReady: boolean;
}

export interface GithubInstallBegin {
  installUrl: string;
  state: string;
  org: string;
  repos: string[];
}

export interface Account {
  id: string;
  company: string;
  ownerEmail: string;
}

export interface AccountSettings {
  account: Account;
  subscription: Subscription;
  cloud: CloudConnection[];
  github: GithubInstallation;
}

export type SettingsErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "payment_failed"
  | "access_denied"
  | "external_id_mismatch"
  | "install_state_mismatch";

export class SettingsError extends Error {
  readonly code: SettingsErrorCode;

  constructor(code: SettingsErrorCode, message: string) {
    super(message);
    this.name = "SettingsError";
    this.code = code;
  }
}
