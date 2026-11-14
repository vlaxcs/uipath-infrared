import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "~/App";

vi.mock("~/onboarding/api", async (original) => ({
  ...(await original<typeof import("~/onboarding/api")>()),
  orchestratorOnboarding: { load: () => new Promise(() => {}), start: () => new Promise(() => {}) },
}));

afterEach(cleanup);

describe("the dashboard shell", () => {
  it("shows the brand and every section", () => {
    render(<App />);
    expect(screen.getByText("Infrared")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["New run", "Runs", "Graph", "Candidates", "Rehearsal", "Approvals"]) {
      expect(nav.textContent).toContain(label);
    }
  });

  it("opens on a new run", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "New run" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading the platform");
  });

  it("lists the sample run and shows its summary when selected", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.getByRole("list", { name: "Runs" }).textContent).toContain("demo-shop");

    fireEvent.click(screen.getByRole("button", { name: /run-demo-shop-0001/ }));

    const summary = screen.getByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
    expect(summary.textContent).toContain("rehearse");
    expect(summary.textContent).toContain("1 / 2");
    expect(summary.textContent).toContain("forecast.json");
    expect(summary.textContent).toContain("catalog.json");
    expect(document.body.textContent).not.toContain("keep_analyses");
  });

  it("switches to a future section and back", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    expect(screen.getByRole("heading", { level: 1, name: "Graph" })).toBeTruthy();
    expect(screen.getByText("Not built yet")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.getByRole("heading", { level: 1, name: "Runs" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Runs" })).toBeTruthy();
  });
});
