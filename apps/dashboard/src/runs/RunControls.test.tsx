import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import { RunControls } from "~/runs/RunControls";

afterEach(cleanup);

describe("the run controls", () => {
  it("toggles following an active run", () => {
    const onToggleFollowing = vi.fn();
    render(
      <RunControls
        run={cutSampleRun(14)}
        mode="live"
        following
        onToggleFollowing={onToggleFollowing}
      />,
    );

    const follow = screen.getByRole("button", { name: "Following live" });
    expect(follow.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(follow);
    expect(onToggleFollowing).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Run again" })).toBeNull();
  });

  it("offers a new run once the run finished", () => {
    const onStartAgain = vi.fn();
    render(
      <RunControls
        run={sampleRun}
        mode="live"
        following={false}
        onToggleFollowing={() => {}}
        onStartAgain={onStartAgain}
      />,
    );

    expect(screen.queryByRole("button", { name: "Follow live" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run again" }));
    expect(onStartAgain).toHaveBeenCalledTimes(1);
  });

  it("shows no live controls in sample mode", () => {
    render(<RunControls run={cutSampleRun(14)} mode="sample" following onToggleFollowing={() => {}} />);
    expect(screen.queryByRole("button", { name: "Following live" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run again" })).toBeNull();
  });
});
