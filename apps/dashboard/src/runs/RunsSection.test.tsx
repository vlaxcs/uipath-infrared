import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Run } from "~/runs/types";
import { RunsSection } from "~/runs/RunsSection";
import { sampleRuns } from "~/runs/sampleRun";

afterEach(cleanup);

const secondRun: Run = {
  ...sampleRuns[0],
  id: "run-demo-shop-0002",
  project: "checkout",
  status: "failed",
};

function Harness({ runs }: { runs: readonly Run[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <RunsSection runs={runs} selectedRunId={selected} onSelectRun={setSelected} />;
}

describe("the runs section", () => {
  it("says when there are no runs", () => {
    render(<RunsSection runs={[]} selectedRunId={null} onSelectRun={() => {}} />);
    expect(screen.getByText("No runs yet")).toBeTruthy();
  });

  it("asks for a selection when runs exist", () => {
    render(<Harness runs={sampleRuns} />);
    expect(screen.getByText("Select a run")).toBeTruthy();
  });

  it("switches the summary between runs", () => {
    render(<Harness runs={[sampleRuns[0], secondRun]} />);

    fireEvent.click(screen.getByRole("button", { name: /run-demo-shop-0002/ }));
    expect(screen.getByRole("region", { name: "checkout" }).textContent).toContain("Failed");

    fireEvent.click(screen.getByRole("button", { name: /run-demo-shop-0001/ }));
    expect(screen.getByRole("region", { name: "demo-shop" }).textContent).toContain("Completed");
  });
});
