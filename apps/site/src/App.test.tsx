import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App.tsx";
import { content } from "./content.ts";
import tokensCss from "./tokens.css?raw";
import { parseColorTokens } from "./tokens.ts";

const accent = parseColorTokens(tokensCss).find((token) => token.name === "accent")!.value;

describe("product page", () => {
  it("opens in Romanian and says it comes from Digi", () => {
    render(<App />);
    expect(document.documentElement.lang).toBe("ro");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(content.ro.hero.title);
    expect(screen.getAllByText("de la Digi").length).toBeGreaterThan(0);
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
