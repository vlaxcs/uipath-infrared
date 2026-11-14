import { describe, expect, it } from "vitest";
import { runnerReport } from "~/domain/runnerSuggestions";

describe("runner suggestions", () => {
  it("suggests GitHub-hosted for barely used self-hosted runners", () => {
    const report = runnerReport({
      source_repo: "vlaxcs/uipath-infrared",
      runners: [
        { runner_type: "self-hosted", hours_month: 3, workflow_runs: 8, provenance: "estimated" },
      ],
    });

    expect(report.sourceRepo).toBe("vlaxcs/uipath-infrared");
    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toMatchObject({
      title: "Move this workload to GitHub-hosted runners",
      runnerType: "self-hosted",
      hours: 3,
      workflows: 8,
    });
    expect(report.note).toBeUndefined();
  });

  it("suggests self-hosted for heavy Linux hosted use", () => {
    const report = runnerReport({
      runners: [{ runner_type: "ubuntu-latest", hours_month: 160, workflow_runs: 80 }],
    });

    expect(report.suggestions[0].title).toBe("Consider self-hosted or on-prem runners");
  });

  it("flags metered macOS and Windows runners", () => {
    const report = runnerReport({
      runners: [
        { runner_type: "macos-14", hours_month: 80, workflow_runs: 20 },
        { runner_type: "windows-2022", hours_month: 90, workflow_runs: 25 },
      ],
    });

    expect(report.suggestions.map((suggestion) => suggestion.title)).toEqual([
      "Check this metered runner type",
      "Check this metered runner type",
    ]);
  });

  it("aggregates duplicate runner types before deciding", () => {
    const report = runnerReport({
      runners: [
        { runner_type: "self-hosted", hours_month: 5, workflow_runs: 3 },
        { runner_type: "self-hosted", hours_month: 5, workflow_runs: 4 },
      ],
    });

    expect(report.runners).toEqual([{ runnerType: "self-hosted", hours: 10, workflows: 7 }]);
    expect(report.suggestions[0].hours).toBe(10);
  });

  it("leaves a runner type alone when the threshold is not crossed", () => {
    expect(
      runnerReport({ runners: [{ runner_type: "self-hosted", hours_month: 21 }] }).suggestions,
    ).toEqual([]);
    expect(
      runnerReport({ runners: [{ runner_type: "ubuntu-latest", hours_month: 159 }] }).suggestions,
    ).toEqual([]);
    expect(
      runnerReport({
        runners: [
          { runner_type: "self-hosted", hours_month: 21 },
          { runner_type: "ubuntu-latest", hours_month: 159 },
        ],
      }).note,
    ).toBe("No runner change is suggested by the current usage.");
  });

  it("never suggests anything for zero hours", () => {
    const report = runnerReport({ runners: [{ runner_type: "self-hosted", hours_month: 0 }] });
    expect(report.suggestions).toEqual([]);
  });

  it("asks for the extractor when the runner type is unknown", () => {
    const report = runnerReport({ runners: [{ runner_type: "unknown", hours_month: 4 }] });
    expect(report.suggestions[0].title).toBe("Runner type is unknown");
  });

  it("caps suggestions at three, heaviest first", () => {
    const report = runnerReport({
      runners: [
        { runner_type: "self-hosted", hours_month: 5 },
        { runner_type: "ubuntu-latest", hours_month: 200 },
        { runner_type: "macos-14", hours_month: 100 },
        { runner_type: "windows-2022", hours_month: 90 },
        { runner_type: "unknown", hours_month: 1 },
      ],
    });

    expect(report.suggestions).toHaveLength(3);
    expect(report.suggestions.map((suggestion) => suggestion.hours)).toEqual([200, 100, 90]);
  });

  it("does not invent savings", () => {
    const report = runnerReport({
      runners: [{ runner_type: "self-hosted", hours_month: 3 }],
    });
    expect(report.suggestions[0].detail).not.toContain("€");
    expect(report.suggestions[0].detail.toLowerCase()).not.toContain("save");
  });

  it("handles missing, null and empty runner data", () => {
    for (const value of [undefined, null, {}, { runners: [] }, { runners: null }]) {
      expect(runnerReport(value)).toMatchObject({
        runners: [],
        suggestions: [],
        note: "No GitHub Actions runner data in this run.",
      });
    }
  });
});
