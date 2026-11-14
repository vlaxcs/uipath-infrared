import type { PaymentMethod } from "~/domain/types";

export interface CardFormErrors {
  number?: string;
  expiry?: string;
}

export type CardFormResult = { ok: true; method: PaymentMethod } | { ok: false; errors: CardFormErrors };

export function brandFor(digits: string): string {
  switch (digits[0]) {
    case "4":
      return "Visa";
    case "5":
      return "Mastercard";
    case "3":
      return "Amex";
    default:
      return "Card";
  }
}

export function parseCardForm(number: string, expiry: string): CardFormResult {
  const errors: CardFormErrors = {};
  const digits = number.replace(/[\s-]/g, "");
  if (digits === "") errors.number = "Enter the card number.";
  else if (!/^\d{12,19}$/.test(digits)) errors.number = "A card number has 12 to 19 digits.";

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  const expMonth = match ? Number(match[1]) : 0;
  if (expiry.trim() === "") errors.expiry = "Enter the expiry date.";
  else if (!match || expMonth < 1 || expMonth > 12) errors.expiry = "Use the format MM/YY.";

  if (errors.number || errors.expiry || !match) return { ok: false, errors };
  return { ok: true, method: { brand: brandFor(digits), last4: digits.slice(-4), expMonth, expYear: 2000 + Number(match[2]) } };
}

export function describeCard(method: PaymentMethod): string {
  return `${method.brand} •••• ${method.last4}, expires ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`;
}
