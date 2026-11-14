import { offerFor, RUN_PACK_RUNS } from "~/domain/plans";
import { SettingsError, type Invoice, type PaidPlan, type PaymentMethod, type Subscription } from "~/domain/types";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addOneMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return isoDay(new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))));
}

function requirePaymentMethod(subscription: Subscription): void {
  if (!subscription.paymentMethod) {
    throw new SettingsError("payment_failed", "Add a payment method before you buy.");
  }
}

function paidInvoice(id: string, now: Date, description: string, amountUsd: number): Invoice {
  return { id, date: isoDay(now), description, amountUsd, status: "paid" };
}

export function buyRunPack(subscription: Subscription, now: Date, invoiceId: string): Subscription {
  requirePaymentMethod(subscription);
  const offer = offerFor("run_pack");
  const startsPlan = subscription.plan === "none";
  return {
    ...subscription,
    plan: startsPlan ? "run_pack" : subscription.plan,
    status: startsPlan ? "active" : subscription.status,
    runsRemaining: subscription.runsRemaining + RUN_PACK_RUNS,
    invoices: [paidInvoice(invoiceId, now, `Run pack, ${RUN_PACK_RUNS} runs`, offer.priceUsd), ...subscription.invoices],
  };
}

export function changePlan(subscription: Subscription, plan: PaidPlan, now: Date, invoiceId: string): Subscription {
  if (subscription.plan === plan) {
    throw new SettingsError("conflict", "You are already on this plan.");
  }
  if (plan === "subscription") {
    requirePaymentMethod(subscription);
    const offer = offerFor("subscription");
    return {
      ...subscription,
      plan: "subscription",
      status: "active",
      renewsAt: addOneMonth(now),
      cancelAtPeriodEnd: false,
      invoices: [
        paidInvoice(invoiceId, now, `Subscription, ${monthNames[now.getUTCMonth()]}`, offer.priceUsd),
        ...subscription.invoices,
      ],
    };
  }
  if (subscription.plan !== "subscription") {
    throw new SettingsError("conflict", "Buy a run pack to start the run pack plan.");
  }
  return { ...subscription, plan: "run_pack", status: "active", renewsAt: null, cancelAtPeriodEnd: false };
}

export function cancelSubscription(subscription: Subscription): Subscription {
  if (subscription.plan !== "subscription" || subscription.status !== "active" || subscription.cancelAtPeriodEnd) {
    throw new SettingsError("conflict", "Only an active subscription can be cancelled.");
  }
  return { ...subscription, cancelAtPeriodEnd: true };
}

export function resumeSubscription(subscription: Subscription): Subscription {
  if (subscription.plan !== "subscription" || !subscription.cancelAtPeriodEnd) {
    throw new SettingsError("conflict", "This subscription is not set to cancel.");
  }
  return { ...subscription, cancelAtPeriodEnd: false };
}

export function updatePaymentMethod(subscription: Subscription, method: PaymentMethod, now: Date): Subscription {
  if (!/^\d{4}$/.test(method.last4)) {
    throw new SettingsError("invalid_input", "The card number must end in 4 digits.");
  }
  if (method.brand.trim() === "") {
    throw new SettingsError("invalid_input", "The card brand is missing.");
  }
  if (!Number.isInteger(method.expMonth) || method.expMonth < 1 || method.expMonth > 12 || !Number.isInteger(method.expYear)) {
    throw new SettingsError("invalid_input", "The expiry date is not valid.");
  }
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  if (method.expYear * 12 + method.expMonth < currentMonth) {
    throw new SettingsError("invalid_input", "This card has expired.");
  }
  return {
    ...subscription,
    paymentMethod: { brand: method.brand.trim(), last4: method.last4, expMonth: method.expMonth, expYear: method.expYear },
    status: subscription.status === "past_due" ? "active" : subscription.status,
  };
}
