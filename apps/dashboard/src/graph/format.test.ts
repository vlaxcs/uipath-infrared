import { describe, expect, it } from "vitest";
import {
  formatMetric,
  formatNumber,
  formatScalar,
  formatSeries,
  humanizeKey,
} from "~/graph/format";

describe("formatting graph facts", () => {
  it("formats scalars", () => {
    expect(formatScalar(true)).toBe("Yes");
    expect(formatScalar(false)).toBe("No");
    expect(formatScalar(null)).toBe("Unknown");
    expect(formatScalar([80, 443])).toBe("80, 443");
  });

  it("formats metric values with units", () => {
    expect(formatMetric({ value: 1575, unit: "EUR/month" })).toBe("1575 EUR/month");
    expect(formatMetric({ value: 0.4, unit: "percent" })).toBe("0.4%");
    expect(formatMetric({ value: 2, unit: "count" })).toBe("2");
  });

  it("summarises series", () => {
    expect(formatSeries({ avg: 8, p95: 22, max: 30, unit: "percent" })).toBe("avg 8%, p95 22%, max 30%");
  });

  it("humanises keys", () => {
    expect(humanizeKey("public_exposure")).toBe("Public exposure");
  });

  it("keeps integers plain and rounds decimals", () => {
    expect(formatNumber(3)).toBe("3");
    expect(formatNumber(3.14159)).toBe("3.14");
  });
});
