import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDecimal,
  formatMetricValue,
  formatPercent,
  formatSeconds,
  formatSignedPp,
  formatTimestamp,
  humanizeKey,
} from "~/rehearsal/format";

const synthetic = { value: 42, unit: "ms", provenance: "synthetic" as const };

describe("formatting rehearsal numbers", () => {
  it("formats percentages and missing values", () => {
    expect(formatPercent(99.94)).toBe("99.94%");
    expect(formatPercent(85.312)).toBe("85.312%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(undefined)).toBe("Not measured");
    expect(formatPercent(Number.NaN)).toBe("Not measured");
  });

  it("formats metric values by kind", () => {
    expect(formatMetricValue(synthetic, "latency")).toBe("42 ms");
    expect(formatMetricValue({ ...synthetic, value: 4.53 }, "latency")).toBe("4.53 ms");
    expect(formatMetricValue({ value: 85.312, provenance: "synthetic" }, "percent")).toBe(
      "85.312%",
    );
    expect(formatMetricValue({ value: 28, unit: "percent", provenance: "synthetic" }, "generic")).toBe(
      "28 percent",
    );
    expect(formatMetricValue(undefined, "percent")).toBe("Not measured");
  });

  it("formats signed percentage points", () => {
    expect(formatSignedPp(0.04)).toBe("+0.04 pp");
    expect(formatSignedPp(-14.188)).toBe("-14.188 pp");
    expect(formatSignedPp(0)).toBe("0 pp");
    expect(formatSignedPp(undefined)).toBe("Not stated");
  });

  it("formats seconds, counts and decimals", () => {
    expect(formatSeconds(90)).toBe("90 s");
    expect(formatSeconds(48.13)).toBe("48.13 s");
    expect(formatSeconds(undefined)).toBe("Not recorded");
    expect(formatCount(900)).toBe("900");
    expect(formatCount(undefined)).toBe("Not recorded");
    expect(formatDecimal(3.14159, 2)).toBe("3.14");
  });

  it("formats both timestamp spellings in UTC", () => {
    expect(formatTimestamp("2026-11-13T10:30:00Z")).toBe("13 Nov 2026, 10:30 UTC");
    expect(formatTimestamp("2026-11-13T21:08:28.839841+00:00")).toBe("13 Nov 2026, 21:08 UTC");
    expect(formatTimestamp("not a date")).toBe("Not stated");
    expect(formatTimestamp(undefined)).toBe("Not stated");
  });

  it("humanises keys", () => {
    expect(humanizeKey("virtual_machine")).toBe("Virtual machine");
    expect(humanizeKey("load_balancer")).toBe("Load balancer");
  });
});
