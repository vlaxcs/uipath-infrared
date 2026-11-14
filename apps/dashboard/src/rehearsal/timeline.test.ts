import { describe, expect, it } from "vitest";
import { makePhase, makeRehearsal, missingMetricsRehearsal } from "~/rehearsal/fixtures";
import { failedRehearsal, sampleRehearsal } from "~/rehearsal/sampleRehearsal";
import { buildTimeline } from "~/rehearsal/timeline";

describe("the rehearsal timeline", () => {
  it("lays the contract sample out in three phases", () => {
    const timeline = buildTimeline(sampleRehearsal);
    expect(timeline.phases.map((phase) => phase.window)).toEqual([
      "0 s – 30 s",
      "30 s – 50 s",
      "50 s – 90 s",
    ]);
    expect(timeline.failureWindow).toBe("30 s – 50 s");
    expect(timeline.measuredPhases).toBe(3);
    expect(timeline.phases.map((phase) => phase.availability.value)).toEqual([
      "100%",
      "99.5%",
      "100%",
    ]);
    expect(timeline.phases[1].requests).toBe("200 total · 199 succeeded · 1 failed");
  });

  it("uses the real sandbox's decimal durations", () => {
    const timeline = buildTimeline(failedRehearsal);
    expect(timeline.phases.map((phase) => phase.window)).toEqual([
      "0 s – 15.01 s",
      "15.01 s – 63.13 s",
      "63.13 s – 78.13 s",
    ]);
    expect(timeline.failureWindow).toBe("15.02 s – 63.15 s");
    expect(timeline.phases[2].availability.value).toBe("50.667%");
  });

  it("reports missing metrics without inventing values", () => {
    const timeline = buildTimeline(missingMetricsRehearsal);
    expect(timeline.measuredPhases).toBe(0);
    for (const phase of timeline.phases) {
      expect(phase.availability.value).toBe("Not measured");
      expect(phase.requests).toBe("Not recorded");
      expect(phase.requestsMeasured).toBe(false);
    }
  });

  it("clamps malformed durations for offsets but labels them", () => {
    const timeline = buildTimeline(
      makeRehearsal({
        phases: {
          baseline: { duration_s: -5, availability_pct: makePhase().availability_pct },
          failure: { duration_s: 10 },
          recovery: { duration_s: 10 },
        },
      }),
    );
    expect(timeline.phases[0].duration).toBe("Not recorded");
    expect(timeline.phases[0].window).toBe("0 s – 0 s");
    expect(timeline.phases[1].window).toBe("0 s – 10 s");
  });
});
