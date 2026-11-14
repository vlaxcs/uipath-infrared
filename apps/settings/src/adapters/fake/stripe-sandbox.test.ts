import { describe, expect, it } from "vitest";
import { createFakeStore } from "~/adapters/fake/store";
import { SEED_SETTINGS } from "~/adapters/seed";
import { createStripeSandbox, passesLuhn, TEST_CARDS } from "~/adapters/fake/stripe-sandbox";

const NOW = new Date("2026-11-14T12:00:00Z");

function sandbox() {
  return createStripeSandbox(createFakeStore(SEED_SETTINGS, { now: () => NOW }));
}

function card(number: string, cvc = "123") {
  return { number, expMonth: 12, expYear: 2034, cvc };
}

describe("the Stripe sandbox", () => {
  it("only lists test cards that pass the Luhn check", () => {
    for (const test of TEST_CARDS) expect(passesLuhn(test.number), test.number).toBe(true);
    expect(passesLuhn("4242424242424241")).toBe(false);
  });

  it("tokenizes a test card into a payment method without the full number", async () => {
    const method = await sandbox().createPaymentMethod(card("4242 4242 4242 4242"));
    expect(method).toEqual({ id: expect.stringMatching(/^pm_/), brand: "Visa", last4: "4242", expMonth: 12, expYear: 2034 });
  });

  it("rejects an invalid number, a bad CVC and a real card", async () => {
    const stripe = sandbox();
    await expect(stripe.createPaymentMethod(card("4242 4242 4242 4241"))).rejects.toMatchObject({ code: "invalid_input" });
    await expect(stripe.createPaymentMethod(card("4242424242424242", "12"))).rejects.toMatchObject({ code: "invalid_input" });
    await expect(stripe.createPaymentMethod(card("4111111111111111"))).rejects.toMatchObject({
      code: "payment_failed",
      message: expect.stringContaining("non test card"),
    });
  });

  it("declines decline cards when they are attached", async () => {
    const stripe = sandbox();
    const insufficient = await stripe.createPaymentMethod(card("4000000000009995"));
    expect(() => stripe.attach(insufficient)).toThrow("Your card has insufficient funds.");
    expect(stripe.events()[0]).toMatchObject({ type: "setup_intent.setup_failed", summary: "Visa •••• 9995, insufficient_funds" });
  });

  it("charges each kind of card as Stripe test mode does", async () => {
    const stripe = sandbox();
    const ok = await stripe.createPaymentMethod(card("5555555555554444"));
    const secure = await stripe.createPaymentMethod(card("4000002500003155"));
    const declining = await stripe.createPaymentMethod(card("4000000000000341"));
    stripe.attach(declining);
    expect(stripe.charge(ok, 100, "Run pack").status).toBe("succeeded");
    expect(stripe.charge(secure, 100, "Run pack").status).toBe("requires_action");
    expect(stripe.charge(secure, 200, "Renewal", { offSession: true })).toMatchObject({
      status: "requires_payment_method",
      decline: { code: "authentication_required" },
    });
    expect(stripe.charge(declining, 100, "Run pack")).toMatchObject({ status: "requires_payment_method", decline: { code: "card_declined" } });
  });

  it("treats a payment method it did not tokenize as a working card", () => {
    expect(sandbox().charge({ id: "pm_seed_visa", brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028 }, 200, "Renewal").status).toBe(
      "succeeded",
    );
  });

  it("keeps the newest event first and notifies listeners", () => {
    const stripe = sandbox();
    let calls = 0;
    const unsubscribe = stripe.subscribe(() => (calls += 1));
    stripe.record("first", "a");
    stripe.record("second", "b");
    unsubscribe();
    stripe.record("third", "c");
    expect(stripe.events().map((event) => event.type)).toEqual(["third", "second", "first"]);
    expect(stripe.events()[0].createdAt).toBe(NOW.toISOString());
    expect(calls).toBe(2);
  });
});
