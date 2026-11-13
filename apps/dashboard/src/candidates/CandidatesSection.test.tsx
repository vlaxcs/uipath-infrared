import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CandidatesSection } from "~/candidates/CandidatesSection";
import { emptyResult, unknownVocabularyResult } from "~/candidates/fixtures";
import { exampleResult, nothingFeasibleResult, sampleResult } from "~/candidates/sampleResult";

afterEach(cleanup);

describe("the candidates view", () => {
  it("renders the real engine result and selects the winner", () => {
    render(<CandidatesSection result={sampleResult} />);

    const list = screen.getByRole("list", { name: "Candidates" });
    expect(within(list).getAllByRole("button")).toHaveLength(5);

    const detail = screen.getByRole("region", { name: "agent-serverless-db-eu" });
    expect(detail.textContent).toContain("Winner");
    expect(detail.textContent).toContain("Agent");
    expect(detail.textContent).toContain("Expected total");
    expect(detail.textContent).toContain("The change, step by step");
    expect(detail.textContent).toContain("Security remediation");
    expect(detail.textContent).toContain("Step 1");
  });

  it("switches to a loser and explains why it lost", () => {
    render(<CandidatesSection result={sampleResult} />);
    const list = screen.getByRole("list", { name: "Candidates" });
    fireEvent.click(within(list).getByRole("button", { name: /managed_services/ }));

    const detail = screen.getByRole("region", { name: "managed_services" });
    expect(detail.textContent).toContain("Why it lost");
    expect(detail.textContent).toContain("Cost");
    expect(detail.textContent).toContain("more expected over the horizon");
    expect(detail.textContent).not.toContain("The change, step by step");
  });

  it("shows the on-prem and security cost blocks from the contract example", () => {
    render(<CandidatesSection result={exampleResult} />);
    const list = screen.getByRole("list", { name: "Candidates" });
    fireEvent.click(within(list).getByRole("button", { name: /move_to_onprem/ }));

    const detail = screen.getByRole("region", { name: "move_to_onprem" });
    expect(detail.textContent).toContain("On-prem platform");
    expect(detail.textContent).toContain("onprem-dc1");
    expect(detail.textContent).toContain("Security remediation");
  });

  it("renders the nothing-feasible state and defaults to the closest plan", () => {
    render(<CandidatesSection result={nothingFeasibleResult} />);

    expect(screen.getByRole("heading", { name: "No feasible candidate" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "move_to_onprem" })).toBeTruthy();
    const blockers = screen.getByRole("list", { name: "Blocking constraints" });
    expect(blockers.textContent).toContain("Monthly budget");
  });

  it("survives unknown vocabulary and an empty result", () => {
    render(<CandidatesSection result={unknownVocabularyResult} />);
    expect(screen.getAllByText(/Brand new flag/).length).toBeGreaterThan(0);

    cleanup();
    render(<CandidatesSection result={emptyResult} />);
    expect(screen.getByText("No candidates")).toBeTruthy();
  });
});
