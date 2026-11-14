import { describe, expect, it } from "vitest";
import {
  makeComponent,
  makeRehearsal,
  minimalRehearsal,
  unsupportedSchemaRehearsal,
  unknownVocabularyRehearsal,
} from "~/rehearsal/fixtures";
import { buildRehearsalModel } from "~/rehearsal/model";
import { failedRehearsal, sampleRehearsal } from "~/rehearsal/sampleRehearsal";

describe("the rehearsal view model", () => {
  it("summarises the passed contract sample", () => {
    const model = buildRehearsalModel(sampleRehearsal);
    expect(model.context.candidateId).toBe("rightsize_in_place");
    expect(model.context.forecastId).toBe("demo-shop-2027-plan");
    expect(model.context.schemaSupported).toBe(true);
    expect(model.context.startedAt).toBe("13 Nov 2026, 10:30 UTC");
    expect(model.context.elapsed).toBe("90 s");
    expect(model.context.elapsedDerived).toBe(false);
    expect(model.context.provenance).toBe("Synthetic measurements");

    expect(model.traffic.pattern).toBe("Constant");
    expect(model.traffic.patternKey).toBe("constant");
    expect(model.traffic.duration).toBe("90 s");
    expect(model.traffic.rate).toBe("10 req/s");
    expect(model.traffic.endpoints).toHaveLength(1);
    expect(model.traffic.totalRequests).toBe("900");

    expect(model.failure.injected).toBe(true);
    expect(model.failure.type).toBe("Instance stop");
    expect(model.failure.target).toBe("vm-shop-web-1");
    expect(model.failure.headline).toBe("Instance stop on vm-shop-web-1");

    expect(model.components.map((component) => component.id)).toEqual([
      "vm-shop-web-1",
      "alb-shop",
      "vm-shop-web-2",
      "rds-orders",
    ]);
    expect(model.componentCounts).toEqual({
      total: 4,
      healthy: 3,
      degraded: 0,
      failed: 1,
      unknown: 0,
    });

    expect(model.fallback.verdictLabel).toBe("Held");
    expect(model.caveats).toEqual([]);
    expect(model.infrastructure?.vpcId).toBe("vpc-sandbox-001");
    expect(model.infrastructure?.teardownLabel).toBe("Teardown succeeded");
    expect(model.extras).toEqual({ skipped: [], notBuilt: [], built: [] });
  });

  it("summarises the real sandbox output and its extensions", () => {
    const model = buildRehearsalModel(failedRehearsal);
    expect(model.context.provenance).toBe("Synthetic measurements");
    expect(model.traffic.endpoints).toHaveLength(2);
    expect(model.traffic.endpoints[0]).toContain("10.100.1.11");
    expect(model.traffic.endpoints[1]).toContain("10.100.2.10");
    expect(model.failure.target).toBe("web-server");
    expect(model.components).toHaveLength(8);
    expect(model.components[0].id).toBe("web-server");
    expect(model.componentCounts).toMatchObject({ total: 8, healthy: 7, degraded: 1, failed: 0 });
    expect(model.caveats).toHaveLength(11);
    expect(model.extras.built).toHaveLength(8);
    expect(model.extras.skipped).toHaveLength(1);
    expect(model.extras.notBuilt).toHaveLength(2);
    expect(model.infrastructure?.readiness).toBe("Ready in 54.3 s");
    expect(model.verdict.decision.label).toBe("Revise");
    expect(model.verdict.decision.source).toBe("recorded");
  });

  it("derives the elapsed time when the file omits it", () => {
    const model = buildRehearsalModel(minimalRehearsal);
    expect(model.context.elapsed).toBe("15 s");
    expect(model.context.elapsedDerived).toBe(true);
    expect(model.components).toEqual([]);
    expect(model.caveats).toEqual([]);
    expect(model.infrastructure).toBeNull();
    expect(model.fallback.verdictLabel).toBe("Not evidenced");
  });

  it("warns on an unsupported schema but still builds the model", () => {
    const model = buildRehearsalModel(unsupportedSchemaRehearsal);
    expect(model.context.schemaSupported).toBe(false);
    expect(model.context.schemaVersion).toBe("2.0");
    expect(model.components).toHaveLength(3);
  });

  it("humanises unknown vocabulary and counts unknown statuses", () => {
    const model = buildRehearsalModel(unknownVocabularyRehearsal);
    expect(model.traffic.pattern).toBe("Wobble");
    expect(model.failure.type).toBe("Meteor");
    expect(model.components[0].statusLabel).toBe("On fire");
    expect(model.components[0].statusTone).toBe("neutral");
    expect(model.componentCounts.unknown).toBe(1);
    expect(model.verdict.decision.label).toBe("Rethink");
    expect(model.caveats).toEqual(["Synthetic values"]);
  });

  it("orders components with the failure target and load balancer first", () => {
    const model = buildRehearsalModel(
      makeRehearsal({
        failure: { ...makeRehearsal().failure, target_component: "target" },
        component_results: [
          makeComponent({ component_id: "healthy-a", kind: "postgres" }),
          makeComponent({ component_id: "lb", kind: "load_balancer" }),
          makeComponent({ component_id: "target", status: "failed" }),
          makeComponent({ component_id: "healthy-b", kind: "cache" }),
        ],
      }),
    );
    expect(model.components.map((component) => component.id)).toEqual([
      "target",
      "lb",
      "healthy-a",
      "healthy-b",
    ]);
  });
});
