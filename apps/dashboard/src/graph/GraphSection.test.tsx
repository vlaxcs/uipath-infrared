import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GraphSection } from "~/graph/GraphSection";
import { sampleGraphModel } from "~/graph/sampleGraph";

afterEach(cleanup);

function graph() {
  return screen.getByRole("group", { name: "Dependency graph" });
}

function edges() {
  return graph().querySelectorAll("[data-graph-edge]");
}

describe("the dependency graph", () => {
  it("renders the start-up mock's components and edges", () => {
    render(<GraphSection model={sampleGraphModel} />);

    expect(screen.getByRole("heading", { name: "startup" })).toBeTruthy();
    expect(screen.getByText("10 components · 9 dependencies")).toBeTruthy();
    expect(within(graph()).getAllByRole("button")).toHaveLength(10);
    expect(edges()).toHaveLength(9);
    expect(within(graph()).getByRole("button", { name: /logs-volume/ })).toBeTruthy();
    expect(within(graph()).getByRole("button", { name: /old-bastion/ })).toBeTruthy();
    expect(screen.getAllByText("Compute").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Event").length).toBeGreaterThan(0);
  });

  it("shows a selected component's facts and connections", () => {
    render(<GraphSection model={sampleGraphModel} />);
    fireEvent.click(within(graph()).getByRole("button", { name: /app-db/ }));

    const detail = screen.getByRole("heading", { name: "app-db" }).closest("section")!;
    expect(detail.textContent).toContain("postgres");
    expect(detail.textContent).toContain("eu-west-1");
    expect(detail.textContent).toContain("Main application");
    expect(detail.textContent).toContain("Dependents");

    for (const peer of ["web-server", "worker", "old-bastion"]) {
      expect(within(detail).getByRole("button", { name: new RegExp(peer) })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: /Data ← web-server/ }));
    expect(screen.getByRole("heading", { name: "web-server" })).toBeTruthy();
  });

  it("selects with the keyboard and clears with Escape", () => {
    render(<GraphSection model={sampleGraphModel} />);

    const node = within(graph()).getByRole("button", { name: /web-server/ });
    node.focus();
    fireEvent.keyDown(node, { key: "Enter" });
    expect(screen.getByRole("heading", { name: "web-server" })).toBeTruthy();

    fireEvent.keyDown(graph(), { key: "Escape" });
    expect(screen.getByText("Select a component")).toBeTruthy();
  });

  it("filters by connection kind and status", () => {
    render(<GraphSection model={sampleGraphModel} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Event/ }));
    expect(edges()).toHaveLength(7);

    fireEvent.click(screen.getByRole("checkbox", { name: /Orphan/ }));
    expect(within(graph()).getAllByRole("button")).toHaveLength(9);

    fireEvent.click(screen.getByRole("checkbox", { name: /Active/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Idle/ }));
    expect(screen.getByText("No components match these filters.")).toBeTruthy();
  });

  it("dims non-matching nodes for a search", () => {
    render(<GraphSection model={sampleGraphModel} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search components" }), {
      target: { value: "web" },
    });

    expect(within(graph()).getAllByRole("button")).toHaveLength(10);
    expect(
      within(graph()).getByRole("button", { name: /web-server/ }).getAttribute("data-state"),
    ).toBe("normal");
    expect(within(graph()).getByRole("button", { name: /app-db/ }).getAttribute("data-state")).toBe(
      "dim",
    );
    expect(graph().querySelector('[data-edge-key="id:e01"]')?.getAttribute("data-state")).toBe("dim");
  });

  it("toggles the labels without removing nodes", () => {
    render(<GraphSection model={sampleGraphModel} />);

    expect(graph().querySelectorAll("text")).toHaveLength(10);
    fireEvent.click(screen.getByRole("checkbox", { name: "Show labels" }));
    expect(graph().querySelectorAll("text")).toHaveLength(0);
    expect(within(graph()).getAllByRole("button")).toHaveLength(10);
  });

  it("offers the fit and zoom controls", () => {
    render(<GraphSection model={sampleGraphModel} />);

    fireEvent.click(screen.getByRole("button", { name: "Fit view" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(graph()).toBeTruthy();
  });
});
