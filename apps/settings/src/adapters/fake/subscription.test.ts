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

describe("the fake subscription slice on the Stripe sandbox", () => {
  async function withCard(number: string, patch?: (seed: AccountSettings) => void) {
    const fake = api(patch);
    await fake.updatePaymentMethod(await fake.sandbox.createPaymentMethod({ number, expMonth: 12, expYear: 2034, cvc: "123" }));
    return fake;
  }

  it("refuses a charge the card declines and leaves state untouched", async () => {
    const fake = await withCard("4000000000000341");
    await expect(fake.buyRunPack()).rejects.toMatchObject({ code: "payment_failed", message: "Your card was declined." });
    expect(fake.store.state.subscription.runsRemaining).toBe(0);
    expect(fake.store.state.subscription.invoices).toHaveLength(3);
  });

  it("holds a 3-D Secure payment until it is completed, and refuses other charges meanwhile", async () => {
    const fake = await withCard("4000002500003155");
    const held = await fake.buyRunPack();
    const pending = held.subscription.pendingPayment!;
    expect(pending).toMatchObject({ purchase: "run_pack", amountUsd: 100, description: "Run pack, 5 runs" });
    expect(held.subscription.runsRemaining).toBe(0);
    await expect(fake.buyRunPack()).rejects.toMatchObject({ code: "conflict" });
    await expect(fake.completePayment("pi_other", true)).rejects.toMatchObject({ code: "not_found" });
    const done = await fake.completePayment(pending.intentId, true);
    expect(done.subscription).toMatchObject({ pendingPayment: null, runsRemaining: 5 });
    expect(done.subscription.invoices[0].paymentIntentId).toBe(pending.intentId);
  });

  it("drops a payment whose 3-D Secure failed", async () => {
    const fake = await withCard("4000002500003155", (seed) => {
      seed.subscription.plan = "run_pack";
      seed.subscription.renewsAt = null;
    });
    const held = await fake.changePlan("subscription");
    const done = await fake.completePayment(held.subscription.pendingPayment!.intentId, false);
    expect(done.subscription).toMatchObject({ plan: "run_pack", pendingPayment: null });
    expect(done.subscription.invoices).toHaveLength(3);
  });

  it("renews a subscription on its renewal date", async () => {
    const fake = api();
    const renewed = await fake.sandbox.advanceToRenewal();
    expect(renewed.subscription).toMatchObject({ status: "active", renewsAt: "2027-01-01" });
    expect(renewed.subscription.invoices[0]).toMatchObject({ date: "2026-12-01", description: "Subscription, December", amountUsd: 200, status: "paid" });
    expect(fake.sandbox.events()[0].type).toBe("invoice.paid");
  });

  it("fails an off-session renewal on a card that needs 3-D Secure", async () => {
    const fake = await withCard("4000002500003155");
    const renewed = await fake.sandbox.advanceToRenewal();
    expect(renewed.subscription.status).toBe("past_due");
    expect(renewed.subscription.invoices[0].status).toBe("failed");
  });

  it("ends a cancelling subscription instead of renewing it", async () => {
    const fake = api((seed) => {
      seed.subscription.cancelAtPeriodEnd = true;
    });
    const ended = await fake.sandbox.advanceToRenewal();
    expect(ended.subscription).toMatchObject({ plan: "none", status: "canceled", renewsAt: null, cancelAtPeriodEnd: false });
    expect(ended.subscription.invoices).toHaveLength(3);
    await expect(fake.sandbox.advanceToRenewal()).rejects.toMatchObject({ code: "conflict" });
  });
});
