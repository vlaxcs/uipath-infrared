import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "~/App";

afterEach(cleanup);

describe("the dashboard shell", () => {
  it("shows the brand and every section", () => {
    render(<App />);
    expect(screen.getByText("Infrared")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["Runs", "Graph", "Candidates", "Rehearsal", "Approvals"]) {
      expect(nav.textContent).toContain(label);
    }
  });

  it("lists the sample run and shows its summary when selected", () => {
    render(<App />);
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

  it("renders the start-up dependency graph", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));

    expect(screen.getByRole("heading", { level: 1, name: "Graph" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Dependency graph" })).toBeTruthy();
    expect(screen.getByText("10 components · 9 dependencies")).toBeTruthy();
    expect(screen.getByRole("button", { name: /web-server/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /app-db/ })).toBeTruthy();
    expect(screen.queryByText("Not built yet")).toBeNull();
  });

  it("switches to a future section and back", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));
    expect(screen.getByRole("heading", { level: 1, name: "Approvals" })).toBeTruthy();
    expect(screen.getByText("Not built yet")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.getByRole("heading", { level: 1, name: "Runs" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Runs" })).toBeTruthy();
  });

  it("renders the passed rehearsal and the derived fallback", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rehearsal" }));

    expect(screen.getByRole("heading", { level: 1, name: "Rehearsal" })).toBeTruthy();
    expect(screen.queryByText("Not built yet")).toBeNull();

    const verdict = screen.getByRole("region", { name: "Verdict" });
    expect(verdict.textContent).toContain("Passed");
    expect(verdict.textContent).toContain("99.94%");
    expect(verdict.textContent).toContain("99.9%");
    expect(verdict.textContent).toContain("Proceed");

    expect(screen.getByRole("table", { name: "Component health" })).toBeTruthy();

    const fallback = screen.getByRole("region", { name: "The fallback" });
    expect(fallback.textContent).toContain("Held");
    expect(fallback.textContent).toContain(
      "The load balancer routed traffic around the failed instance.",
    );
  });
});
