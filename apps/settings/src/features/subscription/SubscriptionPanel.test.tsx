import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { UserEvent } from "@testing-library/user-event";
import { fakeApi, renderWithApi } from "~/app/test-utils";
import { SubscriptionPanel } from "~/features/subscription/SubscriptionPanel";

function currentPlan() {
  return screen.getByRole("heading", { name: "Current plan" }).closest("section") as HTMLElement;
}

function sandboxEvents() {
  return within(screen.getByRole("list", { name: "Webhook events" }));
}

async function saveCard(user: UserEvent, number: string) {
  await user.click(screen.getByRole("button", { name: /^(Update|Add card)$/ }));
  const dialog = within(screen.getByRole("dialog"));
  await user.type(dialog.getByLabelText("Card number"), number);
  await user.type(dialog.getByLabelText("Expiry"), "12/34");
  await user.type(dialog.getByLabelText("CVC"), "123");
  await user.click(dialog.getByRole("button", { name: "Save card" }));
  return dialog;
}

function invoices() {
  return screen.getByRole("heading", { name: "Invoices" }).closest("section") as HTMLElement;
}

describe("the subscription panel", () => {
  it("shows the active subscription and its next charge", async () => {
    await renderWithApi(<SubscriptionPanel />);
    const card = within(currentPlan());
    expect(card.getByText("Subscription")).toBeTruthy();
    expect(card.getByText("Active")).toBeTruthy();
    expect(card.getByText("$200")).toBeTruthy();
    expect(card.getByText("Next charge on 1 Dec 2026")).toBeTruthy();
    expect(within(screen.getByRole("listitem", { name: "Subscription" })).getByText("Current plan")).toBeTruthy();
    expect(screen.getByText("Visa •••• 4242, expires 08/2028")).toBeTruthy();
    expect(within(invoices()).getAllByRole("row")).toHaveLength(4);
  });

  it("cancels at period end and resumes", async () => {
    const user = userEvent.setup();
    const { api } = await renderWithApi(<SubscriptionPanel />);
    await user.click(within(currentPlan()).getByRole("button", { name: "Cancel subscription" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("You keep full access until 1 Dec 2026");
    expect(dialog.textContent).toContain("Scheduled runs stop after that date");
    await user.click(within(dialog).getByRole("button", { name: "Cancel subscription" }));
    expect(await within(currentPlan()).findByText("Cancels on 1 Dec 2026")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.store.state.subscription.cancelAtPeriodEnd).toBe(true);

    await user.click(within(currentPlan()).getByRole("button", { name: "Resume subscription" }));
    expect(await within(currentPlan()).findByText("Active")).toBeTruthy();
    expect(api.store.state.subscription.cancelAtPeriodEnd).toBe(false);
  });

  it("shows a cancel error inside the dialog", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.cancelSubscription = () => Promise.reject(new Error("Billing is down."));
    await renderWithApi(<SubscriptionPanel />, api);
    await user.click(within(currentPlan()).getByRole("button", { name: "Cancel subscription" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel subscription" }));
    expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toBe("Billing is down.");
  });

  it("buys a run pack, adding runs and an invoice", async () => {
    const user = userEvent.setup();
    const api = fakeApi((seed) => {
      seed.subscription.plan = "run_pack";
      seed.subscription.renewsAt = null;
      seed.subscription.runsRemaining = 1;
    });
    await renderWithApi(<SubscriptionPanel />, api);
    expect(within(currentPlan()).getByText("1 run left")).toBeTruthy();
    await user.click(within(currentPlan()).getByRole("button", { name: "Buy run pack" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("You will be charged $100 once, today");
    expect(dialog.textContent).toContain("becomes 6 runs");
    await user.click(within(dialog).getByRole("button", { name: "Pay $100" }));
    expect(await within(currentPlan()).findByText("6 runs left")).toBeTruthy();
    const rows = within(invoices()).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[1].textContent).toContain("14 Nov 2026");
    expect(rows[1].textContent).toContain("Run pack, 5 runs");
    expect(rows[1].textContent).toContain("$100");
  });

  it("shows a payment failure when there is no card", async () => {
    const user = userEvent.setup();
    const api = fakeApi((seed) => {
      seed.subscription.plan = "none";
      seed.subscription.renewsAt = null;
      seed.subscription.paymentMethod = null;
      seed.subscription.invoices = [];
    });
    await renderWithApi(<SubscriptionPanel />, api);
    expect(within(currentPlan()).getByText("No plan", { selector: "span.type-small" })).toBeTruthy();
    expect(screen.getByText("No invoices yet. They appear here after your first purchase.")).toBeTruthy();
    expect(screen.getByText("No payment method on file.")).toBeTruthy();
    await user.click(within(currentPlan()).getByRole("button", { name: "Buy run pack" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Pay $100" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Add a payment method");
  });

  it("switches from subscription to run pack without a charge", async () => {
    const user = userEvent.setup();
    const { api } = await renderWithApi(<SubscriptionPanel />);
    await user.click(screen.getByRole("button", { name: "Switch to Run pack" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Nothing is charged now");
    expect(dialog.textContent).toContain("scheduled runs stop");
    await user.click(within(dialog).getByRole("button", { name: "Switch to Run pack" }));
    expect(await within(screen.getByRole("listitem", { name: "Run pack" })).findByText("Current plan")).toBeTruthy();
    expect(within(currentPlan()).getByText("0 runs left")).toBeTruthy();
    expect(api.store.state.subscription.invoices).toHaveLength(3);
  });

  it("subscribes from a run pack and bills the first month", async () => {
    const user = userEvent.setup();
    const api = fakeApi((seed) => {
      seed.subscription.plan = "run_pack";
      seed.subscription.renewsAt = null;
      seed.subscription.runsRemaining = 2;
    });
    await renderWithApi(<SubscriptionPanel />, api);
    await user.click(screen.getByRole("button", { name: "Switch to Subscription" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("You will be charged $200 today");
    expect(dialog.textContent).toContain("Your 2 runs left from packs stay available");
    await user.click(within(dialog).getByRole("button", { name: "Pay $200 and subscribe" }));
    expect(await within(currentPlan()).findByText("Next charge on 14 Dec 2026")).toBeTruthy();
    expect(within(currentPlan()).getByText("Plus 2 runs left from run packs")).toBeTruthy();
    expect(within(invoices()).getAllByRole("row")[1].textContent).toContain("Subscription, November");
  });

  it("validates the card form field by field", async () => {
    const user = userEvent.setup();
    await renderWithApi(<SubscriptionPanel />);
    await user.click(screen.getByRole("button", { name: "Update" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect(dialog.getByText("Enter the card number.")).toBeTruthy();
    expect(dialog.getByText("Enter the expiry date.")).toBeTruthy();
    expect(dialog.getByText("Enter the security code.")).toBeTruthy();
    await user.type(dialog.getByLabelText("Card number"), "4111");
    await user.type(dialog.getByLabelText("Expiry"), "13/30");
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect(dialog.getByText("A card number has 12 to 19 digits.")).toBeTruthy();
    expect(dialog.getByText("Use the format MM/YY.")).toBeTruthy();
    expect(dialog.getByLabelText("Card number").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the server error for an expired card", async () => {
    const user = userEvent.setup();
    await renderWithApi(<SubscriptionPanel />);
    await user.click(screen.getByRole("button", { name: "Update" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Card number"), "5555 5555 5555 4444");
    await user.type(dialog.getByLabelText("Expiry"), "10/26");
    await user.type(dialog.getByLabelText("CVC"), "123");
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect((await dialog.findByRole("alert")).textContent).toBe("This card has expired.");
  });

  it("saves a new card", async () => {
    const user = userEvent.setup();
    const { api } = await renderWithApi(<SubscriptionPanel />);
    await user.click(screen.getByRole("button", { name: "Update" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Card number"), "3782 822463 10005");
    await user.type(dialog.getByLabelText("Expiry"), "03/29");
    await user.type(dialog.getByLabelText("CVC"), "1234");
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect(await screen.findByText("Amex •••• 0005, expires 03/2029")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.store.state.subscription.paymentMethod).toMatchObject({ brand: "Amex", last4: "0005", expMonth: 3, expYear: 2029 });
    expect(api.store.state.subscription.paymentMethod?.id).toMatch(/^pm_/);
  });

  it("warns when the account is past due and clears once the card is updated", async () => {
    const user = userEvent.setup();
    const api = fakeApi((seed) => {
      seed.subscription.status = "past_due";
      seed.subscription.invoices[0].status = "failed";
    });
    await renderWithApi(<SubscriptionPanel />, api);
    expect(screen.getByRole("alert").textContent).toContain("Update your payment method");
    expect(within(currentPlan()).getByText("Past due")).toBeTruthy();
    expect(within(invoices()).getByText("Failed")).toBeTruthy();
    expect(within(currentPlan()).queryByRole("button", { name: "Cancel subscription" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Update" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Card number"), "4000 0000 0000 0077");
    await user.type(dialog.getByLabelText("Expiry"), "12/30");
    await user.type(dialog.getByLabelText("CVC"), "123");
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect(await within(currentPlan()).findByText("Active")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the Stripe sandbox", () => {
  it("declines a decline test card with Stripe's message and logs the webhook", async () => {
    const user = userEvent.setup();
    const { api } = await renderWithApi(<SubscriptionPanel />);
    const dialog = await saveCard(user, "4000 0000 0000 0002");
    expect((await dialog.findByRole("alert")).textContent).toBe("Your card was declined.");
    expect(api.store.state.subscription.paymentMethod?.last4).toBe("4242");
    expect(sandboxEvents().getByText("setup_intent.setup_failed")).toBeTruthy();
  });

  it("refuses a real card in test mode", async () => {
    const user = userEvent.setup();
    await renderWithApi(<SubscriptionPanel />);
    const dialog = await saveCard(user, "4111 1111 1111 1111");
    expect((await dialog.findByRole("alert")).textContent).toContain("used a non test card");
  });

  it("fills the form from the test card list", async () => {
    const user = userEvent.setup();
    await renderWithApi(<SubscriptionPanel />);
    await user.click(screen.getByRole("button", { name: "Update" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByText("Stripe test cards"));
    await user.click(dialog.getByRole("button", { name: /4000 0025 0000 3155/ }));
    expect((dialog.getByLabelText("Card number") as HTMLInputElement).value).toBe("4000 0025 0000 3155");
    expect((dialog.getByLabelText("CVC") as HTMLInputElement).value).toBe("123");
  });

  it("asks for 3-D Secure and adds the runs once it is completed", async () => {
    const user = userEvent.setup();
    const api = fakeApi((seed) => {
      seed.subscription.plan = "run_pack";
      seed.subscription.renewsAt = null;
      seed.subscription.runsRemaining = 1;
    });
    await renderWithApi(<SubscriptionPanel />, api);
    await saveCard(user, "4000 0025 0000 3155");
    expect(await screen.findByText("Visa •••• 3155, expires 12/2034")).toBeTruthy();
    await user.click(within(currentPlan()).getByRole("button", { name: "Buy run pack" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pay $100" }));
    const challenge = within(await screen.findByRole("dialog", { name: "Authenticate your payment" }));
    expect(challenge.getByText(/charge \$100 for Run pack, 5 runs to Visa •••• 3155/)).toBeTruthy();
    expect(within(currentPlan()).getByText("1 run left")).toBeTruthy();
    await user.click(challenge.getByRole("button", { name: "Complete authentication" }));
    expect(await within(currentPlan()).findByText("6 runs left")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.store.state.subscription.invoices[0]).toMatchObject({ status: "paid", paymentIntentId: expect.stringMatching(/^pi_/) });
    expect(sandboxEvents().getAllByText("payment_intent.succeeded")).toHaveLength(1);
    expect(sandboxEvents().getByText("payment_intent.requires_action")).toBeTruthy();
  });

  it("charges nothing when 3-D Secure fails", async () => {
    const user = userEvent.setup();
    const { api } = await renderWithApi(<SubscriptionPanel />);
    await saveCard(user, "4000 0025 0000 3155");
    await screen.findByText("Visa •••• 3155, expires 12/2034");
    await user.click(screen.getByRole("button", { name: "Switch to Run pack" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Switch to Run pack" }));
    await within(screen.getByRole("listitem", { name: "Run pack" })).findByText("Current plan");
    await user.click(screen.getByRole("button", { name: "Switch to Subscription" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pay $200 and subscribe" }));
    const challenge = within(await screen.findByRole("dialog", { name: "Authenticate your payment" }));
    await user.click(challenge.getByRole("button", { name: "Fail authentication" }));
    expect((await challenge.findByRole("alert")).textContent).toContain("unable to authenticate");
    await user.click(challenge.getByRole("button", { name: "Done" }));
    expect(api.store.state.subscription).toMatchObject({ plan: "run_pack", pendingPayment: null });
    expect(api.store.state.subscription.invoices).toHaveLength(3);
  });

  it("offers to finish a payment left waiting for authentication", async () => {
    const user = userEvent.setup();
    const api = fakeApi((seed) => {
      seed.subscription.pendingPayment = { intentId: "pi_left", purchase: "run_pack", amountUsd: 100, description: "Run pack, 5 runs" };
    });
    await renderWithApi(<SubscriptionPanel />, api);
    expect(screen.getByText(/A payment of \$100 for Run pack, 5 runs is waiting/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Authenticate payment" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Complete authentication" }));
    expect(await within(currentPlan()).findByText("Plus 5 runs left from run packs")).toBeTruthy();
    expect(screen.queryByText(/is waiting/)).toBeNull();
  });

  it("fails the renewal on a card that declines charges, then recovers with a new card", async () => {
    const user = userEvent.setup();
    const { api } = await renderWithApi(<SubscriptionPanel />);
    await saveCard(user, "4000 0000 0000 0341");
    await screen.findByText("Visa •••• 0341, expires 12/2034");
    await user.click(screen.getByRole("button", { name: "Simulate renewal on 1 Dec 2026" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Your last payment failed");
    expect(within(currentPlan()).getByText("Past due")).toBeTruthy();
    const firstRow = within(invoices()).getAllByRole("row")[1];
    expect(firstRow.textContent).toContain("Subscription, December");
    expect(firstRow.textContent).toContain("Failed");
    expect(sandboxEvents().getByText("invoice.payment_failed")).toBeTruthy();
    await saveCard(user, "4242 4242 4242 4242");
    expect(await within(currentPlan()).findByText("Active")).toBeTruthy();
    expect(api.store.state.subscription.renewsAt).toBe("2027-01-01");
  });
});
