import { describe, expect, it } from "vitest";
import {
  addOneMonth,
  buyRunPack,
  cancelSubscription,
  changePlan,
  completePendingPayment,
  holdPayment,
  renewSubscription,
  resumeSubscription,
  updatePaymentMethod,
} from "~/domain/subscription-rules";
import { SettingsError, type Subscription } from "~/domain/types";

const NOW = new Date("2026-11-14T12:00:00Z");

function subscription(patch: Partial<Subscription> = {}): Subscription {
  return {
    plan: "subscription",
    status: "active",
    runsRemaining: 0,
    renewsAt: "2026-12-01",
    cancelAtPeriodEnd: false,
    paymentMethod: { brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028 },
    pendingPayment: null,
    invoices: [{ id: "in_old", date: "2026-11-01", description: "Subscription, November", amountUsd: 200, status: "paid" }],
    ...patch,
  };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof SettingsError) return error.code;
    throw error;
  }
  return undefined;
}

describe("addOneMonth", () => {
  it("moves to the same day next month", () => {
    expect(addOneMonth(NOW)).toBe("2026-12-14");
  });

  it("clamps to the end of a shorter month and rolls the year", () => {
    expect(addOneMonth(new Date("2026-01-31T00:00:00Z"))).toBe("2026-02-28");
    expect(addOneMonth(new Date("2026-12-20T00:00:00Z"))).toBe("2027-01-20");
  });
});

describe("buyRunPack", () => {
  it("starts the run pack plan from none and bills 100 USD today", () => {
    const next = buyRunPack(subscription({ plan: "none", status: "canceled", renewsAt: null, runsRemaining: 1 }), NOW, "in_new");
    expect(next.plan).toBe("run_pack");
    expect(next.status).toBe("active");
    expect(next.runsRemaining).toBe(6);
    expect(next.invoices[0]).toEqual({ id: "in_new", date: "2026-11-14", description: "Run pack, 5 runs", amountUsd: 100, status: "paid" });
    expect(next.invoices).toHaveLength(2);
  });

  it("keeps a subscription a subscription", () => {
    const next = buyRunPack(subscription(), NOW, "in_new");
    expect(next.plan).toBe("subscription");
    expect(next.renewsAt).toBe("2026-12-01");
    expect(next.runsRemaining).toBe(5);
  });

  it("tops up an existing run pack", () => {
    expect(buyRunPack(subscription({ plan: "run_pack", renewsAt: null, runsRemaining: 2 }), NOW, "in_new").runsRemaining).toBe(7);
  });

  it("fails without a payment method", () => {
    expect(codeOf(() => buyRunPack(subscription({ paymentMethod: null }), NOW, "in_new"))).toBe("payment_failed");
  });
});

describe("changePlan", () => {
  it("subscribes from a run pack, bills 200 USD and keeps leftover runs", () => {
    const next = changePlan(subscription({ plan: "run_pack", renewsAt: null, runsRemaining: 3 }), "subscription", NOW, "in_new");
    expect(next).toMatchObject({ plan: "subscription", status: "active", renewsAt: "2026-12-14", cancelAtPeriodEnd: false, runsRemaining: 3 });
    expect(next.invoices[0]).toEqual({ id: "in_new", date: "2026-11-14", description: "Subscription, November", amountUsd: 200, status: "paid" });
  });

  it("subscribes from no plan", () => {
    const next = changePlan(subscription({ plan: "none", status: "canceled", renewsAt: null }), "subscription", NOW, "in_new");
    expect(next.plan).toBe("subscription");
    expect(next.status).toBe("active");
  });

  it("needs a payment method to subscribe", () => {
    expect(codeOf(() => changePlan(subscription({ plan: "run_pack", paymentMethod: null }), "subscription", NOW, "in_new"))).toBe(
      "payment_failed",
    );
  });

  it("downgrades a subscription to a run pack without a charge", () => {
    const next = changePlan(subscription({ cancelAtPeriodEnd: true, runsRemaining: 2 }), "run_pack", NOW, "in_new");
    expect(next).toMatchObject({ plan: "run_pack", renewsAt: null, cancelAtPeriodEnd: false, runsRemaining: 2 });
    expect(next.invoices).toHaveLength(1);
  });

  it("refuses the current plan", () => {
    expect(codeOf(() => changePlan(subscription(), "subscription", NOW, "in_new"))).toBe("conflict");
    expect(codeOf(() => changePlan(subscription({ plan: "run_pack" }), "run_pack", NOW, "in_new"))).toBe("conflict");
  });

  it("refuses switching from no plan to a run pack", () => {
    expect(codeOf(() => changePlan(subscription({ plan: "none" }), "run_pack", NOW, "in_new"))).toBe("conflict");
  });
});

describe("cancel and resume", () => {
  it("cancels at period end", () => {
    const next = cancelSubscription(subscription());
    expect(next.cancelAtPeriodEnd).toBe(true);
    expect(next.renewsAt).toBe("2026-12-01");
    expect(next.plan).toBe("subscription");
  });

  it("refuses to cancel anything but an active, renewing subscription", () => {
    expect(codeOf(() => cancelSubscription(subscription({ plan: "run_pack" })))).toBe("conflict");
    expect(codeOf(() => cancelSubscription(subscription({ status: "past_due" })))).toBe("conflict");
    expect(codeOf(() => cancelSubscription(subscription({ cancelAtPeriodEnd: true })))).toBe("conflict");
  });

  it("resumes a cancelling subscription", () => {
    expect(resumeSubscription(subscription({ cancelAtPeriodEnd: true })).cancelAtPeriodEnd).toBe(false);
  });

  it("refuses to resume when nothing is cancelling", () => {
    expect(codeOf(() => resumeSubscription(subscription()))).toBe("conflict");
    expect(codeOf(() => resumeSubscription(subscription({ plan: "run_pack", cancelAtPeriodEnd: true })))).toBe("conflict");
  });
});

describe("updatePaymentMethod", () => {
  const card = { brand: "Mastercard", last4: "5555", expMonth: 11, expYear: 2026 };

  it("stores a card that expires this month", () => {
    expect(updatePaymentMethod(subscription(), card, NOW).paymentMethod).toEqual(card);
  });

  it("brings a past due account back to active", () => {
    expect(updatePaymentMethod(subscription({ status: "past_due" }), card, NOW).status).toBe("active");
  });

  it("rejects a bad last4", () => {
    expect(codeOf(() => updatePaymentMethod(subscription(), { ...card, last4: "555" }, NOW))).toBe("invalid_input");
    expect(codeOf(() => updatePaymentMethod(subscription(), { ...card, last4: "55a5" }, NOW))).toBe("invalid_input");
  });

  it("rejects an empty brand", () => {
    expect(codeOf(() => updatePaymentMethod(subscription(), { ...card, brand: " " }, NOW))).toBe("invalid_input");
  });

  it("rejects an impossible month", () => {
    expect(codeOf(() => updatePaymentMethod(subscription(), { ...card, expMonth: 13 }, NOW))).toBe("invalid_input");
  });

  it("rejects an expired card", () => {
    expect(codeOf(() => updatePaymentMethod(subscription(), { ...card, expMonth: 10 }, NOW))).toBe("invalid_input");
    expect(codeOf(() => updatePaymentMethod(subscription(), { ...card, expMonth: 12, expYear: 2025 }, NOW))).toBe("invalid_input");
  });
});

describe("3-D Secure", () => {
  const pending = { intentId: "pi_1", purchase: "run_pack" as const, amountUsd: 100, description: "Run pack, 5 runs" };

  it("holds the payment without changing the plan", () => {
    const next = holdPayment(subscription(), pending);
    expect(next.pendingPayment).toEqual(pending);
    expect(next.runsRemaining).toBe(0);
    expect(codeOf(() => buyRunPack(next, NOW, "in_new"))).toBe("conflict");
  });

  it("completes the purchase once authenticated", () => {
    const next = completePendingPayment(subscription({ pendingPayment: pending }), "pi_1", true, NOW, "in_new");
    expect(next).toMatchObject({ pendingPayment: null, runsRemaining: 5 });
    expect(next.invoices[0]).toMatchObject({ id: "in_new", status: "paid", paymentIntentId: "pi_1" });
  });

  it("subscribes once authenticated", () => {
    const held = subscription({ plan: "run_pack", renewsAt: null, pendingPayment: { ...pending, purchase: "subscription", amountUsd: 200 } });
    expect(completePendingPayment(held, "pi_1", true, NOW, "in_new")).toMatchObject({ plan: "subscription", renewsAt: "2026-12-14" });
  });

  it("releases the payment when authentication fails", () => {
    const next = completePendingPayment(subscription({ pendingPayment: pending }), "pi_1", false, NOW, "in_new");
    expect(next).toMatchObject({ pendingPayment: null, runsRemaining: 0 });
    expect(next.invoices).toHaveLength(1);
  });

  it("refuses an intent that is not pending", () => {
    expect(codeOf(() => completePendingPayment(subscription(), "pi_1", true, NOW, "in_new"))).toBe("not_found");
    expect(codeOf(() => completePendingPayment(subscription({ pendingPayment: pending }), "pi_2", true, NOW, "in_new"))).toBe("not_found");
  });
});

describe("renewSubscription", () => {
  it("bills the renewal month and moves the date on", () => {
    const next = renewSubscription(subscription(), true, "in_new", "pi_1");
    expect(next).toMatchObject({ status: "active", renewsAt: "2027-01-01" });
    expect(next.invoices[0]).toEqual({
      id: "in_new",
      date: "2026-12-01",
      description: "Subscription, December",
      amountUsd: 200,
      status: "paid",
      paymentIntentId: "pi_1",
    });
  });

  it("goes past due when the charge fails", () => {
    const next = renewSubscription(subscription(), false, "in_new");
    expect(next.status).toBe("past_due");
    expect(next.invoices[0]).toMatchObject({ status: "failed" });
    expect(next.invoices[0]).not.toHaveProperty("paymentIntentId");
  });

  it("refuses anything but a subscription", () => {
    expect(codeOf(() => renewSubscription(subscription({ plan: "run_pack", renewsAt: null }), true, "in_new"))).toBe("conflict");
  });
});
