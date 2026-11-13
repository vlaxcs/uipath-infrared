import { describe, expect, it } from "vitest";
import { formatTimestamp } from "~/runs/format";

describe("formatting a timestamp", () => {
  it("uses UTC so the output does not depend on the machine", () => {
    expect(formatTimestamp("2026-11-14T09:00:00Z")).toBe("14 Nov 2026, 09:00");
  });
});
