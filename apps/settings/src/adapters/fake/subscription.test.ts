import { describe, expect, it } from "vitest";
import { createFakeSettingsApi } from "~/adapters/fake-settings-api";
import { SEED_SETTINGS } from "~/adapters/seed";
import { SettingsError, type AccountSettings } from "~/domain/types";

const NOW = new Date("2026-11-14T12:00:00Z");

function api(patch: (seed: AccountSettings) => void = () => {}) {
  const seed = structuredClone(SEED_SETTINGS);
  patch(seed);
  return createFakeSettingsApi(seed, { now: () => NOW });
}

describe("the fake subscription slice", () => {
  it("buys a run pack with a fresh invoice id and persists it", async () => {
    const fake = api((seed) => {
      seed.subscription.plan = "none";
      seed.subscription.renewsAt = null;
    });
    const result = await fake.buyRunPack();
    expect(result.subscription.plan).toBe("run_pack");
    expect(result.subscription.runsRemaining).toBe(5);
    const ids = result.subscription.invoices.map((invoice) => invoice.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.subscription.invoices[0]).toMatchObject({ date: "2026-11-14", amountUsd: 100 });
    expect((await fake.getSettings()).subscription.runsRemaining).toBe(5);
  });

  it("returns snapshots that do not alias the store", async () => {
    const fake = api();
    const result = await fake.cancelSubscription();
    result.subscription.cancelAtPeriodEnd = false;
    expect(fake.store.state.subscription.cancelAtPeriodEnd).toBe(true);
  });

  it("cancels, resumes and refuses a second resume", async () => {
    const fake = api();
    expect((await fake.cancelSubscription()).subscription.cancelAtPeriodEnd).toBe(true);
    expect((await fake.resumeSubscription()).subscription.cancelAtPeriodEnd).toBe(false);
    await expect(fake.resumeSubscription()).rejects.toMatchObject({ code: "conflict" });
  });

  it("switches plans both ways", async () => {
    const fake = api();
    const downgraded = await fake.changePlan("run_pack");
    expect(downgraded.subscription).toMatchObject({ plan: "run_pack", renewsAt: null });
    const upgraded = await fake.changePlan("subscription");
    expect(upgraded.subscription).toMatchObject({ plan: "subscription", renewsAt: "2026-12-14" });
    expect(upgraded.subscription.invoices[0].amountUsd).toBe(200);
  });

  it("rejects a payment without a card and leaves state untouched", async () => {
    const fake = api((seed) => {
      seed.subscription.paymentMethod = null;
    });
    const error = await fake.buyRunPack().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SettingsError);
    expect((error as SettingsError).code).toBe("payment_failed");
    expect(fake.store.state.subscription.invoices).toHaveLength(3);
  });

  it("updates the payment method and validates expiry against the store clock", async () => {
    const fake = api();
    const result = await fake.updatePaymentMethod({ brand: "Amex", last4: "0005", expMonth: 1, expYear: 2030 });
    expect(result.subscription.paymentMethod).toEqual({ brand: "Amex", last4: "0005", expMonth: 1, expYear: 2030 });
    await expect(fake.updatePaymentMethod({ brand: "Amex", last4: "0005", expMonth: 10, expYear: 2026 })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
