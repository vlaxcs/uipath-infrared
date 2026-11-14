import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "~/App";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";
import type { RunDetail } from "~/runs/types";

vi.mock("~/onboarding/api", async (original) => ({
  ...(await original<typeof import("~/onboarding/api")>()),
  orchestratorOnboarding: {
    load: () => new Promise(() => {}),
    start: () => new Promise(() => {}),
    loadProfile: () => new Promise(() => {}),
    saveProfile: () => new Promise(() => {}),
    listRuns: () => new Promise(() => {}),
  },
}));

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("the platform frame", () => {
  it("opens on home with Analyze, Previous analysis and the extension, and no sidebar", () => {
    render(<App extensionUrl="https://chromewebstore.google.com/detail/infrared" />);
    expect(screen.getByRole("button", { name: "Infrared home" })).toBeTruthy();
    const analyses = screen.getByRole("navigation", { name: "Analyses" });
    expect(within(analyses).getAllByRole("button").map((button) => button.textContent)).toEqual(["Analyze1x", "Previous analysis"]);
    expect(within(analyses).getByRole("button", { name: "Analyze, costs 1 run" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browser extension" }).getAttribute("href")).toBe(
      "https://chromewebstore.google.com/detail/infrared",
    );
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("opens the extension install guide when it has no URL", () => {
    render(<App extensionUrl={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Browser extension" }));
    expect(screen.getByRole("dialog", { name: "Install the Infrared extension" })).toBeTruthy();
  });

  it("opens a new analysis with a fade, and Back returns home", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze, costs 1 run" }));
    expect(window.location.hash).toBe("#/analyze");
    expect(screen.getByRole("heading", { level: 1, name: "New analysis" }).closest("section")?.className).toContain("animate-panel-in");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Analyses" })).toBeTruthy());
  });

  it("opens Configuration and Account from the account menu", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Configuration" }));
    expect(window.location.hash).toBe("#/configuration");
    expect(screen.getByRole("heading", { level: 1, name: "Configuration" })).toBeTruthy();
    for (const section of ["GitHub organisation", "Cloud access"]) {
      expect(screen.getByRole("heading", { level: 2, name: section })).toBeTruthy();
    }
    expect(screen.getByText("Loading the defaults")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    expect(window.location.hash).toBe("#/account");
    expect(screen.getByRole("heading", { level: 2, name: "Subscription" })).toBeTruthy();
  });

  it("disconnects to the sign-in page, which signs in with GitHub on the orchestrator", () => {
    render(<App orchestratorUrl="http://127.0.0.1:8090" />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    expect(window.location.hash).toBe("#/login");
    expect(screen.getByRole("link", { name: "Sign in with GitHub" }).getAttribute("href")).toBe("http://127.0.0.1:8090/auth/github");
    expect(screen.queryByRole("button", { name: "Account menu" })).toBeNull();
  });

  it("shows the runs left as Nx and the plan beside the avatar", async () => {
    render(<App accountSource={{ load: async () => ({ login: "vlaxcs", avatarUrl: null, credits: 1, plan: "run_pack" }) }} />);
    const balance = await screen.findByRole("img", { name: "1 run left" });
    expect(balance.textContent).toBe("1x");
    expect(screen.getByText("Run pack")).toBeTruthy();
  });

  it("shows no balance when the orchestrator has no account to give", async () => {
    const load = vi.fn(async () => null);
    render(<App accountSource={{ load }} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.queryByRole("img", { name: /runs? left/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
  });

  it("continues with sample data when there is no orchestrator", () => {
    window.location.hash = "#/login";
    render(<App orchestratorUrl={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with sample data" }));
    expect(window.location.hash).toBe("#/");
  });
});

describe("previous analyses", () => {
  it("lists the runs and opens one on its own page", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Previous analysis" }));
    const table = await screen.findByRole("table", { name: "Runs" });
    expect(table.textContent).toContain("demo-shop");

    fireEvent.click(within(table).getByRole("button", { name: /run-demo-shop-0001/ }));
    const summary = await screen.findByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
    expect(window.location.hash).toBe("#/runs/run-demo-shop-0001");

    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(timeline.textContent).toContain("pick_layout");
    expect(timeline.textContent).toContain("approve_plan");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
  });

  it("opens a run directly from the URL, and Back goes to the list", async () => {
    window.location.hash = "#/runs/run-demo-shop-0001";
    render(<App />);
    expect(await screen.findByRole("region", { name: "demo-shop" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
    expect(window.location.hash).toBe("#/runs");
  });

  it("opens a run at its gate", async () => {
    const waiting = { ...cutSampleRun(14), id: "run-approvals-0001" };
    const source: RunSource = {
      ...sampleRunSource,
      mode: "live",
      listRuns: async () => [waiting],
      getRun: async (id: string) => {
        if (id === waiting.id) return waiting as RunDetail;
        throw new Error(`run ${id} not found`);
      },
    };
    window.location.hash = "#/runs/run-approvals-0001/gate";
    render(<App source={source} />);
    expect(await screen.findByRole("heading", { level: 2, name: "Present" })).toBeTruthy();
    expect(screen.getByText("Keep analyses")).toBeTruthy();
  });
});
