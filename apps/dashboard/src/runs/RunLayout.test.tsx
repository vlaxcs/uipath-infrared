import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { RunView } from "~/runs/RunView";
import { sampleRun } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";

afterEach(cleanup);

describe("the run page layout", () => {
  it("puts the steps in order in the pipeline, and the candidates inside Evaluate", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    const agent = screen.getByRole("complementary", { name: "Agent" });
    const steps = within(agent).getByRole("list", { name: "Steps" });
    const titles = ["Extract", "Investigate", "Propose", "Evaluate", "Present", "Rehearse"];
    const buttons = within(steps).getAllByRole("button");
    expect(buttons).toHaveLength(titles.length + 1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Open the starting configuration of demo-shop");
    buttons.slice(1).forEach((button, index) => expect(button.textContent?.startsWith(titles[index])).toBe(true));
    expect(within(agent).queryByRole("list", { name: "Candidates" })).toBeNull();

    fireEvent.click(within(steps).getByRole("button", { name: /^Evaluate/ }));
    const dialog = screen.getByRole("dialog", { name: "Evaluate" });
    const candidates = await within(dialog).findByRole("list", { name: "Candidates" });
    expect(within(candidates).getByRole("button", { name: /^consolidate/ })).toBeTruthy();
  });

  it("shows a candidate's details and changes when it is picked in Evaluate", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    fireEvent.click(within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name: /^Evaluate/ }));
    const dialog = screen.getByRole("dialog", { name: "Evaluate" });
    const candidates = await within(dialog).findByRole("list", { name: "Candidates" });
    fireEvent.click(within(candidates).getByRole("button", { name: /^managed_services/ }));

    expect(within(dialog).getByRole("heading", { level: 2, name: "managed_services" })).toBeTruthy();
  });

  it("opens the starting configuration from the first node", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    fireEvent.click(screen.getByRole("button", { name: "Open the starting configuration of demo-shop" }));
    const dialog = screen.getByRole("dialog", { name: "Analyze: demo-shop" });
    expect(await within(dialog).findByText("Hard constraints")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Next step: Extract" })).toBeTruthy();
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
