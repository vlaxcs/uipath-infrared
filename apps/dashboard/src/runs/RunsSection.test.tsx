import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { failedRun } from "~/runs/fixtures";
import { sampleRun, sampleRuns } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunsSection } from "~/runs/RunsSection";
import type { RunDetail } from "~/runs/types";

afterEach(cleanup);

function Harness({ runs }: { runs: readonly RunDetail[] }) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  return (
    <RunsSection
      runs={runs}
      selectedRun={selectedRun}
      selectedRunId={selectedRunId}
      onSelectRun={setSelectedRunId}
      source={sampleRunSource}
    />
  );
}

describe("the runs section", () => {
  it("says when there are no runs", () => {
    render(
      <RunsSection
        runs={[]}
        selectedRun={null}
        selectedRunId={null}
        onSelectRun={() => {}}
        source={sampleRunSource}
      />,
    );
    expect(screen.getByText("No runs yet")).toBeTruthy();
  });

  it("asks for a selection when runs exist", () => {
    render(<Harness runs={sampleRuns} />);
    expect(screen.getByText("Select a run")).toBeTruthy();
  });

  it("switches the summary between runs", () => {
    render(<Harness runs={[sampleRun, failedRun]} />);

    fireEvent.click(screen.getByRole("button", { name: /run-demo-shop-0002/ }));
    expect(screen.getByRole("region", { name: "checkout" }).textContent).toContain("Failed");

    fireEvent.click(screen.getByRole("button", { name: /run-demo-shop-0001/ }));
    expect(screen.getByRole("region", { name: "demo-shop" }).textContent).toContain("Completed");
  });
});
