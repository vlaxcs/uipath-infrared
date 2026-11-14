import type { PaymentMethod } from "~/domain/types";
import type { CardInput } from "~/ports/billing";

export interface CardFormErrors {
  number?: string;
  expiry?: string;
  cvc?: string;
}

export type CardFormResult = { ok: true; card: CardInput; method: PaymentMethod } | { ok: false; errors: CardFormErrors };

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

export function parseCardForm(number: string, expiry: string, cvc: string): CardFormResult {
  const errors: CardFormErrors = {};
  const digits = number.replace(/[\s-]/g, "");
  if (digits === "") errors.number = "Enter the card number.";
  else if (!/^\d{12,19}$/.test(digits)) errors.number = "A card number has 12 to 19 digits.";

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  const expMonth = match ? Number(match[1]) : 0;
  if (expiry.trim() === "") errors.expiry = "Enter the expiry date.";
  else if (!match || expMonth < 1 || expMonth > 12) errors.expiry = "Use the format MM/YY.";

  if (cvc.trim() === "") errors.cvc = "Enter the security code.";
  else if (!/^\d{3,4}$/.test(cvc.trim())) errors.cvc = "The security code has 3 or 4 digits.";

  if (errors.number || errors.expiry || errors.cvc || !match) return { ok: false, errors };
  const expYear = 2000 + Number(match[2]);
  return {
    ok: true,
    card: { number: digits, expMonth, expYear, cvc: cvc.trim() },
    method: { brand: brandFor(digits), last4: digits.slice(-4), expMonth, expYear },
  };
}

export function formatCardNumber(digits: string): string {
  if (digits.length === 15) return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10)}`;
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function describeCard(method: PaymentMethod): string {
  return `${method.brand} •••• ${method.last4}, expires ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`;
}
