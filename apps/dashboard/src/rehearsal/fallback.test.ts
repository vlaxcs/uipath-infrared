import { describe, expect, it } from "vitest";
import {
  makeComponent,
  makeMetric,
  makePhase,
  makeRehearsal,
  minimalRehearsal,
  noFailureRehearsal,
} from "~/rehearsal/fixtures";
import { buildFallback } from "~/rehearsal/fallback";
import { failedRehearsal, sampleRehearsal } from "~/rehearsal/sampleRehearsal";

describe("the derived fallback", () => {
  it("describes the load balancer holding in the passed sample", () => {
    const fallback = buildFallback(sampleRehearsal);
    expect(fallback.verdictLabel).toBe("Held");
    expect(fallback.tone).toBe("completed");
    expect(fallback.headline).toBe(
      "The load balancer routed traffic around the failed instance.",
    );
    expect(fallback.evidence).toContain("vm-shop-web-1: failed, 0% availability.");
    expect(fallback.evidence).toContain("alb-shop: healthy, 100% availability.");
    expect(fallback.evidence).toContain("vm-shop-web-2 stayed healthy.");
    expect(fallback.evidence).toContain("Availability during the failure: 99.5%.");
    expect(fallback.caveat).toBeNull();
    expect(fallback.derivedLabel).toContain("Derived from component results");
  });

  it("explains the missing load balancer in the real sandbox output", () => {
    const fallback = buildFallback(failedRehearsal);
    expect(fallback.verdictLabel).toBe("Missed");
    expect(fallback.tone).toBe("failed");
    expect(fallback.headline).toBe(
      "No load balancer: the degraded instance kept receiving its share of traffic.",
    );
    expect(fallback.evidence).toContain("No load balancer appears among the 8 component results.");
    expect(fallback.evidence.some((item) => item.includes("round-robin"))).toBe(true);
  });

  it("refuses to describe a fallback when no failure was injected", () => {
    const fallback = buildFallback(noFailureRehearsal);
    expect(fallback.verdictLabel).toBe("Not evidenced");
    expect(fallback.tone).toBe("neutral");
    expect(fallback.headline).toBe("No failure was injected in this rehearsal.");
    expect(fallback.caveat).toContain("cannot be assessed without a failure");
  });

  it("says when the failure target is missing or stayed healthy", () => {
    const missing = buildFallback(makeRehearsal({ failure: { ...makeRehearsal().failure, target_component: "ghost" } }));
    expect(missing.headline).toBe("The failure target is not in the component results.");
    expect(missing.evidence[0]).toContain("does not appear");

    const healthy = buildFallback(
      makeRehearsal({
        component_results: [makeComponent({ component_id: "web-1", status: "healthy" })],
      }),
    );
    expect(healthy.headline).toBe("The failure target web-1 stayed healthy throughout.");
  });

  it("falls back to phase evidence when components are missing", () => {
    const fallback = buildFallback(
      makeRehearsal({
        component_results: [],
        phases: {
          baseline: makePhase({ availability_pct: makeMetric(100) }),
          failure: makePhase({ availability_pct: makeMetric(90) }),
          recovery: makePhase({ availability_pct: makeMetric(95) }),
        },
      }),
    );
    expect(fallback.headline).toBe(
      "Availability fell from 100% before the failure to 90% during it.",
    );
    expect(fallback.caveat).toContain("No component results were recorded");
  });

  it("reports insufficient evidence", () => {
    const fallback = buildFallback(minimalRehearsal);
    expect(fallback.verdictLabel).toBe("Not evidenced");
    expect(fallback.headline).toBe("Not enough evidence to describe the fallback.");
    expect(fallback.caveat).toContain("no component results and no measured availability");
  });
});
