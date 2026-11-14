import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeApi, renderWithApi } from "~/app/test-utils";
import { SubscriptionPanel } from "~/features/subscription/SubscriptionPanel";

function currentPlan() {
  return screen.getByRole("heading", { name: "Current plan" }).closest("section") as HTMLElement;
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
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect(await screen.findByText("Amex •••• 0005, expires 03/2029")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.store.state.subscription.paymentMethod).toEqual({ brand: "Amex", last4: "0005", expMonth: 3, expYear: 2029 });
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
    await user.click(dialog.getByRole("button", { name: "Save card" }));
    expect(await within(currentPlan()).findByText("Active")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
