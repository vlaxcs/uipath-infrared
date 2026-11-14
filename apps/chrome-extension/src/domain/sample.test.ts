import { describe, expect, it } from "vitest";
import { sampleLatestRun } from "~/domain/sample";

describe("the sample latest run", () => {
  it("describes the demo run, its prices and the sample runner suggestions", () => {
    const run = sampleLatestRun();

    expect(run).toMatchObject({
      source: "sample",
      id: "run-demo-shop-0001",
      project: "demo-shop",
      status: "completed",
      step: "rehearse",
      revision: 1,
      maxRevisions: 2,
      before: 133308,
      after: 74365,
      winner: "consolidate",
      pickedLayout: "managed_services",
      runnerSourceRepo: "vlaxcs/uipath-infrared",
    });
    expect(run.runners).toHaveLength(2);
    expect(run.note).toContain("sample data");
    expect(run.steps.every((entry) => entry.state === "done")).toBe(true);
  });
});
