import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App.tsx";
import { content } from "./content.ts";
import { PROJECT_DELTA_LINES } from "./data/run.ts";
import tokensCss from "./tokens.css?raw";
import { parseColorTokens } from "./tokens.ts";

const accent = parseColorTokens(tokensCss).find((token) => token.name === "accent")!.value;

describe("product page", () => {
  it("opens in Romanian as Infrared", () => {
    render(<App />);
    expect(document.documentElement.lang).toBe("ro");
    expect(document.title).toBe("Infrared");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(content.ro.hero.title);
    expect(screen.getAllByText(content.ro.tagline).length).toBeGreaterThan(0);
  });

  it("shows the sample run as a terminal plan", () => {
    render(<App />);
    const run = screen.getByRole("figure", { name: content.ro.run.label });
    expect(run).toHaveTextContent("sources selected");
    expect(run).toHaveTextContent("current layout");
    expect(run).toHaveTextContent("proposed layout");
    expect(run).toHaveTextContent("cost delta");
    expect(run).toHaveTextContent("availability delta");
    expect(run).toHaveTextContent("implementation steps");
    expect(within(run).getByRole("button", { name: content.ro.run.copy })).toBeInTheDocument();
  });

  it("groups every finding under its criterion", () => {
    render(<App />);
    for (const criterion of ["cost", "availability", "database"] as const) {
      const group = screen.getByRole("group", { name: content.ro.finds.criteria[criterion] });
      const names = within(group).getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
      expect(names).toEqual(content.ro.finds.items.filter((item) => item.criterion === criterion).map((item) => item.name));
    }
  });

  it("lists both plans with their prices", () => {
    render(<App />);
    const section = screen.getByRole("region", { name: content.ro.pricing.title });
    for (const plan of content.ro.pricing.plans) {
      const row = within(section).getByRole("rowheader", { name: new RegExp(`^${plan.name}`) }).closest("tr")!;
      expect(row).toHaveTextContent(plan.price);
      expect(row).toHaveTextContent(plan.unit);
      expect(row).toHaveTextContent(plan.detail);
    }
  });

  it("ends on a command, not an illustration", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: content.ro.footer.prompt })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: content.ro.footer.copy })).toBeInTheDocument();
  });

  it("links project plan rows to the cluster", () => {
    render(<App />);
    const rail = screen.getByRole("heading", { name: "project delta" }).closest("section")!;
    const rows = within(rail).getAllByRole("listitem");
    expect(rows).toHaveLength(PROJECT_DELTA_LINES.length);
    fireEvent.focus(rows[0]);
    expect(rows[0]).toHaveAttribute("aria-current", "true");
  });

  it("switches every section to English", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(content.en.hero.title);
    expect(screen.getByRole("heading", { name: content.en.how.title })).toBeInTheDocument();
    expect(screen.queryByText(content.ro.how.promise)).not.toBeInTheDocument();
  });

  it("shows the four steps in order", () => {
    render(<App />);
    const section = screen.getByRole("region", { name: content.ro.how.title });
    const steps = within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(steps).toEqual(content.ro.how.steps.map((step) => step.title));
  });
});

describe("tokens view", () => {
  it("opens from the footer link and lists every colour with its contrast", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("link", { name: content.ro.footer.tokensLink }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(content.ro.tokens.title);
    expect(screen.getByLabelText(/^--color-accent$/)).toHaveValue(accent);
    expect(screen.getAllByText(/:1$/).length).toBeGreaterThan(0);
  });

  it("applies an edited colour to the page and resets it", async () => {
    window.location.hash = "#/tokens";
    render(<App />);
    fireEvent.change(screen.getByLabelText(/^--color-accent$/), { target: { value: "#123456" } });
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe("#123456");
    await userEvent.click(screen.getByRole("button", { name: content.ro.tokens.reset }));
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(accent);
  });
});
