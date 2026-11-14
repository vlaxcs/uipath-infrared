import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { StartRunPanel } from "~/runs/StartRunPanel";

afterEach(cleanup);

describe("the start run panel", () => {
  it("is hidden in sample mode", () => {
    const { container } = render(
      <StartRunPanel
        mode="sample"
        activeRun={null}
        busy={false}
        error={null}
        onStart={() => {}}
        onFollow={() => {}}
      />,
    );

    expect(container.textContent).toBe("");
  });

  it("starts a run on the startup project", () => {
    const onStart = vi.fn();
    render(
      <StartRunPanel
        mode="live"
        activeRun={null}
        busy={false}
        error={null}
        onStart={onStart}
        onFollow={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start run" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows the start error and the busy state", () => {
    render(
      <StartRunPanel
        mode="live"
        activeRun={null}
        busy
        error="orchestrator is offline"
        onStart={() => {}}
        onFollow={() => {}}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("orchestrator is offline");
    const start = screen.getByRole("button", { name: "Starting…" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  it("can return to an active run", () => {
    const onFollow = vi.fn();
    render(
      <StartRunPanel
        mode="live"
        activeRun={cutSampleRun(14)}
        busy={false}
        error={null}
        onStart={() => {}}
        onFollow={onFollow}
      />,
    );

    expect(screen.getByText(/demo-shop is awaiting_approval/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Follow active run" }));
    expect(onFollow).toHaveBeenCalledTimes(1);
  });
});
