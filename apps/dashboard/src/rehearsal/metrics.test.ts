import { describe, expect, it } from "vitest";
import { makeMetric, makePhase } from "~/rehearsal/fixtures";
import { metricCell, requestsCell } from "~/rehearsal/metrics";

describe("rehearsal metric cells", () => {
  it("keeps a zero as measured and carries provenance", () => {
    const cell = metricCell(makeMetric(0), "percent");
    expect(cell.value).toBe("0%");
    expect(cell.measured).toBe(true);
    expect(cell.provenance).toBe("Synthetic");
    expect(cell.basis).toBe("test probe");
  });

  it("reports missing and malformed metrics as not measured", () => {
    expect(metricCell(undefined, "percent")).toEqual({
      value: "Not measured",
      measured: false,
      provenance: null,
      basis: null,
    });
    expect(metricCell({ value: Number.NaN, provenance: "synthetic" }, "percent").measured).toBe(
      false,
    );
  });

  it("joins the request counts that exist", () => {
    expect(requestsCell(makePhase())).toEqual({
      value: "100 total · 100 succeeded · 0 failed",
      measured: true,
    });
    expect(requestsCell({ duration_s: 10, requests_total: 10 })).toEqual({
      value: "10 total",
      measured: true,
    });
    expect(requestsCell({ duration_s: 10 })).toEqual({
      value: "Not recorded",
      measured: false,
    });
  });
});
