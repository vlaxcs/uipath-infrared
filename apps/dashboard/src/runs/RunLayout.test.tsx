import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { RunView } from "~/runs/RunView";
import { sampleRun } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";

afterEach(cleanup);

describe("the run page layout", () => {
  it("puts the agent on the left: its steps in order, then the candidates once evaluate ran", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    const agent = screen.getByRole("complementary", { name: "Agent" });
    const steps = within(agent).getByRole("list", { name: "Steps" });
    const titles = ["Extract", "Investigate", "Propose", "Evaluate", "Present", "Rehearse"];
    const buttons = within(steps).getAllByRole("button");
    expect(buttons).toHaveLength(titles.length);
    buttons.forEach((button, index) => expect(button.textContent?.startsWith(titles[index])).toBe(true));
    const candidates = await within(agent).findByRole("list", { name: "Candidates" });
    expect(within(candidates).getByRole("button", { name: /^consolidate/ })).toBeTruthy();
  });

  it("loads a selected candidate's details on the right", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    const agent = screen.getByRole("complementary", { name: "Agent" });
    const candidates = await within(agent).findByRole("list", { name: "Candidates" });
    fireEvent.click(within(candidates).getByRole("button", { name: /^managed_services/ }));

    const details = screen.getByRole("region", { name: "Details" });
    expect(within(details).getByRole("heading", { level: 2, name: "managed_services" })).toBeTruthy();
    expect(within(details).queryByRole("heading", { name: "Run overview" })).toBeNull();
  });

  it("shows no candidates before evaluate has written a result", () => {
    render(<RunView run={cutSampleRun(4)} source={sampleRunSource} />);
    const agent = screen.getByRole("complementary", { name: "Agent" });
    expect(within(agent).queryByRole("list", { name: "Candidates" })).toBeNull();
  });

  it("plays the mascot animation of where the run stands", () => {
    const { container, unmount } = render(<RunView run={sampleRun} source={sampleRunSource} />);
    expect(container.querySelector("[data-mascot]")?.getAttribute("data-mascot")).toBe("sunset");
    unmount();
    const waiting = render(<RunView run={cutSampleRun(14)} source={sampleRunSource} />);
    expect(waiting.container.querySelector("[data-mascot]")?.getAttribute("data-mascot")).toBe("float");
  });
});
