import { describe, expect, it } from "vitest";
import { DEFAULT_TRAFFIC, readTrafficPrompt } from "~/sandbox/trafficPrompt";

describe("reading a traffic prompt", () => {
  it.each([
    ["200 rps for 30 seconds", { requests_per_second: 200, phase_seconds: 30 }],
    ["50 requests per second, 1 minute per phase", { requests_per_second: 50, phase_seconds: 60 }],
    ["run 80 req/s", { requests_per_second: 80, phase_seconds: 15 }],
    ["double the traffic", { requests_per_second: 20, phase_seconds: 15 }],
    ["3x load for 45 s", { requests_per_second: 30, phase_seconds: 45 }],
  ])("reads %j", (text, profile) => {
    expect(readTrafficPrompt(text, DEFAULT_TRAFFIC).profile).toEqual(profile);
  });

  it("keeps the rate and the phase within what the sandbox accepts", () => {
    expect(readTrafficPrompt("5000 rps for 10 minutes", DEFAULT_TRAFFIC).profile).toEqual({ requests_per_second: 200, phase_seconds: 120 });
    expect(readTrafficPrompt("0 rps for 1 s", DEFAULT_TRAFFIC).profile).toEqual({ requests_per_second: 1, phase_seconds: 5 });
  });

  it("says what it understood, and when it understood nothing", () => {
    expect(readTrafficPrompt("200 rps for 30 seconds", DEFAULT_TRAFFIC).understood).toEqual(["200 requests/s", "30 s per phase"]);
    const nothing = readTrafficPrompt("make it spicy", DEFAULT_TRAFFIC);
    expect(nothing.unread).toBe(true);
    expect(nothing.profile).toEqual(DEFAULT_TRAFFIC);
  });
});
