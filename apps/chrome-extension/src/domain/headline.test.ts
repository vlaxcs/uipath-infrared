import { describe, expect, it } from "vitest";
import { headlineOf, primaryActionOf } from "~/domain/headline";

describe("the card headline", () => {
  it("leads with the monthly saving and its share of today's cost", () => {
    expect(headlineOf({ before: 3269, after: 1773 })).toEqual({
      kind: "saving",
      amount: 1496,
      percent: 46,
      before: 3269,
      after: 1773,
    });
  });

  it("says there is no saving when the winner costs the same or more", () => {
    expect(headlineOf({ before: 1000, after: 1000 }).kind).toBe("no-saving");
    expect(headlineOf({ before: 1000, after: 1200 }).kind).toBe("no-saving");
  });

  it("shows today's cost while the run has no winner yet", () => {
    expect(headlineOf({ before: 3269, after: null })).toEqual({ kind: "current", before: 3269 });
  });

  it("is unpriced until the current estate has a price", () => {
    expect(headlineOf({ before: null, after: null }).kind).toBe("unpriced");
    expect(headlineOf({ before: null, after: 900 }).kind).toBe("unpriced");
  });
});

describe("the card's one action", () => {
  it("asks for the decision the run is waiting on", () => {
    expect(primaryActionOf({ status: "awaiting_approval", awaiting: "layout" })).toEqual({
      label: "Review layout",
      emphasis: "primary",
    });
    expect(primaryActionOf({ status: "awaiting_approval", awaiting: "plan" }).label).toBe("Review plan");
  });

  it("points at the failure when the run failed", () => {
    expect(primaryActionOf({ status: "failed" }).label).toBe("See what failed");
  });

  it("opens the dashboard otherwise", () => {
    expect(primaryActionOf({ status: "running" })).toEqual({ label: "Open dashboard", emphasis: "secondary" });
    expect(primaryActionOf({ status: "completed" }).label).toBe("Open dashboard");
  });
});
