import { describe, expect, it } from "vitest";
import { readRoute, routeHash } from "~/navigation/route";

describe("reading a hash route", () => {
  it("defaults to the runs list", () => {
    expect(readRoute("")).toEqual({ section: "runs", runId: null });
    expect(readRoute("#")).toEqual({ section: "runs", runId: null });
    expect(readRoute("#/runs")).toEqual({ section: "runs", runId: null });
  });

  it("reads a run page", () => {
    expect(readRoute("#/runs/run-demo-shop-0001")).toEqual({
      section: "runs",
      runId: "run-demo-shop-0001",
    });
  });

  it("decodes a run id and keeps it on the runs section", () => {
    expect(readRoute("#/runs/run%2F1")).toEqual({ section: "runs", runId: "run/1" });
    expect(readRoute("#/runs/%E0%A4%A")).toEqual({ section: "runs", runId: null });
  });

  it("reads the other sections", () => {
    expect(readRoute("#/graph")).toEqual({ section: "graph", runId: null });
    expect(readRoute("#/candidates")).toEqual({ section: "candidates", runId: null });
  });

  it("falls back to runs for an unknown section", () => {
    expect(readRoute("#/nope")).toEqual({ section: "runs", runId: null });
    expect(readRoute("#/nope/run-1")).toEqual({ section: "runs", runId: null });
  });
});

describe("writing a hash route", () => {
  it("round-trips a run page", () => {
    const route = { section: "runs" as const, runId: "run-demo-shop-0001" };
    expect(routeHash(route)).toBe("#/runs/run-demo-shop-0001");
    expect(readRoute(routeHash(route))).toEqual(route);
  });

  it("writes a section without a run", () => {
    expect(routeHash({ section: "graph", runId: null })).toBe("#/graph");
  });

  it("encodes a run id", () => {
    expect(routeHash({ section: "runs", runId: "run/1" })).toBe("#/runs/run%2F1");
  });
});
