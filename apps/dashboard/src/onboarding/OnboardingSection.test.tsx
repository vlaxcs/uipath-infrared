import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrchestratorError, type OnboardingSource } from "~/onboarding/api";
import { OnboardingSection } from "~/onboarding/OnboardingSection";
import type { OnboardingSetup } from "~/onboarding/types";

afterEach(cleanup);

const setup: OnboardingSetup = {
  connections: [{ id: "floci", label: "AWS (demo estate)" }],
  providers: ["aws", "managed_pg"],
  onprem: true,
  projects: [
    { id: "startup", description: "A start-up with a poor infrastructure", forbidden_providers: [] },
    { id: "strict", description: "", forbidden_providers: ["managed_pg"] },
  ],
};

function source(overrides: Partial<OnboardingSource> = {}): OnboardingSource {
  return {
    load: vi.fn(async () => setup),
    start: vi.fn(async () => ({ id: "run-startup-0001", project: "startup" })),
    ...overrides,
  };
}

async function shown(fake: OnboardingSource, onFollowRun = vi.fn()) {
  render(<OnboardingSection source={fake} onFollowRun={onFollowRun} />);
  await screen.findByRole("form", { name: "New run" });
}

const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("onboarding", () => {
  it("shows the four sections in order, with the controls in that order", async () => {
    await shown(source());
    const legends = [...document.querySelectorAll("legend")].map((legend) => legend.textContent);
    expect(legends).toEqual(["1. Connect the infrastructure", "2. Pick the project", "3. Where it may move", "4. On-prem"]);
    const controls = [...document.querySelectorAll("input, button")].map((element) => (element as HTMLInputElement).value || element.textContent);
    expect(controls).toEqual(["floci", "startup", "strict", "aws", "managed_pg", "onprem", "Start the run"]);
  });

  it("starts the run with every target ticked and on-prem off by default", async () => {
    const fake = source();
    await shown(fake);
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    await screen.findByRole("heading", { name: "The run started" });
    expect(fake.start).toHaveBeenCalledWith({
      project: "startup",
      onboarding: { connection: "floci", targets: ["aws", "managed_pg"], onprem: { wanted: false } },
    });
    expect(screen.getByText("run-startup-0001")).toBeTruthy();
  });

  it("sends what the owner changed", async () => {
    const fake = source();
    await shown(fake);
    fireEvent.click(box("Managed Postgres"));
    fireEvent.click(box("Also price a setup of our own"));
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    await waitFor(() => expect(fake.start).toHaveBeenCalled());
    expect(fake.start).toHaveBeenCalledWith({
      project: "startup",
      onboarding: { connection: "floci", targets: ["aws"], onprem: { wanted: true } },
    });
  });

  it("keeps the last ticked target ticked", async () => {
    await shown(source());
    fireEvent.click(box("Managed Postgres"));
    expect(box("AWS").disabled).toBe(true);
    expect(box("AWS").checked).toBe(true);
    expect(screen.getByText("At least one target stays ticked")).toBeTruthy();
  });

  it("disables a provider the project forbids", async () => {
    await shown(source());
    fireEvent.click(screen.getByRole("radio", { name: "strict" }));
    expect(box("Managed Postgres").disabled).toBe(true);
    expect(box("Managed Postgres").checked).toBe(false);
    expect(screen.getByText("Forbidden by the project")).toBeTruthy();
  });

  it("hides on-prem when the catalog has no on-prem option", async () => {
    await shown(source({ load: vi.fn(async () => ({ ...setup, onprem: false })) }));
    expect(screen.queryByText("4. On-prem")).toBeNull();
  });

  it("says there are no projects and keeps Start disabled", async () => {
    await shown(source({ load: vi.fn(async () => ({ ...setup, projects: [] })) }));
    expect(screen.getByText(/No projects yet/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers Retry when the platform is unreachable, and recovers", async () => {
    const load = vi
      .fn<OnboardingSource["load"]>()
      .mockRejectedValueOnce(new OrchestratorError("The platform is unreachable."))
      .mockResolvedValueOnce(setup);
    render(<OnboardingSection source={source({ load })} onFollowRun={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("unreachable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("form", { name: "New run" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the answers and shows the reason when the start is refused", async () => {
    const start = vi.fn(async () => Promise.reject(new OrchestratorError("project busy: startup is run-startup-0002")));
    await shown(source({ start }));
    fireEvent.click(box("Managed Postgres"));
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    expect((await screen.findByRole("alert")).textContent).toBe("project busy: startup is run-startup-0002");
    expect(box("Managed Postgres").checked).toBe(false);
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("hands the started run to Runs", async () => {
    const onFollowRun = vi.fn();
    await shown(source(), onFollowRun);
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    fireEvent.click(await screen.findByRole("button", { name: "Follow it in Runs" }));
    expect(onFollowRun).toHaveBeenCalledWith("run-startup-0001");
  });
});
