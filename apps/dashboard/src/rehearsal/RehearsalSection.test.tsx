import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  minimalRehearsal,
  missingMetricsRehearsal,
  noFailureRehearsal,
  unsupportedSchemaRehearsal,
  unknownVocabularyRehearsal,
} from "~/rehearsal/fixtures";
import { RehearsalSection } from "~/rehearsal/RehearsalSection";
import { failedRehearsal, sampleRehearsal } from "~/rehearsal/sampleRehearsal";

afterEach(cleanup);

describe("the rehearsal view", () => {
  it("renders the passed contract sample with a held fallback", () => {
    render(<RehearsalSection rehearsal={sampleRehearsal} />);

    const verdict = screen.getByRole("region", { name: "Verdict" });
    expect(verdict.textContent).toContain("Passed");
    expect(verdict.textContent).toContain("99.94%");
    expect(verdict.textContent).toContain("99.9%");
    expect(verdict.textContent).toContain("+0.04 pp");
    expect(verdict.textContent).toContain("Proceed");
    expect(verdict.textContent).toContain("Derived from the verdict");

    const traffic = screen.getByRole("region", { name: "Traffic profile" });
    expect(traffic.textContent).toContain("Constant");
    expect(traffic.textContent).toContain("10 req/s");
    expect(traffic.textContent).toContain("900");

    const failure = screen.getByRole("region", { name: "Failure injected" });
    expect(failure.textContent).toContain("vm-shop-web-1");
    expect(failure.textContent).toContain("20 s");

    const phases = screen.getByRole("list", { name: "Rehearsal phases" });
    expect(within(phases).getAllByRole("listitem")).toHaveLength(3);
    expect(phases.textContent).toContain("Before the failure");
    expect(phases.textContent).toContain("During the failure");
    expect(phases.textContent).toContain("After recovery");
    expect(phases.textContent).toContain("99.5%");

    const table = screen.getByRole("table", { name: "Component health" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(table.textContent).toContain("Load balancer");
    expect(table.textContent).toContain("Failure target");

    const fallback = screen.getByRole("region", { name: "The fallback" });
    expect(fallback.textContent).toContain("Held");
    expect(fallback.textContent).toContain(
      "The load balancer routed traffic around the failed instance.",
    );
    expect(screen.queryByRole("region", { name: "Measurement notes and caveats" })).toBeNull();
  });

  it("renders the failed sandbox output with its notes and extras", () => {
    render(<RehearsalSection rehearsal={failedRehearsal} />);

    const verdict = screen.getByRole("region", { name: "Verdict" });
    expect(verdict.textContent).toContain("Failed");
    expect(verdict.textContent).toContain("85.312%");
    expect(verdict.textContent).toContain("-14.188 pp");
    expect(verdict.textContent).toContain("Revise");
    expect(verdict.textContent).toContain("Recorded in x_decision");

    const endpoints = screen.getByRole("list", { name: "Traffic endpoints" });
    expect(within(endpoints).getAllByRole("listitem")).toHaveLength(2);

    const table = screen.getByRole("table", { name: "Component health" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(8);

    const fallback = screen.getByRole("region", { name: "The fallback" });
    expect(fallback.textContent).toContain("Missed");
    expect(fallback.textContent).toContain("No load balancer");
    expect(fallback.textContent).toContain("round-robin");

    expect(
      screen.getByRole("region", { name: "Measurement notes and caveats" }).textContent,
    ).toContain("synthetic");
    expect(
      screen.getByRole("region", { name: "Infrastructure and teardown" }).textContent,
    ).toContain("Ready in 54.3 s");
    expect(
      screen.getByRole("region", { name: "Rehearsal extras" }).textContent,
    ).toContain("Built resources (8)");
  });

  it("shows not measured when the file has no metrics", () => {
    render(<RehearsalSection rehearsal={missingMetricsRehearsal} />);
    expect(screen.getByRole("region", { name: "Verdict" }).textContent).toContain("Passed");
    expect(screen.getAllByText("Not measured").length).toBeGreaterThan(0);
    expect(screen.getByText("No component results were recorded.")).toBeTruthy();
  });

  it("reports a rehearsal with no failure", () => {
    render(<RehearsalSection rehearsal={noFailureRehearsal} />);
    expect(screen.getByText("No failure was injected in this rehearsal, so the fallback was not exercised.")).toBeTruthy();
    const fallback = screen.getByRole("region", { name: "The fallback" });
    expect(fallback.textContent).toContain("Not evidenced");
    expect(fallback.textContent).toContain("No failure was injected in this rehearsal.");
  });

  it("renders a minimal rehearsal without optional sections", () => {
    render(<RehearsalSection rehearsal={minimalRehearsal} />);
    expect(screen.getByText("No component results were recorded.")).toBeTruthy();
    expect(screen.getByText("Not enough evidence to describe the fallback.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Measurement notes and caveats" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Infrastructure and teardown" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Rehearsal extras" })).toBeNull();
  });

  it("humanises unknown vocabulary and warns on a future schema", () => {
    render(<RehearsalSection rehearsal={unknownVocabularyRehearsal} />);
    expect(screen.getByRole("region", { name: "Traffic profile" }).textContent).toContain("Wobble");
    expect(screen.getByRole("table", { name: "Component health" }).textContent).toContain("On fire");
    expect(screen.getByRole("region", { name: "Verdict" }).textContent).toContain("Rethink");

    cleanup();
    render(<RehearsalSection rehearsal={unsupportedSchemaRehearsal} />);
    expect(screen.getByText(/schema this view does not know/)).toBeTruthy();
    expect(screen.getByText("Schema 2.0")).toBeTruthy();
  });
});
