import { describe, expect, it } from "vitest";
import {
  formatEUR,
  formatPercent,
  formatRisk,
  formatTime,
  formatTimestamp,
  shortHash,
} from "~/runs/format";

describe("formatting a timestamp", () => {
  it("uses UTC so the output does not depend on the machine", () => {
    expect(formatTimestamp("2026-11-14T09:00:00Z")).toBe("14 Nov 2026, 09:00");
  });

  it("shows only the UTC time for timeline events", () => {
    expect(formatTime("2026-11-14T09:00:00Z")).toBe("09:00");
  });
});

describe("shortening a hash", () => {
  it("keeps the first twelve characters", () => {
    expect(shortHash("c0b12c14aef4cbe9346800f7cd5c888564436da6cfb84d5c094573e6a49b074a")).toBe("c0b12c14aef4");
  });
});

describe("formatting numbers", () => {
  it("formats euros without cents", () => {
    expect(formatEUR(74365)).toBe("€74,365");
    expect(formatEUR(undefined)).toBe("Not reported");
  });

  it("keeps up to two decimals on a percentage", () => {
    expect(formatPercent(99.94)).toBe("99.94%");
    expect(formatPercent(99.9)).toBe("99.9%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(undefined)).toBe("Not reported");
  });

  it("shows risk to two decimals", () => {
    expect(formatRisk(0.3)).toBe("0.30");
    expect(formatRisk(undefined)).toBe("Not reported");
  });
});
