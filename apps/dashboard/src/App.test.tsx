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

  it("switches to a future section and back", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    expect(screen.getByRole("heading", { level: 1, name: "Graph" })).toBeTruthy();
    expect(screen.getByText("Not built yet")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.getByRole("heading", { level: 1, name: "Runs" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Runs" })).toBeTruthy();
  });

  it("shows the engine's candidates and the winner's change", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Candidates" }));

    expect(screen.getByRole("heading", { level: 1, name: "Candidates" })).toBeTruthy();
    const list = screen.getByRole("list", { name: "Candidates" });
    expect(list.querySelectorAll("button")).toHaveLength(5);
    expect(screen.queryByText("Not built yet")).toBeNull();

    const detail = screen.getByRole("region", { name: "agent-serverless-db-eu" });
    expect(detail.textContent).toContain("Winner");
    expect(detail.textContent).toContain("Agent");
    expect(detail.textContent).toContain("The change, step by step");
    expect(detail.textContent).toContain("Security remediation");
  });
});
