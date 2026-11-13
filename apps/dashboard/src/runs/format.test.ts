import { describe, expect, it } from "vitest";
import { formatTime, formatTimestamp, shortHash } from "~/runs/format";

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
