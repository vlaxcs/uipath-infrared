import { describe, expect, it } from "vitest";
import { readRoute, routeHash } from "~/navigation/route";

describe("reading a hash route", () => {
  it("defaults to the runs list", () => {
    expect(readRoute("")).toEqual({ section: "runs", runId: null, focusGate: false });
    expect(readRoute("#")).toEqual({ section: "runs", runId: null, focusGate: false });
    expect(readRoute("#/runs")).toEqual({ section: "runs", runId: null, focusGate: false });
  });

  it("reads a run page", () => {
    expect(readRoute("#/runs/run-demo-shop-0001")).toEqual({
      section: "runs",
      runId: "run-demo-shop-0001",
      focusGate: false,
    });
  });

  it("reads a run page focused on its gate", () => {
    expect(readRoute("#/runs/run-demo-shop-0001/gate")).toEqual({
      section: "runs",
      runId: "run-demo-shop-0001",
      focusGate: true,
    });
  });

  it("decodes a run id and keeps it on the runs section", () => {
    expect(readRoute("#/runs/run%2F1")).toEqual({ section: "runs", runId: "run/1", focusGate: false });
    expect(readRoute("#/runs/%E0%A4%A")).toEqual({ section: "runs", runId: null, focusGate: false });
  });

  it("reads the other sections", () => {
    expect(readRoute("#/graph")).toEqual({ section: "graph", runId: null, focusGate: false });
    expect(readRoute("#/approvals")).toEqual({ section: "approvals", runId: null, focusGate: false });
  });

  it("falls back to runs for an unknown section", () => {
    expect(readRoute("#/nope")).toEqual({ section: "runs", runId: null, focusGate: false });
    expect(readRoute("#/nope/run-1")).toEqual({ section: "runs", runId: null, focusGate: false });
  });
});

describe("writing a hash route", () => {
  it("round-trips a run page", () => {
    const route = { section: "runs" as const, runId: "run-demo-shop-0001", focusGate: false };
    expect(routeHash(route)).toBe("#/runs/run-demo-shop-0001");
    expect(readRoute(routeHash(route))).toEqual(route);
  });

  it("round-trips a gate focus", () => {
    const route = { section: "runs" as const, runId: "run-demo-shop-0001", focusGate: true };
    expect(routeHash(route)).toBe("#/runs/run-demo-shop-0001/gate");
    expect(readRoute(routeHash(route))).toEqual(route);
  });

  it("writes a section without a run", () => {
    expect(routeHash({ section: "graph", runId: null, focusGate: false })).toBe("#/graph");
    expect(routeHash({ section: "approvals", runId: null, focusGate: false })).toBe("#/approvals");
  });

  it("encodes a run id", () => {
    expect(routeHash({ section: "runs", runId: "run/1", focusGate: false })).toBe("#/runs/run%2F1");
  });

  it("ignores a focus flag without a run", () => {
    expect(routeHash({ section: "runs", runId: null, focusGate: true })).toBe("#/runs");
  });
});
