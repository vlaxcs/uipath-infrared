import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "~/App";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("the dashboard shell", () => {
  it("shows the brand and every section", async () => {
    render(<App />);
    expect(screen.getByText("Infrared")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["Runs", "Graph", "Candidates", "Rehearsal", "Approvals"]) {
      expect(nav.textContent).toContain(label);
    }
    expect(screen.getByText("Sample data")).toBeTruthy();
    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
  });

  it("opens a run on its own page and returns to the list", async () => {
    render(<App />);
    const table = await screen.findByRole("table", { name: "Runs" });
    expect(table.textContent).toContain("demo-shop");

    fireEvent.click(within(table).getByRole("button", { name: /run-demo-shop-0001/ }));

    const summary = await screen.findByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
    expect(summary.textContent).toContain("rehearse");
    expect(summary.textContent).toContain("1 / 2");
    expect(summary.textContent).toContain("forecast.json");
    expect(summary.textContent).toContain("catalog.json");
    expect(screen.queryByRole("table", { name: "Runs" })).toBeNull();
    expect(window.location.hash).toBe("#/runs/run-demo-shop-0001");

    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(timeline.textContent).toContain("keep_analyses");
    expect(timeline.textContent).toContain("the GPU and orphan findings stand; the ERP one waits for the vendor");
    expect(timeline.textContent).toContain("pick_layout");
    expect(timeline.textContent).toContain("managed_services");
    expect(timeline.textContent).toContain("approve_plan");
    expect(timeline.textContent).toContain("cto (dashboard)");
    expect(timeline.textContent).toContain("cto (slack)");
    expect(timeline.textContent).toContain("result.0.json");
    expect(timeline.textContent).toContain("result.1.json");
    expect(timeline.textContent).toContain("rehearsal.json");
    expect(screen.queryByText("A layout is waiting to be picked")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /All runs/ }));

    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "demo-shop" })).toBeNull();
    expect(window.location.hash).toBe("#/runs");
  });

  it("opens a run directly from the URL", async () => {
    window.location.hash = "#/runs/run-demo-shop-0001";
    render(<App />);

    expect(await screen.findByRole("region", { name: "demo-shop" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Runs" })).toBeNull();
  });

  it("switches to a future section and back", async () => {
    render(<App />);
    await screen.findByRole("table", { name: "Runs" });

    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    expect(screen.getByRole("heading", { level: 1, name: "Graph" })).toBeTruthy();
    expect(screen.getByText("Not built yet")).toBeTruthy();
    expect(window.location.hash).toBe("#/graph");

    fireEvent.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.getByRole("heading", { level: 1, name: "Runs" })).toBeTruthy();
    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
    expect(window.location.hash).toBe("#/runs");
  });
});
