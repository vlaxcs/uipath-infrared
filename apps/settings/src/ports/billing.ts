import type { AccountSettings, PaymentMethod } from "~/domain/types";

export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

/** Turns card details into a payment method in the browser, as Stripe.js does, so the card number never reaches the settings API. */
export interface CardTokenizer {
  createPaymentMethod(card: CardInput): Promise<PaymentMethod>;
}

export interface TestCardInfo {
  number: string;
  brand: string;
  outcome: string;
}

export interface SandboxEvent {
  id: string;
  type: string;
  createdAt: string;
  summary: string;
}

/** What the Stripe test-mode simulator lets the page do beyond the settings API: tokenize cards, read the webhook log, run the renewal clock. */
export interface SandboxControls extends CardTokenizer {
  testCards: TestCardInfo[];
  events(): SandboxEvent[];
  subscribe(listener: () => void): () => void;
  advanceToRenewal(): Promise<AccountSettings>;
}
