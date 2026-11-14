import type { FakeStore } from "~/adapters/fake/store";
import { SettingsError, type PaymentMethod } from "~/domain/types";
import type { CardInput, SandboxEvent } from "~/ports/billing";

export interface Decline {
  code: string;
  message: string;
}

export interface TestCard {
  number: string;
  brand: string;
  outcome: string;
  attach?: Decline;
  charge: "succeeds" | "requires_action" | Decline;
}

const DECLINED: Decline = { code: "card_declined", message: "Your card was declined." };
const AUTHENTICATION_REQUIRED: Decline = {
  code: "authentication_required",
  message: "Your card was declined. This transaction requires authentication.",
};
const NOT_A_TEST_CARD =
  "Your card was declined. Your request was in test mode, but used a non test card. For a list of valid test cards, visit: https://stripe.com/docs/testing.";

/** Stripe's documented test-mode cards and what each one does. */
export const TEST_CARDS: TestCard[] = [
  { number: "4242424242424242", brand: "Visa", outcome: "Succeeds", charge: "succeeds" },
  { number: "5555555555554444", brand: "Mastercard", outcome: "Succeeds", charge: "succeeds" },
  { number: "378282246310005", brand: "Amex", outcome: "Succeeds", charge: "succeeds" },
  { number: "4000000000000077", brand: "Visa", outcome: "Succeeds", charge: "succeeds" },
  { number: "4000002500003155", brand: "Visa", outcome: "Asks for 3-D Secure on every payment", charge: "requires_action" },
  { number: "4000000000000341", brand: "Visa", outcome: "Saves, then every payment is declined", charge: DECLINED },
  { number: "4000000000000002", brand: "Visa", outcome: "Declined", attach: DECLINED, charge: DECLINED },
  {
    number: "4000000000009995",
    brand: "Visa",
    outcome: "Insufficient funds",
    attach: { code: "insufficient_funds", message: "Your card has insufficient funds." },
    charge: DECLINED,
  },
  {
    number: "4000000000000069",
    brand: "Visa",
    outcome: "Expired card",
    attach: { code: "expired_card", message: "Your card has expired." },
    charge: DECLINED,
  },
  {
    number: "4000000000000127",
    brand: "Visa",
    outcome: "Incorrect CVC",
    attach: { code: "incorrect_cvc", message: "Your card's security code is incorrect." },
    charge: DECLINED,
  },
];

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return digits.length > 0 && sum % 10 === 0;
}

export type PaymentIntent =
  | { id: string; status: "succeeded" }
  | { id: string; status: "requires_action" }
  | { id: string; status: "requires_payment_method"; decline: Decline };

export interface StripeSandbox {
  createPaymentMethod(card: CardInput): Promise<PaymentMethod>;
  events(): SandboxEvent[];
  subscribe(listener: () => void): () => void;
  record(type: string, summary: string): void;
  attach(method: PaymentMethod): void;
  charge(method: PaymentMethod, amountUsd: number, description: string, options?: { offSession?: boolean }): PaymentIntent;
  authenticate(intentId: string, authenticated: boolean): void;
}

function cardLabel(method: PaymentMethod): string {
  return `${method.brand} •••• ${method.last4}`;
}

export function createStripeSandbox(store: FakeStore): StripeSandbox {
  const cards = new Map<string, TestCard>();
  const intents = new Map<string, string>();
  const listeners = new Set<() => void>();
  let log: SandboxEvent[] = [];

  function record(type: string, summary: string) {
    log = [{ id: store.nextId("evt"), type, createdAt: store.now().toISOString(), summary }, ...log];
    listeners.forEach((listener) => listener());
  }

  function intent(amountUsd: number, description: string): string {
    const id = store.nextId("pi");
    intents.set(id, `$${amountUsd}, ${description}`);
    return id;
  }

  return {
    createPaymentMethod: (card) =>
      store.settle(() => {
        const digits = card.number.replace(/[\s-]/g, "");
        if (!passesLuhn(digits)) throw new SettingsError("invalid_input", "Your card number is invalid.");
        if (!/^\d{3,4}$/.test(card.cvc)) throw new SettingsError("invalid_input", "Your card's security code is invalid.");
        const test = TEST_CARDS.find((candidate) => candidate.number === digits);
        if (!test) throw new SettingsError("payment_failed", NOT_A_TEST_CARD);
        const id = store.nextId("pm");
        cards.set(id, test);
        return { id, brand: test.brand, last4: digits.slice(-4), expMonth: card.expMonth, expYear: card.expYear };
      }),
    events: () => log,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    record,
    attach(method) {
      const decline = method.id ? cards.get(method.id)?.attach : undefined;
      if (decline) {
        record("setup_intent.setup_failed", `${cardLabel(method)}, ${decline.code}`);
        throw new SettingsError("payment_failed", decline.message);
      }
      record("payment_method.attached", cardLabel(method));
    },
    charge(method, amountUsd, description, options = {}) {
      const id = intent(amountUsd, description);
      const summary = `${id}, ${intents.get(id)}`;
      let behaviour = (method.id && cards.get(method.id)?.charge) || "succeeds";
      if (behaviour === "requires_action" && options.offSession) behaviour = AUTHENTICATION_REQUIRED;
      if (behaviour === "succeeds") {
        record("payment_intent.succeeded", summary);
        return { id, status: "succeeded" };
      }
      if (behaviour === "requires_action") {
        record("payment_intent.requires_action", `${summary}, 3-D Secure`);
        return { id, status: "requires_action" };
      }
      record("payment_intent.payment_failed", `${summary}, ${behaviour.code}`);
      return { id, status: "requires_payment_method", decline: behaviour };
    },
    authenticate(intentId, authenticated) {
      const summary = `${intentId}, ${intents.get(intentId) ?? "unknown payment"}`;
      if (authenticated) record("payment_intent.succeeded", summary);
      else record("payment_intent.payment_failed", `${summary}, authentication failed`);
    },
  };
}
