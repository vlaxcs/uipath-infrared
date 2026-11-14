import { describe, expect, it } from "vitest";
import { readRoute, routeHash } from "~/navigation/route";

describe("reading a hash route", () => {
  it("opens home without a hash", () => {
    expect(readRoute("")).toEqual({ page: "home", runId: null, focusGate: false });
    expect(readRoute("#/")).toEqual({ page: "home", runId: null, focusGate: false });
  });

  it("reads every page", () => {
    for (const page of ["analyze", "runs", "configuration", "account", "login"] as const) {
      expect(readRoute(`#/${page}`)).toEqual({ page, runId: null, focusGate: false });
    }
  });

  it("reads a run page and its gate", () => {
    expect(readRoute("#/runs/run-startup-0002")).toEqual({ page: "runs", runId: "run-startup-0002", focusGate: false });
    expect(readRoute("#/runs/run-startup-0002/gate")).toEqual({ page: "runs", runId: "run-startup-0002", focusGate: true });
  });

  it("decodes a run id and refuses a broken one", () => {
    expect(readRoute("#/runs/run%2F1").runId).toBe("run/1");
    expect(readRoute("#/runs/%E0%A4%A").runId).toBeNull();
  });

  it("keeps a run id only on the runs page", () => {
    expect(readRoute("#/account/run-1")).toEqual({ page: "account", runId: null, focusGate: false });
  });

  it("falls back to home for an unknown page, including the old sections", () => {
    for (const hash of ["#/nope", "#/graph", "#/candidates/run-1", "#/approvals"]) {
      expect(readRoute(hash)).toEqual({ page: "home", runId: null, focusGate: false });
    }
  });
});

describe("writing a hash route", () => {
  it("writes home as the root", () => {
    expect(routeHash({ page: "home", runId: null, focusGate: false })).toBe("#/");
  });

  it("round-trips a run and its gate", () => {
    for (const route of [
      { page: "runs" as const, runId: "run-demo-shop-0001", focusGate: false },
      { page: "runs" as const, runId: "run-demo-shop-0001", focusGate: true },
      { page: "analyze" as const, runId: null, focusGate: false },
    ]) {
      expect(readRoute(routeHash(route))).toEqual(route);
    }
  });

  it("encodes a run id", () => {
    expect(routeHash({ page: "runs", runId: "run/1", focusGate: false })).toBe("#/runs/run%2F1");
  });
});
