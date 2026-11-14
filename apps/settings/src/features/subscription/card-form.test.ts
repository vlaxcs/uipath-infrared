import { describe, expect, it } from "vitest";
import { brandFor, describeCard, parseCardForm } from "~/features/subscription/card-form";

describe("the card form", () => {
  it("derives the brand from the first digit", () => {
    expect(brandFor("4111")).toBe("Visa");
    expect(brandFor("5555")).toBe("Mastercard");
    expect(brandFor("3782")).toBe("Amex");
    expect(brandFor("6011")).toBe("Card");
  });

  it("parses a spaced number and MM/YY expiry", () => {
    expect(parseCardForm("4111 1111 1111 1234", "09 / 29")).toEqual({
      ok: true,
      method: { brand: "Visa", last4: "1234", expMonth: 9, expYear: 2029 },
    });
  });

  it("reports missing fields", () => {
    expect(parseCardForm("", "")).toEqual({ ok: false, errors: { number: "Enter the card number.", expiry: "Enter the expiry date." } });
  });

  it("reports a short number and a bad expiry", () => {
    expect(parseCardForm("4111", "13/29")).toEqual({
      ok: false,
      errors: { number: "A card number has 12 to 19 digits.", expiry: "Use the format MM/YY." },
    });
    expect(parseCardForm("4111111111111111", "0929")).toMatchObject({ ok: false, errors: { expiry: "Use the format MM/YY." } });
  });

  it("describes a stored card", () => {
    expect(describeCard({ brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028 })).toBe("Visa •••• 4242, expires 08/2028");
  });
});
