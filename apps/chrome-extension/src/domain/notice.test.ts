import { describe, expect, it } from "vitest";
import { NoRunsError, OrchestratorError } from "~/domain/api";
import { noAccessNotice, noticeFor } from "~/domain/notice";

describe("the notice shown instead of a run", () => {
  it("says there are no runs yet when the orchestrator has none", () => {
    expect(noticeFor(new NoRunsError())).toEqual({ kind: "no-runs", message: "No runs yet" });
  });

  it("says the orchestrator is unreachable on a network failure, keeping the cause", () => {
    expect(noticeFor(new TypeError("Failed to fetch"))).toEqual({
      kind: "unreachable",
      message: "Can't reach Infrared",
      detail: "Failed to fetch",
    });
  });

  it("treats an orchestrator error as unreachable", () => {
    expect(noticeFor(new OrchestratorError("the engine is down", 500)).kind).toBe("unreachable");
  });

  it("names the host it has no access to", () => {
    expect(noAccessNotice("https://infrared.example.com")).toMatchObject({
      kind: "no-access",
      detail: "No access to infrared.example.com. Open Settings to connect.",
    });
  });
});
