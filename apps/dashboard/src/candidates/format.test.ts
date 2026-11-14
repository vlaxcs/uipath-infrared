import { describe, expect, it } from "vitest";
import {
  formatConstraintValue,
  formatDecimal,
  formatDeltaPp,
  formatDistance,
  formatEur,
  formatHours,
  formatMonths,
  formatPercent,
  formatRank,
  formatRisk,
  formatSaving,
  formatScore,
  formatSignedEur,
  humanizeKey,
} from "~/candidates/format";

describe("formatting candidate numbers", () => {
  it("formats EUR", () => {
    expect(formatEur(159805.26)).toBe("EUR 159,805");
    expect(formatEur(1.36, "cents")).toBe("EUR 1.36");
    expect(formatSignedEur(-1496)).toBe("-EUR 1,496");
    expect(formatSignedEur(46)).toBe("+EUR 46");
    expect(formatSignedEur(0)).toBe("EUR 0");
  });

  it("formats percentages, percentage points and risk", () => {
    expect(formatPercent(99.43)).toBe("99.43%");
    expect(formatPercent(97.995)).toBe("97.995%");
    expect(formatPercent(98)).toBe("98%");
    expect(formatPercent(null)).toBe("Not known");
    expect(formatDeltaPp(1.43)).toBe("+1.43 pp");
    expect(formatDeltaPp(-0.5)).toBe("-0.5 pp");
    expect(formatDeltaPp(0)).toBe("0 pp");
    expect(formatRisk(0.13)).toBe("0.13");
    expect(formatRisk(null)).toBe("Not known");
    expect(formatScore(0.19)).toBe("0.19");
    expect(formatScore(null)).toBe("Not scored");
  });

  it("formats hours, months, ranks and distances", () => {
    expect(formatHours(94.49)).toBe("94.49 h");
    expect(formatHours(null)).toBe("Not known");
    expect(formatMonths(4.14)).toBe("4.1 months");
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(null)).toBe("Not known");
    expect(formatRank(2)).toBe("#2");
    expect(formatRank(null)).toBe("No rank");
    expect(formatDistance(0.549)).toBe("0.549");
    expect(formatDecimal(3.14159, 2)).toBe("3.14");
  });

  it("phrases savings in both directions", () => {
    expect(formatSaving(2919)).toBe("Saves EUR 2,919/month");
    expect(formatSaving(-310)).toBe("Adds EUR 310/month");
    expect(formatSaving(46.5)).toBe("Saves EUR 46.50/month");
    expect(formatSaving(0)).toBe("No run-cost change");
  });

  it("formats constraint values with the right unit", () => {
    expect(formatConstraintValue("budget", 139450)).toBe("EUR 139,450");
    expect(formatConstraintValue("min_availability_pct", 97.995)).toBe("97.995%");
    expect(formatConstraintValue("max_migration_effort_hours", 12)).toBe("12 h");
    expect(formatConstraintValue("data_residency", "eu-west-1")).toBe("eu-west-1");
    expect(formatConstraintValue("budget", null)).toBe("—");
  });

  it("humanises keys", () => {
    expect(humanizeKey("public_exposure")).toBe("Public exposure");
    expect(humanizeKey("security.forbid_public_datastores")).toBe(
      "Security forbid public datastores",
    );
  });
});
