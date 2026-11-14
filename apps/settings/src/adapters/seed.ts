import type { AccountSettings } from "~/domain/types";

export const SEED_SETTINGS: AccountSettings = {
  account: { id: "acct_shopwave", company: "Shopwave", ownerEmail: "cto@shopwave.io" },
  subscription: {
    plan: "subscription",
    status: "active",
    runsRemaining: 0,
    renewsAt: "2026-12-01",
    cancelAtPeriodEnd: false,
    paymentMethod: { brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028 },
    invoices: [
      { id: "in_0003", date: "2026-11-01", description: "Subscription, November", amountUsd: 200, status: "paid" },
      { id: "in_0002", date: "2026-10-01", description: "Subscription, October", amountUsd: 200, status: "paid" },
      { id: "in_0001", date: "2026-09-14", description: "Run pack, 5 runs", amountUsd: 100, status: "paid" },
    ],
  },
  cloud: [
    {
      id: "cc_prod",
      provider: "aws",
      accountId: "412345678901",
      roleArn: "arn:aws:iam::412345678901:role/InfraredReadOnly",
      externalId: "ir-7f3c9a2e5b14",
      regions: ["eu-central-1", "eu-west-1"],
      access: "read-only",
      status: "connected",
      createdAt: "2026-09-14T10:02:00Z",
      lastVerifiedAt: "2026-11-14T06:00:00Z",
      error: null,
    },
  ],
  github: {
    status: "not_connected",
    org: null,
    installationId: null,
    repoSelection: { kind: "all" },
    availableRepos: [],
    permissions: [],
    installedAt: null,
    extensionReady: false,
  },
};
