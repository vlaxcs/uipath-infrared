import { describe, expect, it } from "vitest";
import runExample from "../../../../contracts/run.example.json";
import { latestArtifactPaths, pickedLayout } from "~/domain/facts";
import type { RunDetail, RunEvent } from "~/domain/types";

const detail = runExample as unknown as RunDetail;
const events = detail.events as RunEvent[];

describe("run facts", () => {
  it("takes the latest result and infra paths from the event log", () => {
    expect(latestArtifactPaths(events)).toEqual({ result: "result.1.json", infra: "infra.json" });
  });

  it("ignores events without an output", () => {
    expect(
      latestArtifactPaths([
        { ...events[0], seq: 1 },
        { ...events[1], seq: 2, output: { contract: "result", file: { path: "result.0.json", sha256: "" } } },
      ]),
    ).toEqual({ result: "result.0.json", infra: null });
  });

  it("finds the layout the person picked", () => {
    expect(pickedLayout(events)).toBe("managed_services");
    expect(pickedLayout([])).toBeNull();
  });
});
